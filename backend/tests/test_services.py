"""Tests for the service layer."""

import pytest
from unittest.mock import Mock, MagicMock, patch

from app.services.document_service import DocumentService, DocumentFilter
from app.services.query_service import QueryService
from app.services.email_service import EmailService, GenerateEmailDTO, SaveEmailDTO
from app.services.auth_service import AuthService, RegisterDTO, LoginDTO
from app.services.conversation_service import ConversationService
from app.exceptions import ValidationError, UnauthorizedError, NotFoundError


# ══════════════════════════════════════════════════════════════════════
# DocumentService
# ══════════════════════════════════════════════════════════════════════


class TestDocumentService:

    @pytest.fixture
    def mock_sb(self):
        m = MagicMock()
        m.table.return_value = m
        m.select.return_value = m
        m.insert.return_value = m
        m.delete.return_value = m
        m.eq.return_value = m
        m.single.return_value = m
        m.execute.return_value = Mock(data=[])
        return m

    @pytest.fixture
    def mock_emb(self):
        m = Mock()
        m.embed_text.return_value = [0.1] * 768
        return m

    @pytest.fixture
    def svc(self, mock_sb, mock_emb):
        return DocumentService(mock_sb, mock_emb)

    def test_get_all_empty(self, svc, mock_sb):
        assert svc.get_all() == []

    def test_get_all_with_data(self, svc, mock_sb):
        mock_sb.execute.return_value = Mock(data=[
            {"id": 1, "title": "A", "type": "t"},
            {"id": 2, "title": "B", "type": "t"},
        ])
        docs = svc.get_all()
        assert len(docs) == 2

    def test_get_all_with_filter(self, svc, mock_sb):
        f = DocumentFilter(doc_type="policy", limit=10)
        mock_sb.execute.return_value = Mock(data=[{"id": 1}])
        docs = svc.get_all(f)
        assert len(docs) == 1

    def test_get_by_id_found(self, svc, mock_sb):
        mock_sb.execute.return_value = Mock(data={"id": 1, "title": "T"})
        doc = svc.get_by_id(1)
        assert doc["id"] == 1

    def test_get_by_id_not_found(self, svc, mock_sb):
        mock_sb.execute.side_effect = Exception("nope")
        assert svc.get_by_id(999) is None

    def test_create(self, svc, mock_sb, mock_emb):
        mock_sb.execute.return_value = Mock(data=[{"id": 1, "title": "New"}])
        doc = svc.create("New", "Content", "test")
        assert doc["title"] == "New"
        mock_emb.embed_text.assert_called_once()

    def test_delete_success(self, svc, mock_sb):
        assert svc.delete(1) is True

    def test_delete_failure(self, svc, mock_sb):
        mock_sb.execute.side_effect = Exception("fail")
        assert svc.delete(1) is False


# ══════════════════════════════════════════════════════════════════════
# QueryService
# ══════════════════════════════════════════════════════════════════════


class TestQueryService:

    @pytest.fixture
    def mock_engine(self):
        from app.core.rag.engine import QueryResult
        m = Mock()
        m.query.return_value = QueryResult(
            question="Q", answer="A", sources=[], language="English", has_answer=True,
        )
        return m

    @pytest.fixture
    def svc(self, mock_engine):
        return QueryService(mock_engine)

    def test_answer_success(self, svc, mock_engine):
        r = svc.answer_question("What?")
        assert r["success"] is True
        assert "answer" in r

    def test_answer_empty_question(self, svc):
        r = svc.answer_question("")
        assert r["success"] is False

    def test_valid_history(self, svc):
        h = [{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello"}]
        assert svc.validate_conversation_history(h) is True

    def test_invalid_history_missing_content(self, svc):
        assert svc.validate_conversation_history([{"role": "user"}]) is False

    def test_invalid_history_bad_role(self, svc):
        assert svc.validate_conversation_history([{"role": "x", "content": "y"}]) is False


# ══════════════════════════════════════════════════════════════════════
# EmailService (DTO validation only — no live API)
# ══════════════════════════════════════════════════════════════════════


class TestEmailDTOs:

    def test_generate_dto_valid(self):
        dto = GenerateEmailDTO(
            email_type="attestation",
            student_name="Ali",
            student_id="21INF001",
        )
        assert dto.student_name == "Ali"

    def test_generate_dto_missing_name(self):
        with pytest.raises(ValidationError):
            GenerateEmailDTO(email_type="custom", student_name="", student_id="123")

    def test_generate_dto_missing_id(self):
        with pytest.raises(ValidationError):
            GenerateEmailDTO(email_type="custom", student_name="Ali", student_id="")

    def test_generate_dto_unknown_type_falls_back(self):
        dto = GenerateEmailDTO(email_type="unknown", student_name="A", student_id="1")
        assert dto.email_type == "custom"

    def test_save_dto_valid(self):
        dto = SaveEmailDTO(subject="S", body="B")
        assert dto.subject == "S"

    def test_save_dto_missing_subject(self):
        with pytest.raises(ValidationError):
            SaveEmailDTO(subject="", body="B")

    def test_save_dto_missing_body(self):
        with pytest.raises(ValidationError):
            SaveEmailDTO(subject="S", body="")


# ══════════════════════════════════════════════════════════════════════
# AuthService (DTO validation only)
# ══════════════════════════════════════════════════════════════════════


class TestAuthDTOs:

    def test_register_dto_valid(self):
        dto = RegisterDTO(email="a@b.c", password="123456", student_id="S1")
        dto.validate()  # should not raise

    def test_register_dto_short_password(self):
        dto = RegisterDTO(email="a@b.c", password="12", student_id="S1")
        with pytest.raises(ValidationError):
            dto.validate()

    def test_register_dto_missing_email(self):
        dto = RegisterDTO(email="", password="123456", student_id="S1")
        with pytest.raises(ValidationError):
            dto.validate()

    def test_register_dto_student_needs_id(self):
        dto = RegisterDTO(email="a@b.c", password="123456", role="student", student_id="")
        with pytest.raises(ValidationError):
            dto.validate()

    def test_login_dto_valid(self):
        dto = LoginDTO(email="a@b.c", password="pass")
        dto.validate()

    def test_login_dto_missing(self):
        dto = LoginDTO(email="", password="")
        with pytest.raises(ValidationError):
            dto.validate()


# ══════════════════════════════════════════════════════════════════════
# ConversationService (unit, mocked Supabase)
# ══════════════════════════════════════════════════════════════════════


class TestConversationService:

    @pytest.fixture
    def mock_sb(self):
        m = MagicMock()
        m.table.return_value = m
        m.select.return_value = m
        m.insert.return_value = m
        m.update.return_value = m
        m.delete.return_value = m
        m.eq.return_value = m
        m.order.return_value = m
        m.range.return_value = m
        m.maybe_single.return_value = m
        m.execute.return_value = Mock(data=[], count=0)
        return m

    @pytest.fixture
    def svc(self, mock_sb):
        return ConversationService(mock_sb)

    def test_list_empty(self, svc, mock_sb):
        mock_sb.execute.return_value = Mock(data=[], count=0)
        result = svc.list_conversations("user-1")
        assert result == []

    def test_create_conversation(self, svc, mock_sb):
        mock_sb.execute.return_value = Mock(data=[{
            "id": "conv-1", "user_id": "u1", "title": "Hello",
            "is_active": True, "created_at": "2024-01-01", "updated_at": "2024-01-01",
        }])
        conv = svc.create_conversation("u1", title="Hello")
        assert conv.id == "conv-1"
        assert conv.title == "Hello"

    def test_delete_not_found(self, svc, mock_sb):
        mock_sb.execute.return_value = Mock(data=[])
        with pytest.raises(NotFoundError):
            svc.delete_conversation("missing", "u1")

    def test_rename_empty_title(self, svc):
        with pytest.raises(ValidationError):
            svc.rename_conversation("conv-1", "u1", "")

    def test_quick_ask_empty(self, svc):
        with pytest.raises(ValidationError):
            svc.quick_ask("")

    @patch("app.services.conversation_service.answer_question")
    def test_quick_ask_success(self, mock_aq, svc):
        mock_aq.return_value = {
            "question": "Hi", "answer": "Hello", "sources": [],
            "has_answer": True, "language": "English",
        }
        result = svc.quick_ask("Hi")
        assert result["success"] is True
        assert result["answer"] == "Hello"
