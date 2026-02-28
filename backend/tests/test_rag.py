"""Tests for the RAG utility pipeline (app.utils.rag)."""

import pytest
from unittest.mock import patch, Mock

from app.utils.rag import (
    _detect_language,
    _rerank,
    retrieve_context,
    answer_question,
    _build_system_prompt,
)


# ══════════════════════════════════════════════════════════════════════
# Language detection
# ══════════════════════════════════════════════════════════════════════


class TestDetectLanguage:

    def test_french(self):
        assert _detect_language("Bonjour, comment allez-vous?") == "French"

    def test_arabic(self):
        assert _detect_language("مرحبا بكم") == "Arabic"

    def test_english(self):
        assert _detect_language("Hello, how are you?") == "English"

    def test_mixed_defaults_english(self):
        assert _detect_language("xyz abc 123") == "English"

    def test_french_keywords(self):
        assert _detect_language("quel est le règlement") == "French"

    def test_arabic_with_latin(self):
        # Arabic chars take priority
        assert _detect_language("hello مرحبا") == "Arabic"


# ══════════════════════════════════════════════════════════════════════
# Reranking
# ══════════════════════════════════════════════════════════════════════


class TestRerank:

    def test_reranks_by_combined_score(self):
        rows = [
            {"content": "unrelated material", "similarity": 0.9},
            {"content": "attendance rules apply to students", "similarity": 0.6},
        ]
        ranked = _rerank("attendance rules", rows)
        # Second row has better keyword overlap, may rise
        assert all("rerank_score" in r for r in ranked)
        # Sorted descending
        scores = [r["rerank_score"] for r in ranked]
        assert scores == sorted(scores, reverse=True)

    def test_empty_rows(self):
        assert _rerank("test", []) == []

    def test_single_row(self):
        rows = [{"content": "test content", "similarity": 0.5}]
        result = _rerank("test", rows)
        assert len(result) == 1
        assert result[0]["rerank_score"] > 0


# ══════════════════════════════════════════════════════════════════════
# System prompt builder
# ══════════════════════════════════════════════════════════════════════


class TestSystemPrompt:

    def test_english_prompt(self):
        prompt = _build_system_prompt("English")
        assert "English" in prompt
        assert "UniHelp" in prompt

    def test_french_prompt(self):
        prompt = _build_system_prompt("French")
        assert "French" in prompt
        assert "administration" in prompt.lower()

    def test_arabic_prompt(self):
        prompt = _build_system_prompt("Arabic")
        assert "Arabic" in prompt


# ══════════════════════════════════════════════════════════════════════
# Retrieve context (mocked)
# ══════════════════════════════════════════════════════════════════════


class TestRetrieveContext:

    @patch("app.utils.rag.get_query_embedding")
    @patch("app.utils.rag.get_supabase")
    def test_returns_ranked_rows(self, mock_sb, mock_emb):
        mock_emb.return_value = [0.1] * 768
        mock_sb.return_value.rpc.return_value.execute.return_value = Mock(data=[
            {"id": 1, "content": "rules", "title": "T", "type": "r", "similarity": 0.8},
        ])
        rows = retrieve_context("rules")
        assert len(rows) == 1
        assert "rerank_score" in rows[0]

    @patch("app.utils.rag.get_query_embedding")
    @patch("app.utils.rag.get_supabase")
    def test_returns_empty_on_no_matches(self, mock_sb, mock_emb):
        mock_emb.return_value = [0.1] * 768
        mock_sb.return_value.rpc.return_value.execute.return_value = Mock(data=[])
        assert retrieve_context("anything") == []


# ══════════════════════════════════════════════════════════════════════
# Full answer_question (mocked)
# ══════════════════════════════════════════════════════════════════════


class TestAnswerQuestion:

    @patch("app.utils.rag.get_query_embedding")
    @patch("app.utils.rag.get_supabase")
    def test_no_docs_returns_no_answer(self, mock_sb, mock_emb):
        mock_emb.return_value = [0.1] * 768
        mock_sb.return_value.rpc.return_value.execute.return_value = Mock(data=[])

        result = answer_question("test?")
        assert result["has_answer"] is False
        assert result["sources"] == []

    @patch("app.utils.rag.chat_messages")
    @patch("app.utils.rag.get_query_embedding")
    @patch("app.utils.rag.get_supabase")
    def test_with_docs_returns_answer(self, mock_sb, mock_emb, mock_chat):
        mock_emb.return_value = [0.1] * 768
        mock_sb.return_value.rpc.return_value.execute.return_value = Mock(data=[
            {"id": 1, "content": "The rule is X.", "title": "Rules", "type": "regulation", "similarity": 0.85},
        ])
        mock_chat.return_value = {"content": "According to the rules, X applies."}

        result = answer_question("What is the rule?")
        assert result["has_answer"] is True
        assert len(result["sources"]) == 1
        assert "answer" in result

    @patch("app.utils.rag.chat_messages")
    @patch("app.utils.rag.get_query_embedding")
    @patch("app.utils.rag.get_supabase")
    def test_llm_error_returns_fallback(self, mock_sb, mock_emb, mock_chat):
        mock_emb.return_value = [0.1] * 768
        mock_sb.return_value.rpc.return_value.execute.return_value = Mock(data=[
            {"id": 1, "content": "Fallback text.", "title": "Doc", "type": "r", "similarity": 0.7},
        ])
        mock_chat.return_value = {"error": "API overloaded"}

        result = answer_question("test?")
        assert result["has_answer"] is True
        assert "indisponible" in result["answer"].lower() or "Fallback" in result["answer"]

    @patch("app.utils.rag.chat_messages")
    @patch("app.utils.rag.get_query_embedding")
    @patch("app.utils.rag.get_supabase")
    def test_with_history(self, mock_sb, mock_emb, mock_chat):
        mock_emb.return_value = [0.1] * 768
        mock_sb.return_value.rpc.return_value.execute.return_value = Mock(data=[
            {"id": 1, "content": "X", "title": "T", "type": "r", "similarity": 0.9},
        ])
        mock_chat.return_value = {"content": "Answer with context."}

        history = [
            {"role": "user", "content": "prev Q"},
            {"role": "assistant", "content": "prev A"},
        ]
        result = answer_question("follow up?", history=history)
        assert result["has_answer"] is True

    def test_language_detection_in_result(self):
        """Language field is always present."""
        with patch("app.utils.rag.retrieve_context", return_value=[]):
            result = answer_question("Bonjour")
            assert result["language"] == "French"
