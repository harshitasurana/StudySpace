# -*- coding: utf-8 -*-
"""
Decomposes generation-quality results (run_generation_benchmark.py's
output) into retrieval-failure vs. generation-failure: for each question,
checks whether the gold chunk was actually present in the top-k context
that was fed to the generator models. A wrong/partial answer when the
gold chunk WASN'T in context is a retrieval failure, not a fair knock on
the generator; a wrong answer when the gold chunk WAS in context is a
genuine generation failure.

Also generates the summary graphs (overall accuracy per model, and
accuracy split by retrieval-hit vs retrieval-miss).

Usage:
    .venv/Scripts/python.exe rag_benchmark/scripts/analyze_generation_quality.py Hindi
"""
import importlib
import json
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BENCH_ROOT = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, SCRIPT_DIR)
sys.path.insert(0, os.path.join(BENCH_ROOT, "gold_questions"))

import benchmark_lib as bl  # noqa: E402
from run_generation_benchmark import build_hybrid_topk, TOP_K  # noqa: E402

CORPUS_PATH = os.path.join(BENCH_ROOT, "corpus_cache", "all_chunks.jsonl")


def main():
    if len(sys.argv) != 2:
        print("Usage: analyze_generation_quality.py <Subject>")
        sys.exit(1)
    subject = sys.argv[1]

    module_name = f"{subject.lower().replace(' ', '_')}_gold_questions"
    gq_module = importlib.import_module(module_name)
    gold = gq_module.GOLD_QUESTIONS
    gold_by_id = {q["id"]: q for q in gold}

    results_dir = os.path.join(BENCH_ROOT, "results", subject.lower().replace(" ", "_"))
    graphs_dir = os.path.join(results_dir, "graphs")
    os.makedirs(graphs_dir, exist_ok=True)

    with open(os.path.join(results_dir, "generation_quality.json"), encoding="utf-8") as f:
        gen_data = json.load(f)
    generator_models = gen_data["generator_models"]

    all_chunks = bl.load_corpus(CORPUS_PATH)
    own_chunks = [c for c in all_chunks if c["subject"] == subject]

    print(f"Recomputing top-{TOP_K} Hybrid context per question to check retrieval hit/miss...")
    context_ids_by_qid = {}
    ids = [c["id"] for c in own_chunks]
    texts = [c["text"] for c in own_chunks]
    docs_tokens = [bl.tokenize(t) for t in texts]
    bm25 = bl.BM25Okapi(docs_tokens)
    import numpy as np
    vec_matrix = np.array([c["vector"] for c in own_chunks], dtype=np.float32)
    faiss_index = bl.build_faiss_index(vec_matrix)
    for q in gold:
        qtok = bl.tokenize(q["question"])
        bscores = bm25.get_scores(qtok)
        b_order = np.argsort(-bscores)
        b_ranked_ids = [ids[i] for i in b_order]
        qvec = np.array([bl.embed_query(q["question"])], dtype=np.float32)
        bl.faiss.normalize_L2(qvec)
        _, idxs = faiss_index.search(qvec, len(ids))
        d_ranked_ids = [ids[i] for i in idxs[0]]
        hybrid_ids = bl.rrf_fuse([b_ranked_ids, d_ranked_ids])[:TOP_K]
        context_ids_by_qid[q["id"]] = hybrid_ids

    # --- Retrieval hit/miss + generation accuracy split ---
    retrieval_hits = 0
    split_counts = {
        m: {"hit": {"CORRECT": 0, "PARTIAL": 0, "INCORRECT": 0, "ERROR": 0},
            "miss": {"CORRECT": 0, "PARTIAL": 0, "INCORRECT": 0, "ERROR": 0}}
        for m in generator_models
    }

    per_question_analysis = []
    for row in gen_data["per_question"]:
        qid = row["id"]
        q = gold_by_id[qid]
        gold_ids = set(q["gold_chunk_ids"])
        context_ids = context_ids_by_qid[qid]
        hit = bool(gold_ids & set(context_ids))
        retrieval_hits += int(hit)

        for model in generator_models:
            verdict = row["answers"][model]["verdict"]
            bucket = "hit" if hit else "miss"
            key = verdict if verdict in split_counts[model][bucket] else "ERROR"
            split_counts[model][bucket][key] += 1

        per_question_analysis.append({"id": qid, "retrieval_hit": hit, "context_ids": context_ids})

    n = len(gen_data["per_question"])
    retrieval_hit_rate = retrieval_hits / n

    def accuracy(counts):
        total = sum(counts.values())
        if total == 0:
            return None
        return (counts["CORRECT"] + 0.5 * counts["PARTIAL"]) / total

    decomposition = {}
    for model in generator_models:
        hit_counts = split_counts[model]["hit"]
        miss_counts = split_counts[model]["miss"]
        decomposition[model] = {
            "hit_n": sum(hit_counts.values()),
            "hit_counts": hit_counts,
            "hit_accuracy": accuracy(hit_counts),
            "miss_n": sum(miss_counts.values()),
            "miss_counts": miss_counts,
            "miss_accuracy": accuracy(miss_counts),
        }

    print(f"\nRetrieval hit rate (gold chunk in top-{TOP_K} Hybrid context): {retrieval_hit_rate:.3f} ({retrieval_hits}/{n})")
    print(f"\n{'Model':<16} {'Hit N':<7} {'Hit Acc':<9} {'Miss N':<7} {'Miss Acc':<9}")
    for model, d in decomposition.items():
        miss_acc_str = f"{d['miss_accuracy']:.3f}" if d["miss_accuracy"] is not None else "n/a"
        hit_acc_str = f"{d['hit_accuracy']:.3f}" if d["hit_accuracy"] is not None else "n/a"
        print(f"{model:<16} {d['hit_n']:<7} {hit_acc_str:<9} {d['miss_n']:<7} {miss_acc_str:<9}")

    out_path = os.path.join(results_dir, "generation_analysis.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "subject": subject,
            "top_k": TOP_K,
            "n_questions": n,
            "retrieval_hit_rate": retrieval_hit_rate,
            "decomposition": decomposition,
            "per_question": per_question_analysis,
        }, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {out_path}")

    # --- Graph 1: overall generation accuracy per model (stacked verdict counts) ---
    fig, ax = plt.subplots(figsize=(8, 5))
    verdict_keys = ["CORRECT", "PARTIAL", "INCORRECT", "ERROR"]
    colors = {"CORRECT": "#2ca02c", "PARTIAL": "#ff9f1c", "INCORRECT": "#d62728", "ERROR": "#7f7f7f"}
    bottoms = [0] * len(generator_models)
    for verdict in verdict_keys:
        vals = [gen_data["summary"][m]["counts"].get(verdict, 0) for m in generator_models]
        ax.bar(generator_models, vals, bottom=bottoms, label=verdict, color=colors[verdict])
        bottoms = [b + v for b, v in zip(bottoms, vals)]
    ax.set_ylim(0, n * 1.15)
    for i, m in enumerate(generator_models):
        acc = gen_data["summary"][m]["accuracy"]
        ax.text(i, bottoms[i] + n * 0.03, f"{acc * 100:.1f}%", ha="center", fontweight="bold")
    ax.set_ylabel("# Questions")
    ax.set_title(f"{subject}: Generation-quality verdicts per model (n={n}, top-{TOP_K} Hybrid context)")
    ax.legend(loc="upper right", fontsize=8)
    fig.tight_layout()
    out1 = os.path.join(graphs_dir, f"{subject.lower()}_generation_quality.png")
    fig.savefig(out1, dpi=150)
    plt.close(fig)
    print(f"Saved {out1}")

    # --- Graph 2: accuracy split by retrieval hit vs miss ---
    fig, ax = plt.subplots(figsize=(8, 5))
    x = range(len(generator_models))
    width = 0.35
    hit_accs = [decomposition[m]["hit_accuracy"] or 0 for m in generator_models]
    miss_accs = [decomposition[m]["miss_accuracy"] or 0 for m in generator_models]
    ax.bar([xi - width / 2 for xi in x], hit_accs, width, label=f"Retrieval HIT (gold chunk in context, n≈{decomposition[generator_models[0]]['hit_n']})", color="#2ca02c")
    ax.bar([xi + width / 2 for xi in x], miss_accs, width, label=f"Retrieval MISS (gold chunk missing, n≈{decomposition[generator_models[0]]['miss_n']})", color="#d62728")
    ax.set_xticks(list(x))
    ax.set_xticklabels(generator_models)
    ax.set_ylabel("Accuracy (CORRECT + 0.5×PARTIAL)")
    ax.set_ylim(0, 1.05)
    ax.set_title(f"{subject}: Generation accuracy when retrieval succeeds vs. fails")
    ax.legend(fontsize=8)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    out2 = os.path.join(graphs_dir, f"{subject.lower()}_generation_vs_retrieval.png")
    fig.savefig(out2, dpi=150)
    plt.close(fig)
    print(f"Saved {out2}")


if __name__ == "__main__":
    main()
