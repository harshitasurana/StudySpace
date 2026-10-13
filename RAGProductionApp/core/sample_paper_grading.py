"""
core/sample_paper_grading.py

Stage 1/2 grading for the Sample Papers feature — the student writes every
answer on paper (organized by question number) and uploads ONE
consolidated PDF for the whole attempt, not a photo per question. This
reads that PDF page by page via the local vision model (same approach as
core/sample_paper_extraction.py's Stage 0 question-page reads — reusing
its render_page_image/page_count/extract_page_text_anchors/
OllamaPageVisionReader directly rather than duplicating them), matches
each transcribed answer to the paper's real question by question number
(a plain Python dict join, same reasoning as extraction's own matching —
students are asked to label answers with the printed question number, so
this doesn't need a model call either), then grades each matched answer
against the question's REAL model_answer/rubric_criteria (sourced from
Postgres, passed in verbatim by Node — never re-derived or guessed here).

Grading itself is text-only (SAMPLE_PAPER_GRADE_ANSWER_PROMPT, run on the
text model via TutorEngine.grade_text_answer): by the time grading runs,
the one vision-dependent step (reading the student's handwriting) has
already happened, so comparing transcribed text against a rubric is a
plain text task — faster and cheaper than another vision call per
question.

A question with no matched answer anywhere in the PDF (not attempted)
grades to 0 marks without a model call at all — nothing to grade.
"""

from __future__ import annotations

import logging
from typing import Callable

from core.sample_paper_extraction import (
    VisionReadBackend,
    render_page_image,
    page_count,
    extract_page_text_anchors,
)

logger = logging.getLogger(__name__)


def _call_vision_json(backend: VisionReadBackend, image, prompt: str, *, key: str) -> list[dict]:
    """Same fail-safe contract as sample_paper_extraction.py's own
    _call_vision_json (duplicated rather than imported — that one is
    module-private) — one bad page must not abort grading the rest of the
    attempt."""
    import json

    try:
        raw = backend(image, prompt)
    except Exception:
        logger.exception("Vision backend call failed reading an answer page")
        return []

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Answer page read returned non-JSON output: %r", raw[:500])
        return []

    items = data.get(key)
    if not isinstance(items, list):
        return []
    return items


def read_answer_page(image, anchors: str, backend: VisionReadBackend) -> list[dict]:
    from core.prompts import SAMPLE_PAPER_ANSWER_PAGE_PROMPT
    prompt = SAMPLE_PAPER_ANSWER_PAGE_PROMPT.format(anchors=anchors or "(none found)")
    return _call_vision_json(backend, image, prompt, key="answers")


def extract_student_answers(pdf_bytes: bytes, backend: VisionReadBackend, *, dpi: int = 200) -> list[dict]:
    """Every answer segment found across every page of the student's
    answer PDF, in page order — a multi-page answer to one question
    produces multiple segments with the same question_number, merged by
    merge_answer_segments below."""
    all_segments: list[dict] = []
    total_pages = page_count(pdf_bytes)
    for i in range(total_pages):
        anchors = extract_page_text_anchors(pdf_bytes, i)
        image = render_page_image(pdf_bytes, i, dpi=dpi)
        segments = read_answer_page(image, anchors, backend)
        logger.info("Answer PDF page %d/%d: read %d answer segment(s)", i + 1, total_pages, len(segments))
        all_segments.extend(segments)
    return all_segments


def merge_answer_segments(segments: list[dict]) -> dict[int, str]:
    """Groups segments by question_number (a multi-page answer joins with
    a blank line between pages, in page order since segments arrives in
    page order already). Segments with no determinable question_number
    are dropped — they were never confidently matchable to begin with
    (see SAMPLE_PAPER_ANSWER_PAGE_PROMPT's own rule against guessing)."""
    merged: dict[int, list[str]] = {}
    for seg in segments:
        number = seg.get("question_number")
        text = (seg.get("answer_text") or "").strip()
        if number is None or not text:
            continue
        merged.setdefault(number, []).append(text)
    return {number: "\n\n".join(parts) for number, parts in merged.items()}


def grade_matched_answer(question: dict, transcribed_answer: str | None, grade_text_call: Callable[..., dict]) -> dict:
    """Grades one question. transcribed_answer=None (nothing matched in
    the PDF) short-circuits to an honest zero-score result without a
    model call — there's nothing to grade."""
    max_marks = question["max_marks"]

    if not transcribed_answer:
        return {
            "question_id": question["question_id"],
            "transcribed_answer": None,
            "max_marks": max_marks,
            "marks_awarded": 0,
            "rubric_breakdown": [],
            "feedback": "No answer was found for this question in your uploaded PDF.",
            "internal_notes": "Not attempted — no matching question_number found in the answer PDF.",
            "confidence": "high",
            "needs_self_review": False,
        }

    result = grade_text_call(
        question_text=question["question_text"],
        max_marks=max_marks,
        model_answer=question.get("model_answer") or "(no model answer on file — grade on general correctness)",
        rubric_criteria=question.get("rubric_criteria") or [],
        student_answer=transcribed_answer,
    )

    # Every answer here came through one transcription step (reading
    # handwriting), so — unlike Stage 2's original per-strategy confidence
    # table, which assumed some answers arrive as clean typed text with no
    # transcription risk at all — every result here carries that risk
    # uniformly. A high grading confidence still isn't enough on its own;
    # medium/low always forces a self-review flag.
    confidence = result.get("confidence", "low")
    needs_self_review = confidence != "high"

    return {
        "question_id": question["question_id"],
        "transcribed_answer": transcribed_answer,
        "max_marks": max_marks,
        "marks_awarded": result.get("marks_awarded", 0),
        "rubric_breakdown": result.get("rubric_breakdown") or [],
        "feedback": result.get("feedback") or "",
        "internal_notes": result.get("internal_notes") or "",
        "confidence": confidence,
        "needs_self_review": needs_self_review,
    }


def grade_sample_paper_pdf(
    pdf_bytes: bytes,
    questions: list[dict],
    vision_backend: VisionReadBackend,
    grade_text_call: Callable[..., dict],
    *,
    dpi: int = 200,
) -> list[dict]:
    """End-to-end Stage 1/2 grading: read the answer PDF page by page,
    merge segments by question number, grade each of the paper's real
    questions (matched or not). Returns one result per question in
    `questions`, ready for Node to write as sample_paper_responses rows."""
    segments = extract_student_answers(pdf_bytes, vision_backend, dpi=dpi)
    answers_by_number = merge_answer_segments(segments)

    results = []
    for question in questions:
        transcribed = answers_by_number.get(question["question_number"])
        results.append(grade_matched_answer(question, transcribed, grade_text_call))
    return results
