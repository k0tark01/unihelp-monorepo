"""
Conversation and Message models.

Conversations are stored in Supabase tables.
Each conversation belongs to a user and contains an ordered list of messages.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List


class MessageRole(str, Enum):
    """Roles for conversation messages."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


@dataclass
class Message:
    """Single message within a conversation."""
    role: MessageRole
    content: str
    id: Optional[str] = None
    conversation_id: Optional[str] = None
    sources: Optional[List[Dict]] = None  # RAG sources if applicable
    language: Optional[str] = None
    created_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "role": self.role.value if isinstance(self.role, MessageRole) else self.role,
            "content": self.content,
        }
        if self.id:
            data["id"] = self.id
        if self.sources:
            data["sources"] = self.sources
        if self.language:
            data["language"] = self.language
        if self.created_at:
            data["created_at"] = self.created_at
        return data

    def to_chat_format(self) -> Dict[str, str]:
        """Minimal dict for LLM chat history."""
        return {
            "role": self.role.value if isinstance(self.role, MessageRole) else self.role,
            "content": self.content,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Message":
        return cls(
            id=data.get("id"),
            conversation_id=data.get("conversation_id"),
            role=MessageRole(data.get("role", "user")),
            content=data.get("content", ""),
            sources=data.get("sources"),
            language=data.get("language"),
            created_at=data.get("created_at"),
        )


@dataclass
class Conversation:
    """A conversation (chat session) belonging to a user."""
    id: Optional[str] = None
    user_id: Optional[str] = None
    title: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    messages: List[Message] = field(default_factory=list)

    def to_dict(self, include_messages: bool = False) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title or "New conversation",
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "message_count": len(self.messages),
        }
        if include_messages:
            data["messages"] = [m.to_dict() for m in self.messages]
        return data

    def get_chat_history(self, max_turns: int = 10) -> List[Dict[str, str]]:
        """
        Return the last ``max_turns`` user/assistant messages
        in the format expected by the LLM (``[{"role": ..., "content": ...}]``).
        """
        relevant = [
            m for m in self.messages
            if m.role in (MessageRole.USER, MessageRole.ASSISTANT)
        ]
        return [m.to_chat_format() for m in relevant[-max_turns:]]

    @classmethod
    def from_dict(cls, data: Dict[str, Any], messages: Optional[List[Dict]] = None) -> "Conversation":
        conv = cls(
            id=data.get("id"),
            user_id=data.get("user_id"),
            title=data.get("title"),
            is_active=data.get("is_active", True),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )
        if messages:
            conv.messages = [Message.from_dict(m) for m in messages]
        return conv
