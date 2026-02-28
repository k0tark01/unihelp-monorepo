"""Test configuration and shared fixtures."""

import os
import pytest
from unittest.mock import Mock, MagicMock, patch

from app import create_app
from app.container import Container
from app.config import Config


# ── Test config ──────────────────────────────────────────────────────


class TestConfig(Config):
    TESTING = True
    DEBUG = True
    SECRET_KEY = "test-secret"
    SUPABASE_URL = os.getenv("TEST_SUPABASE_URL", "http://localhost:54321")
    SUPABASE_KEY = os.getenv("TEST_SUPABASE_KEY", "test-key")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "test-api-key")


# ── Fixtures ─────────────────────────────────────────────────────────


@pytest.fixture
def app():
    """Create test Flask app."""
    Container.reset()
    app = create_app("default")
    app.config.from_object(TestConfig)
    yield app
    Container.reset()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def runner(app):
    return app.test_cli_runner()


@pytest.fixture
def auth_headers():
    return {
        "Authorization": "Bearer test-token",
        "Content-Type": "application/json",
    }


@pytest.fixture
def sample_document():
    return {
        "title": "Test Document",
        "content": "This is a test document about university regulations.",
        "type": "regulation",
    }


@pytest.fixture
def sample_query():
    return {"question": "What are the attendance requirements?", "top_k": 5}


# ── Shared mocks ─────────────────────────────────────────────────────


@pytest.fixture
def mock_supabase():
    """Chainable Supabase mock."""
    mock = MagicMock()
    mock.table.return_value = mock
    mock.select.return_value = mock
    mock.insert.return_value = mock
    mock.update.return_value = mock
    mock.delete.return_value = mock
    mock.eq.return_value = mock
    mock.order.return_value = mock
    mock.range.return_value = mock
    mock.maybe_single.return_value = mock
    mock.single.return_value = mock
    mock.execute.return_value = Mock(data=[], count=0)
    mock.rpc.return_value = mock
    return mock


@pytest.fixture
def mock_embedding_service():
    mock = Mock()
    mock.embed_text.return_value = [0.1] * 768
    mock.embed_query.return_value = [0.1] * 768
    return mock
