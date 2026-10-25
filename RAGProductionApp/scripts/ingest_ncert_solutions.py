"""
scripts/ingest_ncert_solutions.py

Ingests a chapter's real NCERT Solutions and NCERT Notes PDFs into the
same vector collection the AI Tutor's chat endpoint (main.py's
POST /api/tutor/chat) already searches, so a student's real question can
be grounded in this content — with a page-level citation — the same way
it's already grounded in the textbook.

Deliberately NOT a vision-transcribe-everything pipeline: the Solutions
PDF chunks per QUESTION (one vision read per question, using the exact
page each question's "N." marker was found on — see
core/ncert_solutions_index.py, which this script imports rather than
re-deriving); the Notes PDF has no question-level structure, so it chunks
per PAGE instead. Plain PyMuPDF text extraction is not used for the
embedded content itself — only for the *structural* index that decides
chunk boundaries — because the surrounding math notation garbles under
plain extraction the same way it does for the textbook itself (see
core/chapter_reader_vision.py's module docstring for the concrete
example this project already found).

Idempotent: every point's ID is a deterministic uuid5 of its own
identity (content_type + chapter + page/question), so re-running this
after fixing a bad transcription overwrites rather than duplicates.

Usage:
    python -m scripts.ingest_ncert_solutions --subject Mathematics --chapter "Orienting Yourself: The Use of Coordinates"
    python -m scripts.ingest_ncert_solutions --subject Mathematics --chapter "..." --dry-run
    python -m scripts.ingest_ncert_solutions --subject Mathematics --chapter "..." --only solutions
"""

from __future__ import annotations

import argparse
import logging
import os
import uuid
from functools import lru_cache

from config.curriculum import CURRICULUM
from core.chapter_reader_vision import read_chapter_page
from core.ncert_solutions_index import build_ncert_solutions_index
from core.pdf_style_extractor import extract_chapter_pdf_pages
from core.sample_paper_extraction import OllamaPageVisionReader, render_page_image
from rag.data_loader import embed_texts
from rag.vector_db import VectorDB

logger = logging.getLogger(__name__)

# The exact literal Node's ai_tutor_service.js's chatWithTutorService
# already sends as `standard` for every real Class 9 student — required
# so tutor_chat's class_name=req.standard filter actually matches this
# content. Hardcoded, not parameterized, since this script (and this
# whole NCERT pilot) is Class 9 Math only for now.
NCERT_CLASS_TAG = "Standard 9"

KNOWLEDGE_BASE_ROOT = os.path.join(os.path.dirname(__file__), "..", "knowledge_base")
NCERT_SOLUTIONS_ROOT = os.path.join(os.path.dirname(__file__), "..", "NCERT-Solutions")
NCERT_NOTES_ROOT = os.path.join(os.path.dirname(__file__), "..", "NCERT-Notes")


def _resolve_path(root: str, subject: str, chapter: str) -> str | None:
    for entry in CURRICULUM.get(subject, []):
        if entry["chapter"] == chapter:
            return os.path.join(root, subject, entry["file"])
    return None


def _point_id(*parts) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, ":".join(str(p) for p in parts)))


@lru_cache(maxsize=8)
def _extract_pages_cached(pdf_path: str):
    return extract_chapter_pdf_pages(pdf_path)


def _structural_anchors_for_page(pdf_path: str, page_index: int) -> str:
    """Plain-text structural anchors (headings/bold) for the given page —
    same role they play in the Chapter Reader's own vision reads: keeps
    the vision model's transcription grounded to real heading placement
    instead of it re-discovering structure from pixels alone. Best-effort
    — an empty/failed extraction still lets the page be read, just
    without anchor hints. Cached per pdf_path since this is called once
    per question, not once per page — re-parsing the whole PDF each time
    would be wasteful."""
    try:
        pages = _extract_pages_cached(pdf_path)
        for page in pages:
            if page.get("pdf_page_index") == page_index:
                # extract_chapter_pdf_pages' own "text" field IS the
                # structural-anchor form (## /### headings, **bold**
                # spans, driven by real font metadata) — not a separate
                # field; that's what read_chapter_page's `anchors` param
                # expects (see its docstring: "structural anchors...
                # already reliably detected from plain text").
                return page.get("text", "") or ""
    except Exception:
        logger.exception("Structural anchor extraction failed for %s page %d — continuing without anchors", pdf_path, page_index)
    return ""


def ingest_solutions(subject: str, chapter: str, index: dict, backend, dry_run: bool) -> list[dict]:
    """One vision read + one embedding per real question, at the exact
    page its "N." marker was found on (per the already-verified
    structural index). Returns the list of points that were (or, in
    --dry-run, would be) upserted, for reporting."""
    solutions_path = _resolve_path(NCERT_SOLUTIONS_ROOT, subject, chapter)
    if not solutions_path or not os.path.exists(solutions_path):
        logger.warning("No NCERT Solutions PDF for %s / %s — skipping", subject, chapter)
        return []

    with open(solutions_path, "rb") as f:
        pdf_bytes = f.read()

    points = []
    for exercise, entry in index.items():
        for question in entry["questions"]:
            page_index = question["solution_page"]
            question_number = question["number"]
            logger.info("Solutions: exercise %s question %s (page %d)", exercise, question_number, page_index + 1)

            if dry_run:
                points.append({"content_type": "ncert_solution", "exercise": exercise, "question_number": question_number, "page": page_index})
                continue

            image = render_page_image(pdf_bytes, page_index)
            anchors = _structural_anchors_for_page(solutions_path, page_index)
            text = read_chapter_page(image, anchors, backend)
            if not text:
                logger.warning("Empty transcription for Solutions exercise %s question %s (page %d) — skipping", exercise, question_number, page_index + 1)
                continue

            points.append({
                "id": _point_id("ncert_solution", chapter, exercise, question_number),
                "text": text,
                "payload": {
                    "text": text,
                    "source": "NCERT Solutions",
                    "content_type": "ncert_solution",
                    "subject": subject,
                    "chapter": chapter,
                    "class": NCERT_CLASS_TAG,
                    "page": page_index,
                    "exercise": exercise,
                    "question_number": question_number,
                },
            })
    return points


def ingest_notes(subject: str, chapter: str, backend, dry_run: bool) -> list[dict]:
    """One vision read + one embedding per real page — Notes has no
    question-level structure to chunk on, so this is coarser than
    Solutions on purpose (see the plan's own Risks section: transcription
    quality here has no reliable per-page anchor to ground against, spot
    check accordingly)."""
    notes_path = _resolve_path(NCERT_NOTES_ROOT, subject, chapter)
    if not notes_path or not os.path.exists(notes_path):
        logger.warning("No NCERT Notes PDF for %s / %s — skipping", subject, chapter)
        return []

    with open(notes_path, "rb") as f:
        pdf_bytes = f.read()

    import fitz
    doc = fitz.open(notes_path)
    num_pages = len(doc)
    doc.close()

    # Fallback only — read_chapter_page's own docstring already documents
    # this contract ("fails safe to an empty string... callers should
    # fall back to the plain-text version on empty output"). Confirmed
    # live this is a real, non-hypothetical case: 4 of 25 real Chapter 1
    # Notes pages come back as malformed JSON from the vision model
    # (verified directly — a valid, real transcription of the page's
    # actual content, followed by a long run of stray blank lines, then
    # the model just stops before closing the JSON string — a decoding
    # quirk, not a token-budget issue; doubling num_ctx did not fix it).
    # Plain extraction re-garbles inline math the vision path exists to
    # avoid, so this is a deliberate last resort, not a routine
    # substitute — used only when vision output was empty.
    plain_text_by_pdf_index = {p["pdf_page_index"]: p["text"] for p in extract_chapter_pdf_pages(notes_path)}

    # This exact PDF's font maps its minus-sign glyph to U+2013 (EN DASH)
    # rather than a real hyphen-minus — confirmed directly (fitz.get_text()
    # returns "–" at every negative-coordinate position, e.g. "(-3,
    # 2)" comes out "(–3, 2)"). Vision transcription doesn't have
    # this problem (the model writes a plain "-", per its own prompt
    # instructions) — this normalization is only needed on the plain-text
    # fallback path.
    _DASH_TO_MINUS = {"–": "-", "−": "-"}

    def _normalize_fallback_text(text: str) -> str:
        for bad, good in _DASH_TO_MINUS.items():
            text = text.replace(bad, good)
        return text

    points = []
    for page_index in range(num_pages):
        logger.info("Notes: page %d of %d", page_index + 1, num_pages)

        if dry_run:
            points.append({"content_type": "ncert_notes", "page": page_index})
            continue

        image = render_page_image(pdf_bytes, page_index)
        text = read_chapter_page(image, "", backend)
        if not text:
            fallback_text = _normalize_fallback_text(plain_text_by_pdf_index.get(page_index, "").strip())
            if fallback_text:
                logger.warning(
                    "Vision transcription empty for Notes page %d — using plain-text extraction instead "
                    "(math notation may be less reliable here; spot-check this page)",
                    page_index + 1,
                )
                text = fallback_text
            else:
                logger.warning("Empty transcription for Notes page %d — skipping", page_index + 1)
                continue

        points.append({
            "id": _point_id("ncert_notes", chapter, page_index),
            "text": text,
            "payload": {
                "text": text,
                "source": "NCERT Notes",
                "content_type": "ncert_notes",
                "subject": subject,
                "chapter": chapter,
                "class": NCERT_CLASS_TAG,
                "page": page_index,
            },
        })
    return points


def main():
    parser = argparse.ArgumentParser(
        prog="ingest_ncert_solutions.py",
        description="Ingests a chapter's real NCERT Solutions/Notes PDFs into the AI Tutor's shared vector collection.",
    )
    parser.add_argument("--subject", type=str, required=True)
    parser.add_argument("--chapter", type=str, required=True, help="Real chapter title, matching config/curriculum.py's CURRICULUM entries.")
    parser.add_argument("--only", type=str, choices=["solutions", "notes", "both"], default="both")
    parser.add_argument("--dry-run", action="store_true", help="List what would be ingested without calling the vision model or writing to the vector store.")
    parser.add_argument("--log-level", type=str, default="INFO")
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    textbook_path = _resolve_path(KNOWLEDGE_BASE_ROOT, args.subject, args.chapter)
    solutions_path = _resolve_path(NCERT_SOLUTIONS_ROOT, args.subject, args.chapter)
    if not textbook_path or not os.path.exists(textbook_path):
        raise SystemExit(f"No textbook PDF found for {args.subject} / {args.chapter!r} — check --chapter matches CURRICULUM exactly.")
    if not solutions_path or not os.path.exists(solutions_path):
        raise SystemExit(f"No NCERT Solutions PDF found for {args.subject} / {args.chapter!r}.")

    index = build_ncert_solutions_index(textbook_path, solutions_path)
    if not index:
        raise SystemExit("build_ncert_solutions_index returned an empty index — nothing to ingest. Check the PDFs' exercise-heading wording.")

    # num_ctx raised well past OllamaPageVisionReader's own 8192 default —
    # confirmed via a real run against this exact chapter: 4 of 27 Notes
    # pages (all real, dense content, not blank) came back as invalid
    # JSON (response cut off mid-string, no closing brace) and were
    # silently skipped. The class's own docstring already measured a
    # full rendered page + prompt at ~4145 tokens on its own — at
    # num_ctx=8192 that leaves under 4000 tokens of headroom for the
    # response, which a page with several worked examples/formulas (each
    # doubled in size by JSON string-escaping) can genuinely exceed.
    backend = OllamaPageVisionReader(num_ctx=16384)
    all_points = []

    if args.only in ("solutions", "both"):
        all_points.extend(ingest_solutions(args.subject, args.chapter, index, backend, args.dry_run))
    if args.only in ("notes", "both"):
        all_points.extend(ingest_notes(args.subject, args.chapter, backend, args.dry_run))

    if args.dry_run:
        logger.info("DRY RUN — would ingest %d points: %s", len(all_points), all_points)
        return

    if not all_points:
        logger.warning("Nothing to ingest — no points were produced.")
        return

    logger.info("Embedding %d transcribed chunks...", len(all_points))
    texts = [p["text"] for p in all_points]
    vectors = embed_texts(texts)

    vector_store = VectorDB()
    vector_store.upsert(
        ids=[p["id"] for p in all_points],
        vectors=vectors,
        payloads=[p["payload"] for p in all_points],
    )
    logger.info("Upserted %d NCERT points into the shared vector collection.", len(all_points))


if __name__ == "__main__":
    main()
