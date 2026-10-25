import logging
import random

from rag.data_loader import embed_texts
from rag.vector_db import VectorDB

logger = logging.getLogger(__name__)

# A fresh VectorDB client here connects to the exact same Qdrant collection
# main.py's own `vector_store` does (QDRANT_URL/QDRANT_COLLECTION env
# vars) — it's just a separate lightweight client instance, not shared
# state. This module has to have no import-time dependency on main.py:
# the Celery worker (core/mindmap_tasks.py) imports this module, and
# main.py imports the Celery task to call .delay() on it, so main.py ->
# core/mindmap_tasks.py -> core/mindmap_retrieval.py -> main.py would be
# circular.
_vector_store = VectorDB()

MAX_CONTEXT_CHARS = 5000


def retrieve_varied_chapter_chunks(
    subject,
    chapter,
    error_log_context,
    class_name=None,
    max_chunks=6,
    max_context_chars=MAX_CONTEXT_CHARS,
):
    """Shared retrieval behind quiz/flashcard generation (via main.py's
    _retrieve_varied_chapter_context), mind-map generation (needs real
    per-chunk source/page metadata for citations, not just flattened
    text), and slide-deck generation — including their respective Celery-
    backed background tasks. Moved out of main.py so the worker can call
    it without importing main.py. top_k is intentionally wide (20) and
    then randomly subsampled — a fixed, narrow top_k fed the exact same
    chunks into the same generation call every time, so repeated
    generations for a chapter came out nearly identical. Sampling a
    different slice of the chapter's (still relevant, still ranked-
    relevant) content each call gives real generation-to-generation
    variety without losing grounding. Returns the raw chunk dicts (see
    vector_db.py's search() for shape: text/source/page/chapter/...).

    class_name is optional and defaults to None (unscoped) — only the
    mind-map/slide-deck call sites currently pass it. Quiz/flashcard
    generation has the identical class-scoping gap today; deliberately
    left unscoped here rather than fixed "for free" in this same pass,
    to avoid silently expanding this change's scope.

    max_chunks/max_context_chars default to the original mind-map/quiz/
    flashcard budget — slide-deck generation passes larger values (see
    core/slide_deck_tasks.py) when asked for a more detailed, longer
    deck, without changing behavior for any other caller."""
    try:
        query_vec = embed_texts([f"{chapter} overview key concepts"])[0]
        found = _vector_store.search(
            query_vector=query_vec,
            subject=subject,
            chapter=chapter,
            class_name=class_name,
            top_k=20,
        )
        chunks = [c for c in found["chunks"] if isinstance(c.get("text"), str) and c["text"].strip()]
    except Exception:
        logger.exception(f"Vector search failed for {error_log_context}")
        chunks = []

    # Sample from the full retrieved set (up to all 20) rather than
    # always capping the pool at 10 — a caller asking for more final
    # chunks (max_chunks) should also get to draw from a wider pool,
    # not just take more from the same small sample.
    pool_size = min(len(chunks), max(max_chunks, 10))
    sampled_chunks = random.sample(chunks, pool_size) if pool_size else []

    selected_chunks = []
    current_chars = 0
    for chunk in sampled_chunks:
        remaining = max_context_chars - current_chars
        if remaining <= 0:
            break
        clean_text = chunk["text"].strip()[:remaining]
        selected_chunks.append({**chunk, "text": clean_text})
        current_chars += len(clean_text)
        if len(selected_chunks) >= max_chunks:
            break

    return selected_chunks


def retrieve_node_context(node_label, chapter, class_name=None, subject=None, top_k=8):
    """Small, tightly-scoped retrieval for one mind-map node's own
    grandchildren expansion (see main.py's _expand_concept_overview_depth)
    — unlike retrieve_varied_chapter_chunks' wide chapter-level query,
    this is scoped to the specific node's own label so the returned
    evidence is genuinely about that sub-concept, not another pass over
    the whole chapter. Returning few/no chunks is expected and meaningful
    — it's the caller's signal that this node doesn't have enough real
    grounded content to justify a third mind-map level."""
    try:
        query_vec = embed_texts([f"{node_label} {chapter}"])[0]
        found = _vector_store.search(
            query_vector=query_vec,
            subject=subject,
            chapter=chapter,
            class_name=class_name,
            top_k=top_k,
        )
        chunks = [c for c in found["chunks"] if isinstance(c.get("text"), str) and c["text"].strip()]
    except Exception:
        logger.exception(f"Vector search failed for mind-map node expansion: {node_label}")
        chunks = []
    return chunks
