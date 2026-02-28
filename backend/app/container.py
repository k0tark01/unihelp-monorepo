"""Dependency injection container for managing service instances."""
from typing import Optional

from app.supabase_client import get_supabase
from app.core.rag import RAGEngine
from app.core.rag.embeddings import EmbeddingService
from app.core.rag.chunker import ChunkConfig
from app.services.document_service import DocumentService
from app.services.query_service import QueryService
class Container:
    """
    Singleton dependency-injection container.

    Manages service instances and their dependencies.
    """

    _instance: Optional['Container'] = None

    def __init__(self, config):
        self.config = config
        self._embedding_service = None
        self._rag_engine = None
        self._document_service = None
        self._query_service = None

    @classmethod
    def get_instance(cls, config=None) -> 'Container':
        if cls._instance is None:
            if config is None:
                raise ValueError("Config required for first initialization")
            cls._instance = cls(config)
        return cls._instance

    @classmethod
    def reset(cls):
        """Reset singleton (useful for testing)."""
        cls._instance = None

    # ------------------------------------------------------------------
    # Service accessors
    # ------------------------------------------------------------------

    def get_supabase_client(self):
        return get_supabase()

    def get_embedding_service(self) -> EmbeddingService:
        if self._embedding_service is None:
            self._embedding_service = EmbeddingService(
                api_key=self.config.get("GEMINI_API_KEY"),
                model="models/gemini-embedding-001",
            )
        return self._embedding_service

    def get_rag_engine(self) -> RAGEngine:
        if self._rag_engine is None:
            chunk_config = ChunkConfig(
                chunk_size=1000,
                chunk_overlap=200,
                strategy='semantic',
            )
            self._rag_engine = RAGEngine(
                supabase_client=self.get_supabase_client(),
                embedding_service=self.get_embedding_service(),
                chunk_config=chunk_config,
                enable_reranking=True,
            )
        return self._rag_engine

    def get_document_service(self) -> DocumentService:
        if self._document_service is None:
            self._document_service = DocumentService(
                supabase_client=self.get_supabase_client(),
                embedding_service=self.get_embedding_service(),
            )
        return self._document_service

    def get_query_service(self) -> QueryService:
        if self._query_service is None:
            self._query_service = QueryService(
                rag_engine=self.get_rag_engine(),
            )
        return self._query_service


# ------------------------------------------------------------------
# Global accessor functions
# ------------------------------------------------------------------

def get_container() -> Container:
    return Container.get_instance()


def get_embedding_service() -> EmbeddingService:
    return get_container().get_embedding_service()


def get_rag_engine() -> RAGEngine:
    return get_container().get_rag_engine()


def get_document_service() -> DocumentService:
    """Get document service from container."""
    return get_container().get_document_service()


def get_query_service() -> QueryService:
    """Get query service from container."""
    return get_container().get_query_service()
