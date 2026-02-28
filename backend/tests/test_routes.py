"""Tests for API routes."""

import json
import pytest
from unittest.mock import Mock, patch, MagicMock


# ══════════════════════════════════════════════════════════════════════
# Health
# ══════════════════════════════════════════════════════════════════════


class TestHealthRoutes:

    def test_root(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["status"] == "healthy"

    def test_api_health(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert "version" in data


# ══════════════════════════════════════════════════════════════════════
# AI routes
# ══════════════════════════════════════════════════════════════════════


class TestAIRoutes:

    def test_query_without_question(self, client, auth_headers):
        resp = client.post("/api/ai/query", json={}, headers=auth_headers)
        assert resp.status_code == 400
        data = json.loads(resp.data)
        assert data["success"] is False

    @patch("app.routes.ai.get_query_service")
    def test_query_success(self, mock_get, client, auth_headers, sample_query):
        mock_svc = Mock()
        mock_svc.answer_question.return_value = {
            "success": True,
            "question": sample_query["question"],
            "answer": "Answer",
            "sources": [],
            "language": "English",
            "has_answer": True,
        }
        mock_svc.validate_conversation_history.return_value = True
        mock_get.return_value = mock_svc

        resp = client.post("/api/ai/query", json=sample_query, headers=auth_headers)
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["success"] is True
        assert "answer" in data

    @patch("app.routes.ai.get_query_service")
    def test_query_invalid_top_k(self, mock_get, client, auth_headers):
        resp = client.post(
            "/api/ai/query",
            json={"question": "Test?", "top_k": 100},
            headers=auth_headers,
        )
        assert resp.status_code == 400


# ══════════════════════════════════════════════════════════════════════
# Document routes
# ══════════════════════════════════════════════════════════════════════


class TestDocumentRoutes:

    @patch("app.routes.documents.get_document_service")
    def test_get_all(self, mock_get, client, auth_headers):
        mock_svc = Mock()
        mock_svc.get_all.return_value = [{"id": 1}, {"id": 2}]
        mock_get.return_value = mock_svc

        resp = client.get("/api/documents/", headers=auth_headers)
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["success"] is True
        assert len(data["data"]) == 2

    @patch("app.routes.documents.get_document_service")
    def test_get_by_id(self, mock_get, client, auth_headers):
        mock_svc = Mock()
        mock_svc.get_by_id.return_value = {"id": 1, "title": "T"}
        mock_get.return_value = mock_svc

        resp = client.get("/api/documents/1", headers=auth_headers)
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["data"]["id"] == 1

    @patch("app.routes.documents.get_document_service")
    def test_get_by_id_404(self, mock_get, client, auth_headers):
        mock_svc = Mock()
        mock_svc.get_by_id.return_value = None
        mock_get.return_value = mock_svc

        resp = client.get("/api/documents/999", headers=auth_headers)
        assert resp.status_code == 404

    @patch("app.routes.documents.get_document_service")
    def test_create_document(self, mock_get, client, auth_headers, sample_document):
        mock_svc = Mock()
        mock_svc.create.return_value = {"id": 1, **sample_document}
        mock_get.return_value = mock_svc

        resp = client.post("/api/documents/", json=sample_document, headers=auth_headers)
        assert resp.status_code == 201

    def test_create_document_missing_fields(self, client, auth_headers):
        resp = client.post("/api/documents/", json={"title": "Only"}, headers=auth_headers)
        assert resp.status_code == 400


# ══════════════════════════════════════════════════════════════════════
# Email routes
# ══════════════════════════════════════════════════════════════════════


class TestEmailRoutes:

    @patch("app.routes.emails._svc")
    def test_get_all_emails(self, mock_svc_fn, client, auth_headers):
        mock_svc = Mock()
        mock_svc.list_emails.return_value = [{"id": 1}]
        mock_svc_fn.return_value = mock_svc

        resp = client.get("/api/emails/", headers=auth_headers)
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["success"] is True

    @patch("app.routes.emails._svc")
    def test_get_types(self, mock_svc_fn, client, auth_headers):
        mock_svc = Mock()
        mock_svc.get_email_types.return_value = {"attestation": "desc"}
        mock_svc_fn.return_value = mock_svc

        resp = client.get("/api/emails/types", headers=auth_headers)
        assert resp.status_code == 200

    def test_generate_missing_fields(self, client, auth_headers):
        resp = client.post(
            "/api/emails/generate",
            json={"email_type": "attestation"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_save_email_missing_subject(self, client, auth_headers):
        resp = client.post(
            "/api/emails/",
            json={"body": "B"},
            headers=auth_headers,
        )
        assert resp.status_code == 400


# ══════════════════════════════════════════════════════════════════════
# Conversation routes
# ══════════════════════════════════════════════════════════════════════


class TestConversationRoutes:

    @patch("app.routes.conversations._get_service")
    def test_list_conversations(self, mock_get, client, auth_headers):
        mock_svc = Mock()
        mock_svc.list_conversations.return_value = []
        mock_get.return_value = mock_svc

        resp = client.get("/api/conversations/", headers=auth_headers)
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["success"] is True

    @patch("app.routes.conversations._get_service")
    def test_create_conversation(self, mock_get, client, auth_headers):
        from app.models.conversation import Conversation
        mock_svc = Mock()
        conv = Conversation(id="c1", user_id="u1", title="T")
        mock_svc.create_conversation.return_value = conv
        mock_get.return_value = mock_svc

        resp = client.post(
            "/api/conversations/",
            json={"title": "T"},
            headers=auth_headers,
        )
        assert resp.status_code == 201

    def test_send_message_missing_content(self, client, auth_headers):
        resp = client.post(
            "/api/conversations/abc/messages",
            json={},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_quick_ask_missing_question(self, client, auth_headers):
        resp = client.post(
            "/api/conversations/quick",
            json={},
            headers=auth_headers,
        )
        assert resp.status_code == 400
