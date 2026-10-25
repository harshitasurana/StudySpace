"""
Additive retrieval-comparison utility: runs BM25 (rank_bm25), FAISS
(faiss.IndexFlatIP cosine over the same bge-m3 vectors already stored in
Qdrant), Hybrid (Reciprocal Rank Fusion of the two), and the existing
live Qdrant dense search side-by-side for a given query, so retrieval
quality can be compared/tested directly against the production path.

This does NOT change how any existing endpoint retrieves context —
vector_store.search() (Qdrant) is called exactly as it already is
elsewhere in the app. BM25/FAISS indices here are built in-memory, per
request, from a read-only Qdrant scroll (same collection, same points);
nothing is written back to Qdrant.
"""
import re
from collections import defaultdict

import faiss
import numpy as np
from qdrant_client.models import FieldCondition, Filter, MatchValue
from rank_bm25 import BM25Okapi

from rag.data_loader import embed_texts
from rag.vector_db import VectorDB

# Latin/digits + the Devanagari Unicode block (U+0900-U+097F) so Hindi
# text tokenizes into whole words instead of being silently dropped by
# BM25 ([a-zA-Z0-9]+ alone matches nothing in Devanagari text).
TOKEN_RE = re.compile(r"[a-zA-Z0-9ऀ-ॿ]+")


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in TOKEN_RE.findall(text or "")]


def _fetch_chunks(vector_store: VectorDB, subject: str | None, chapter: str | None):
    """Read-only scroll of the Qdrant collection (id, text, vector, payload),
    optionally filtered by subject/chapter — same filter fields VectorDB.search()
    already supports."""
    conditions = []
    if subject:
        conditions.append(FieldCondition(key="subject", match=MatchValue(value=subject)))
    if chapter:
        conditions.append(FieldCondition(key="chapter", match=MatchValue(value=chapter)))
    query_filter = Filter(must=conditions) if conditions else None

    chunks = []
    offset = None
    while True:
        points, offset = vector_store.client.scroll(
            collection_name=vector_store.collection,
            scroll_filter=query_filter,
            limit=256,
            offset=offset,
            with_payload=True,
            with_vectors=True,
        )
        for p in points:
            payload = p.payload or {}
            chunks.append(
                {
                    "id": str(p.id),
                    "text": payload.get("text", ""),
                    "vector": p.vector,
                    "payload": payload,
                }
            )
        if offset is None:
            break
    return chunks


def _rrf_fuse(rank_lists, k=60):
    scores = defaultdict(float)
    for ranks in rank_lists:
        for rank, doc_id in enumerate(ranks):
            scores[doc_id] += 1.0 / (k + rank + 1)
    return sorted(scores.keys(), key=lambda d: -scores[d])


def _chunk_summary(chunk, score=None):
    payload = chunk["payload"]
    out = {
        "id": chunk["id"],
        "subject": payload.get("subject"),
        "chapter": payload.get("chapter"),
        "text": (chunk["text"] or "")[:300],
    }
    if score is not None:
        out["score"] = float(score)
    return out


def compare_retrieval(
    vector_store: VectorDB,
    query: str,
    subject: str | None = None,
    chapter: str | None = None,
    top_k: int = 5,
):
    """Runs Qdrant (existing live path), BM25, FAISS/Dense, and Hybrid
    retrieval for `query` and returns their top_k results side-by-side,
    for comparison/testing. Read-only against Qdrant."""

    # --- Existing live path, unchanged ---
    query_vector = embed_texts([query])[0]
    qdrant_result = vector_store.search(
        query_vector=query_vector,
        subject=subject,
        chapter=chapter,
        top_k=top_k,
    )
    qdrant_chunks = [
        {
            "id": c["id"],
            "subject": c["subject"],
            "chapter": c["chapter"],
            "text": (c["text"] or "")[:300],
            "score": c["score"],
        }
        for c in qdrant_result["chunks"]
    ]

    # --- Pull the same searchable set for BM25/FAISS (read-only) ---
    chunks = _fetch_chunks(vector_store, subject, chapter)
    if not chunks:
        return {
            "query": query,
            "subject": subject,
            "chapter": chapter,
            "corpus_size": 0,
            "qdrant": qdrant_chunks,
            "bm25": [],
            "faiss_dense": [],
            "hybrid": [],
        }

    ids = [c["id"] for c in chunks]
    texts = [c["text"] for c in chunks]
    vec_matrix = np.array([c["vector"] for c in chunks], dtype=np.float32)

    # --- BM25 ---
    docs_tokens = [_tokenize(t) for t in texts]
    bm25 = BM25Okapi(docs_tokens)
    bm25_scores = bm25.get_scores(_tokenize(query))
    bm25_order = np.argsort(-bm25_scores)
    bm25_ranked_ids = [ids[i] for i in bm25_order]
    bm25_results = [
        _chunk_summary(chunks[i], bm25_scores[i]) for i in bm25_order[:top_k]
    ]

    # --- FAISS / Dense (cosine, IndexFlatIP over L2-normalized vectors) ---
    normed = vec_matrix.copy()
    faiss.normalize_L2(normed)
    index = faiss.IndexFlatIP(normed.shape[1])
    index.add(normed)

    qvec = np.array([query_vector], dtype=np.float32)
    faiss.normalize_L2(qvec)
    scores, idxs = index.search(qvec, len(ids))
    faiss_order = idxs[0]
    faiss_ranked_ids = [ids[i] for i in faiss_order]
    faiss_results = [
        _chunk_summary(chunks[i], scores[0][rank]) for rank, i in enumerate(faiss_order[:top_k])
    ]

    # --- Hybrid (RRF over BM25 + FAISS rankings) ---
    hybrid_ranked_ids = _rrf_fuse([bm25_ranked_ids, faiss_ranked_ids])
    id_to_chunk = {c["id"]: c for c in chunks}
    hybrid_results = [
        _chunk_summary(id_to_chunk[cid]) for cid in hybrid_ranked_ids[:top_k]
    ]

    return {
        "query": query,
        "subject": subject,
        "chapter": chapter,
        "corpus_size": len(chunks),
        "qdrant": qdrant_chunks,
        "bm25": bm25_results,
        "faiss_dense": faiss_results,
        "hybrid": hybrid_results,
    }
