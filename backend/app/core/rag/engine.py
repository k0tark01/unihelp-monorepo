"""
Main RAG Engine — orchestrates retrieval, prompt generation, and LLM interaction.

This engine uses the working patterns from app/utils/rag.py and
app/utils/gemini_client.py, ensuring correct handling of the Gemini SDK.
"""
from __future__ import annotations

import re
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass, field

from .chunker import TextChunker, ChunkConfig
from .embeddings import EmbeddingService
from .retriever import DocumentRetriever
from .prompts import PromptEngine, RAGContext
from app.utils.gemini_client import chat_messages

logger = logging.getLogger(__name__)


@dataclass
class QueryResult:
    """Result of a RAG query."""
    question: str
    answer: str
    sources: List[Dict]
    language: str
    has_answer: bool
    metadata: Optional[Dict] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "question": self.question,
            "answer": self.answer,
            "sources": self.sources,
            "language": self.language,
            "has_answer": self.has_answer,
            "metadata": self.metadata or {},
        }


# ── Language detection ───────────────────────────────────────────────────

_FRENCH_WORDS = {
    "le", "la", "les", "de", "du", "d", "des", "un", "une",
    "en", "et", "est", "que", "qui", "pas", "dans",
    "je", "tu", "il", "nous", "vous", "ils", "elles",
    "avec", "pour", "sur", "par", "ce", "se", "ne", "son", "sa", "ses",
    "quel", "quelle", "quels", "quelles", "quoi", "comment",
    "pourquoi", "quand", "combien",
    "sont", "avoir", "etre", "faire", "bonjour", "merci",
    "votre", "mon", "ma", "mes", "cette", "cet",
    "avant", "apres", "alors", "mais", "aussi", "donc",
}

_ENGLISH_WORDS = {
    "the", "is", "are", "was", "were", "have", "has", "do", "does",
    "what", "how", "why", "where", "when", "who", "can", "will", "give",
    "tell", "show", "find", "about", "with", "from", "this", "that",
    "hi", "hello", "hey", "please", "thanks", "and", "or", "not", "me",
    "my", "your", "i", "a", "an",
}

_ARABIC_RE = re.compile(r"[\u0600-\u06FF]")


def detect_language(text: str) -> str:
    """Return 'Arabic', 'French', or 'English'."""
    if _ARABIC_RE.search(text):
        return "Arabic"
    words = set(re.findall(r"\b\w+\b", text.lower()))
    fr = len(words & _FRENCH_WORDS)
    en = len(words & _ENGLISH_WORDS)
    if fr > en:
        return "French"
    return "English"


class RAGEngine:
    """
    Main RAG (Retrieval-Augmented Generation) Engine.

    Pipeline:
    1. Language detection
    2. Query embedding
    3. Document retrieval + reranking
    4. Prompt assembly with conversation context
    5. LLM call (Gemini)
    6. Response formatting with sources
    """

    def __init__(
        self,
        supabase_client,
        embedding_service: EmbeddingService,
        chunk_config: Optional[ChunkConfig] = None,
        enable_reranking: bool = True,
    ):
        self.supabase = supabase_client
        self.embedding_service = embedding_service
        self.chunker = TextChunker(chunk_config)
        self.retriever = DocumentRetriever(supabase_client, enable_reranking)
        self.prompt_engine = PromptEngine()

    # ── Main query method ────────────────────────────────────────────

    def query(
        self,
        question: str,
        top_k: int = 8,
        conversation_history: Optional[List[Dict]] = None,
        similarity_threshold: float = 0.3,
    ) -> QueryResult:
        """
        Process a question through the full RAG pipeline.

        Args:
            question: User's question (any language)
            top_k: Number of documents to retrieve
            conversation_history: Previous messages for context
            similarity_threshold: Minimum similarity for retrieval

        Returns:
            QueryResult with answer, sources, language
        """
        language = detect_language(question)

        # Generate query embedding
        query_embedding = self.embedding_service.embed_query(question)

        # Retrieve relevant documents
        retrieved_docs = self.retriever.retrieve(
            query_embedding=query_embedding,
            query_text=question,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
        )

        # No relevant docs found
        if not retrieved_docs:
            no_answer = {
                "French": "Je ne trouve pas d'informations pertinentes dans les documents disponibles.",
                "Arabic": "لا أجد معلومات ذات صلة في المستندات المتاحة للإجابة على سؤالك.",
                "English": "I cannot find relevant information in the available documents.",
            }
            return QueryResult(
                question=question,
                answer=no_answer.get(language, no_answer["English"]),
                sources=[],
                language=language,
                has_answer=False,
            )

        # Build RAG context
        context = RAGContext(
            query=question,
            documents=[doc.to_dict() for doc in retrieved_docs],
            conversation_history=conversation_history,
            language=language,
        )

        # Generate prompt messages
        if conversation_history:
            messages = self.prompt_engine.build_conversational_prompt(context)
        else:
            prompt = self.prompt_engine.build_rag_prompt(context)
            messages = [
                {"role": "system", "content": self.prompt_engine.SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ]

        # Call LLM — chat_messages returns {"content": str} or {"error": str}
        try:
            llm_result = chat_messages(messages)

            if "error" in llm_result:
                logger.error("LLM returned error: %s", llm_result["error"])
                # Fallback: return raw document excerpts
                answer = self._build_fallback_answer(retrieved_docs, language)
                has_answer = False
            else:
                answer = llm_result.get("content", "")
                has_answer = True

        except Exception as exc:
            logger.exception("LLM call failed")
            answer = self._build_fallback_answer(retrieved_docs, language)
            has_answer = False

        # Format sources
        sources = [
            {
                "id": doc.id,
                "title": doc.title,
                "type": doc.doc_type,
                "file_url": doc.file_url,
                "text": doc.content[:500] + "..." if len(doc.content) > 500 else doc.content,
                "similarity": round(doc.similarity, 3),
                "rerank_score": round(doc.rerank_score, 3) if doc.rerank_score else None,
            }
            for doc in retrieved_docs
        ]

        return QueryResult(
            question=question,
            answer=answer,
            sources=sources,
            language=language,
            has_answer=has_answer,
        )

    # ── Document ingestion ───────────────────────────────────────────

    def ingest_document(
        self,
        title: str,
        content: str,
        doc_type: Optional[str] = None,
        file_url: Optional[str] = None,
    ) -> Dict:
        """Chunk, embed, and store a new document."""
        chunks = self.chunker.chunk_text(
            content, metadata={"title": title, "type": doc_type}
        )
        if not chunks:
            return {"success": False, "error": "No content to ingest"}

        try:
            embedding_text = f"{title}\n\n{content}"
            embedding = list(self.embedding_service.embed_text(embedding_text))

            row = {
                "title": title,
                "content": content,
                "type": doc_type,
                "embedding": embedding,
            }
            if file_url:
                row["file_url"] = file_url

            result = self.supabase.table("documents").insert(row).execute()

            return {
                "success": True,
                "document_id": result.data[0]["id"] if result.data else None,
                "chunks_created": len(chunks),
                "metadata": {
                    "title": title,
                    "type": doc_type,
                    "chunk_count": len(chunks),
                    "total_words": sum(c.word_count for c in chunks),
                },
            }
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    # ── Helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _build_fallback_answer(docs, language: str) -> str:
        """Build a fallback answer from retrieved docs when LLM is unavailable."""
        headers = {
            "French": "[Réponse automatique — service IA temporairement indisponible]",
            "Arabic": "[رد تلقائي — خدمة الذكاء الاصطناعي غير متاحة مؤقتاً]",
            "English": "[Auto-reply — AI service temporarily unavailable]",
        }
        parts = [headers.get(language, headers["English"]), ""]
        for i, doc in enumerate(docs[:3], 1):
            parts.append(f"[{i}] {doc.title}:")
            parts.append(doc.content[:400])
            parts.append("")
        return "\n".join(parts)
