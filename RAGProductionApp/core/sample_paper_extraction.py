"""
core/sample_paper_extraction.py

Stage 0 extraction for the Sample Papers feature — turns a real Paper PDF
+ its real Solution PDF into structured questions paired with their real
answers, ready for admin fidelity review (see the Node migration's header
comment for the full feature rationale).

Deliberately NOT a TutorEngine method: TutorEngine has no vision plumbing
today (every vision call in this codebase — QwenValidator's page/figure
reads — lives outside it, in scripts/ingest_textbook_images.py). This
module follows that same separation and the same dependency-injection
pattern (a QwenVisionBackend-shaped callable is passed in, never
constructed here), so callers choose which backend to use (a real
OllamaQwenBackend in production, a fake in tests) exactly like
QwenValidator already does.

Why page IMAGES, not plain PDF text: verified directly against a real
paper (Math Sample1) that plain PyMuPDF text extraction scrambles inline
math notation (exponents/fractions/roots get pulled out of reading order
and dumped as loose tokens elsewhere on the page), while question
numbering, section headers, and marks extract cleanly. So the plain text
layer is used only for structural anchors (grounding which questions to
expect on a page); the actual question/answer wording is read from a
rendered page image via the vision model, the way a human reading the PDF
would.

Why matching is NOT an LLM call: both the Paper and its Solution number
their items identically (1, 2, 3, ...) and that numbering was verified to
extract reliably as plain text from both documents — a plain Python
dict-keyed join is more reliable and far cheaper than asking a model to
fuzzy-match, so match_questions_to_solutions() below does no model call
at all.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Callable, Optional, Protocol

import fitz  # PyMuPDF
from PIL import Image

logger = logging.getLogger(__name__)


class VisionReadBackend(Protocol):
    """Same shape as scripts/ingest_textbook_images.py's QwenVisionBackend
    Protocol — kept as a separate Protocol here (not imported) so this
    module has no import-time dependency on that script file at all,
    only a structural one."""
    def __call__(self, image: Image.Image, prompt: str) -> str: ...


class OllamaPageVisionReader:
    """Default VisionReadBackend for full-page reads. Not a reuse of
    scripts/ingest_textbook_images.py's OllamaQwenBackend, on purpose:
    that class's request always merges VisionRuntime.request_options(),
    which only ever contributes {} or {"num_gpu": 0} — it never sets
    num_ctx, so it inherits Ollama's local default context window (4096
    tokens on this environment's server). That's fine for validating a
    small textbook-figure crop, but a full rendered exam-paper page (verified
    directly: ~4145 tokens for one page + prompt) overflows it, failing
    with a 400 "exceeds the available context size" error. This class
    follows the exact same proven request shape (base64 image, /api/chat,
    "images": [...], format: "json") but with a num_ctx large enough for
    a full page, verified working end-to-end against a real page."""

    def __init__(self, *, base_url: str | None = None, model: str | None = None,
                 timeout: float = 480.0, num_ctx: int = 8192, retries: int = 2) -> None:
        import os
        self.base_url = (base_url or os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")).rstrip("/")
        self.model = model or os.getenv("VISION_MODEL", "qwen2.5vl:7b")
        self.timeout = timeout
        self.num_ctx = num_ctx
        self.retries = retries

    def __call__(self, image: Image.Image, prompt: str) -> str:
        import base64
        import io
        import requests

        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")

        # Local full-page vision inference on this hardware genuinely takes
        # a couple of minutes per page and occasionally longer — a single
        # timeout with no retry was verified to silently drop entire pages
        # (lost questions, not just slow ones). Retry once on a timeout
        # specifically (not on other errors, which are more likely to
        # recur identically) before giving up on this page.
        last_exc: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                response = requests.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt, "images": [encoded]}],
                        "format": "json",
                        "stream": False,
                        # num_gpu deliberately NOT overridden here. Forcing
                        # num_gpu=-1 (full GPU offload) was tried to speed
                        # this up — nvidia-smi showed a real GPU with
                        # headroom — but it was verified to correlate with
                        # the local Ollama server crashing outright
                        # mid-run (connection refused, process gone) twice
                        # in a row, which never happened on the plain CPU
                        # default. Likely a driver/runtime mismatch with
                        # this specific GPU, not something to fight from
                        # here — reliability over speed; leave Ollama's own
                        # default GPU/CPU heuristic in place.
                        "options": {"num_ctx": self.num_ctx},
                    },
                    timeout=self.timeout,
                )
                response.raise_for_status()
                return response.json().get("message", {}).get("content", "")
            except requests.exceptions.Timeout as exc:
                last_exc = exc
                logger.warning("Vision call timed out (attempt %d/%d)", attempt + 1, self.retries + 1)
                continue
        raise last_exc


# ============================================================
# Page rendering + structural anchors (plain text — verified reliable)
# ============================================================

def render_page_image(pdf_bytes: bytes, page_index: int, *, dpi: int = 200) -> Image.Image:
    """Renders one page of a PDF to a PIL Image in memory — no temp file,
    matching LocalImageStorage._coerce_image_bytes's in-memory convention
    (core/local_image_storage.py)."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc[page_index]
        pix = page.get_pixmap(dpi=dpi)
        return Image.open(__import__("io").BytesIO(pix.tobytes("png")))
    finally:
        doc.close()


def page_count(pdf_bytes: bytes) -> int:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return doc.page_count
    finally:
        doc.close()


def extract_page_text_anchors(pdf_bytes: bytes, page_index: int) -> str:
    """Plain-text extraction of one page — verified reliable for question
    numbering/section headers/marks, unreliable for inline math (see
    module docstring). Passed to the vision prompt as a grounding hint,
    never as the source of the actual question/answer wording."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return doc[page_index].get_text()
    finally:
        doc.close()


# ============================================================
# Vision reads (one call per page)
# ============================================================

def _call_vision_json(backend: VisionReadBackend, image: Image.Image, prompt: str, *, key: str) -> list[dict]:
    """Fails safe to an empty list on any parse/shape failure — one bad
    page must not abort extracting the rest of the document. Matches this
    codebase's existing fail-safe-parser convention for batch/extraction
    helpers (as distinct from single-shot chat generation, which raises)."""
    try:
        raw = backend(image, prompt)
    except Exception:
        logger.exception("Vision backend call failed")
        return []

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Vision page read returned non-JSON output: %r", raw[:500])
        return []

    items = data.get(key)
    if not isinstance(items, list):
        return []
    return items


def read_question_page(image: Image.Image, anchors: str, backend: VisionReadBackend) -> list[dict]:
    from core.prompts import SAMPLE_PAPER_QUESTION_PAGE_PROMPT
    prompt = SAMPLE_PAPER_QUESTION_PAGE_PROMPT.format(anchors=anchors or "(none found)")
    return _call_vision_json(backend, image, prompt, key="questions")


def read_solution_page(image: Image.Image, anchors: str, backend: VisionReadBackend) -> list[dict]:
    from core.prompts import SAMPLE_PAPER_SOLUTION_PAGE_PROMPT
    prompt = SAMPLE_PAPER_SOLUTION_PAGE_PROMPT.format(anchors=anchors or "(none found)")
    return _call_vision_json(backend, image, prompt, key="solutions")


def extract_paper_questions(pdf_bytes: bytes, backend: VisionReadBackend, *, dpi: int = 200) -> list[dict]:
    """Every question found across every page of the Paper PDF, in page
    order. Does not dedupe/validate numbering — that's match_questions_to_solutions's
    and the admin review step's job."""
    all_questions: list[dict] = []
    total_pages = page_count(pdf_bytes)
    for i in range(total_pages):
        anchors = extract_page_text_anchors(pdf_bytes, i)
        image = render_page_image(pdf_bytes, i, dpi=dpi)
        questions = read_question_page(image, anchors, backend)
        logger.info("Paper page %d/%d: read %d question(s)", i + 1, total_pages, len(questions))
        all_questions.extend(questions)
    return all_questions


def extract_solution_answers(pdf_bytes: bytes, backend: VisionReadBackend, *, dpi: int = 200) -> list[dict]:
    """Every solution item found across every page of the Solution PDF."""
    all_solutions: list[dict] = []
    total_pages = page_count(pdf_bytes)
    for i in range(total_pages):
        anchors = extract_page_text_anchors(pdf_bytes, i)
        image = render_page_image(pdf_bytes, i, dpi=dpi)
        solutions = read_solution_page(image, anchors, backend)
        logger.info("Solution page %d/%d: read %d item(s)", i + 1, total_pages, len(solutions))
        all_solutions.extend(solutions)
    return all_solutions


# ============================================================
# Matching (plain Python, no model call — see module docstring)
# ============================================================

def match_questions_to_solutions(questions: list[dict], solutions: list[dict]) -> list[dict]:
    """Pairs each extracted question to its real solution by
    question_number == item_number. A question with no matching solution
    entry keeps answer_text=None / answer_source='unmatched' rather than
    being dropped or guessed — Stage 0's admin review surfaces this, and
    the RAG-drafted-answer fallback (a separate, explicitly-flagged path)
    is the only thing allowed to fill it in."""
    solutions_by_number = {s.get("item_number"): s for s in solutions if s.get("item_number") is not None}

    matched: list[dict] = []
    for q in questions:
        number = q.get("question_number")
        marks = q.get("marks")
        solution = solutions_by_number.get(number)
        rubric_criteria = (solution.get("rubric_criteria") or []) if solution else []
        # The Solution PDF never prints mark values (verified directly —
        # only the Paper does), so the vision read of a solution page has
        # no way to know a question's true marks and self-constrain its
        # rubric breakdown to sum to it. For 1-mark items specifically
        # that's not a rounding issue to fix — this exam format grades
        # them all-or-nothing (a single correct option/answer), so any
        # multi-step "rubric" the model inferred from the shown working
        # is never actually gradeable partial credit. Multi-mark mismatches
        # are left as-is for Stage 0's admin review to catch and correct,
        # not silently normalized here.
        if marks == 1 and rubric_criteria:
            rubric_criteria = []
        matched.append({
            "question_number": number,
            "text": q.get("text"),
            "options": q.get("options") or [],
            "marks": marks,
            "has_diagram_or_graph": bool(q.get("has_diagram_or_graph")),
            "figure_description": q.get("figure_description"),
            "answer_text": solution.get("answer_text") if solution else None,
            "rubric_criteria": rubric_criteria,
            "answer_source": "solution_matched" if solution else "unmatched",
        })
    return matched


# ============================================================
# Sensible defaults for admin-editable classification fields
# ============================================================

def infer_defaults(record: dict) -> dict:
    """Proposes question_type/input_type/grading_strategy/question_media
    for one matched record — always admin-overridable in the Stage 0
    review UI, never auto-published unreviewed. Heuristic, not exact."""
    marks = record.get("marks") or 0
    has_figure = record.get("has_diagram_or_graph", False)
    is_mcq = bool(record.get("options"))
    text = (record.get("text") or "").lower()

    if has_figure and ("graph" in text or "plot" in text or "histogram" in text or "polygon" in text):
        question_type = "diagram_based"
        grading_strategy = "graph_rubric"
    elif has_figure:
        question_type = "diagram_based"
        grading_strategy = "diagram_rubric"
    elif is_mcq:
        question_type = "short_answer"
        grading_strategy = "exact"
    elif marks and marks <= 2:
        question_type = "short_answer"
        grading_strategy = "rubric"
    else:
        question_type = "long_answer"
        grading_strategy = "rubric"

    input_type = "photo" if question_type == "diagram_based" else "typed_or_photo"
    # Image cropping/storage for has_diagram_or_graph questions is not yet
    # built (Stage 0 follow-up) — question_media stays 'none' until a real
    # question_media_key exists, so nothing points at a missing asset.
    question_media = "none"

    return {
        "question_type": question_type,
        "input_type": input_type,
        "grading_strategy": grading_strategy,
        "question_media": question_media,
    }


@dataclass
class ExtractedSamplePaper:
    questions: list[dict]


def extract_sample_paper(paper_pdf_bytes: bytes, solution_pdf_bytes: bytes, backend: VisionReadBackend) -> list[dict]:
    """End-to-end Stage 0 extraction: read both PDFs page by page via the
    vision backend, match by number, propose classification defaults.
    Returns a list of question dicts ready for Node to bulk-insert as
    sample_paper_questions rows at review_status='ai_extracted'."""
    questions = extract_paper_questions(paper_pdf_bytes, backend)
    solutions = extract_solution_answers(solution_pdf_bytes, backend)
    matched = match_questions_to_solutions(questions, solutions)
    for record in matched:
        record.update(infer_defaults(record))
    return matched
