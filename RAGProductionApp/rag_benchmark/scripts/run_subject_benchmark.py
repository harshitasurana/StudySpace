# -*- coding: utf-8 -*-
"""
Runs the BM25 / Dense / Hybrid (/ Qdrant) benchmark for ONE subject at a
time (per the decision to do this subject-wise rather than all at once):

1. Base experiment: <subject>-only corpus. When embedding_model is the
   production model (bge-m3), this ALSO runs "Qdrant": the actual live
   production retrieval path (VectorDB.search(), real Qdrant server, not
   a simulation) as its own labeled, formally-scored method.
2. Corpus-growth stress test: incrementally mixing in the other 4
   subjects as real, non-duplicated distractor content, up to the full
   corpus, to see how much retrieval quality degrades with a bigger,
   noisier search space.

Usage:
    .venv/Scripts/python.exe rag_benchmark/scripts/run_subject_benchmark.py Science
    .venv/Scripts/python.exe rag_benchmark/scripts/run_subject_benchmark.py Science nomic-embed-text

The embedding model arg is optional, default bge-m3 (the model the live
Qdrant corpus is actually indexed with — the "production" comparison
point). Any other value must have a matching pre-built corpus cache at
rag_benchmark/corpus_cache/all_chunks__<model>.jsonl (see
embed_corpus_with_model.py) since Dense/FAISS retrieval needs the corpus
embedded with the SAME model as the query.

Results (raw JSON) are written to rag_benchmark/results/<subject>/,
suffixed with the embedding model name for anything other than bge-m3 so
the two never overwrite each other.
"""
import importlib
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BENCH_ROOT = os.path.dirname(SCRIPT_DIR)
REPO_ROOT = os.path.dirname(BENCH_ROOT)
sys.path.insert(0, SCRIPT_DIR)
sys.path.insert(0, os.path.join(BENCH_ROOT, "gold_questions"))
sys.path.insert(0, REPO_ROOT)

import benchmark_lib as bl  # noqa: E402

ALL_SUBJECTS = ["Science", "Hindi", "English", "Social Studies", "Mathematics"]
PRODUCTION_EMBED_MODEL = "bge-m3"


def main():
    if len(sys.argv) not in (2, 3):
        print("Usage: run_subject_benchmark.py <Subject> [embedding_model]")
        print(f"Known subjects: {ALL_SUBJECTS}")
        sys.exit(1)
    subject = sys.argv[1]
    embed_model = sys.argv[2] if len(sys.argv) == 3 else PRODUCTION_EMBED_MODEL
    if subject not in ALL_SUBJECTS:
        print(f"Unknown subject '{subject}'. Known: {ALL_SUBJECTS}")
        sys.exit(1)

    model_suffix = "" if embed_model == PRODUCTION_EMBED_MODEL else f"__{embed_model.replace(':', '-')}"
    corpus_filename = "all_chunks.jsonl" if not model_suffix else f"all_chunks{model_suffix}.jsonl"
    corpus_path = os.path.join(BENCH_ROOT, "corpus_cache", corpus_filename)
    if not os.path.exists(corpus_path):
        print(f"No corpus cache for embedding model '{embed_model}' at {corpus_path}.")
        print(f"Run: .venv/Scripts/python.exe rag_benchmark/scripts/embed_corpus_with_model.py {embed_model}")
        sys.exit(1)

    module_name = f"{subject.lower().replace(' ', '_')}_gold_questions"
    try:
        gq_module = importlib.import_module(module_name)
    except ModuleNotFoundError:
        print(f"No gold question file found: rag_benchmark/gold_questions/{module_name}.py")
        sys.exit(1)
    gold = gq_module.GOLD_QUESTIONS
    print(f"Subject: {subject} | Embedding model: {embed_model} | Gold questions: {len(gold)}")

    results_dir = os.path.join(BENCH_ROOT, "results", subject.lower().replace(" ", "_"))
    os.makedirs(results_dir, exist_ok=True)

    all_chunks = bl.load_corpus(corpus_path)
    own_chunks = [c for c in all_chunks if c["subject"] == subject]
    other_subjects = [s for s in ALL_SUBJECTS if s != subject]
    others_by_subject = {s: [c for c in all_chunks if c["subject"] == s] for s in other_subjects}
    print(f"{subject}-only corpus: {len(own_chunks)} chunks | Full corpus: {len(all_chunks)} chunks")

    # Only meaningful against bge-m3: that's the model the live Qdrant
    # collection is actually indexed with. A different embedding model's
    # query vector compared against bge-m3-indexed points would be
    # comparing two unrelated vector spaces.
    vector_store = None
    if embed_model == PRODUCTION_EMBED_MODEL:
        from rag.vector_db import VectorDB
        vector_store = VectorDB()

    # Pre-embed every gold query ONCE (query text doesn't change across corpus-size stages).
    print(f"Pre-embedding {len(gold)} queries via Ollama {embed_model} (GPU-accelerated)...")
    cache = {}
    for i, q in enumerate(gold):
        cache[q["question"]] = bl.embed_query(q["question"], model=embed_model)
        if (i + 1) % 15 == 0 or (i + 1) == len(gold):
            print(f"  embedded {i + 1}/{len(gold)}")

    def cached_embed(text):
        return cache[text]

    # --- Stage 0: subject-only corpus ---
    base_results = bl.run_experiment(
        f"{subject}-only ({len(own_chunks)} chunks)", own_chunks, gold, cached_embed,
        vector_store=vector_store, qdrant_subject=subject,
    )
    with open(os.path.join(results_dir, f"results_base{model_suffix}.json"), "w", encoding="utf-8") as f:
        json.dump({"corpus_size": len(own_chunks), "embedding_model": embed_model, "results": base_results}, f, indent=2)

    # --- Corpus-growth stages: add other subjects one at a time ---
    growth_all = {"stage0_base": {"corpus_size": len(own_chunks), "results": base_results}}
    cumulative = list(own_chunks)
    for i, other in enumerate(other_subjects, start=1):
        cumulative = cumulative + others_by_subject[other]
        label = f"stage{i}_plus_{other.lower().replace(' ', '_')}_{len(cumulative)}"
        stage_results = bl.run_experiment(f"{label} ({len(cumulative)} chunks)", cumulative, gold, cached_embed)
        growth_all[label] = {"corpus_size": len(cumulative), "results": stage_results}

    with open(os.path.join(results_dir, f"growth_results{model_suffix}.json"), "w", encoding="utf-8") as f:
        json.dump(growth_all, f, indent=2)

    print(f"\nSaved all results for '{subject}' ({embed_model}) to {results_dir}")
    return results_dir, subject


if __name__ == "__main__":
    main()
