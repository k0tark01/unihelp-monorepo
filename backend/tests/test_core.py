"""Tests for core RAG components."""

import pytest
from collections import Counter
from unittest.mock import Mock

from app.core.rag.chunker import TextChunker, ChunkConfig, TextChunk
from app.core.rag.embeddings import EmbeddingService
from app.core.rag.retriever import DocumentRetriever, RetrievedDocument, _tokenise


# ── TextChunker ──────────────────────────────────────────────────────


class TestTextChunker:

    def test_default_config(self):
        chunker = TextChunker()
        assert chunker.config.chunk_size == 1000
        assert chunker.config.chunk_overlap == 200

    def test_custom_config(self):
        cfg = ChunkConfig(chunk_size=500, chunk_overlap=100, strategy="fixed")
        chunker = TextChunker(cfg)
        assert chunker.config.chunk_size == 500
        assert chunker.config.strategy == "fixed"

    def test_chunk_short_text(self):
        chunks = TextChunker().chunk_text("Short text.")
        assert len(chunks) == 1
        assert chunks[0].text == "Short text."

    def test_chunk_long_text_fixed(self):
        cfg = ChunkConfig(chunk_size=100, chunk_overlap=20, strategy="fixed")
        text = "Lorem ipsum dolor sit amet. " * 20
        chunks = TextChunker(cfg).chunk_text(text)
        assert len(chunks) > 1
        for c in chunks:
            assert isinstance(c, TextChunk)

    def test_chunk_preserves_metadata(self):
        meta = {"source": "test.txt"}
        chunks = TextChunker().chunk_text("Hello", meta)
        assert chunks[0].metadata == meta

    def test_empty_text(self):
        assert TextChunker().chunk_text("") == []

    def test_semantic_chunking(self):
        cfg = ChunkConfig(chunk_size=150, strategy="semantic")
        text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
        chunks = TextChunker(cfg).chunk_text(text)
        assert len(chunks) >= 1
        for c in chunks:
            assert c.text.strip()


# ── EmbeddingService ─────────────────────────────────────────────────


class TestEmbeddingService:

    @pytest.fixture
    def svc(self):
        return EmbeddingService(api_key="test-key", model="models/gemini-embedding-001")

    def test_init(self, svc):
        assert svc.model == "models/gemini-embedding-001"

    @pytest.mark.skip(reason="Requires live API key")
    def test_embed_text(self, svc):
        result = svc.embed_text("Hello world")
        assert isinstance(result, (list, tuple))
        assert len(result) > 0

    @pytest.mark.skip(reason="Requires live API key")
    def test_embed_query(self, svc):
        result = svc.embed_query("What is this?")
        assert isinstance(result, list)
        assert len(result) > 0


# ── DocumentRetriever ────────────────────────────────────────────────


class TestDocumentRetriever:

    @pytest.fixture
    def mock_sb(self):
        mock = Mock()
        mock.rpc.return_value = mock
        mock.execute.return_value = Mock(data=[
            {"id": 1, "title": "Rules", "content": "attendance rules apply", "type": "regulation", "similarity": 0.9},
            {"id": 2, "title": "Guide", "content": "student guide for exams", "type": "guide", "similarity": 0.7},
            {"id": 3, "title": "FAQ", "content": "frequently asked questions", "type": "faq", "similarity": 0.5},
        ])
        return mock

    @pytest.fixture
    def retriever(self, mock_sb):
        return DocumentRetriever(mock_sb, enable_reranking=True)

    def test_retrieve_calls_rpc(self, retriever, mock_sb):
        docs = retriever.retrieve([0.1] * 768, "attendance rules", top_k=3)
        mock_sb.rpc.assert_called_once()
        assert len(docs) <= 3

    def test_retrieve_returns_retrieved_documents(self, retriever):
        docs = retriever.retrieve([0.1] * 768, "rules", top_k=3)
        assert all(isinstance(d, RetrievedDocument) for d in docs)

    def test_reranking_reorders_by_score(self, retriever):
        docs = retriever.retrieve([0.1] * 768, "attendance rules", top_k=3)
        scores = [d.rerank_score for d in docs]
        assert scores == sorted(scores, reverse=True)

    def test_empty_results(self, mock_sb):
        mock_sb.execute.return_value = Mock(data=[])
        retriever = DocumentRetriever(mock_sb)
        assert retriever.retrieve([0.1] * 768, "anything") == []

    def test_disable_reranking(self, mock_sb):
        retriever = DocumentRetriever(mock_sb, enable_reranking=False)
        docs = retriever.retrieve([0.1] * 768, "rules", top_k=3)
        # Without reranking, order stays as-is (by similarity desc from DB)
        assert docs[0].similarity >= docs[-1].similarity

    def test_deduplication(self):
        sb = Mock()
        sb.rpc.return_value = sb
        sb.execute.return_value = Mock(data=[
            {"id": 1, "title": "Doc", "content": "exactly the same content here", "type": "r", "similarity": 0.9},
            {"id": 2, "title": "Doc", "content": "exactly the same content here", "type": "r", "similarity": 0.85},
        ])
        retriever = DocumentRetriever(sb, dedup_threshold=0.9)
        docs = retriever.retrieve([0.1] * 768, "same content", top_k=5)
        assert len(docs) == 1  # dupicate removed

    def test_custom_weights(self, mock_sb):
        weights = {"vector": 0.5, "keyword": 0.2, "title": 0.2, "coverage": 0.1}
        retriever = DocumentRetriever(mock_sb, weights=weights)
        docs = retriever.retrieve([0.1] * 768, "rules", top_k=3)
        assert len(docs) > 0

    def test_to_dict(self):
        doc = RetrievedDocument(
            id=1, title="T", content="C", doc_type="r",
            similarity=0.8, rerank_score=0.75,
        )
        d = doc.to_dict()
        assert d["id"] == 1
        assert d["similarity"] == 0.8


# ── Tokeniser ────────────────────────────────────────────────────────


class TestTokenise:

    def test_english(self):
        tokens = _tokenise("Hello World!")
        assert tokens == ["hello", "world"]

    def test_french(self):
        tokens = _tokenise("Bonjour le Monde")
        assert "bonjour" in tokens

    def test_arabic(self):
        tokens = _tokenise("مرحبا بالعالم")
        assert len(tokens) >= 1

    def test_empty(self):
        assert _tokenise("") == []


# ── RAG Prompts ──────────────────────────────────────────────────────


class TestRAGPrompts:

    def test_import_modules(self):
        from app.core.rag.prompts import PromptEngine, RAGContext
        assert PromptEngine is not None
        assert RAGContext is not None

    def test_context_creation(self):
        from app.core.rag.prompts import RAGContext
        ctx = RAGContext(
            query="Test?",
            documents=[{"title": "D", "content": "C"}],
            language="English",
        )
        assert ctx.query == "Test?"
        assert ctx.language == "English"

    def test_prompt_engine_build(self):
        from app.core.rag.prompts import PromptEngine, RAGContext
        engine = PromptEngine()
        ctx = RAGContext(
            query="What is the policy?",
            documents=[{"title": "Policy", "content": "The policy states...", "type": "policy", "similarity": 0.85}],
            language="English",
        )
        prompt = engine.build_rag_prompt(ctx)
        assert "Policy" in prompt
        assert "What is the policy?" in prompt

    def test_multilingual(self):
        from app.core.rag.prompts import PromptEngine
        engine = PromptEngine()
        assert "French" in engine.MULTILINGUAL_INSTRUCTIONS
        assert "Arabic" in engine.MULTILINGUAL_INSTRUCTIONS
