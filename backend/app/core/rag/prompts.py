"""
Advanced RAG Prompt Engineering for document-grounded QA.

Features:
  - Strict document grounding (no hallucination)
  - Multi-pass reasoning: identify → extract → synthesise → cite
  - Multilingual (French, Arabic, English)
  - Conversation-aware context injection
  - Chain-of-thought formatting
"""
from __future__ import annotations

from typing import List, Dict, Optional
from dataclasses import dataclass, field


@dataclass
class RAGContext:
    """Context for RAG prompt generation."""
    query: str
    documents: List[Dict]
    conversation_history: Optional[List[Dict]] = None
    language: str = "English"


class PromptEngine:
    """Generates production-grade prompts for the RAG system."""

    # ── System prompt ────────────────────────────────────────────────

    SYSTEM_PROMPT = (
        "You are **UniHelp**, the official AI assistant for the university.\n"
        "Your sole knowledge source is the DOCUMENT CONTEXT provided below.\n\n"
        "## Core Rules\n"
        "1. **Ground every claim** in the provided documents. Cite the document title in brackets, e.g. [Règlement intérieur].\n"
        "2. If the documents **do not contain** the answer, reply:\n"
        '   "I could not find this information in the available documents. '
        'Please contact the administration for clarification."\n'
        "3. **Never fabricate** information, statistics, dates, or procedures.\n"
        "4. **Respond in the same language** as the user's question.\n"
        "5. Structure long answers with bullet points or numbered steps.\n"
        "6. Bold **key terms** and important values.\n"
        "7. When multiple documents are relevant, synthesise them into a coherent answer and cite each.\n"
        "8. If the question is ambiguous, state your interpretation before answering.\n\n"
        "## Reasoning Process (internal, do NOT show these steps to the user)\n"
        "- Step 1: Identify which documents are relevant to the question.\n"
        "- Step 2: Extract the specific passages that answer the question.\n"
        "- Step 3: Synthesise a clear, complete answer from those passages.\n"
        "- Step 4: Verify every fact is supported by a cited document.\n"
        "- Step 5: Format the answer clearly in the user's language.\n"
    )

    # ── Language-specific instructions ────────────────────────────────

    LANGUAGE_INSTRUCTIONS = {
        "French": (
            "Répondez en **français** de manière claire et professionnelle. "
            "Utilisez un registre formel adapté au contexte universitaire. "
            "Citez les documents entre crochets [Titre du document]."
        ),
        "Arabic": (
            "أجب باللغة **العربية** بشكل واضح ومهني. "
            "استخدم أسلوبًا رسميًا مناسبًا للسياق الجامعي. "
            "اذكر المستندات بين أقواس [عنوان المستند]."
        ),
        "English": (
            "Answer in **English** clearly and professionally. "
            "Use a formal register appropriate for a university context. "
            "Cite documents in brackets [Document Title]."
        ),
    }

    # ── No-answer responses ──────────────────────────────────────────

    NO_ANSWER = {
        "French": (
            "Je n'ai pas trouvé cette information dans les documents disponibles. "
            "Veuillez contacter l'administration pour plus de précisions."
        ),
        "Arabic": (
            "لم أجد هذه المعلومات في المستندات المتاحة. "
            "يرجى التواصل مع الإدارة للحصول على مزيد من التوضيحات."
        ),
        "English": (
            "I could not find this information in the available documents. "
            "Please contact the administration for clarification."
        ),
    }

    # ── Prompt builders ──────────────────────────────────────────────

    def build_rag_prompt(self, context: RAGContext) -> str:
        """
        Build a single-turn RAG prompt with document context.

        The system prompt is sent separately; this returns only the user turn.
        """
        context_section = self._build_context_section(context.documents)
        lang_instruction = self.LANGUAGE_INSTRUCTIONS.get(
            context.language, self.LANGUAGE_INSTRUCTIONS["English"]
        )

        conversation_section = ""
        if context.conversation_history:
            conversation_section = self._build_conversation_section(context.conversation_history)

        prompt = (
            f"{context_section}"
            f"{conversation_section}"
            f"\n## Question\n"
            f"{context.query}\n\n"
            f"## Instructions\n"
            f"- Answer the question using ONLY the documents above.\n"
            f"- Cite the document title in [brackets] for every fact.\n"
            f"- If no document answers the question, say so clearly.\n"
            f"- {lang_instruction}\n\n"
            f"## Answer\n"
        )
        return prompt

    def build_conversational_prompt(self, context: RAGContext) -> List[Dict[str, str]]:
        """
        Build a multi-turn conversational prompt with history.

        Returns a list of messages in chat format including:
        - System message (rules + document context)
        - Previous conversation turns
        - Current user query
        """
        messages: List[Dict[str, str]] = []

        # System: rules + document context
        system_content = (
            self.SYSTEM_PROMPT + "\n\n"
            + self._build_context_section(context.documents)
        )
        messages.append({"role": "system", "content": system_content})

        # Inject conversation history (last 10 turns)
        if context.conversation_history:
            for msg in context.conversation_history[-10:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})

        # Current query
        lang_instruction = self.LANGUAGE_INSTRUCTIONS.get(
            context.language, self.LANGUAGE_INSTRUCTIONS["English"]
        )
        messages.append({
            "role": "user",
            "content": (
                f"{context.query}\n\n"
                f"Remember: {lang_instruction}"
            ),
        })

        return messages

    # ── Private helpers ──────────────────────────────────────────────

    def _build_context_section(self, documents: List[Dict]) -> str:
        """Build document context section with relevance scores."""
        if not documents:
            return "## Document Context\n_No relevant documents found._\n\n"

        parts = ["## Document Context\n"]
        for i, doc in enumerate(documents, 1):
            title = doc.get("title", "Untitled")
            content = doc.get("content", "")
            doc_type = doc.get("type", "document")
            similarity = doc.get("similarity", 0.0)

            parts.append(
                f"### [{i}] {title}  _(type: {doc_type}, relevance: {similarity:.0%})_\n"
                f"{content}\n"
            )
        parts.append("---\n")
        return "\n".join(parts)

    def _build_conversation_section(self, history: List[Dict]) -> str:
        """Build previous conversation section."""
        if not history:
            return ""

        parts = ["\n## Previous Conversation\n"]
        for msg in history[-6:]:
            role = msg.get("role", "user").upper()
            content = msg.get("content", "")
            parts.append(f"**{role}:** {content}\n")
        parts.append("---\n")
        return "\n".join(parts)
