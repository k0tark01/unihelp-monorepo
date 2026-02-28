"""
Conversation service — manages chat sessions and integrates RAG.

Responsibilities:
  - Create / list / delete conversations
  - Send messages within a conversation (RAG-powered)
  - Manage conversation history for context window
"""

from __future__ import annotations

import logging
from typing import Optional, Dict, Any, List

from app.models.conversation import Conversation, Message, MessageRole
from app.utils.rag import answer_question, detect_language
from app.exceptions import ValidationError, NotFoundError, RAGError

logger = logging.getLogger(__name__)

# Maximum messages to keep in history when sending to LLM
MAX_HISTORY_TURNS = 10


class ConversationService:
    """
    Stateless service for conversations.

    All persistence goes through the Supabase client.
    """

    def __init__(self, supabase_client):
        self._sb = supabase_client

    # ── List conversations ───────────────────────────────────────────

    def list_conversations(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Return conversations for a user, newest first."""
        resp = (
            self._sb.table("conversations")
            .select("id, user_id, title, is_active, created_at, updated_at")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .order("updated_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        rows = resp.data or []

        # Attach message count per conversation
        result = []
        for row in rows:
            count_resp = (
                self._sb.table("messages")
                .select("id", count="exact")
                .eq("conversation_id", row["id"])
                .execute()
            )
            row["message_count"] = count_resp.count or 0
            result.append(row)

        return result

    # ── Get single conversation with messages ────────────────────────

    def get_conversation(self, conversation_id: str, user_id: str) -> Conversation:
        """
        Fetch a conversation + all its messages.

        Raises:
            NotFoundError – conversation does not exist or doesn't belong to user
        """
        conv_resp = (
            self._sb.table("conversations")
            .select("*")
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not conv_resp.data:
            raise NotFoundError("Conversation not found")

        msg_resp = (
            self._sb.table("messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .execute()
        )
        messages_data = msg_resp.data or []

        return Conversation.from_dict(conv_resp.data, messages_data)

    # ── Create conversation ──────────────────────────────────────────

    def create_conversation(
        self,
        user_id: str,
        title: Optional[str] = None,
    ) -> Conversation:
        """Create a new empty conversation."""
        resp = (
            self._sb.table("conversations")
            .insert({
                "user_id": user_id,
                "title": title or "New conversation",
                "is_active": True,
            })
            .execute()
        )
        if not resp.data:
            raise RAGError("Failed to create conversation")
        return Conversation.from_dict(resp.data[0])

    # ── Delete (soft) conversation ───────────────────────────────────

    def delete_conversation(self, conversation_id: str, user_id: str) -> None:
        """Soft-delete a conversation (set is_active = false)."""
        resp = (
            self._sb.table("conversations")
            .update({"is_active": False})
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not resp.data:
            raise NotFoundError("Conversation not found")

    # ── Rename conversation ──────────────────────────────────────────

    def rename_conversation(
        self,
        conversation_id: str,
        user_id: str,
        title: str,
    ) -> Dict[str, Any]:
        """Rename a conversation."""
        if not title or not title.strip():
            raise ValidationError("title is required")

        resp = (
            self._sb.table("conversations")
            .update({"title": title.strip()})
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not resp.data:
            raise NotFoundError("Conversation not found")
        return resp.data[0]

    # ── Send message (RAG-powered) ───────────────────────────────────

    def send_message(
        self,
        conversation_id: str,
        user_id: str,
        content: str,
        top_k: int = 8,
    ) -> Dict[str, Any]:
        """
        Send a user message and get a RAG-powered assistant reply.

        Steps:
        1. Validate the conversation belongs to user
        2. Save user message
        3. Fetch conversation history
        4. Call RAG pipeline with history context
        5. Save assistant message
        6. Auto-title conversation if first message
        7. Return assistant response

        Returns:
            {
                "user_message":      {...},
                "assistant_message": {...},
                "sources":           [...],
                "language":          str,
                "has_answer":        bool,
            }
        """
        if not content or not content.strip():
            raise ValidationError("Message content is required")

        content = content.strip()

        # 1. Verify conversation ownership
        conv_resp = (
            self._sb.table("conversations")
            .select("id, user_id, title")
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .eq("is_active", True)
            .maybe_single()
            .execute()
        )
        if not conv_resp.data:
            raise NotFoundError("Conversation not found")

        # 2. Save user message
        user_msg_resp = (
            self._sb.table("messages")
            .insert({
                "conversation_id": conversation_id,
                "role": "user",
                "content": content,
            })
            .execute()
        )
        user_msg = Message.from_dict(user_msg_resp.data[0]) if user_msg_resp.data else None

        # 3. Fetch recent history for context
        history_resp = (
            self._sb.table("messages")
            .select("role, content")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .execute()
        )
        history_rows = history_resp.data or []

        # Build history excluding the just-added user message (it's the question)
        history = []
        for row in history_rows[:-1]:  # exclude last (current question)
            if row.get("role") in ("user", "assistant") and row.get("content"):
                history.append({
                    "role": row["role"],
                    "content": row["content"],
                })
        history = history[-(MAX_HISTORY_TURNS * 2):]  # limit context window

        # 4. Call RAG pipeline
        try:
            rag_result = answer_question(
                question=content,
                history=history if history else None,
                top_k=top_k,
            )
        except Exception as exc:
            logger.exception("RAG pipeline failed")
            rag_result = {
                "answer": "I'm sorry, I encountered an error processing your question. Please try again.",
                "sources": [],
                "has_answer": False,
                "language": detect_language(content),
            }

        # 5. Save assistant message
        assistant_content = rag_result.get("answer", "")
        sources = rag_result.get("sources", [])
        language = rag_result.get("language", "English")

        asst_msg_resp = (
            self._sb.table("messages")
            .insert({
                "conversation_id": conversation_id,
                "role": "assistant",
                "content": assistant_content,
                "sources": sources if sources else None,
                "language": language,
            })
            .execute()
        )
        asst_msg = Message.from_dict(asst_msg_resp.data[0]) if asst_msg_resp.data else None

        # 6. Auto-title the conversation if it's the first message
        if conv_resp.data.get("title") in (None, "", "New conversation"):
            auto_title = content[:60] + ("..." if len(content) > 60 else "")
            self._sb.table("conversations").update(
                {"title": auto_title}
            ).eq("id", conversation_id).execute()

        # 7. Touch updated_at
        self._sb.table("conversations").update(
            {"updated_at": "now()"}
        ).eq("id", conversation_id).execute()

        return {
            "user_message": user_msg.to_dict() if user_msg else {"role": "user", "content": content},
            "assistant_message": asst_msg.to_dict() if asst_msg else {"role": "assistant", "content": assistant_content},
            "sources": sources,
            "language": language,
            "has_answer": rag_result.get("has_answer", False),
        }

    # ── Quick ask (no conversation persistence) ─────────────────────

    def quick_ask(
        self,
        question: str,
        history: Optional[List[Dict]] = None,
        top_k: int = 8,
    ) -> Dict[str, Any]:
        """
        Answer a question without saving to a conversation.
        Useful for one-off queries.
        """
        if not question or not question.strip():
            raise ValidationError("question is required")

        result = answer_question(
            question=question.strip(),
            history=history,
            top_k=top_k,
        )
        return {
            "success": True,
            **result,
        }
