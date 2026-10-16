# -*- coding: utf-8 -*-
"""
Shared retrieval + evaluation code for the RAG benchmark: BM25 (via the
rank_bm25 library), Dense/FAISS (via the faiss library, cosine similarity
using an IndexFlatIP over L2-normalized real production bge-m3 vectors),
Hybrid (RRF), and Recall/Precision/Faithfulness@k scoring.

Uses the actual rank_bm25 and faiss libraries (not hand-rolled
implementations) for closer methodological parity with the reference
paper's own "BM25" and "FAISS" framing.
"""
import json
import re
import urllib.request
from collections import defaultdict

import faiss
import numpy as np
from rank_bm25 import BM25Okapi

OLLAMA_URL = "http://127.0.0.1:11434/api/embeddings"
EMBED_MODEL = "bge-m3"
# Latin/digits + the Devanagari Unicode block (U+0900-U+097F, which also
# covers combining vowel signs/matras and virama) so Hindi text tokenizes
# into whole words instead of being silently dropped ([a-zA-Z0-9]+ alone
# matches nothing in Devanagari text, which was zeroing out BM25 for Hindi).
TOKEN_RE = re.compile(r"[a-zA-Z0-9ऀ-ॿ]+")


def tokenize(text):
    return [t.lower() for t in TOKEN_RE.findall(text)]


def embed_query(text, model=None):
    payload = json.dumps({"model": model or EMBED_MODEL, "prompt": text}).encode("utf-8")
    req = urllib.request.Request(OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["embedding"]


def load_corpus(path, subjects=None):
    chunks = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            c = json.loads(line)
            if subjects is not None and c["subject"] not in subjects:
                continue
            chunks.append(c)
    return chunks


def rrf_fuse(rank_lists, k=60):
    scores = defaultdict(float)
    for ranks in rank_lists:
        for rank, doc_id in enumerate(ranks):
            scores[doc_id] += 1.0 / (k + rank + 1)
    return sorted(scores.keys(), key=lambda d: -scores[d])


def evaluate(gold, ranked_lists_by_method, ks):
    results = {}
    for name, ranked_lists in ranked_lists_by_method.items():
        results[name] = {}
        for k in ks:
            recalls, precisions = [], []
            for q in gold:
                ranked = ranked_lists[q["id"]][:k]
                gold_ids = set(q["gold_chunk_ids"])
                hit = len(set(ranked) & gold_ids)
                recall = 1.0 if hit > 0 else 0.0
                precision = hit / k
                recalls.append(recall)
                precisions.append(precision)
            results[name][k] = {
                "recall": sum(recalls) / len(recalls),
                "precision": sum(precisions) / len(precisions),
                "faithfulness": sum(recalls) / len(recalls),
            }
    return results


def build_faiss_index(vec_matrix):
    """IndexFlatIP over L2-normalized vectors == exact cosine similarity search."""
    normed = vec_matrix.copy()
    faiss.normalize_L2(normed)
    index = faiss.IndexFlatIP(normed.shape[1])
    index.add(normed)
    return index


def run_experiment(label, corpus_chunks, gold, query_embed_fn=None, ks=(1, 3, 5, 10),
                    vector_store=None, qdrant_subject=None):
    """Runs BM25 (rank_bm25) + Dense/FAISS (faiss) + Hybrid (RRF) retrieval
    for `gold` questions against `corpus_chunks`, returns the evaluate()
    results dict.
    `query_embed_fn` defaults to embed_query (live Ollama call); pass a
    cache-backed function to reuse embeddings across corpus-size stages.

    If `vector_store` (a rag.vector_db.VectorDB instance) is given, ALSO
    runs a "Qdrant" method: the actual live production retrieval path
    (VectorDB.search(), same function main.py's real endpoints call — not
    a simulation), filtered to `qdrant_subject` so it searches the same
    subject-only corpus the other methods are scored against. Only valid
    for a single-subject stage, since VectorDB.search()'s subject filter
    is single-value (MatchValue), not a multi-subject match — left
    unchanged rather than extended, per "don't change what's already
    there, only add."
    """
    query_embed_fn = query_embed_fn or embed_query

    ids = [c["id"] for c in corpus_chunks]
    texts = [c["text"] for c in corpus_chunks]
    vec_matrix = np.array([c["vector"] for c in corpus_chunks], dtype=np.float32)

    print(f"[{label}] Building BM25 index (rank_bm25) over {len(ids)} chunks...")
    docs_tokens = [tokenize(t) for t in texts]
    bm25 = BM25Okapi(docs_tokens)

    print(f"[{label}] Building FAISS index (IndexFlatIP, cosine) over {len(ids)} chunks...")
    faiss_index = build_faiss_index(vec_matrix)

    bm25_ranks, dense_ranks, hybrid_ranks, qdrant_ranks = {}, {}, {}, {}
    for q in gold:
        qtok = tokenize(q["question"])
        bscores = bm25.get_scores(qtok)
        b_order = np.argsort(-bscores)
        b_ranked_ids = [ids[i] for i in b_order]
        bm25_ranks[q["id"]] = b_ranked_ids

        query_vec = query_embed_fn(q["question"])
        qvec = np.array([query_vec], dtype=np.float32)
        faiss.normalize_L2(qvec)
        _, idxs = faiss_index.search(qvec, len(ids))
        d_ranked_ids = [ids[i] for i in idxs[0]]
        dense_ranks[q["id"]] = d_ranked_ids

        hybrid_ranks[q["id"]] = rrf_fuse([b_ranked_ids, d_ranked_ids])

        if vector_store is not None:
            live_result = vector_store.search(
                query_vector=query_vec,
                subject=qdrant_subject,
                top_k=len(ids),
            )
            qdrant_ranks[q["id"]] = [c["id"] for c in live_result["chunks"]]

    methods = {"BM25": bm25_ranks, "Dense": dense_ranks, "Hybrid": hybrid_ranks}
    if vector_store is not None:
        methods["Qdrant"] = qdrant_ranks
    results = evaluate(gold, methods, list(ks))

    print(f"\n[{label}] {'Method':<10} {'k':<4} {'Recall':<10} {'Precision':<10} {'Faithfulness':<12}")
    for method in methods:
        for k in ks:
            r = results[method][k]
            print(f"{'':<{len(label) + 2}}{method:<10} {k:<4} {r['recall']:<10.3f} {r['precision']:<10.3f} {r['faithfulness']:<12.3f}")

    return results
