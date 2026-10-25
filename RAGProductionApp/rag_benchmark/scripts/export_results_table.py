# -*- coding: utf-8 -*-
"""
Exports a subject's benchmark results (retrieval recall/precision,
generation-quality accuracy, and the retrieval-hit vs retrieval-miss
generation breakdown, whichever files exist) as plain table files
(CSV + Markdown) instead of only being readable as raw JSON.

Reads whatever of these already exist under rag_benchmark/results/<subject>/:
  - results_base.json          (from run_subject_benchmark.py)
  - generation_quality.json    (from run_generation_benchmark.py)
  - generation_analysis.json   (from analyze_generation_quality.py)

Writes to rag_benchmark/results/<subject>/tables/:
  - retrieval.csv / retrieval.md
  - generation_quality.csv / generation_quality.md
  - generation_hit_vs_miss.csv / generation_hit_vs_miss.md

Usage:
    .venv/Scripts/python.exe rag_benchmark/scripts/export_results_table.py Science
    .venv/Scripts/python.exe rag_benchmark/scripts/export_results_table.py Mathematics
"""
import csv
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BENCH_ROOT = os.path.dirname(SCRIPT_DIR)


def write_table(rows, headers, out_dir, name):
    os.makedirs(out_dir, exist_ok=True)

    csv_path = os.path.join(out_dir, f"{name}.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)

    md_path = os.path.join(out_dir, f"{name}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("| " + " | ".join(headers) + " |\n")
        f.write("|" + "|".join("---" for _ in headers) + "|\n")
        for row in rows:
            f.write("| " + " | ".join(str(v) for v in row) + " |\n")

    print(f"Saved {csv_path}")
    print(f"Saved {md_path}")


def export_retrieval(results_dir, out_dir):
    path = os.path.join(results_dir, "results_base.json")
    if not os.path.exists(path):
        print(f"Skipping retrieval table: no {path}")
        return
    with open(path, encoding="utf-8") as f:
        d = json.load(f)

    headers = ["Method", "k", "Recall", "Precision"]
    rows = []
    for method, ks in d["results"].items():
        for k in sorted(ks.keys(), key=int):
            m = ks[k]
            rows.append([method, k, f"{m['recall']:.1%}", f"{m['precision']:.1%}"])
    write_table(rows, headers, out_dir, "retrieval")


def export_generation_quality(results_dir, out_dir):
    path = os.path.join(results_dir, "generation_quality.json")
    if not os.path.exists(path):
        print(f"Skipping generation-quality table: no {path}")
        return
    with open(path, encoding="utf-8") as f:
        d = json.load(f)

    headers = ["Model", "CORRECT", "PARTIAL", "INCORRECT", "UNPARSEABLE", "ERROR", "Accuracy"]
    rows = []
    for model, s in d["summary"].items():
        c = s["counts"]
        rows.append([
            model,
            c.get("CORRECT", 0),
            c.get("PARTIAL", 0),
            c.get("INCORRECT", 0),
            c.get("UNPARSEABLE", 0),
            c.get("ERROR", 0),
            f"{s['accuracy']:.1%}",
        ])
    write_table(rows, headers, out_dir, "generation_quality")


def export_hit_vs_miss(results_dir, out_dir):
    path = os.path.join(results_dir, "generation_analysis.json")
    if not os.path.exists(path):
        print(f"Skipping hit-vs-miss table: no {path}")
        return
    with open(path, encoding="utf-8") as f:
        d = json.load(f)

    headers = ["Model", "Hit N", "Hit Accuracy", "Miss N", "Miss Accuracy"]
    rows = []
    for model, s in d["decomposition"].items():
        rows.append([
            model,
            s["hit_n"],
            f"{s['hit_accuracy']:.1%}",
            s["miss_n"],
            f"{s['miss_accuracy']:.1%}",
        ])
    write_table(rows, headers, out_dir, "generation_hit_vs_miss")


def main():
    if len(sys.argv) != 2:
        print("Usage: export_results_table.py <Subject>")
        sys.exit(1)
    subject = sys.argv[1]

    results_dir = os.path.join(BENCH_ROOT, "results", subject.lower().replace(" ", "_"))
    if not os.path.isdir(results_dir):
        print(f"No results directory found: {results_dir}")
        sys.exit(1)
    out_dir = os.path.join(results_dir, "tables")

    export_retrieval(results_dir, out_dir)
    export_generation_quality(results_dir, out_dir)
    export_hit_vs_miss(results_dir, out_dir)


if __name__ == "__main__":
    main()
