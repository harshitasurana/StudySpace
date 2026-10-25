"""
core/document_context.py

Sprint 18 — Document Context.

DocumentContext is the single source of truth for "which document is
this" in terms of the enterprise local storage hierarchy: class,
board, publisher, subject, chapter number/name, and the original PDF
filename.

Every object key in the pipeline (see core/chapter_workspace.py)
is derived from a DocumentContext — nothing downstream hardcodes a
path segment or string-concatenates a key by hand (Part 7: "No
hardcoded string concatenation elsewhere in the codebase").

This module contains zero storage logic (no storage client, no
filesystem calls, no uploads) — it only knows how to normalize its own
fields into the slugs the storage hierarchy is built from (Part 4 —
Naming Convention):

    class_09
    science
    chapter_01_matter_in_our_surroundings
    page_015

Pure data + naming rules, nothing else.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

# Any run of characters that isn't a-z/0-9 collapses to a single "_".
_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(value: str) -> str:
    """"Matter in Our Surroundings" -> "matter_in_our_surroundings".
    Lowercases, replaces any run of non-alphanumeric characters with a
    single underscore, and strips leading/trailing underscores. Used
    for every folder segment derived from free text (board, publisher,
    subject, chapter name) so the hierarchy never contains spaces,
    mixed case, or punctuation. An empty result (e.g. the input was
    all punctuation) falls back to "unknown" rather than producing a
    blank path segment.
    """
    slug = _SLUG_RE.sub("_", value.strip().lower()).strip("_")
    return slug or "unknown"


@dataclass(frozen=True)
class DocumentContext:
    """Everything needed to place a document's assets in the
    enterprise local storage hierarchy:

        classes/class_<NN>/textbooks/<board>/<publisher>/<subject>/
            chapter_<NN>_<chapter_name>/...

    Every field is exactly what the caller supplied — this class never
    guesses or infers a value; it only normalizes given values into
    slugs via the properties below. Frozen/hashable so it can be
    passed around and reused as a dict key or cached without risk of
    accidental mutation mid-pipeline.
    """

    class_no: int
    board: str
    publisher: str
    subject: str
    chapter_no: int
    chapter_name: str
    pdf_name: str

    # ------------------------------------------------------------
    # Naming Convention (Part 4)
    # ------------------------------------------------------------
    @property
    def class_slug(self) -> str:
        return f"class_{self.class_no:02d}"

    @property
    def board_slug(self) -> str:
        return _slugify(self.board)

    @property
    def publisher_slug(self) -> str:
        return _slugify(self.publisher)

    @property
    def subject_slug(self) -> str:
        return _slugify(self.subject)

    @property
    def chapter_slug(self) -> str:
        return f"chapter_{self.chapter_no:02d}_{_slugify(self.chapter_name)}"

    @staticmethod
    def page_slug(page_no: int) -> str:
        return f"page_{page_no:03d}"

    @property
    def pdf_stem(self) -> str:
        """The original PDF's filename without extension — used only
        for local/staging naming, never for the storage hierarchy itself
        (that's always chapter_slug, never the raw filename)."""
        return Path(self.pdf_name).stem


__all__ = ["DocumentContext"]