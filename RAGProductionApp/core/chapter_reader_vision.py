"""
core/chapter_reader_vision.py

Vision-based page reading — transcribes a rendered PDF page image
faithfully via the vision model, instead of trusting plain PyMuPDF text
extraction, because plain reading-order extraction scrambles inline math
notation. Verified directly against real chapter content: the distance
formula sqrt((x2-x1)^2 + (y2-y1)^2) came out of
core/pdf_style_extractor.py's plain-text extraction as disconnected loose
tokens with the sqrt/exponent structure lost entirely — the exact same
failure mode already identified and fixed for Sample Papers extraction
(see core/sample_paper_extraction.py's module docstring).

The Chapter Reader itself no longer uses this — it now renders the real
PDF directly in the browser (react-pdf/pdf.js), which sidesteps the
transcription-fidelity problem entirely (nothing is retyped, so nothing
can be scrambled). This module is kept for pipelines that genuinely need
real, faithfully-transcribed TEXT to work with, not just a visual render
— e.g. extracting a chapter's real exercise questions for later
processing.

core/pdf_style_extractor.py's extract_chapter_pdf_pages is still used
for structural anchors (headings/bold spans, reliably detected from the
PDF's own real font metadata) — this module only replaces the body
WORDING, transcribed from a rendered page image via the vision model,
grounded by those same anchors so heading/bold placement isn't
rediscovered from scratch by the vision model (which has no access to
font-size data, only pixels).

Reuses core/sample_paper_extraction.py's page-rendering/vision-backend
machinery directly rather than duplicating it — render_page_image and
OllamaPageVisionReader are generic PDF/vision utilities, not
sample-paper-specific.
"""

from __future__ import annotations

import json
import logging

from core.sample_paper_extraction import VisionReadBackend, render_page_image

logger = logging.getLogger(__name__)

__all__ = ["read_chapter_page", "render_page_image"]


def read_chapter_page(image, anchors: str, backend: VisionReadBackend) -> str:
    """Reads one page via vision, transcribing its actual wording
    faithfully (preserving math notation) while keeping the given
    structural anchors (headings/bold spans, already reliably detected
    from plain text) exactly where they belong. Fails safe to an empty
    string on any backend/parse failure — callers should fall back to
    the plain-text version on empty output, rather than losing the
    page's content entirely."""
    from core.prompts import CHAPTER_PAGE_READ_PROMPT

    prompt = CHAPTER_PAGE_READ_PROMPT.format(anchors=anchors or "(none found)")
    try:
        raw = backend(image, prompt)
    except Exception:
        logger.exception("Vision backend call failed reading a chapter page")
        return ""

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Chapter page vision read returned non-JSON output: %r", raw[:500])
        return ""

    markdown = data.get("markdown")
    return markdown.strip() if isinstance(markdown, str) else ""
