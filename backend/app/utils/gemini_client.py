"""
Gemini AI client wrapper (google-genai SDK).
Provides:
  - get_embedding(text)       → list[float]  (768-dim via text-embedding-004)
  - get_query_embedding(text) → list[float]
  - chat(prompt)              → str          (answer from gemini-2.0-flash)
"""

import os
from google import genai
from google.genai import types
from flask import current_app


def _get_client() -> genai.Client:
    """Build and return a Gemini client (v1beta) for chat/generation."""
    api_key = current_app.config.get("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in your .env file.")
    return genai.Client(api_key=api_key)


def _get_embedding_client() -> genai.Client:
    """Build and return a Gemini client for embedding (same base client)."""
    api_key = current_app.config.get("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in your .env file.")
    return genai.Client(api_key=api_key)


def get_embedding(text: str) -> list[float]:
    """
    Generate a 768-dimensional embedding for a document
    using gemini-embedding-001 with output_dimensionality=768.
    """
    client = _get_embedding_client()
    result = client.models.embed_content(
        model="models/gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=768,
        ),
    )
    return result.embeddings[0].values


def get_query_embedding(text: str) -> list[float]:
    """
    Generate a 768-dimensional embedding optimized for query retrieval.
    Use this for the student's question, not for stored documents.
    """
    client = _get_embedding_client()
    result = client.models.embed_content(
        model="models/gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=768,
        ),
    )
    return result.embeddings[0].values


def chat(prompt: str, system_instruction: str = None) -> str:
    """
    Send a single-turn prompt to Gemini and return the text response.
    """
    client = _get_client()
    sys_instr = system_instruction or (
        "You are UniHelp, a helpful university assistant. "
        "Answer student questions clearly and concisely in the same language the student uses. "
        "If you cannot find the answer in the provided context, say so honestly."
    )
    response = client.models.generate_content(
        model="gemini-2.0-flash-lite",
        contents=prompt,
        config=types.GenerateContentConfig(system_instruction=sys_instr),
    )
    return response.text


def chat_messages(messages: list[dict]) -> dict:
    """
    Multi-turn chat matching the rag-base llm.chat(messages) interface.

    Accepts messages in the format used by rag-base:
        [{"role": "system",    "content": "..."},
         {"role": "user",      "content": "..."},
         {"role": "assistant", "content": "..."},
         ...]

    Returns:
        {"content": str}   on success
        {"error": str}     on failure
    """
    client = _get_client()

    # Extract system messages -> system_instruction
    system_parts = [
        m["content"] for m in messages
        if m.get("role") == "system" and m.get("content")
    ]
    sys_instr = "\n".join(system_parts) if system_parts else None

    # Build conversation turns (user / model)
    contents = []
    for m in messages:
        role    = m.get("role", "")
        content = m.get("content", "")
        if not content or role == "system":
            continue
        # rag-base uses 'assistant'; Gemini SDK expects 'model'
        gemini_role = "model" if role == "assistant" else "user"
        contents.append({"role": gemini_role, "parts": [{"text": content}]})

    if not contents:
        return {"error": "No user/assistant messages provided"}

    try:
        cfg = types.GenerateContentConfig(system_instruction=sys_instr) if sys_instr else None
        response = client.models.generate_content(
            model="gemini-2.0-flash-lite",
            contents=contents,
            config=cfg,
        )
        return {"content": response.text}
    except Exception as e:
        return {"error": str(e)}
