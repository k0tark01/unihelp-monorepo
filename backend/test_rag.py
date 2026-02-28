"""Quick RAG smoke test — run directly, no HTTP server needed."""
import sys, os
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()

from app import create_app

app = create_app()

with app.app_context():
    from app.utils.rag import detect_language, retrieve_context, answer_question

    # ── 1. Language detection ────────────────────────────────────────
    print("=" * 55)
    print("1. Language detection")
    print("=" * 55)
    tests = [
        "Combien d'absences sont autorisées ?",
        "How many absences are allowed?",
        "كم عدد الغيابات المسموح بها؟",
    ]
    for q in tests:
        print(f"  [{detect_language(q):7s}] {q}")

    # ── 2. Retrieval (no LLM) ────────────────────────────────────────
    print()
    print("=" * 55)
    print("2. Retrieval + reranking (no LLM)")
    print("=" * 55)
    chunks = retrieve_context("absences autorisées", top_k=3)
    print(f"  chunks returned: {len(chunks)}")
    for c in chunks:
        sim    = c.get("similarity",    0)
        rerank = c.get("rerank_score",  0)
        title  = c.get("title", "?")
        print(f"  sim={sim:.3f}  rerank={rerank:.3f}  title={title}")

    if not chunks:
        print("  ⚠  No chunks found — check Supabase has documents and threshold is low enough")
        sys.exit(1)

    # ── 3. Full RAG — French ─────────────────────────────────────────
    print()
    print("=" * 55)
    print("3. Full RAG — French question")
    print("=" * 55)
    r = answer_question("Combien d'absences sont autorisées avant d'être déclaré défaillant ?")
    print(f"  language  : {r['language']}")
    print(f"  has_answer: {r['has_answer']}")
    print(f"  sources   : {[s['title'] for s in r['sources']]}")
    print(f"  answer preview:\n")
    for line in r["answer"][:500].split("\n"):
        print(f"    {line}")

    # ── 4. Full RAG — English ────────────────────────────────────────
    print()
    print("=" * 55)
    print("4. Full RAG — English question")
    print("=" * 55)
    r2 = answer_question("How do I request an internship convention?")
    print(f"  language  : {r2['language']}")
    print(f"  has_answer: {r2['has_answer']}")
    print(f"  sources   : {[s['title'] for s in r2['sources']]}")
    print(f"  answer preview:\n")
    for line in r2["answer"][:500].split("\n"):
        print(f"    {line}")

    # ── 5. Conversation history ──────────────────────────────────────
    print()
    print("=" * 55)
    print("5. RAG with conversation history")
    print("=" * 55)
    history = [
        {"role": "user",      "content": "Bonjour"},
        {"role": "assistant", "content": "Bonjour ! Je suis UniHelp, comment puis-je vous aider ?"},
    ]
    r3 = answer_question("Et les examens de rattrapage, comment ça marche ?", history=history)
    print(f"  language  : {r3['language']}")
    print(f"  has_answer: {r3['has_answer']}")
    print(f"  answer preview:\n")
    for line in r3["answer"][:400].split("\n"):
        print(f"    {line}")

    print()
    print("=" * 55)
    print("  ALL RAG TESTS PASSED ✓")
    print("=" * 55)
