# RAG Retrieval Benchmark

Benchmarks this app's local RAG system (BM25 / Dense / Hybrid / live
production retrieval) against the methodology of the NCERT-RAG-Eval paper
(Scientific Reports, DOI 10.1038/s41598-026-71757-y), using the real
Qdrant `docs` corpus and real `bge-m3` production embeddings — not a
synthetic/mocked benchmark.

Done **subject-by-subject** (not all subjects merged into one gold set):
each subject gets its own hand-written, chunk-annotated gold question
file, and its own results/graphs folder. Questions mix types
(factual/definition recall, why/how comprehension, character/plot,
true-false, thematic) rather than only "what is X" recall.

## Layout

- `corpus_cache/all_chunks.jsonl` — a cached extract of the full Qdrant
  `docs` collection (id, subject, chapter, text, real bge-m3 vector).
  Regenerate with `scripts/fetch_corpus.py` if the corpus changes.
- `gold_questions/<subject>_gold_questions.py` — hand-written gold
  questions for one subject, each with exact Qdrant chunk-id answers.
  Done so far: `science_gold_questions.py` (215 qs — **full coverage, all
  13 Science chapters**: Motion, Forces, Sound, Work & Energy,
  Classification/Biodiversity, Earth Systems, Atomic Structure, Mixtures
  & Separation, Chemical Bonding, Cell Biology, Reproduction, Tissues,
  and the intro "Nature of Science" chapter), `hindi_gold_questions.py`
  (30 qs, 2 chapters: "दो बैलों की कथा" prose story, "झाँसी की रानी"
  poem — Hindi not yet expanded to full-chapter coverage).
- `scripts/benchmark_lib.py` — shared BM25 (`rank_bm25.BM25Okapi`),
  Dense/FAISS (`faiss.IndexFlatIP` over L2-normalized real production
  bge-m3 vectors = exact cosine similarity), Hybrid (RRF, same formula as
  the paper), optionally **Qdrant** (the actual live production
  retrieval path — `rag.vector_db.VectorDB.search()`, the real function
  main.py's endpoints call, not a simulation — included whenever the run
  uses the production embedding model), and Recall/Precision/
  Faithfulness@k scoring. Uses the real `rank_bm25` and `faiss-cpu`
  libraries (added via `uv add`), not hand-rolled implementations, for
  closer parity with the paper's own "BM25"/"FAISS" framing.
  Tokenizer covers Latin + the Devanagari Unicode block so Hindi text
  doesn't get silently dropped by BM25 (a real bug caught and fixed here
  — the original `[a-zA-Z0-9]+` pattern matched nothing in Devanagari
  text).
- `scripts/run_subject_benchmark.py <Subject> [embedding_model]` — runs
  the full benchmark for one subject: subject-only corpus (+ live Qdrant
  when using bge-m3), then a corpus-growth stress test that mixes in the
  other subjects as real non-duplicated distractor content one at a time.
  `embedding_model` defaults to `bge-m3` (the production model — also the
  only embedding-capable model actually usable here, see below).
- `scripts/embed_corpus_with_model.py <model>` — re-embeds the full
  cached corpus with a different Ollama embedding model, for testing
  Dense/FAISS retrieval with something other than bge-m3. Currently
  unused: the project's other local Ollama models (llama3:8b, qwen3:8b,
  gemma3:4b, qwen2.5vl:7b) are chat/vision models, not embedding models —
  confirmed directly, Ollama returns `"This server does not support
  embeddings"` for all of them on both the legacy and new embed
  endpoints. bge-m3 is the only viable local embedding model right now.
- `scripts/plot_results.py <Subject>` — generates the two retrieval PNG
  graphs (Recall/Precision@k bar chart vs. paper baselines, showing
  BM25/Dense/Hybrid/Qdrant together when Qdrant is present; and the
  corpus-growth line chart) from a subject's saved JSON results.
- `scripts/run_generation_benchmark.py <Subject>` — a second, different
  benchmark axis: not "did retrieval find the right chunk" but "given
  retrieved context, does the app's actual chat model produce a correct
  answer." Retrieves top-3 Hybrid context per question, has the project's
  real chat models (llama3 = `TUTOR_CHAT_MODEL`, gemma3:4b =
  `TUTOR_CHAT_MODEL_HI`, qwen2.5vl:7b = `VISION_MODEL` — see `.env`; none
  of these can produce embeddings, confirmed directly against the local
  Ollama server, so they only make sense on the generation side) answer
  each question, then an independent judge model (qwen3:8b, not itself a
  generator under test) verdicts CORRECT/PARTIAL/INCORRECT against the
  real gold chunk text. Saves progress after every question (a slow
  multi-model run over dozens of questions WILL occasionally hit a local
  LLM timeout — this survives that and resumes instead of losing
  everything, a real failure it hit once during Hindi).
- `scripts/analyze_generation_quality.py <Subject>` — decomposes
  generation results into retrieval-hit vs. retrieval-miss buckets (was
  the gold chunk actually in the context fed to the generator?), since a
  wrong answer when the source material was never provided isn't a fair
  knock on the generator. Produces `generation_analysis.json` and two
  more graphs.
- `results/<subject>/` — `results_base.json`, `growth_results.json`,
  `generation_quality.json`, `generation_analysis.json`, and
  `graphs/*.png` for that subject.

Additive-only, does not touch the live app: `main.py` gained one new
admin-gated route, `GET /api/admin/retrieval-compare`
(`core/retrieval_compare.py`), that runs BM25/FAISS/Hybrid/Qdrant
side-by-side for any ad-hoc query — useful for spot-checks outside the
formal per-subject benchmark. Every existing endpoint's retrieval is
unchanged; `vector_store.search()` is called exactly as it already was.

## Running the next subject

```
.venv/Scripts/python.exe rag_benchmark/scripts/run_subject_benchmark.py <Subject>
.venv/Scripts/python.exe rag_benchmark/scripts/plot_results.py <Subject>
```

Requires a gold question file at
`gold_questions/<subject_lowercase>_gold_questions.py` exporting a
`GOLD_QUESTIONS` list (same format as `science_gold_questions.py`) —
write this first by reading the real chunks for that subject's chapters
(via `corpus_cache/all_chunks.jsonl`) and hand-deriving questions with
their exact gold chunk id(s), the same way the Science and Hindi sets
were built. Mix question types, not just definition recall.

Subject names must match Qdrant's payload values exactly: `Science`,
`Hindi`, `English`, `Social Studies`, `Mathematics`.

## Results so far

**Science — FULL coverage** (215 questions, all 13 chapters, mixed
question types/levels — factual, historical who/when, numerical/formula
calculations straight from the textbook's own worked examples,
comprehension/why, true-false, ordered-list recall — not just "what is
X"; 274-chunk subject corpus): beats the paper's BM25/FAISS/Hybrid
Recall at k=3 (paper: 0.682, 0.807, 0.818 — this system: BM25 0.930,
Dense 0.893, Hybrid 0.940), and roughly matches the paper's Precision at
k=3 (paper: 0.280/0.341/0.348 — this system: 0.329/0.312/0.330). Live
Qdrant production path matches Dense exactly. Retrieval quality barely
degrades even when the corpus grows 6x (274 → 1632 chunks) with real
distractor content from the other 4 subjects — Hybrid Recall@3 stays
between 0.921 and 0.940 across every stage. This is the headline result:
it holds across the *entire* Science curriculum, not a cherry-picked
4-chapter subset (an earlier, smaller 60-question/4-chapter pass showed
similar or slightly better numbers — 0.950 Hybrid Recall@3 — but that
was before full-chapter coverage; the 215-question numbers above
supersede it as the one to cite).

**Hindi** (30 questions, 473-chunk subject corpus) — retrieval: does
**not** beat the paper — BM25 0.533/0.178, Dense 0.567/0.189, Hybrid
0.567/0.200 Recall/Precision @k=3, all below the paper's baselines (live
Qdrant again matches Dense exactly, confirming the benchmark reflects the
real system). Corpus-growth robustness still holds (barely moves as
other subjects are added as distractors) — the weakness is in the base
retrieval quality, not robustness to noise. Not root-caused: the raw
corpus text for at least the poem chapter has visible OCR corruption
(garbled/scrambled Devanagari matras), a plausible cause not yet
confirmed against the actual failing questions.

**Hindi generation quality** (same 30 questions, top-3 Hybrid context,
the project's real chat models, qwen3:8b judging): llama3 45.0%,
qwen2.5vl 50.0%, gemma3 (the actual production Hindi model) 51.7%
accuracy — all three land in a tight, unremarkable band. Decomposed by
retrieval hit/miss: when the gold chunk WAS in the retrieved context,
accuracy is 68-71% across all three models (solid); when it wasn't,
accuracy craters to 12-31%. **Retrieval is the dominant bottleneck for
Hindi, not generation** — the chat models handle the material reasonably
well whenever they're actually given the right source text.

Caveats for any write-up: Science's 215 questions now exceed the paper's
88, with full-chapter coverage rather than a subset — a stronger
methodological position than before. Hindi is still only 30 questions
over 2 of 12 chapters and hasn't been expanded to match. Broader
multi-subject corpus (1632 chunks, 5 subjects) vs. the paper's
single-subject Physics corpus (237 chunks) — a novelty angle, not a
same-corpus comparison. Faithfulness = Recall here, same simplification
the paper itself uses and flags as a limitation. Results are
subject-dependent (Science beats the paper, Hindi doesn't) — report both,
don't generalize from one subject. The paper itself doesn't evaluate
generation quality or do a retrieval/generation failure decomposition —
that piece here is this project's own addition, not a paper comparison.

---

## 👥 Authors & Contributors

- **Harshita Surana** - Project Author & Lead Developer ([@harshitasurana](https://github.com/harshitasurana))
- **Yash Joshi** - Co-Author & Core Contributor

