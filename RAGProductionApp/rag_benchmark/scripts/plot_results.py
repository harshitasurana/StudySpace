# -*- coding: utf-8 -*-
"""
Generates graphs from a subject's benchmark results:
  1. Recall/Precision@k bar chart for the subject-only corpus, with the
     reference paper's BM25/FAISS/Hybrid @k=3 baselines overlaid as
     horizontal reference lines.
  2. Recall@3 and Precision@3 vs. corpus-size line chart (the
     corpus-growth stress test).

Usage:
    .venv/Scripts/python.exe rag_benchmark/scripts/plot_results.py Science
"""
import json
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BENCH_ROOT = os.path.dirname(SCRIPT_DIR)

# Reference paper (NCERT-RAG-Eval, Sci Rep, DOI 10.1038/s41598-026-71757-y) @ k=3
PAPER_BASELINES = {
    "BM25": {"recall": 0.682, "precision": 0.280},
    "FAISS": {"recall": 0.807, "precision": 0.341},
    "Hybrid": {"recall": 0.818, "precision": 0.348},
}


def _method_label(method, embed_model):
    # BM25 is keyword-only, no embedding model involved. Dense/Qdrant/Hybrid
    # all depend on the embedding model, so label them explicitly - a bare
    # "Dense" or "Qdrant" bar gives no visual indication of which embedding
    # model produced it (that fact was previously only in the JSON, not on
    # the chart itself).
    if method == "BM25":
        return "BM25 (keyword, no embedding)"
    return f"{method} ({embed_model})"


def plot_base_bars(subject, base_results, out_path, embed_model="bge-m3"):
    # Qdrant (the actual live production retrieval path) is only present
    # when the benchmark was run with the production embedding model
    # (bge-m3) and a vector_store was passed in - include it when there.
    method_order = ["BM25", "Dense", "Hybrid", "Qdrant"]
    methods = [m for m in method_order if m in base_results]
    ks = [1, 3, 5, 10]
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    n = len(methods)
    width = 0.8 / n

    for ax, metric in zip(axes, ["recall", "precision"]):
        x = range(len(ks))
        for i, method in enumerate(methods):
            vals = [base_results[method][str(k)][metric] for k in ks]
            ax.bar([xi + i * width for xi in x], vals, width, label=_method_label(method, embed_model))
        ax.set_xticks([xi + width * (n - 1) / 2 for xi in x])
        ax.set_xticklabels([f"k={k}" for k in ks])
        ax.set_ylabel(metric.capitalize())
        ax.set_title(f"{subject}: {metric.capitalize()}@k")
        ax.set_ylim(0, 1.05)
        ax.legend(fontsize=8)
        ax.grid(axis="y", alpha=0.3)

    # Add paper baselines as a separate annotation on the k=3 group
    for ax, metric in zip(axes, ["recall", "precision"]):
        k3_idx = ks.index(3)
        center_offset = width * (n - 1) / 2
        for j, (pname, pvals) in enumerate(PAPER_BASELINES.items()):
            ax.axhline(pvals[metric], linestyle="--", alpha=0.35, linewidth=1, color=["gray", "black", "red"][j])
            ax.scatter([k3_idx + center_offset], [pvals[metric]], marker="*", s=180,
                       color=["gray", "black", "red"][j], zorder=5,
                       label=f"paper {pname}@3")
        ax.legend(fontsize=7)

    fig.suptitle(f"{subject} corpus — Retrieval quality vs. NCERT-RAG-Eval paper baselines\n"
                 f"(ours: embedding model = {embed_model}, run locally; paper: BM25/FAISS/Hybrid as reported)")
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"Saved {out_path}")


def plot_growth(subject, growth_results, out_path, embed_model="bge-m3"):
    stages = list(growth_results.keys())
    sizes = [growth_results[s]["corpus_size"] for s in stages]
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    for ax, metric in zip(axes, ["recall", "precision"]):
        for method in ["BM25", "Dense", "Hybrid"]:
            vals = [growth_results[s]["results"][method]["3"][metric] for s in stages]
            ax.plot(sizes, vals, marker="o", label=_method_label(method, embed_model))
        ax.set_xlabel("Corpus size (chunks)")
        ax.set_ylabel(f"{metric.capitalize()}@3")
        ax.set_title(f"{subject}: {metric.capitalize()}@3 vs corpus size")
        ax.set_ylim(0, 1.05)
        ax.legend(fontsize=8)
        ax.grid(alpha=0.3)

    fig.suptitle(f"{subject} — Corpus-growth stress test (real non-duplicated distractor content)\n"
                 f"(embedding model = {embed_model})")
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"Saved {out_path}")


def main():
    if len(sys.argv) != 2:
        print("Usage: plot_results.py <Subject>")
        sys.exit(1)
    subject = sys.argv[1]
    results_dir = os.path.join(BENCH_ROOT, "results", subject.lower().replace(" ", "_"))
    graphs_dir = os.path.join(results_dir, "graphs")
    os.makedirs(graphs_dir, exist_ok=True)

    with open(os.path.join(results_dir, "results_base.json"), encoding="utf-8") as f:
        base_data = json.load(f)
        base = base_data["results"]
        embed_model = base_data.get("embedding_model", "bge-m3")
    with open(os.path.join(results_dir, "growth_results.json"), encoding="utf-8") as f:
        growth = json.load(f)

    plot_base_bars(subject, base, os.path.join(graphs_dir, f"{subject.lower()}_recall_precision_at_k.png"), embed_model)
    plot_growth(subject, growth, os.path.join(graphs_dir, f"{subject.lower()}_corpus_growth.png"), embed_model)


if __name__ == "__main__":
    main()
