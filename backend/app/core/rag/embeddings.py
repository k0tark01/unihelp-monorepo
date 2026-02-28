"""Embedding service using Google Gemini (google-genai SDK).

Uses the same SDK and patterns as app/utils/gemini_client.py
to ensure consistency.
"""
from __future__ import annotations

import os
from typing import List, Optional
from functools import lru_cache

from google import genai
from google.genai import types


class EmbeddingService:
    """
    Service for generating text embeddings using Gemini.

    Uses ``google.genai`` (the new SDK) — NOT ``google.generativeai``.
    Provides caching and batch processing capabilities.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "models/gemini-embedding-001",
        dimensions: int = 768,
    ):
        """
        Initialize embedding service.

        Args:
            api_key: Gemini API key (falls back to GEMINI_API_KEY env var)
            model: Embedding model name
            dimensions: Output embedding dimensionality
        """
        self._api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.model = model
        self.dimensions = dimensions
        self._client: Optional[genai.Client] = None

    def _get_client(self) -> genai.Client:
        """Lazy-init the Gemini client."""
        if self._client is None:
            if not self._api_key:
                raise ValueError("GEMINI_API_KEY is not set")
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    @lru_cache(maxsize=1000)
    def embed_text(self, text: str) -> tuple:
        """
        Generate embedding for a document text.

        Returns a *tuple* (hashable for LRU cache).
        Call ``list(...)`` if you need a list.
        """
        try:
            client = self._get_client()
            result = client.models.embed_content(
                model=self.model,
                contents=text,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=self.dimensions,
                ),
            )
            return tuple(result.embeddings[0].values)
        except Exception as e:
            raise RuntimeError(f"Failed to generate embedding: {e}")

    def embed_query(self, query: str) -> List[float]:
        """
        Generate embedding optimised for query retrieval.

        Not cached — queries are typically unique.
        """
        try:
            client = self._get_client()
            result = client.models.embed_content(
                model=self.model,
                contents=query,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_QUERY",
                    output_dimensionality=self.dimensions,
                ),
            )
            return list(result.embeddings[0].values)
        except Exception as e:
            raise RuntimeError(f"Failed to generate query embedding: {e}")

    def embed_batch(self, texts: List[str], batch_size: int = 50) -> List[List[float]]:
        """
        Generate embeddings for multiple texts.

        Args:
            texts: List of texts to embed
            batch_size: Number of texts per API call
        """
        embeddings: List[List[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            batch_embeddings = [list(self.embed_text(t)) for t in batch]
            embeddings.extend(batch_embeddings)
        return embeddings
