"""
RAG pipeline - UniHelp Flask backend.

Production-ready pipeline using Supabase pgvector + Gemini.
Features:
  - Trilingual support (French, Arabic, English)
  - Hybrid reranking (80% vector + 20% keyword overlap)
  - Chain-of-thought prompt engineering
  - Conversation context awareness
  - Graceful LLM fallback
"""

import re
from typing import Optional

from app.supabase_client import get_supabase
from app.utils.gemini_client import get_query_embedding, chat_messages


# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------

_FRENCH_WORDS = {
    # articles / prepositions / pronouns
    'le', 'la', 'les', 'de', 'du', 'd', 'des', 'un', 'une',
    'en', 'et', 'est', 'que', 'qui', 'pas', 'dans',
    'je', 'tu', 'il', 'nous', 'vous', 'ils', 'elles',
    'avec', 'pour', 'sur', 'par', 'ce', 'se', 'ne', 'son', 'sa', 'ses',
    # question words
    'quel', 'quelle', 'quels', 'quelles', 'quoi', 'comment',
    'pourquoi', 'quand', 'combien',
    # common verbs / words
    'sont', 'avoir', 'etre', 'être', 'faire', 'bonjour', 'merci',
    'votre', 'mon', 'ma', 'mes', 'cette', 'cet',
    'avant', 'apres', 'après', 'alors', 'mais', 'aussi', 'donc',
    'peut', 'doit', 'faut',
}
_ENGLISH_WORDS = {
    'the', 'is', 'are', 'was', 'were', 'have', 'has', 'do', 'does',
    'what', 'how', 'why', 'where', 'when', 'who', 'can', 'will', 'give',
    'tell', 'show', 'find', 'about', 'with', 'from', 'this', 'that',
    'hi', 'hello', 'hey', 'please', 'thanks', 'and', 'or', 'not', 'me',
    'my', 'your', 'i', 'a', 'an',
}
_ARABIC_RE = re.compile(r'[\u0600-\u06FF]')


def _detect_language(text: str) -> str:
    """Return 'Arabic', 'French', or 'English'."""
    if _ARABIC_RE.search(text):
        return 'Arabic'
    words = set(re.findall(r'\b\w+\b', text.lower()))
    fr_score = len(words & _FRENCH_WORDS)
    en_score = len(words & _ENGLISH_WORDS)
    if fr_score > en_score:
        return 'French'
    elif en_score > 0:
        return 'English'
    return 'English'  # safe default


# ---------------------------------------------------------------------------
# Reranking — 0.8 × vector_similarity + 0.2 × keyword_overlap
# ---------------------------------------------------------------------------

def _rerank(query: str, rows: list) -> list:
    """
    Rerank Supabase RPC rows.
    combined_score = 0.8 * similarity + 0.2 * term_overlap
    """
    query_terms = set(query.lower().split())
    for row in rows:
        text_terms = set(row.get('content', '').lower().split())
        overlap = len(query_terms & text_terms) / len(query_terms) if query_terms else 0
        vec_score = float(row.get('similarity', 0))
        row['rerank_score'] = 0.8 * vec_score + 0.2 * overlap
    rows.sort(key=lambda x: x.get('rerank_score', 0), reverse=True)
    return rows


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

def retrieve_context(question: str, top_k: int = 8) -> list:
    """Embed question → match_documents RPC → rerank → top_k rows."""
    sb = get_supabase()
    embedding = get_query_embedding(question)

    resp = sb.rpc('match_documents', {
        'query_embedding': embedding,
        'match_threshold': 0.3,
        'match_count': top_k * 2,
    }).execute()

    rows = resp.data or []
    if not rows:
        return []

    return _rerank(question, rows)[:top_k]


# ---------------------------------------------------------------------------
# System prompt builder — production-grade prompt engineering
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT_TEMPLATE = """\
You are **UniHelp**, the official AI assistant for the university.

## Core Rules
1. **Ground every claim** in the provided documents. Cite the document title in brackets, e.g. [Règlement intérieur].
2. If the documents **do not contain** the answer, say so clearly in {lang}: \
"{no_answer}"
3. **Never fabricate** information, statistics, dates, or procedures.
4. **Respond ONLY in {lang}**. Never switch language.
5. Use bullet points or numbered steps for complex answers.
6. Bold **key terms** and important values.
7. When multiple documents are relevant, synthesise them and cite each.
8. If the question is ambiguous, state your interpretation before answering.

## Reasoning Process (internal — do not show to the user)
- Identify which documents are relevant.
- Extract the specific passages that answer the question.
- Synthesise a clear, complete answer.
- Verify every fact is supported by a cited document.
- Format cleanly in {lang}.\
"""

_NO_ANSWER = {
    'French': "Je n'ai pas trouvé cette information dans les documents disponibles. Veuillez contacter l'administration.",
    'Arabic': "لم أجد هذه المعلومات في المستندات المتاحة. يرجى التواصل مع الإدارة.",
    'English': "I could not find this information in the available documents. Please contact the administration.",
}


def _build_system_prompt(lang: str) -> str:
    """Build a language-specific system prompt."""
    return _SYSTEM_PROMPT_TEMPLATE.format(
        lang=lang,
        no_answer=_NO_ANSWER.get(lang, _NO_ANSWER['English']),
    )


# ---------------------------------------------------------------------------
# Answer generation
# ---------------------------------------------------------------------------

def _generate_answer(
    query: str,
    context: str,
    rows: list,
    history: list | None = None,
) -> str:
    """Call Gemini with context + conversation history."""
    lang = _detect_language(query)
    system_prompt = _build_system_prompt(lang)

    messages = [{'role': 'system', 'content': system_prompt}]

    # Inject conversation history (last 10 turns) for context continuity
    if history:
        for msg in history[-10:]:
            role = msg.get('role', '')
            content = msg.get('content', '')
            if role in ('user', 'assistant') and content:
                messages.append({'role': role, 'content': content})

    # Build the user turn with document context
    messages.append({
        'role': 'user',
        'content': (
            f'## Relevant Documents\n\n'
            f'{context}\n\n---\n\n'
            f'## Question (answer in {lang})\n'
            f'{query}'
        ),
    })

    result = chat_messages(messages)

    if 'error' in result:
        # LLM unavailable — graceful degradation with raw chunks
        fallback_parts = []
        for i, row in enumerate(rows[:3], 1):
            title = row.get('title', 'Document')
            content_text = row.get('content', '')
            fallback_parts.append(f'[{i}] {title}:\n{content_text[:400]}')
        return (
            '[Réponse automatique — service IA temporairement indisponible]\n\n'
            + '\n\n'.join(fallback_parts)
        )

    fallback = rows[0].get('content', 'No answer.')[:300] if rows else 'No answer.'
    return result.get('content', fallback)


# ---------------------------------------------------------------------------
# Main public function
# ---------------------------------------------------------------------------

def answer_question(
    question: str,
    history: Optional[list] = None,
    top_k: int = 8,
) -> dict:
    """
    Full RAG pipeline.

    Args:
        question: Student question (any language).
        history: [{'role': 'user'|'assistant', 'content': str}, ...]
        top_k: Number of document chunks to retrieve.

    Returns:
        {
            'question':   str,
            'answer':     str,
            'sources':    [{'rank', 'title', 'text', 'score', 'rerank_score', 'type'}, ...],
            'has_answer': bool,
            'language':   str,
        }
    """
    rows = retrieve_context(question, top_k=top_k)

    if not rows:
        lang = _detect_language(question)
        return {
            'question': question,
            'answer': _NO_ANSWER.get(lang, _NO_ANSWER['English']),
            'sources': [],
            'has_answer': False,
            'language': lang,
        }

    sources = []
    context_parts = []

    for i, row in enumerate(rows, 1):
        text = row.get('content', '')
        title = row.get('title', 'Unknown')
        score = float(row.get('similarity', 0))

        sources.append({
            'rank': i,
            'title': title,
            'text': text[:500] + '...' if len(text) > 500 else text,
            'score': score,
            'rerank_score': row.get('rerank_score', score),
            'type': row.get('type', 'document'),
        })
        context_parts.append(f'### [{title}] (chunk {i})\n{text}')

    context = '\n\n---\n\n'.join(context_parts)

    answer = _generate_answer(
        query=question,
        context=context,
        rows=rows,
        history=history or [],
    )

    return {
        'question': question,
        'answer': answer,
        'sources': sources,
        'has_answer': True,
        'language': _detect_language(question),
    }


# Public alias
detect_language = _detect_language
