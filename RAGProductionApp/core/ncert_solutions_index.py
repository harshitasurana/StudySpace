"""Builds a structural index — which exercise/question lives on which
page — for a chapter's real NCERT Solutions PDF and the real textbook PDF
it answers questions from.

Pure PyMuPDF text extraction, no LLM/vision call anywhere in this module.
Verified directly against the real Math Chapter 1 PDFs before this was
written: exercise headers and individual question markers extract
cleanly even though the surrounding inline math notation (fractions,
exponents, tables) does not — this module only ever reads the clean
structural anchors, never the math-bearing prose, so it doesn't need the
vision-based transcription the rendering/RAG-ingestion paths use.

The Solutions PDF and the textbook PDF are two different documents from
two different sources, so their exercise headers are worded differently
("EXERCISE : 1.2" vs "Exercise Set 1.2") and even numbered on a different
internal scheme in places — every exercise key here is normalized to a
bare "N.M" string (or the literal "end" for the end-of-chapter section)
specifically so the two can be matched against each other.
"""

import logging
import re

import fitz

logger = logging.getLogger(__name__)

_SOLUTIONS_EXERCISE_RE = re.compile(r"EXERCISE\s*:\s*(\d+\.\d+)", re.IGNORECASE)
_SOLUTIONS_END_RE = re.compile(r"END OF CHAPTER EXERCISE", re.IGNORECASE)
_SOLUTIONS_QUESTION_RE = re.compile(r"^\d{1,2}\.$")

_TEXTBOOK_EXERCISE_RE = re.compile(r"Exercise\s+Set\s+(\d+\.\d+)", re.IGNORECASE)
_TEXTBOOK_END_RE = re.compile(r"End-of-Chapter\s+Exercises", re.IGNORECASE)


def extract_solution_question_pages(pdf_path) -> dict:
    """Returns {"1.1": [{"question_number": 1, "page_index": 0}, ...], ...,
    "end": [...]} — one entry per question marker found, in the order
    encountered, grouped under the exercise section it falls in. A
    question's page_index is where its "N." marker was found, which is
    where its solution content starts (or very close to it — see the
    module docstring's caller, this can occasionally be off by one page
    for a question whose marker appears after a leading diagram/table)."""
    doc = fitz.open(pdf_path)
    sections: dict[str, list[dict]] = {}
    current_key = None

    for page_index, page in enumerate(doc):
        lines = [line.strip() for line in page.get_text().split("\n") if line.strip()]
        for line in lines:
            exercise_match = _SOLUTIONS_EXERCISE_RE.search(line)
            if exercise_match:
                current_key = exercise_match.group(1)
                sections.setdefault(current_key, [])
                continue
            if _SOLUTIONS_END_RE.search(line):
                current_key = "end"
                sections.setdefault(current_key, [])
                continue
            if current_key is not None and _SOLUTIONS_QUESTION_RE.match(line):
                question_number = int(line.rstrip("."))
                existing = sections[current_key]
                # A question's own marker can legitimately appear more
                # than once on a page (restated before the answer) —
                # only record the first (earliest-page) sighting.
                if not any(q["question_number"] == question_number for q in existing):
                    existing.append({"question_number": question_number, "page_index": page_index})

    doc.close()

    if not sections:
        logger.warning("extract_solution_question_pages: found zero exercise sections in %s", pdf_path)

    return sections


def extract_textbook_exercise_ranges(pdf_path) -> dict:
    """Returns {"1.1": {"start_page": 3, "end_page": 5}, ..., "end": {...}}
    — start_page is where the header line itself was found; end_page is
    the page before the next header (or the document's last page for the
    final section)."""
    doc = fitz.open(pdf_path)
    headers: list[tuple[str, int]] = []

    for page_index, page in enumerate(doc):
        for line in page.get_text().split("\n"):
            line = line.strip()
            if not line:
                continue
            exercise_match = _TEXTBOOK_EXERCISE_RE.search(line)
            if exercise_match:
                headers.append((exercise_match.group(1), page_index))
                continue
            if _TEXTBOOK_END_RE.search(line):
                headers.append(("end", page_index))

    last_page = len(doc) - 1
    doc.close()

    if not headers:
        logger.warning("extract_textbook_exercise_ranges: found zero exercise headers in %s", pdf_path)
        return {}

    ranges = {}
    for i, (key, start_page) in enumerate(headers):
        end_page = headers[i + 1][1] - 1 if i + 1 < len(headers) else last_page
        ranges[key] = {"start_page": start_page, "end_page": end_page}
    return ranges


def build_ncert_solutions_index(textbook_path, solutions_path) -> dict:
    """Combines both extractions into the one shape the frontend needs:
    {"1.1": {"textbook_pages": [start, end], "questions": [{"number": 1,
    "solution_page": 0}, ...]}, ...}. Only exercise keys present in BOTH
    documents are included — a key found in only one side can't be used
    for a jump link either direction, so it's dropped rather than
    included with a null half."""
    textbook_ranges = extract_textbook_exercise_ranges(textbook_path)
    solution_questions = extract_solution_question_pages(solutions_path)

    index = {}
    for key, questions in solution_questions.items():
        textbook_range = textbook_ranges.get(key)
        if textbook_range is None:
            logger.warning(
                "build_ncert_solutions_index: exercise %r found in Solutions PDF but not in textbook — skipping",
                key,
            )
            continue
        index[key] = {
            "textbook_pages": [textbook_range["start_page"], textbook_range["end_page"]],
            "questions": [
                {"number": q["question_number"], "solution_page": q["page_index"]}
                for q in sorted(questions, key=lambda q: q["question_number"])
            ],
        }

    if not index:
        logger.warning(
            "build_ncert_solutions_index: no matching exercise sections between %s and %s",
            textbook_path,
            solutions_path,
        )

    return index
