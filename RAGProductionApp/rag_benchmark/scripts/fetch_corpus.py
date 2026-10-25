# -*- coding: utf-8 -*-
"""
Pulls the full "docs" collection out of the local Qdrant instance (id,
subject, chapter, chapter_number, text, and the real production bge-m3
vector for every chunk) and writes it to
rag_benchmark/corpus_cache/all_chunks.jsonl.

Run this whenever the corpus in Qdrant changes and the cached extract
needs refreshing. Read-only against Qdrant (scroll only, no writes).
"""
import json
import os

from qdrant_client import QdrantClient

QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
COLLECTION = "docs"
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "corpus_cache", "all_chunks.jsonl")


def main():
    client = QdrantClient(url=QDRANT_URL)
    out_path = os.path.abspath(OUT_PATH)
    count = 0
    with open(out_path, "w", encoding="utf-8") as f:
        offset = None
        while True:
            points, offset = client.scroll(
                collection_name=COLLECTION,
                limit=256,
                offset=offset,
                with_payload=True,
                with_vectors=True,
            )
            for p in points:
                payload = p.payload or {}
                row = {
                    "id": str(p.id),
                    "subject": payload.get("subject"),
                    "chapter": payload.get("chapter"),
                    "chapter_number": payload.get("chapter_number"),
                    "text": payload.get("text"),
                    "vector": p.vector,
                }
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
                count += 1
            if offset is None:
                break
    print(f"Wrote {count} chunks to {out_path}")


if __name__ == "__main__":
    main()
