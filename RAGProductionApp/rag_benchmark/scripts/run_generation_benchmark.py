# -*- coding: utf-8 -*-
"""
Generation-quality benchmark: a different axis from the retrieval
benchmark (run_subject_benchmark.py). Retrieval asks "did we find the
right chunk?" This asks "given the right chunks, does the app's actual
chat model produce a correct answer?" — using the project's real chat
models (see .env): llama3 (TUTOR_CHAT_MODEL, the default), gemma3:4b
(TUTOR_CHAT_MODEL_HI, the model actually used for Hindi chat), and
qwen2.5vl:7b (VISION_MODEL). None of these can produce embeddings
(confirmed directly against the local Ollama server), so they sit on the
generation side of the pipeline, not the retrieval side.

For each gold question:
  1. Retrieve top-k context chunks via Hybrid retrieval (BM25 rank_bm25 +
     FAISS dense over real bge-m3 vectors, RRF-fused) on the subject-only
     corpus — same retrieval code as the main benchmark.
  2. Ask each generator model to answer using ONLY that context.
  3. An independent judge model (qwen3:8b — not itself a generator under
     test, to avoid self-grading bias) compares the generated answer
     against the actual gold chunk text (the real ground truth) and
     verdicts CORRECT / PARTIAL / INCORRECT with a one-line reason.

Usage:
    .venv/Scripts/python.exe rag_benchmark/scripts/run_generation_benchmark.py Hindi

Slow: each of llama3/gemma3/qwen2.5vl + the judge is a real local LLM
call (~15-60s observed). Expect this to take a while for a full subject's
gold set; run in the background.
"""
import importlib
import json
import os
import re
import sys
import time
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BENCH_ROOT = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, SCRIPT_DIR)
sys.path.insert(0, os.path.join(BENCH_ROOT, "gold_questions"))

import benchmark_lib as bl  # noqa: E402

CORPUS_PATH = os.path.join(BENCH_ROOT, "corpus_cache", "all_chunks.jsonl")
OLLAMA_CHAT_URL = "http://127.0.0.1:11434/api/chat"

GENERATOR_MODELS = ["llama3:8b", "gemma3:4b", "qwen2.5vl:7b"]
JUDGE_MODEL = "qwen3:8b"
TOP_K = 3


def chat(model, messages, timeout=300, retries=2):
    payload = json.dumps({"model": model, "messages": messages, "stream": False}).encode("utf-8")
    last_err = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(OLLAMA_CHAT_URL, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            return data.get("message", {}).get("content", "")
        except Exception as e:
            last_err = e
            print(f"    [retry {attempt + 1}/{retries}] {model} call failed: {e}")
    raise last_err


def build_hybrid_topk(corpus_chunks, gold, top_k):
    """Reuses benchmark_lib's BM25+FAISS+RRF to get top_k chunk texts per question."""
    ids = [c["id"] for c in corpus_chunks]
    id_to_chunk = {c["id"]: c for c in corpus_chunks}
    texts = [c["text"] for c in corpus_chunks]
    docs_tokens = [bl.tokenize(t) for t in texts]
    bm25 = bl.BM25Okapi(docs_tokens)

    import numpy as np
    vec_matrix = np.array([c["vector"] for c in corpus_chunks], dtype=np.float32)
    faiss_index = bl.build_faiss_index(vec_matrix)

    context_by_qid = {}
    for q in gold:
        qtok = bl.tokenize(q["question"])
        bscores = bm25.get_scores(qtok)
        b_order = np.argsort(-bscores)
        b_ranked_ids = [ids[i] for i in b_order]

        qvec = np.array([bl.embed_query(q["question"])], dtype=np.float32)
        bl.faiss.normalize_L2(qvec)
        _, idxs = faiss_index.search(qvec, len(ids))
        d_ranked_ids = [ids[i] for i in idxs[0]]

        hybrid_ids = bl.rrf_fuse([b_ranked_ids, d_ranked_ids])[:top_k]
        context_by_qid[q["id"]] = [id_to_chunk[cid]["text"] for cid in hybrid_ids]
    return context_by_qid


def generate_answer(model, question, context_chunks):
    context_block = "\n\n".join(f"[स्रोत {i + 1}]\n{c}" for i, c in enumerate(context_chunks))
    prompt = (
        "नीचे दिए गए संदर्भ (context) के आधार पर प्रश्न का उत्तर दें। "
        "केवल दिए गए संदर्भ की जानकारी का प्रयोग करें, बाहर की जानकारी न जोड़ें। "
        "संक्षिप्त और सटीक उत्तर दें।\n\n"
        f"संदर्भ:\n{context_block}\n\nप्रश्न: {question}\n\nउत्तर:"
    )
    return chat(model, [{"role": "user", "content": prompt}])


VERDICT_RE = re.compile(r"\b(CORRECT|PARTIAL|INCORRECT)\b", re.IGNORECASE)


def judge_answer(question, gold_text, generated_answer):
    prompt = (
        "You are grading a student's answer against the real source text it should be based on. "
        "Question (may be in Hindi): " + question + "\n\n"
        "Ground-truth source text (the correct answer must be consistent with this):\n" + gold_text + "\n\n"
        "Student's generated answer:\n" + generated_answer + "\n\n"
        "Judge whether the generated answer is factually correct and supported by the source text. "
        "Respond with exactly one verdict word on its own — CORRECT, PARTIAL, or INCORRECT — "
        "followed by a one-sentence reason on the next line."
    )
    raw = chat(JUDGE_MODEL, [{"role": "user", "content": prompt}])
    m = VERDICT_RE.search(raw)
    verdict = m.group(1).upper() if m else "UNPARSEABLE"
    return verdict, raw.strip()


def main():
    if len(sys.argv) not in (2, 3):
        print("Usage: run_generation_benchmark.py <Subject> [\"Chapter Name\"]")
        sys.exit(1)
    subject = sys.argv[1]
    chapter_filter = sys.argv[2] if len(sys.argv) == 3 else None

    module_name = f"{subject.lower().replace(' ', '_')}_gold_questions"
    gq_module = importlib.import_module(module_name)
    gold = gq_module.GOLD_QUESTIONS
    if chapter_filter:
        gold = [q for q in gold if q["chapter"] == chapter_filter]
        if not gold:
            all_chapters = sorted(set(q["chapter"] for q in gq_module.GOLD_QUESTIONS))
            print(f"No questions found for chapter '{chapter_filter}'. Known chapters:")
            for c in all_chapters:
                print(" -", c)
            sys.exit(1)
        print(f"Subject: {subject} | Chapter filter: '{chapter_filter}' | Questions in this chapter: {len(gold)}")
    print(f"Gold questions this run: {len(gold)} | Generators: {GENERATOR_MODELS} | Judge: {JUDGE_MODEL}")

    all_chunks = bl.load_corpus(CORPUS_PATH)
    own_chunks = [c for c in all_chunks if c["subject"] == subject]
    id_to_chunk = {c["id"]: c for c in own_chunks}
    print(f"{subject}-only corpus: {len(own_chunks)} chunks")

    print(f"Retrieving top-{TOP_K} Hybrid context per question...")
    context_by_qid = build_hybrid_topk(own_chunks, gold, TOP_K)

    results_dir = os.path.join(BENCH_ROOT, "results", subject.lower().replace(" ", "_"))
    os.makedirs(results_dir, exist_ok=True)
    out_path = os.path.join(results_dir, "generation_quality.json")

    # Resume support: if a partial run already saved progress, skip
    # questions already fully answered by every generator instead of
    # re-paying for slow local LLM calls that already succeeded.
    per_question = []
    done_ids = set()
    if os.path.exists(out_path):
        with open(out_path, encoding="utf-8") as f:
            prev = json.load(f)
        for row in prev.get("per_question", []):
            if all(m in row.get("answers", {}) for m in GENERATOR_MODELS):
                per_question.append(row)
                done_ids.add(row["id"])
        if done_ids:
            print(f"Resuming: {len(done_ids)} questions already completed in a prior run (across all chapters done so far).")

    def save_progress():
        n_done = len(per_question)
        model_verdict_counts = {m: {"CORRECT": 0, "PARTIAL": 0, "INCORRECT": 0, "UNPARSEABLE": 0, "ERROR": 0} for m in GENERATOR_MODELS}
        for row in per_question:
            for model, a in row["answers"].items():
                v = a["verdict"]
                model_verdict_counts[model][v if v in model_verdict_counts[model] else "UNPARSEABLE"] += 1
        summary = {}
        for model, counts in model_verdict_counts.items():
            accuracy = (counts["CORRECT"] + 0.5 * counts["PARTIAL"]) / n_done if n_done else 0.0
            summary[model] = {"counts": counts, "accuracy": accuracy}
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({
                "subject": subject,
                "top_k": TOP_K,
                "generator_models": GENERATOR_MODELS,
                "judge_model": JUDGE_MODEL,
                "questions_completed": n_done,
                "questions_total": len(gq_module.GOLD_QUESTIONS),  # full subject total, not just this chapter's filtered run
                "summary": summary,
                "per_question": per_question,
            }, f, indent=2, ensure_ascii=False)
        return summary

    t_start = time.time()
    for qi, q in enumerate(gold):
        if q["id"] in done_ids:
            continue
        context_chunks = context_by_qid[q["id"]]
        gold_text = "\n\n".join(id_to_chunk[cid]["text"] for cid in q["gold_chunk_ids"] if cid in id_to_chunk)

        row = {"id": q["id"], "question": q["question"], "answers": {}}
        for model in GENERATOR_MODELS:
            t0 = time.time()
            try:
                answer = generate_answer(model, q["question"], context_chunks)
                verdict, judge_raw = judge_answer(q["question"], gold_text, answer)
            except Exception as e:
                answer, verdict, judge_raw = "", "ERROR", str(e)
            row["answers"][model] = {"answer": answer, "verdict": verdict, "judge_raw": judge_raw, "seconds": round(time.time() - t0, 1)}
            print(f"[{qi + 1}/{len(gold)}] {q['id']} | {model} -> {verdict} ({round(time.time() - t0, 1)}s)")

        per_question.append(row)
        save_progress()  # persist after every question so a crash loses at most one question's work

    elapsed = time.time() - t_start
    print(f"\nTotal time this run: {round(elapsed / 60, 1)} min")

    summary = save_progress()
    print(f"\n{'Model':<16} {'CORRECT':<9} {'PARTIAL':<9} {'INCORRECT':<10} {'UNPARSE':<8} {'ERROR':<6} {'Accuracy':<9}")
    for model, s in summary.items():
        c = s["counts"]
        print(f"{model:<16} {c['CORRECT']:<9} {c['PARTIAL']:<9} {c['INCORRECT']:<10} {c['UNPARSEABLE']:<8} {c['ERROR']:<6} {s['accuracy']:<9.3f}")
    print(f"Saved {out_path}")


if __name__ == "__main__":
    main()
