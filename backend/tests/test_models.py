"""Tests for data models."""

import pytest
from app.models.user import User, UserRole, StudentProfile, AdminProfile
from app.models.conversation import Conversation, Message, MessageRole


# ══════════════════════════════════════════════════════════════════════
# UserRole
# ══════════════════════════════════════════════════════════════════════


class TestUserRole:

    def test_from_str_student(self):
        assert UserRole.from_str("student") == UserRole.STUDENT

    def test_from_str_admin(self):
        assert UserRole.from_str("admin") == UserRole.ADMIN

    def test_from_str_default(self):
        assert UserRole.from_str("unknown") == UserRole.STUDENT

    def test_is_valid(self):
        assert UserRole.is_valid("student")
        assert UserRole.is_valid("admin")
        assert not UserRole.is_valid("hacker")


# ══════════════════════════════════════════════════════════════════════
# User
# ══════════════════════════════════════════════════════════════════════


class TestUser:

    def test_defaults(self):
        u = User(id="123", email="a@b.c")
        assert u.role == UserRole.STUDENT
        assert u.is_active is True
        assert u.is_student is True
        assert u.is_admin is False

    def test_admin_role(self):
        u = User(id="1", email="a@b.c", role=UserRole.ADMIN)
        assert u.is_admin is True
        assert u.is_student is False

    def test_to_dict(self):
        u = User(id="1", email="a@b.c", full_name="Ali")
        d = u.to_dict()
        assert d["id"] == "1"
        assert d["email"] == "a@b.c"
        assert d["full_name"] == "Ali"
        assert d["role"] == "student"

    def test_to_dict_with_profile(self):
        p = StudentProfile(user_id="1", student_id="S1", department="CS")
        u = User(id="1", email="a@b.c", profile=p)
        d = u.to_dict()
        assert d["profile"]["student_id"] == "S1"

    def test_from_db_row(self):
        row = {
            "id": "1",
            "email": "a@b.c",
            "full_name": "Ali",
            "role": "student",
            "is_active": True,
        }
        profile = {"student_id": "S1", "department": "CS", "level": "L3"}
        u = User.from_db_row(row, profile)
        assert u.email == "a@b.c"
        assert isinstance(u.profile, StudentProfile)


# ══════════════════════════════════════════════════════════════════════
# StudentProfile / AdminProfile
# ══════════════════════════════════════════════════════════════════════


class TestProfiles:

    def test_student_to_dict(self):
        p = StudentProfile(user_id="1", student_id="S1", department="CS", level="L3")
        d = p.to_dict()
        assert d["student_id"] == "S1"
        assert d["department"] == "CS"

    def test_admin_to_dict(self):
        p = AdminProfile(user_id="1", title="Head")
        d = p.to_dict()
        assert d["title"] == "Head"


# ══════════════════════════════════════════════════════════════════════
# MessageRole
# ══════════════════════════════════════════════════════════════════════


class TestMessageRole:

    def test_values(self):
        assert MessageRole.USER.value == "user"
        assert MessageRole.ASSISTANT.value == "assistant"
        assert MessageRole.SYSTEM.value == "system"


# ══════════════════════════════════════════════════════════════════════
# Message
# ══════════════════════════════════════════════════════════════════════


class TestMessage:

    def test_to_dict(self):
        m = Message(id="m1", conversation_id="c1", role=MessageRole.USER, content="Hi")
        d = m.to_dict()
        assert d["role"] == "user"
        assert d["content"] == "Hi"

    def test_to_chat_format(self):
        m = Message(id="m1", conversation_id="c1", role=MessageRole.USER, content="Hi")
        cf = m.to_chat_format()
        assert cf == {"role": "user", "content": "Hi"}

    def test_from_dict(self):
        data = {
            "id": "m1",
            "conversation_id": "c1",
            "role": "assistant",
            "content": "Hello",
            "sources": [{"title": "Doc"}],
            "language": "English",
            "created_at": "2024-01-01",
        }
        m = Message.from_dict(data)
        assert m.role == MessageRole.ASSISTANT
        assert m.sources == [{"title": "Doc"}]


# ══════════════════════════════════════════════════════════════════════
# Conversation
# ══════════════════════════════════════════════════════════════════════


class TestConversation:

    def test_defaults(self):
        c = Conversation(id="c1", user_id="u1", title="T")
        assert c.is_active is True
        assert c.messages == []

    def test_to_dict_without_messages(self):
        c = Conversation(id="c1", user_id="u1", title="T")
        d = c.to_dict(include_messages=False)
        assert "messages" not in d

    def test_to_dict_with_messages(self):
        m = Message(id="m1", conversation_id="c1", role=MessageRole.USER, content="Hi")
        c = Conversation(id="c1", user_id="u1", title="T", messages=[m])
        d = c.to_dict(include_messages=True)
        assert len(d["messages"]) == 1

    def test_get_chat_history(self):
        msgs = [
            Message(id=str(i), conversation_id="c1", role=MessageRole.USER, content=f"Q{i}")
            for i in range(15)
        ]
        c = Conversation(id="c1", user_id="u1", title="T", messages=msgs)
        history = c.get_chat_history(max_turns=5)
        assert len(history) == 5

    def test_from_dict(self):
        row = {"id": "c1", "user_id": "u1", "title": "T", "is_active": True}
        msgs = [
            {"id": "m1", "conversation_id": "c1", "role": "user", "content": "Hi"},
        ]
        c = Conversation.from_dict(row, msgs)
        assert c.id == "c1"
        assert len(c.messages) == 1
