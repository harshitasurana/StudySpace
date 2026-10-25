"""
core/chapter_workspace.py

Sprint 17 — Chapter Workspace & Storage Management. (superseded)
Sprint 18 — Enterprise MinIO Storage Integration.
Sprint 18.3 — Page Asset Storage & Visual Organization. (superseded)
Sprint 19 — Enterprise Storage Refactor (MinIO-First Architecture). (superseded)
Sprint 20 — MinIO Chapter Workspace Foundation.
Sprint 21 — Qwen Decision Storage & Figure Naming. (superseded)
Sprint 23 — Intelligent Visual Naming System.
Sprint 25 — Deferred MinIO Upload & Final Visual Storage.

As of Sprint 19, ChapterWorkspace is a PURE OBJECT-KEY GENERATOR. It
never touches the filesystem: no directories are created, no files are
saved, moved, or deleted, and nothing is uploaded. It only answers
"what object key does this asset live at" — every byte actually
moves through core/local_image_storage.py (LocalImageStorage), driven
by keys this class hands it. Sprint 20 keeps that contract exactly;
only the key *layout* changes.

Sprint 20 replaces the Sprint 18.3/19 per-visual-type page layout
(pages/page_<NNN>/{graphs,diagrams,tables,figures,mixed_regions}/...)
with a flat, browsing-friendly layout that mirrors the pre-MinIO local
chapter workspace: every page gets its own top-level folder directly
under the chapter root, holding that page's figures side by side with
its metadata.json — no visual-type subfolders, no page_<NNN> nesting
under a pages/ parent.

Every object key below the bucket is generated from a DocumentContext
(core/document_context.py) — never hardcoded, never string-concatenated
ad hoc elsewhere in the codebase:

    classes/
      class_09/
        textbooks/
          cbse/
            ncert/
              science/
                chapter_01_matter_in_our_surroundings/
                  original/
                    textbook.pdf
                  rendered_pages/
                    page_001.png
                    page_002.png
                  extracted/
                    region_981f8ec8f35e3ec1.png
                    region_7ab13dc91f4a2b6e.png
                  page_001/
                    figure_1_1.png
                    figure_1_2.png
                    metadata.json
                  page_002/
                    figure_2_1.png
                    metadata.json
                  metadata/
                    chapter_metadata.json
                    embeddings.json
                    processing_report.json
                  logs/
                    ingest.log
                  debug/
                    <filename>
                  accepted/
                    figure_1_1.png
                  rejected/
                    figure_1_2.png

Sprint 21 adds `accepted/` and `rejected/` as two more flat,
chapter-root folders, siblings of `metadata/`, `logs/`, and `debug/`.
Every figure Qwen Validation accepts or rejects gets a durable
chapter-level copy in one of these, filed under the exact same
filename it already has inside its `page_<NNN>/` folder — that
page-folder original is never moved or deleted, only copied from.
Sprint 21 also changes the *filename itself*: figures are now named
from the textbook's own chapter+figure numbering
(`figure_<chapter_number>_<figure_number>.png`) rather than from the
page they happen to appear on, so the same figure keeps the same
filename in `page_<NNN>/`, `accepted/`, and `rejected/` alike.

Sprint 23 generalizes that naming scheme beyond textbook figures.
Not every extracted visual carries a printed "Figure N.N" label —
diagrams, graphs, tables, photos, experiment/activity boxes, maps,
flowcharts, illustrations, mixed educational regions, decorative
images, logos/icons, and other educational visuals never do, and
Sprint 21's naming forced all of them into `figure_...` filenames
regardless (`figure_1_auto_001.png`), which said nothing about what
the asset actually was. resolve_figure_name() now picks a name using
three priorities, highest first:

    1. Textbook figure number (unchanged from Sprint 21) —
       "Figure 1.1" -> figure_1_1.png
    2. Visual-type + chapter-level sequence, when no figure number is
       available — a diagram is diagram_<chapter>_<seq>.png, a graph
       is graph_<chapter>_<seq>.png, a table is
       table_<chapter>_<seq>.png, and so on for every visual type the
       pipeline supports (see _VISUAL_TYPE_ALIASES below). Each visual
       type gets its own independent chapter-level sequence — the 5th
       diagram and the 2nd table in a chapter are both "_003_" and
       "_002_" respectively, never sharing one counter.
    3. Region id, only when neither of the above is available —
       region_<region_id>.png, the naming system's last resort.

See resolve_figure_name() below for the full priority logic.

Sprint 25 changes *when* a visual's final name is decided relative to
*when* it's uploaded — nothing about resolve_figure_name() itself.
Before Sprint 25, a candidate was uploaded to page_<NNN>/ the moment
extraction produced a crop, using whatever name Priority 2 could build
at that point (no figure number yet — Caption Association hadn't run),
and later renamed in place (a MinIO copy+delete) if Caption Association
found a real figure number. That rename was also the exact failure
mode this sprint was written to close: if the "before" key logged at
upload time and the "before" key assumed at rename time ever drifted
even slightly, the rename's copy_object() call failed with "source not
found" and the visual was silently lost from its page folder.

Sprint 25 removes the rename entirely by deferring the upload instead
of the naming decision:

    1. At extraction time, the crop goes to `extracted/`
       (extracted_key), named only from its region_id
       (extracted_filename) — never a candidate figure/type name,
       since nothing about a visual's final identity is decidable yet.
    2. It stays there, untouched, all the way through OCR, Caption
       Association, and Qwen Validation — no storage writes at all
       during this stretch.
    3. Only once Qwen Validation has an accept/reject decision (and,
       therefore, every input resolve_figure_name() needs) is the
       visual uploaded to its page_<NNN>/ home — once, already under
       its final name, copied to accepted/ or rejected/, and its
       extracted/ temp copy deleted. See ingest_textbook_images.py's
       Sprint 25 notes (_upload_temp_extracted_visual /
       _finalize_visual_storage) for that orchestration; this module
       only supplies the two keys (extracted_key, figure_key) both
       ends of that flow need.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from core.document_context import DocumentContext

# Figure Naming: "1.1" / "3-2" -> "1_1" / "3_2" — the separator(s) a
# textbook uses between chapter and figure number, normalized to a
# single underscore so figure_key() never has to special-case '.' vs
# '-' vs multi-part numbers ("1.1.2" -> "1_1_2").
_FIGURE_NUMBER_SEPARATORS_RE = re.compile(r"[.\-\s]+")

# Strips a leading label word ("Figure ", "Fig. ", "Table ", ...) off a
# figure number before it's slugged. Exists because callers don't always
# pass a bare number: Caption Association's own resolved value (see
# _resolve_figure_number() / CaptionMatch.reference in
# ingest_textbook_images.py) is the *canonical reference* — "Figure 1.1",
# not "1.1" — and figure_number_slug() has to accept either without
# producing a doubled-up "figure_Figure_1_1.png". Requires a space after
# the label so a bare alphanumeric number like "A.1" (no label, letter
# immediately followed by punctuation) is left untouched.
_FIGURE_LABEL_PREFIX_RE = re.compile(r"^[A-Za-z]+\.?\s+")

# Filename priority (see resolve_figure_name() for the full logic):
#   1. figure_<figure_number>.png         — textbook's own figure number,
#                                            e.g. "Figure 1.1" -> figure_1_1.png
#   2. <visual_type>_<chapter>_<NNN>.png  — visual-type + chapter-level
#                                            sequence, when no figure number
#                                            has been resolved (Sprint 23);
#                                            each visual type gets its own
#                                            independent sequence
#   3. region_<region_id>.png             — last resort, when neither of
#                                            the above is available
_FIGURE_PREFIX = "figure"
_REGION_PREFIX = "region"

# Visual-type normalization: maps every visual-type spelling the pipeline
# may hand resolve_figure_name() (an ExtractionType constant, a raw
# LayoutLabel, or free text a caller typed by hand) to the single filename
# prefix Sprint 23 uses for that type. Keys are matched after lowercasing
# and normalizing whitespace/punctuation to underscores (see
# _normalize_visual_type()), so "Activity", "activity", and "activity-box"
# all resolve the same way.
#
# Anything not listed here isn't unsupported — _normalize_visual_type()
# still produces a clean, filename-safe slug for it (Priority 3 — Other
# Educational Visuals) — it just doesn't get one of these specific,
# spec-mandated prefixes.
_VISUAL_TYPE_ALIASES: dict[str, str] = {
    # Extractor/dispatch vocabulary (core.ExtractionType) -> filename prefix
    "graph": "graph",
    "diagram": "diagram",
    "table": "table",
    "photo": "photo",
    "activity": "experiment",     # "Let's Do" / lab-style boxes -> experiments
    "experiment": "experiment",
    # Additional educational visual types Sprint 23 names, even though
    # today's extractors don't all produce them yet (see ExtractionType's
    # forward-looking constants in ingest_textbook_images.py)
    "map": "map",
    "flowchart": "flowchart",
    "illustration": "illustration",
    "mixed": "mixed_region",
    "mixed_region": "mixed_region",
    "mixed_educational_region": "mixed_region",
    "decorative": "decorative",
    "logo": "logo",
    "icon": "logo",
    "logo_icon": "logo",
    "other": "other",
}

_VISUAL_TYPE_SLUG_RE = re.compile(r"[^a-z0-9]+")


@dataclass
class ChapterWorkspace:
    """Deterministic local object-key generation for one chapter's
    ingestion run.

    `context` drives every object key this class produces; it's the
    enterprise hierarchy's naming scheme. A workspace built without a
    context raises a clear error the moment any key method is called
    (`_require_context`) rather than silently returning a bad key.

    ChapterWorkspace is responsible only for naming (chapter naming,
    page naming, deterministic filenames, figure numbering), never for
    creating directories, saving files, uploading, or moving anything.
    That's LocalImageStorage's job.
    """

    chapter_name: str
    context: Optional[DocumentContext] = None
    root_prefix: str = "classes"

    # Chapter-level running counters, one per normalized visual type,
    # backing next_type_index() below — used for the Priority 2 fallback
    # filename (<visual_type>_<chapter_number>_<NNN>.png), when no
    # textbook figure number has been resolved for a candidate yet.
    # Each visual type (diagram, graph, table, photo, experiment, ...)
    # counts independently and chapter-wide, not per-page, so
    # "the 3rd diagram in this chapter" means the same thing regardless
    # of which page it was found on. Never touched directly by callers
    # outside this class; excluded from repr/equality so two workspaces
    # pointed at the same context still compare equal regardless of how
    # many assets have been named through either.
    _type_counters: dict[str, int] = field(default_factory=dict, repr=False, compare=False)

    # ============================================================
    # ENTERPRISE OBJECT KEYS
    # ============================================================
    def _require_context(self) -> DocumentContext:
        if self.context is None:
            raise ValueError(
                "ChapterWorkspace has no DocumentContext — cannot generate "
                "object keys. Pass context= to build_chapter_workspace()."
            )
        return self.context

    @property
    def chapter_prefix(self) -> str:
        """classes/class_09/textbooks/cbse/ncert/science/
        chapter_01_matter_in_our_surroundings — the root every other
        key in this chapter is built under."""
        ctx = self._require_context()
        return "/".join((
            self.root_prefix.strip("/"),
            ctx.class_slug,
            "textbooks",
            ctx.board_slug,
            ctx.publisher_slug,
            ctx.subject_slug,
            ctx.chapter_slug,
        ))

    # -- Original PDF ---------------------------------------------
    def original_pdf_key(self) -> str:
        return f"{self.chapter_prefix}/original/textbook.pdf"

    # -- NCERT Solutions / Notes source PDFs -------------------------
    def ncert_solutions_key(self) -> str:
        return f"{self.chapter_prefix}/ncert_solutions/solutions.pdf"

    def ncert_notes_key(self) -> str:
        return f"{self.chapter_prefix}/ncert_notes/notes.pdf"

    # -- Rendered pages ---------------------------------------------
    #
    # Sprint 20: rendered_pages/page_<NNN>.png lives at the chapter
    # root, a sibling of every page_<NNN>/ folder below — not nested
    # under a shared pages/ parent the way Sprint 18.3/19 had it.
    def rendered_page_key(self, page_no: int) -> str:
        ctx = self._require_context()
        return f"{self.chapter_prefix}/rendered_pages/{ctx.page_slug(page_no)}.png"

    # -- Chapter-level metadata (metadata/ folder) -------------------
    def chapter_metadata_key(self) -> str:
        return f"{self.chapter_prefix}/metadata/chapter_metadata.json"

    def embeddings_key(self) -> str:
        return f"{self.chapter_prefix}/metadata/embeddings.json"

    def processing_report_key(self) -> str:
        return f"{self.chapter_prefix}/metadata/processing_report.json"

    # -- Chapter-level flat folders (logs/debug) ---------------------
    def debug_key(self, filename: str) -> str:
        return f"{self.chapter_prefix}/debug/{filename}"

    def log_key(self) -> str:
        return f"{self.chapter_prefix}/logs/ingest.log"

    # -- Temporary extraction workspace (Sprint 25) -------------------
    #
    # A visual's holding pen between extraction and Qwen Validation's
    # accept/reject decision — before OCR, Caption Association, or
    # Qwen have run, nothing about its final identity (type, figure
    # number, accept/reject) is known yet, so it can't be named or
    # placed like a finished asset. `extracted_filename` is always
    # region_<region_id>.png — deterministic from the region alone,
    # never a candidate figure/type name — so re-running Qwen
    # Validation against the same extraction always looks for the same
    # temp key. This folder is a staging area only: every object in it
    # is deleted once the same bytes have been uploaded to their final
    # page_<NNN>/<filename> home (see _finalize_visual_storage in
    # ingest_textbook_images.py); anything still here after a
    # successful run means that visual's finalize step never
    # completed.
    @staticmethod
    def extracted_filename(region_id: str) -> str:
        """region_<region_id>.png — the one and only filename a visual
        ever has while it's parked in extracted/."""
        return f"{_REGION_PREFIX}_{region_id}.png"

    def extracted_key(self, filename: str) -> str:
        """<chapter_prefix>/extracted/<filename> — filename is always
        extracted_filename(region_id), passed in rather than rebuilt
        here so callers that already have it (it's stashed on
        candidate.metadata["extracted_filename"] at extraction time)
        never risk it drifting from what was actually uploaded."""
        return f"{self.chapter_prefix}/extracted/{filename}"

    # -- Qwen decision storage (accepted/rejected) -------------------
    #
    # Sprint 21: durable, chapter-level homes for every figure Qwen
    # Validation has judged. `filename` is always the exact filename
    # this figure already carries inside its page_<NNN>/ folder (see
    # resolve_figure_name below) — never rebuilt or re-derived here —
    # so the same figure resolves to the same filename in its page
    # folder, in accepted/, and in rejected/ alike. Storing here is
    # always a *copy* of the page-folder original; that original is
    # never moved or deleted (see module docstring).
    def accepted_key(self, filename: str) -> str:
        """<chapter_prefix>/accepted/<filename> — where a figure
        Qwen Validation accepts is copied to, alongside its unchanged
        page_<NNN>/<filename> original."""
        return f"{self.chapter_prefix}/accepted/{filename}"

    def rejected_key(self, filename: str) -> str:
        """<chapter_prefix>/rejected/<filename> — mirrors
        accepted_key() for figures Qwen Validation rejects. The
        page_<NNN>/<filename> original is preserved here too."""
        return f"{self.chapter_prefix}/rejected/{filename}"

    # -- Page folders -------------------------------------------------
    #
    # Sprint 20: page_<NNN>/ is a top-level chapter folder (a sibling
    # of original/, rendered_pages/, metadata/, logs/, debug/) — no
    # intermediate pages/ parent, and no per-visual-type subfolders
    # underneath it. Every figure extracted from a page, whatever type
    # it is, lives directly inside that page's own folder alongside
    # its metadata.json.
    def page_folder(self, page_no: int) -> str:
        ctx = self._require_context()
        return f"{self.chapter_prefix}/{ctx.page_slug(page_no)}"

    def page_metadata_key(self, page_no: int) -> str:
        return f"{self.page_folder(page_no)}/metadata.json"

    def figure_key(self, page_no: int, figure_name: str) -> str:
        """page_<NNN>/<figure_name> — figure_name is a plain filename
        (e.g. "figure_1_1.png"), typically produced by
        resolve_figure_name() below, never built ad hoc by callers."""
        return f"{self.page_folder(page_no)}/{figure_name}"

    # -- Figure Naming --------------------------------------------
    @staticmethod
    def figure_number_slug(figure_number: str) -> str:
        """"1.1" -> "1_1", "3-2" -> "3_2", "1.1.2" -> "1_1_2" — the
        textbook's own figure number, normalized into a filename-safe
        slug. Also accepts a full canonical reference — "Figure 1.1"
        -> "1_1", not "Figure_1_1" — by stripping a leading label word
        first, so it's safe to pass either a bare number (e.g. from
        Caption Association's CaptionMatch.figure_number) or its
        canonical reference (CaptionMatch.reference) straight through."""
        text = _FIGURE_LABEL_PREFIX_RE.sub("", figure_number.strip())
        slug = _FIGURE_NUMBER_SEPARATORS_RE.sub("_", text)
        return slug.strip("_") or "0"

    @staticmethod
    def _normalize_visual_type(visual_type: str) -> str:
        """"Activity" / "activity-box" / "Mixed Educational Region" ->
        "experiment" / "experiment" / "mixed_region" — lowercases,
        collapses any run of non-alphanumeric characters to a single
        underscore, then looks the result up in _VISUAL_TYPE_ALIASES
        for the spec-mandated filename prefix. A visual type with no
        alias entry (an unanticipated or genuinely "other" type) still
        gets a clean, filename-safe slug back — normalization never
        fails just because a type wasn't in the known list; it only
        raises (via resolve_figure_name) when given nothing at all."""
        slug = _VISUAL_TYPE_SLUG_RE.sub("_", visual_type.strip().lower()).strip("_")
        if not slug:
            return "visual"
        return _VISUAL_TYPE_ALIASES.get(slug, slug)

    def next_type_index(self, visual_type: str) -> int:
        """Chapter-level running counter backing the Priority 2
        filename (<visual_type>_<chapter_number>_<NNN>.png), starting
        from 1 for each normalized visual type and shared across every
        page in this chapter — not reset per page, and not shared
        across types (the chapter's diagrams and graphs each count
        from 1 independently). Allocated exactly once, at extraction
        time, and reused for every later reference to that same asset
        so it keeps the same filename throughout its life (unless it's
        later promoted to a Priority 1 name once a figure number is
        resolved — see resolve_figure_name)."""
        slug = self._normalize_visual_type(visual_type)
        self._type_counters[slug] = self._type_counters.get(slug, 0) + 1
        return self._type_counters[slug]

    def resolve_figure_name(
        self,
        page_no: int,
        *,
        figure_number: Optional[str] = None,
        visual_type: Optional[str] = None,
        index: Optional[int] = None,
        region_id: Optional[str] = None,
    ) -> str:
        """Visual Naming Priority (Sprint 23):

            1. Textbook's own figure number, e.g. "Figure 1.1"
               -> figure_1_1.png
               (the textbook's own numbering already encodes both the
               chapter and the figure — "1.1" means chapter 1, figure
               1 — so figure_number_slug() alone gives the final
               figure_<chapter_number>_<figure_number>.png name; no
               separate chapter_number is needed here)
            2. Visual type + chapter-level sequence, when no figure
               number is available (yet, or ever) — driven by this
               chapter's own chapter_no and an independent running
               count per normalized visual type, not by which page the
               visual was found on
               -> diagram_1_001.png / graph_1_001.png / table_1_001.png
                  / photo_1_001.png / experiment_1_001.png / etc.
               `index`, if given explicitly, is used as the sequence
               number as-is instead of allocating a new one — this is
               what lets a caller (e.g. figure-filename promotion)
               rebuild the exact same name a visual already has,
               rather than minting a fresh one.
            3. Region id, when neither of the above is available
               -> region_<region_id>.png

        Callers pass whichever of `figure_number` / `visual_type`
        (+ optional `index`) / `region_id` they currently have; this
        method picks the highest-priority name it can build from what's
        given rather than requiring all of them up front — e.g.
        extraction time only has `visual_type` and `region_id` (no
        figure number yet, since Caption Association hasn't run), while
        a later promotion call has `figure_number` too and that always
        wins. `page_no` is accepted for API symmetry with the other
        page-scoped methods (and because callers naturally have it on
        hand) but does not appear in the filename itself — the same
        visual keeps the same name no matter which page it's
        referenced from."""
        if figure_number:
            return f"{_FIGURE_PREFIX}_{self.figure_number_slug(figure_number)}.png"
        if visual_type:
            ctx = self._require_context()
            prefix = self._normalize_visual_type(visual_type)
            seq = index if index is not None else self.next_type_index(visual_type)
            return f"{prefix}_{ctx.chapter_no}_{seq:03d}.png"
        if region_id:
            return f"{_REGION_PREFIX}_{region_id}.png"
        raise ValueError(
            "resolve_figure_name() needs at least one of figure_number, "
            "visual_type, or region_id to build a filename."
        )


def build_chapter_workspace(
    pdf_path,
    *,
    context: Optional[DocumentContext] = None,
    root_prefix: str = "classes",
) -> ChapterWorkspace:
    """Builds a ChapterWorkspace for one chapter's ingestion run.
    `chapter_name` always comes from `pdf_path.stem` — never hardcoded,
    never guessed from subject/chapter metadata. `context`, when
    supplied, enables every object-key method on the returned
    workspace. Nothing is created anywhere — there is no local
    directory to make and no object-storage "folder" to pre-create
    (object storage has none), so this is just a plain constructor
    call."""
    from pathlib import Path
    pdf_path = Path(pdf_path)
    return ChapterWorkspace(
        chapter_name=pdf_path.stem,
        context=context,
        root_prefix=root_prefix,
    )


__all__ = ["ChapterWorkspace", "build_chapter_workspace"]