"""
Advanced document retrieval with hybrid reranking.

Features:
  - Vector similarity search via Supabase pgvector
  - Multi-signal reranking: vector + keyword + title + coverage
  - Diversity-aware deduplication
  - Position-sensitive scoring
"""

import math
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Dict, List, Optional


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class RetrievedDocument:
    """Retrieved document with multi-signal scores."""

    id: int
    title: str
    content: str
    doc_type: Optional[str]
    similarity: float
    rerank_score: Optional[float] = None
    keyword_score: float = 0.0
    title_score: float = 0.0
    coverage_score: float = 0.0

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'type': self.doc_type,
            'similarity': self.similarity,
            'rerank_score': self.rerank_score,
        }


# ---------------------------------------------------------------------------
# Tokenisation helper (French / Arabic / English friendly)
# ---------------------------------------------------------------------------

_WORD_RE = re.compile(r'[\w\u0600-\u06FF]+', re.UNICODE)


def _tokenise(text: str) -> List[str]:
    """Lower-case tokenise, stripping diacritics-safe."""
    return _WORD_RE.findall(text.lower())


# ---------------------------------------------------------------------------
# Retriever
# ---------------------------------------------------------------------------

class DocumentRetriever:
    """
    Production retriever with hybrid reranking.

    Scoring formula (default weights):
      final = w_vec * vector_sim
            + w_kw  * keyword_overlap
            + w_ttl * title_match
            + w_cov * query_coverage

    Default: 0.60 / 0.15 / 0.10 / 0.15
    """

    DEFAULT_WEIGHTS = {
        'vector': 0.60,
        'keyword': 0.15,
        'title': 0.10,
        'coverage': 0.15,
    }

    def __init__(
        self,
        supabase_client,
        enable_reranking: bool = True,
        weights: Optional[Dict[str, float]] = None,
        dedup_threshold: float = 0.92,
    ):
        self.supabase = supabase_client
        self.enable_reranking = enable_reranking
        self.weights = weights or self.DEFAULT_WEIGHTS
        self.dedup_threshold = dedup_threshold

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def retrieve(
        self,
        query_embedding: List[float],
        query_text: str,
        top_k: int = 8,
        similarity_threshold: float = 0.3,
    ) -> List[RetrievedDocument]:
        """Retrieve and rerank relevant documents."""
        fetch_count = top_k * 3 if self.enable_reranking else top_k

        response = self.supabase.rpc('match_documents', {
            'query_embedding': query_embedding,
            'match_threshold': similarity_threshold,
            'match_count': fetch_count,
        }).execute()

        rows = response.data or []
        if not rows:
            return []

        docs = [
            RetrievedDocument(
                id=r.get('id'),
                title=r.get('title', ''),
                content=r.get('content', ''),
                doc_type=r.get('type'),
                similarity=float(r.get('similarity', 0)),
            )
            for r in rows
        ]

        if self.enable_reranking and len(docs) > 1:
            docs = self._rerank(query_text, docs)
            docs = self._deduplicate(docs)

        return docs[:top_k]

    # ------------------------------------------------------------------
    # Multi-signal reranking
    # ------------------------------------------------------------------

    def _rerank(
        self, query: str, documents: List[RetrievedDocument],
    ) -> List[RetrievedDocument]:
        """
        Score each document across four signals and compute weighted final.
        """
        q_tokens = _tokenise(query)
        q_set = set(q_tokens)
        q_counter = Counter(q_tokens)

        w = self.weights

        for doc in documents:
            d_tokens = _tokenise(doc.content)
            d_set = set(d_tokens)
            d_counter = Counter(d_tokens)

            # 1) Keyword overlap — IDF-weighted Jaccard
            doc.keyword_score = self._keyword_score(q_set, d_set, d_counter, len(d_tokens))

            # 2) Title match — what fraction of query terms appear in the title
            t_tokens = set(_tokenise(doc.title))
            doc.title_score = len(q_set & t_tokens) / len(q_set) if q_set else 0.0

            # 3) Query coverage — how many unique query terms appear in content
            doc.coverage_score = len(q_set & d_set) / len(q_set) if q_set else 0.0

            # 4) Combined
            doc.rerank_score = (
                w['vector'] * doc.similarity
                + w['keyword'] * doc.keyword_score
                + w['title'] * doc.title_score
                + w['coverage'] * doc.coverage_score
            )

        documents.sort(key=lambda d: d.rerank_score or 0, reverse=True)
        return documents

    # ------------------------------------------------------------------
    # Keyword scoring — term-frequency normalised overlap
    # ------------------------------------------------------------------

    @staticmethod
    def _keyword_score(
        q_set: set, d_set: set, d_counter: Counter, doc_len: int,
    ) -> float:
        """
        TF-normalised keyword overlap.

        For each overlapping term, contribution = min(tf, 3) / 3
        (cap at 3 to prevent very long docs from dominating).
        """
        common = q_set & d_set
        if not common or not q_set:
            return 0.0
        score = sum(min(d_counter[t], 3) / 3.0 for t in common) / len(q_set)
        return min(score, 1.0)

    # ------------------------------------------------------------------
    # Near-duplicate removal
    # ------------------------------------------------------------------

    def _deduplicate(self, docs: List[RetrievedDocument]) -> List[RetrievedDocument]:
        """Remove near-duplicate chunks (same content, different IDs)."""
        kept: List[RetrievedDocument] = []
        seen_signatures: List[set] = []

        for doc in docs:
            sig = set(_tokenise(doc.content)[:60])  # first 60 tokens as fingerprint
            is_dup = False
            for prev_sig in seen_signatures:
                if not sig or not prev_sig:
                    continue
                jaccard = len(sig & prev_sig) / len(sig | prev_sig)
                if jaccard >= self.dedup_threshold:
                    is_dup = True
                    break
            if not is_dup:
                kept.append(doc)
                seen_signatures.append(sig)

        return kept
