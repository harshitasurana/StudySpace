# -*- coding: utf-8 -*-
"""
Re-embeds the full cached corpus (rag_benchmark/corpus_cache/all_chunks.jsonl)
with a given local Ollama embedding model, so Dense/FAISS retrieval can be
benchmarked with that model instead of bge-m3 (the model the live Qdrant
corpus is actually indexed with). Query embeddings must come from the same
model as the corpus for cosine similarity to be meaningful, so this
produces a full parallel corpus cache, not just query vectors.

Usage:
    .venv/Scripts/python.exe rag_benchmark/scripts/embed_corpus_with_model.py nomic-embed-text

Writes rag_benchmark/corpus_cache/all_chunks__<model>.jsonl (same schema
as all_chunks.jsonl: id, subject, chapter, chapter_number, text, vector —
just a different embedding model's vector).
"""
import json
import os
import sys
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BENCH_ROOT = os.path.dirname(SCRIPT_DIR)
SRC_PATH = os.path.join(BENCH_ROOT, "corpus_cache", "all_chunks.jsonl")

OLLAMA_URL = "http://127.0.0.1:11434/api/embeddings"


def embed(model, text):
    payload = json.dumps({"model": model, "prompt": text}).encode("utf-8")
    req = urllib.request.Request(OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["embedding"]


def main():
    if len(sys.argv) != 2:
        print("Usage: embed_corpus_with_model.py <ollama-embedding-model-name>")
        sys.exit(1)
    model = sys.argv[1]

    rows = []
    with open(SRC_PATH, encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))
    print(f"Re-embedding {len(rows)} chunks with model '{model}'...")

    out_path = os.path.join(BENCH_ROOT, "corpus_cache", f"all_chunks__{model.replace(':', '-')}.jsonl")
    with open(out_path, "w", encoding="utf-8") as out_f:
        for i, row in enumerate(rows):
            vec = embed(model, row["text"])
            new_row = {
                "id": row["id"],
                "subject": row["subject"],
                "chapter": row["chapter"],
                "chapter_number": row["chapter_number"],
                "text": row["text"],
                "vector": vec,
            }
            out_f.write(json.dumps(new_row, ensure_ascii=False) + "\n")
            if (i + 1) % 100 == 0 or (i + 1) == len(rows):
                print(f"  embedded {i + 1}/{len(rows)}")

    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
