"""
ingest_textbook_images.py

Sprint 1 — Build the New Foundation.

This module is the ORCHESTRATOR for the textbook visual-ingestion
pipeline:

    PDF
     |
     v
    PyMuPDF (load)
     |
     v
    Page Renderer
     |
     v
    DocLayout-YOLO
     |
     v
    Educational Region Detection
     |
     +---------+----------+----------+----------+
     v         v          v          v
   Graph    Diagram     Table      Photo
   Region   Region      Region     Region
     |         |          |          |
     v         v          v          v
  extract_  extract_   PP-Struct   extract_
  graphs    diagrams    ureV3      photos
     |         |          |          |
     +---------+----------+----------+
                    |
                    v
               PaddleOCR
                    |
                    v
            Caption Association
                    |
                    v
             Qwen Validation
                    |
                    v
                Metadata
                    |
                    v
            Duplicate Removal
                    |
                    v
               Embeddings
                    |
                    v
                 Qdrant
                    |
                    v
             Pass2 Enrichment

DocumentProcessor below is a pure orchestrator. It does not contain
any extraction heuristics, layout heuristics, or acceptance policy —
that logic lives in the dedicated stage modules it calls out to (each
one a single box in the diagram above). This file only sequences
those calls: load -> render -> detect -> dispatch -> collect -> store.

Every stage is injected as a dependency (constructor argument) rather
than hardcoded, so:
  - later sprints can implement/replace a stage without touching this
    file, and
  - this file can be exercised end-to-end today even for stages that
    are not implemented yet (they default to no-op pass-throughs).
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
import uuid
from difflib import SequenceMatcher
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional, Protocol

import fitz  # PyMuPDF
from dotenv import load_dotenv
from PIL import Image
import numpy as np

from core.vision_runtime import VisionRuntime, get_vision_runtime
from core.chapter_workspace import ChapterWorkspace, build_chapter_workspace
from core.document_context import DocumentContext
from core.local_image_storage import (
    LocalImageStorage,
    StoredObject,
    get_local_image_storage,
)

logger = logging.getLogger(__name__)

load_dotenv()

# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

KNOWLEDGE_BASE_DIR = PROJECT_ROOT / os.getenv(
    "KNOWLEDGE_BASE_DIR",
    "knowledge_base",
)

# Sprint 19 — Part 2: Remove Persistent Local Workspace. There is no
# more MEDIA_ROOT: local image storage (core/local_image_storage.py,
# under LOCAL_MEDIA_ROOT) is the only durable home for page renders,
# visual crops, metadata, logs, and debug images. Anything that used
# to live under media/textbooks/... now lives only in memory (PIL
# images / dicts / strings) until it's uploaded, or briefly in a
# tempfile.TemporaryDirectory() where a real filesystem path is
# unavoidable (e.g. handing a path to a third-party library). Nothing
# remains on ad-hoc local disk paths after ingestion completes — every
# durable artifact lands under LOCAL_MEDIA_ROOT via LocalImageStorage.


# ============================================================
# SERVICES
# ============================================================

OLLAMA_URL = os.getenv(
    "OLLAMA_HOST",
    "http://127.0.0.1:11434",
).rstrip("/")

VISION_MODEL = os.getenv(
    "VISION_MODEL",
    "qwen2.5vl:7b",
)

# cpu | gpu | auto — see core/vision_runtime.py. This only decides how
# the Vision Validation stage talks to Ollama (CPU-forced vs
# GPU-allowed); it does not touch any other stage.
VISION_RUNTIME = os.getenv(
    "VISION_RUNTIME",
    "gpu",
)

EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL",
    "bge-m3",
)

QDRANT_URL = os.getenv(
    "QDRANT_URL",
    "http://127.0.0.1:6333",
)

IMAGE_COLLECTION = os.getenv(
    "IMAGE_COLLECTION",
    "textbook_images",
)

QDRANT_VECTOR_DIM = int(
    os.getenv(
        "QDRANT_VECTOR_DIM",
        "1024",
    )
)

# ============================================================
# PAGE RENDERING CONFIG
#
# Single source of truth for render resolution. Every stage that
# needs a page image uses the RenderedPage produced at this DPI —
# nothing downstream re-renders at a different resolution.
# ============================================================

PAGE_RENDER_DPI = int(
    os.getenv("PAGE_RENDER_DPI", "160")
)


# ============================================================
# LAYOUT DETECTOR CONFIG
#
# LayoutDetector (DocLayout-YOLO) needs a weights file and a device;
# unlike the other services above these have no safe built-in
# default, so they're read here (env-driven, same convention as
# everything else in this section) rather than hardcoded at the
# DocumentProcessor construction site.
# ============================================================

DOCLAYOUT_WEIGHTS_PATH = os.getenv("DOCLAYOUT_WEIGHTS_PATH") or None

DOCLAYOUT_DEVICE = os.getenv("DOCLAYOUT_DEVICE", "cpu")


# ============================================================
# LOGGING CONFIG
# ============================================================

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


# ============================================================
# PIPELINE DIAGNOSTICS (Sprint 15)
#
# Cross-cutting observability only — nothing below changes what any
# stage decides, accepts, rejects, or produces. Every method here is
# called from *inside* an existing stage's __call__, wrapped around
# logic that was already there, so if any stage fails, skips data, or
# behaves unexpectedly, the exact stage and reason show up in the
# console output within seconds, without a debugger.
#
# Controlled by DIAGNOSTICS_ENABLED (env var, default "true"). When
# disabled, every method below is a no-op and the pipeline's observable
# behavior (return values, files written, records stored) is identical
# to before this sprint — only the printed diagnostics disappear.
# ============================================================

DIAGNOSTICS_ENABLED = os.getenv("DIAGNOSTICS_ENABLED", "true").strip().lower() not in (
    "0", "false", "no", "off",
)

# ============================================================
# CHAPTER WORKSPACE / DEBUG IMAGES (Sprint 17)
#
# DEBUG_IMAGES_ENABLED only controls the optional page_<N>_regions.png
# dumps into each chapter workspace's debug/ folder (Part 5) — nothing
# else. Off by default: writing a full-page annotated image per page
# is not something every run wants paying disk/time for.
# ============================================================

DEBUG_IMAGES_ENABLED = os.getenv("DEBUG_IMAGES_ENABLED", "false").strip().lower() not in (
    "0", "false", "no", "off",
)

# ============================================================
# DOCUMENT CONTEXT CONFIG (Sprint 18)
#
# BOARD / PUBLISHER have no local-filesystem equivalent (Subject
# Detection above only ever reads Subject/Chapter off the folder
# layout) — every DocumentContext this pipeline builds uses these two
# values, env-driven exactly like everything else in this section
# rather than hardcoded at each construction site.
# ============================================================

TEXTBOOK_BOARD = os.getenv("TEXTBOOK_BOARD", "cbse")
TEXTBOOK_PUBLISHER = os.getenv("TEXTBOOK_PUBLISHER", "ncert")

# Local-only deployment: storage is always LocalImageStorage
# (core/local_image_storage.py, under LOCAL_MEDIA_ROOT) — there is no
# remote object store to enable/disable or point at a different root
# prefix, so the old MINIO_STORAGE_ENABLED/MINIO_ROOT_PREFIX toggles
# are gone. See _get_storage() / _init_storage_at_startup() below.


class PipelineDiagnostics:
    """Unified diagnostics: stage timing (Part 1), candidate-flow
    tracking by region_id (Part 2), stage statistics (Part 3), and the
    per-stage diagnostic printers for Save / Qwen / Metadata /
    Duplicate Removal / Embedding / Qdrant (Parts 4-9), plus the final
    pipeline report (Part 10).

    Also holds `counters`, a simple per-document tally
    (`begin_document()` resets it) that the stages below increment as
    candidates pass through them, so Part 10's summary can be built
    from real, observed counts rather than re-deriving them from
    already-mutated PipelineResult state after the fact.
    """

    def __init__(self, enabled: bool = True) -> None:
        self.enabled = enabled
        self._stage_starts: dict[str, float] = {}
        self.candidate_log: dict[str, list[str]] = {}
        self.counters: dict[str, int] = {}
        self._doc_start: float = 0.0

    # ------------------------------------------------------------
    # Per-document counters (feed Part 10's Final Pipeline Report)
    # ------------------------------------------------------------
    def begin_document(self) -> None:
        self.counters = {}
        self.candidate_log = {}
        self._doc_start = time.perf_counter()

    def count(self, key: str, n: int = 1) -> None:
        self.counters[key] = self.counters.get(key, 0) + n

    def get_count(self, key: str) -> int:
        return self.counters.get(key, 0)

    @property
    def document_elapsed(self) -> float:
        return time.perf_counter() - self._doc_start

    # ------------------------------------------------------------
    # Part 1 — Pipeline Stage Logger
    # ------------------------------------------------------------
    def stage_start(self, name: str) -> None:
        if not self.enabled:
            return
        self._stage_starts[name] = time.perf_counter()
        print("=" * 30)
        print(f"Stage : {name}")
        print("Started")
        print("=" * 30)

    def stage_end(self, name: str) -> float:
        if not self.enabled:
            return 0.0
        elapsed = time.perf_counter() - self._stage_starts.pop(name, time.perf_counter())
        print("Completed")
        print(f"Time : {elapsed:.2f} sec")
        print()
        return elapsed

    # ------------------------------------------------------------
    # Part 2 — Candidate Flow Tracking
    # ------------------------------------------------------------
    def track(self, region_id: Optional[str], event: str) -> None:
        if not self.enabled or not region_id:
            return
        self.candidate_log.setdefault(region_id, []).append(event)
        print(region_id)
        print()
        print(event)
        print()

    def drop(self, region_id: Optional[str], reason: str) -> None:
        if not self.enabled or not region_id:
            return
        self.candidate_log.setdefault(region_id, []).append(f"Dropped: {reason}")
        print(region_id)
        print()
        print("Dropped")
        print()
        print("Reason:")
        print(reason)
        print()

    # ------------------------------------------------------------
    # Part 3 — Stage Statistics
    # ------------------------------------------------------------
    def stage_stats(
        self,
        name: str,
        *,
        received: Optional[int] = None,
        processed: Optional[int] = None,
        saved: Optional[int] = None,
        failed: Optional[int] = None,
        skipped: Optional[int] = None,
    ) -> None:
        if not self.enabled:
            return
        print(name)
        print()
        if received is not None:
            print(f"Candidates received : {received}")
            print()
        if processed is not None:
            print(f"Candidates processed : {processed}")
            print()
        if saved is not None:
            print(f"Images saved : {saved}")
            print()
        if failed is not None:
            print(f"Images failed : {failed}")
            print()
        if skipped is not None:
            print(f"Skipped : {skipped}")
            print()

    # ------------------------------------------------------------
    # Part 4 — Save Diagnostics
    # ------------------------------------------------------------
    def save_result(
        self,
        region_id: Optional[str],
        *,
        path: Any,
        exists: bool,
        size: Optional[tuple[int, int]],
        status: str,
        reason: Optional[str] = None,
    ) -> None:
        if not self.enabled:
            return
        print("Region:")
        print(region_id)
        print()
        print("Path:")
        print(path)
        print()
        print("Image Exists:")
        print("YES" if exists else "NO")
        print()
        if size is not None:
            print("Size:")
            print(f"{size[0]}x{size[1]}")
            print()
        print("Status:")
        print(status)
        print()
        if status != "SUCCESS" and reason:
            print("Reason:")
            print(reason)
            print()

    # ------------------------------------------------------------
    # Part 5 — Qwen Diagnostics
    # ------------------------------------------------------------
    def qwen_result(
        self,
        region_id: Optional[str],
        *,
        accepted: bool,
        confidence: Optional[float] = None,
        reason: Optional[str] = None,
    ) -> None:
        if not self.enabled:
            return
        print("Region:")
        print(region_id)
        print()
        if accepted:
            print("Accepted : YES")
            print()
            print(f"Confidence : {confidence if confidence is not None else 'n/a'}")
            print()
        else:
            print("Rejected")
            print()
            print("Reason:")
            print(reason or "unknown")
            print()
            print("Confidence:")
            print(confidence if confidence is not None else "n/a")
            print()

    # ------------------------------------------------------------
    # Part 6 — Metadata Diagnostics
    # ------------------------------------------------------------
    def metadata_result(
        self,
        *,
        subject: Any,
        chapter: Any,
        figure_number: Any,
        caption: Any,
        crop_path: Any,
        image_hash: Any,
        search_text_length: int,
        status: str,
    ) -> None:
        if not self.enabled:
            return
        print("Subject")
        print(subject)
        print()
        print("Chapter")
        print(chapter)
        print()
        print("Figure Number")
        print(figure_number)
        print()
        print("Caption")
        print(caption)
        print()
        print("Crop Path")
        print(crop_path)
        print()
        print("Image Hash")
        print(image_hash)
        print()
        print("Search Text Length")
        print(search_text_length)
        print()
        print("Status")
        print(status)
        print()

    # ------------------------------------------------------------
    # Part 7 — Duplicate Removal Diagnostics
    # ------------------------------------------------------------
    def duplicate_result(
        self,
        *,
        image_hash: Any,
        duplicate_found: bool,
        original_region: Optional[str] = None,
        removed_region: Optional[str] = None,
    ) -> None:
        if not self.enabled:
            return
        print("Image Hash")
        print(image_hash)
        print()
        print("Duplicate Found")
        print("YES" if duplicate_found else "NO")
        print()
        if duplicate_found:
            print("Original Region")
            print(original_region)
            print()
            print("Removed")
            print(removed_region)
            print()

    # ------------------------------------------------------------
    # Part 8 — Embedding Diagnostics
    # ------------------------------------------------------------
    def embedding_result(
        self,
        *,
        success: bool,
        dimension: Optional[int] = None,
        time_sec: Optional[float] = None,
        reason: Optional[str] = None,
    ) -> None:
        if not self.enabled:
            return
        if success:
            print("Embedding Generated")
            print()
            print("Dimension")
            print(dimension)
            print()
            print("Time")
            print(f"{time_sec:.2f} sec" if time_sec is not None else "n/a")
            print()
        else:
            print("Embedding Failed")
            print()
            print("Reason")
            print(reason or "unknown")
            print()

    # ------------------------------------------------------------
    # Part 9 — Qdrant Diagnostics
    # ------------------------------------------------------------
    def qdrant_upload_start(self, point_count: int, collection: str) -> None:
        if not self.enabled:
            return
        print("Uploading")
        print()
        print(f"{point_count} points")
        print()
        print("Collection")
        print(collection)
        print()

    def qdrant_upload_result(self, uploaded: int, failed: int) -> None:
        if not self.enabled:
            return
        print("Upload Successful" if failed == 0 else "Upload Completed With Failures")
        print()
        print(f"{uploaded} uploaded")
        print(f"{failed} failed")
        print()

    # ------------------------------------------------------------
    # Part 10 — Final Pipeline Report
    # ------------------------------------------------------------
    def final_report(self, **fields: Any) -> None:
        if not self.enabled:
            return
        print("=" * 52)
        print()
        print("PIPELINE SUMMARY")
        print()
        print("=" * 52)
        print()
        for label, value in fields.items():
            print(label)
            print(value)
            print()
        print("=" * 52)

    # ------------------------------------------------------------
    # Part 11 — Chapter Workspace Storage Diagnostics (Sprint 17)
    #
    # Distinct from Part 4-6's save_result()/qwen_result()/
    # metadata_result() above: those report on the *content* decisions
    # each stage already made (accept/reject, hash, search text, ...).
    # These four report purely on *storage* — every image write, move,
    # or metadata-file write into a chapter workspace prints
    # immediately, so a failed save is visible the moment it happens,
    # not just in the end-of-chapter tally.
    # ------------------------------------------------------------
    def image_save(
        self,
        region_id: Optional[str],
        *,
        stage: str,
        status: str,
        folder: str,
        path: Any,
        size: Optional[tuple[int, int]] = None,
        reason: Optional[str] = None,
    ) -> None:
        if not self.enabled:
            return
        print("=====================================")
        print("Image Save")
        print("=====================================")
        print()
        print(f"Region ID : {region_id}")
        print()
        print(f"Stage     : {stage}")
        print()
        print(f"Status    : {status}")
        print()
        if status == "SUCCESS":
            print(f"Folder    : {folder}")
            print()
            print("Path      :")
            print(path)
            print()
            if size is not None:
                print(f"Size      : {size[0]} x {size[1]}")
                print()
        else:
            print("Reason    :")
            print(reason or "unknown")
            print()
            print("Target    :")
            print(path)
            print()

    def qwen_storage(
        self,
        region_id: Optional[str],
        *,
        decision: str,
        from_folder: str,
        to_folder: str,
        reason: Optional[str] = None,
    ) -> None:
        if not self.enabled:
            return
        print("=====================================")
        print("Qwen Storage")
        print("=====================================")
        print()
        print(f"Region ID : {region_id}")
        print()
        print(f"Decision  : {decision}")
        print()
        print("Moved")
        print()
        print("FROM")
        print()
        print(from_folder)
        print()
        print("TO")
        print()
        print(to_folder)
        print()
        if reason:
            print("Reason")
            print()
            print(reason)
            print()

    def metadata_save(
        self,
        region_id: Optional[str],
        *,
        status: str,
        file_path: Any,
    ) -> None:
        if not self.enabled:
            return
        print("=====================================")
        print("Metadata Save")
        print("=====================================")
        print()
        print(f"Region ID : {region_id}")
        print()
        print(f"Status    : {status}")
        print()
        print("File")
        print()
        print(file_path)
        print()

    def chapter_workspace_summary(
        self,
        *,
        chapter: str,
        workspace: Any,
        extracted: int,
        accepted: int,
        rejected: int,
        metadata_files: int,
        debug_images: int,
        elapsed_seconds: float,
    ) -> None:
        if not self.enabled:
            return
        minutes, seconds = divmod(int(elapsed_seconds), 60)
        print("===========================================")
        print("Chapter Workspace Summary")
        print("===========================================")
        print()
        print("Chapter")
        print()
        print(chapter)
        print()
        print("Workspace")
        print()
        print(workspace)
        print()
        print("Images Extracted")
        print()
        print(extracted)
        print()
        print("Accepted")
        print()
        print(accepted)
        print()
        print("Rejected")
        print()
        print(rejected)
        print()
        print("Metadata Files")
        print()
        print(metadata_files)
        print()
        print("Debug Images")
        print()
        print(debug_images)
        print()
        print("Elapsed Time")
        print()
        print(f"{minutes} min {seconds} sec")
        print()

    # ------------------------------------------------------------
    # Part 12 — Sprint 22: Unified Storage Lifecycle Diagnostics
    #
    # Replaces the several slightly-different printers Part 11 grew
    # one stage at a time (image_save / qwen_storage / metadata_save)
    # with one consistent shape every storage write in the pipeline
    # goes through — rendered pages, figures, page metadata, the
    # accepted/rejected copies, chapter metadata, the processing
    # report. Every write still prints immediately (a failure is
    # visible the moment it happens), but now always carries the exact
    # object key (and, for copies, the source key it came from) so a
    # mismatched key or a write failure is diagnosable straight from
    # the log.
    # ------------------------------------------------------------
    def storage_event(
        self,
        event: str,
        *,
        key: Any,
        bucket: Optional[str] = None,
        status: str = "SUCCESS",
        exists: Optional[bool] = None,
        source_key: Optional[str] = None,
        region_id: Optional[str] = None,
        size: Optional[tuple[int, int]] = None,
        reason: Optional[str] = None,
    ) -> None:
        if not self.enabled:
            return
        print("=====================================")
        print(event)
        print("=====================================")
        print()
        if region_id is not None:
            print(f"Region ID : {region_id}")
            print()
        if source_key is not None:
            print("Source Key:")
            print(source_key)
            print()
        print("Key:")
        print(key)
        print()
        if bucket:
            print(f"Bucket    : {bucket}")
            print()
        print(f"Status    : {status}")
        print()
        if exists is not None:
            print(f"Verified Exists : {'YES' if exists else 'NO'}")
            print()
        if size is not None:
            print(f"Size      : {size[0]} x {size[1]}")
            print()
        if status != "SUCCESS" and reason:
            print("Reason    :")
            print(reason)
            print()


# Module-level singleton every stage below reaches for. Not injected
# per-DocumentProcessor-instance (unlike the real stages) because
# diagnostics is purely observational, cross-cutting, and never part
# of any stage's business logic or return value.
diagnostics = PipelineDiagnostics(enabled=DIAGNOSTICS_ENABLED)


# ============================================================
# DATA CONTRACTS
#
# Plain data containers only — no behavior, no heuristics. These are
# the shapes that flow between pipeline stages.
# ============================================================

@dataclass
class RenderedPage:
    """The single render of one page. Produced exactly once by
    render_page(); every later stage (DocLayout-YOLO, the region
    extractors, PaddleOCR, ...) is handed this same object instead of
    opening the PDF and re-rendering the page itself.

    Stores exactly what later stages need:
      - page        : the underlying PyMuPDF page object (text/vector
                      access, coordinate math, etc.)
      - image       : the rasterized page (PIL.Image)
      - scale       : zoom factor used to render (image px per PDF pt) —
                      needed to map region bboxes back into PDF space
      - page_number : 1-indexed position in the document
    """
    page_number: int
    page: fitz.Page
    image: Image.Image
    scale: float

    @property
    def page_rect(self) -> fitz.Rect:
        """Original (unscaled) page rectangle, in PDF points. Derived
        from `page`, not stored separately — one source of truth for
        page geometry."""
        return self.page.rect


class LayoutLabel:
    """Fixed vocabulary DocLayout-YOLO predictions are normalized into.
    Nothing downstream needs to know model-specific class ids or the
    raw label strings a given model checkpoint happens to use."""
    FIGURE = "figure"
    TABLE = "table"
    CAPTION = "caption"
    PHOTO = "photo"
    TEXT = "text"
    TITLE = "title"
    FORMULA = "formula"
    LIST = "list"
    HEADER = "header"
    FOOTER = "footer"
    IGNORE = "ignore"  # DocLayout-YOLO's own "discard this" class (raw label "abandon")


ALL_LAYOUT_LABELS: tuple[str, ...] = (
    LayoutLabel.FIGURE,
    LayoutLabel.TABLE,
    LayoutLabel.CAPTION,
    LayoutLabel.PHOTO,
    LayoutLabel.TEXT,
    LayoutLabel.TITLE,
    LayoutLabel.FORMULA,
    LayoutLabel.LIST,
    LayoutLabel.HEADER,
    LayoutLabel.FOOTER,
)
# Deliberately excludes LayoutLabel.IGNORE — it's not a real content
# label anything downstream ever sees a LayoutRegion for (see
# IGNORED_LAYOUT_LABELS below); this tuple is the vocabulary of labels
# that actually reach EducationalRegionBuilder.

# Normalized labels that should never become a LayoutRegion at all —
# DocLayout-YOLO's own "not content" prediction ("abandon": running
# headers/footers, watermarks, page furniture the model itself has
# already decided to discard) is filtered out by LayoutDetector before
# region creation, rather than flowing downstream as an "unrecognized
# label" warning on every single detection.
IGNORED_LAYOUT_LABELS: frozenset[str] = frozenset({LayoutLabel.IGNORE})


def make_region_id(page: int, bbox: tuple[float, float, float, float], region_class: str) -> str:
    """Stable, deterministic id for a detected region.

    Derived only from page + rounded bbox + class — never from
    confidence or raw model output — so the same physical region gets
    the same id across re-runs (even if the model's confidence score
    or internal representation drifts slightly between invocations).
    This is what lets OCR, caption association, validation, and
    storage all refer to "this region" as the same thing.
    """
    rounded_bbox = tuple(round(v, 1) for v in bbox)
    digest = hashlib.sha256(f"{page}:{region_class}:{rounded_bbox}".encode("utf-8")).hexdigest()
    return f"region_{digest[:16]}"


@dataclass
class LayoutRegion:
    """One region detected by DocLayout-YOLO. This is the "LayoutRegion"
    the architecture spec describes: bbox / class / confidence / page,
    plus a stable `region_id`.

    (The field is named `region_class` rather than `class` — `class` is
    a reserved word in Python.)

    This is DocLayout-YOLO's raw output — one block, no relationships
    to anything else on the page. EducationalRegionBuilder (below)
    groups these into EducationalRegions, which is what actually gets
    dispatched to an extractor.
    """
    bbox: tuple[float, float, float, float]   # (x0, y0, x1, y1), PDF point space
    region_class: str                          # one of ALL_LAYOUT_LABELS
    confidence: float
    page: int                                   # 1-indexed page number
    raw: Any = None         # untouched model output, for downstream provenance only
    region_id: str = ""     # auto-derived in __post_init__ if left blank

    def __post_init__(self) -> None:
        if not self.region_id:
            self.region_id = make_region_id(self.page, self.bbox, self.region_class)


# ============================================================
# EXTRACTION TYPES
#
# The vocabulary EducationalRegion.type is normalized into, and what
# dispatch_region() actually routes on. Distinct from LayoutLabel:
# LayoutLabel is what DocLayout-YOLO can see (a "figure" on the page);
# ExtractionType is what the pipeline is going to *do* with it (run it
# through extract_graphs vs extract_diagrams vs ...). "table" and
# "photo" map straight across; "figure" is ambiguous and needs a
# FigureTypeClassifier (below) to resolve into graph / diagram /
# activity before dispatch ever sees it.
# ============================================================

class ExtractionType:
    # Dispatch-ready today — every value below has a real extractor
    # wired up in _EXTRACTOR_REGISTRY (see dispatch_region()).
    GRAPH = "graph"
    DIAGRAM = "diagram"
    TABLE = "table"
    PHOTO = "photo"
    ACTIVITY = "activity"

    # Sprint 23 — named but not yet dispatched. No extractor produces
    # these yet (Educational Region Detection only ever resolves a
    # LayoutLabel.FIGURE anchor into GRAPH / DIAGRAM / ACTIVITY today —
    # see FigureTypeClassifier above), but ChapterWorkspace's naming
    # system (resolve_figure_name / _VISUAL_TYPE_ALIASES) already knows
    # how to name a visual of any of these types the moment something
    # upstream starts classifying into them, with no naming-side change
    # required when that day comes.
    MAP = "map"
    FLOWCHART = "flowchart"
    ILLUSTRATION = "illustration"
    MIXED_REGION = "mixed_region"
    DECORATIVE = "decorative"
    LOGO = "logo"
    OTHER = "other"


ALL_EXTRACTION_TYPES: tuple[str, ...] = (
    ExtractionType.GRAPH,
    ExtractionType.DIAGRAM,
    ExtractionType.TABLE,
    ExtractionType.PHOTO,
    ExtractionType.ACTIVITY,
)

# Every visual type Sprint 23 can name a file for — dispatch-ready types
# plus the forward-looking ones above. Distinct from ALL_EXTRACTION_TYPES
# (which is deliberately narrower: only types dispatch_region() can
# actually route to an extractor today) so that list doesn't have to grow
# — and every dispatch call site doesn't have to start handling types with
# no extractor — just to let the naming system recognize a new type.
ALL_NAMEABLE_VISUAL_TYPES: tuple[str, ...] = ALL_EXTRACTION_TYPES + (
    ExtractionType.MAP,
    ExtractionType.FLOWCHART,
    ExtractionType.ILLUSTRATION,
    ExtractionType.MIXED_REGION,
    ExtractionType.DECORATIVE,
    ExtractionType.LOGO,
    ExtractionType.OTHER,
)


@dataclass
class EducationalRegion:
    """A layout block promoted to a self-contained extraction unit.

    Where a LayoutRegion is just "Figure, this bbox, this page", an
    EducationalRegion already carries everything an extractor needs to
    do its job without searching the page: which caption belongs to
    it, what nearby text/title blocks give it context, and — unlike a
    LayoutRegion — a `type` that is already one of ALL_EXTRACTION_TYPES
    (graph / diagram / table / photo / activity), not just a raw
    layout label. Resolving both of those is Educational Region
    Detection's whole job; dispatch_region() does nothing but a dict
    lookup on `type`.
    """
    region_id: str                                # copied from the anchor LayoutRegion, for tracking downstream
    type: str                                     # one of ALL_EXTRACTION_TYPES — already dispatch-ready
    bbox: tuple[float, float, float, float]       # anchor bbox, PDF point space
    page: int
    confidence: float
    caption: Optional[LayoutRegion] = None        # nearest associated caption block, if any
    context: list[LayoutRegion] = field(default_factory=list)  # nearby text/title blocks, nearest first
    source: Optional[LayoutRegion] = None         # the original anchor LayoutRegion, for provenance


# ============================================================
# VISUAL CANDIDATE
#
# The single, consistent shape every RegionExtractor (extract_graphs,
# extract_diagrams, PP-StructureV3, extract_photos, ...) returns,
# instead of each extractor inventing its own ad hoc payload dict.
# PaddleOCR, Caption Association, Qwen Validation, Metadata, Duplicate
# Removal, Embeddings, and storage all read/write this same shape.
# ============================================================

@dataclass
class VisualCandidate:
    """What a region extractor produces for one EducationalRegion.

    `region_id` ties this candidate back to the EducationalRegion (and
    transitively, the original LayoutRegion) it came from — the same
    id threads through OCR, caption association, validation, and
    storage, so every stage can say "this is still the same region"
    without re-matching on geometry.

    Extractor-specific detail that doesn't fit the common fields
    (e.g. a graph's parsed data series, a table's row/column grid)
    goes in `metadata` rather than widening this contract per
    extractor.
    """
    region_id: str
    type: str                                      # one of ALL_EXTRACTION_TYPES
    page: int
    bbox: tuple[float, float, float, float]
    image: Any = None                               # cropped raster (e.g. PIL.Image), if the extractor produced one
    caption_text: Optional[str] = None               # filled in by Caption Association, not the extractor itself
    ocr_text: Optional[str] = None                   # filled in by PaddleOCR
    confidence: float = 0.0
    metadata: dict = field(default_factory=dict)     # extractor-specific extras

    @classmethod
    def from_region(cls, region: EducationalRegion, **overrides: Any) -> "VisualCandidate":
        """Convenience constructor: seed the common fields straight
        from the EducationalRegion an extractor was handed, so every
        extractor doesn't have to repeat `region_id=region.region_id,
        type=region.type, page=region.page, bbox=region.bbox` by hand."""
        defaults = dict(
            region_id=region.region_id,
            type=region.type,
            page=region.page,
            bbox=region.bbox,
            confidence=region.confidence,
        )
        defaults.update(overrides)
        return cls(**defaults)


@dataclass
class RegionResult:
    """Output of dispatch_region(): the EducationalRegion that was
    routed, and the VisualCandidate its extractor produced (or None,
    if extraction failed — see `ok`/`error`)."""
    region: EducationalRegion
    candidate: Optional[VisualCandidate] = None
    ok: bool = True
    error: Optional[str] = None


@dataclass
class PageResult:
    """Output of finalize_page: everything collected for one page."""
    page_number: int
    region_results: list[RegionResult] = field(default_factory=list)
    error: Optional[str] = None  # set when the whole page failed (e.g. corrupt page,
                                  # detector failure) instead of raising out of process_pdf


@dataclass
class PipelineResult:
    """Output of process_pdf: everything collected for one document."""
    pdf_path: Path
    pages: list[PageResult] = field(default_factory=list)
    context: dict = field(default_factory=dict)


# ============================================================
# STAGE INTERFACES
#
# Each Protocol below corresponds to exactly one box in the
# architecture diagram. DocumentProcessor depends only on these
# interfaces, never on a concrete implementation.
# ============================================================

class PageRenderer(Protocol):
    def __call__(self, page: fitz.Page, page_number: int) -> RenderedPage: ...


class RegionDetector(Protocol):
    """DocLayout-YOLO + Educational Region Detection: raster in,
    localized EducationalRegions out."""
    def __call__(self, rendered: RenderedPage) -> list[EducationalRegion]: ...


class RegionExtractor(Protocol):
    """extract_graphs / extract_diagrams / PP-StructureV3 / extract_photos.
    Receives an already-localized EducationalRegion — its own bbox,
    its caption candidate, its context — and never needs to search the
    page for any of it."""
    def __call__(self, region: EducationalRegion, rendered: RenderedPage, **context: Any) -> RegionResult: ...


class PageEnricher(Protocol):
    """PaddleOCR / Caption Association — operate on a page's collected
    region results before validation."""
    def __call__(self, page_result: PageResult, rendered: RenderedPage, **context: Any) -> PageResult: ...


class DocumentEnricher(Protocol):
    """Qwen Validation / Metadata / Duplicate Removal / Embeddings /
    Pass2 Enrichment — operate on the whole collected document."""
    def __call__(self, result: PipelineResult) -> PipelineResult: ...


class ResultStore(Protocol):
    """Qdrant (or any other sink)."""
    def __call__(self, result: PipelineResult) -> int: ...


# ============================================================
# PAGE RENDERER (Sprint 2)
#
# The one place in the whole pipeline that turns a PDF page into an
# image. Every other stage — DocLayout-YOLO, the region extractors,
# PaddleOCR — consumes the RenderedPage this produces. No module
# downstream of DocumentProcessor.process_page() may re-render a page.
# ============================================================

def render_page(
    page: fitz.Page,
    page_number: int,
    *,
    dpi: int = PAGE_RENDER_DPI,
) -> RenderedPage:
    """Rasterize one PDF page to an image, exactly once.

    PDF Load (PyMuPDF) -> Page Renderer -> Page Image, wrapped in the
    RenderedPage contract (page object, image, scale, page number)
    that every later stage receives.
    """
    scale = dpi / 72.0  # PyMuPDF units are 72 points/inch
    matrix = fitz.Matrix(scale, scale)

    pixmap = page.get_pixmap(matrix=matrix, alpha=False)
    image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)

    return RenderedPage(
        page_number=page_number,
        page=page,
        image=image,
        scale=scale,
    )


# ============================================================
# LAYOUT DETECTOR (Sprint 3)
#
# Runs DocLayout-YOLO exactly once per page. No filtering, no
# acceptance policy, no splitting "figure" into graph/diagram — that
# is Educational Region Detection's job (a later sprint), which sits
# between this and dispatch_region.
# ============================================================

# Raw label strings a DocLayout-YOLO checkpoint may emit, mapped onto
# the fixed LayoutLabel vocabulary. This is normalization (canonical
# naming), not classification — the model already made the decision,
# this only makes the resulting string consistent for callers.
_RAW_LABEL_ALIASES: dict[str, str] = {
    "figure": LayoutLabel.FIGURE,
    "fig": LayoutLabel.FIGURE,
    "table": LayoutLabel.TABLE,
    "figure_caption": LayoutLabel.CAPTION,
    "table_caption": LayoutLabel.CAPTION,
    "caption": LayoutLabel.CAPTION,
    "photo": LayoutLabel.PHOTO,
    "image": LayoutLabel.PHOTO,
    "plain text": LayoutLabel.TEXT,
    "plain_text": LayoutLabel.TEXT,
    "text": LayoutLabel.TEXT,
    "paragraph": LayoutLabel.TEXT,
    "title": LayoutLabel.TITLE,
    "section_title": LayoutLabel.TITLE,
    "isolate_formula": LayoutLabel.FORMULA,
    "formula": LayoutLabel.FORMULA,
    "equation": LayoutLabel.FORMULA,
    "list": LayoutLabel.LIST,
    "list_item": LayoutLabel.LIST,
    "header": LayoutLabel.HEADER,
    "page_header": LayoutLabel.HEADER,
    "footer": LayoutLabel.FOOTER,
    "page_footer": LayoutLabel.FOOTER,
    "footnote": LayoutLabel.FOOTER,
    "abandon": LayoutLabel.IGNORE,  # DocLayout-YOLO's own reject class — filtered out, not "unrecognized"
}


def normalize_layout_label(raw_label: Any) -> str:
    """Map a raw DocLayout-YOLO class name onto the fixed LayoutLabel
    vocabulary. Unknown labels are lowercased/underscored and passed
    through as-is (logged) rather than dropped, so nothing silently
    disappears — deciding whether an unrecognized label matters is a
    later sprint's job, not this one's."""
    key = str(raw_label).strip().lower()
    label = _RAW_LABEL_ALIASES.get(key)

    if label is None:
        logger.warning("Unrecognized DocLayout-YOLO label %r — passing through.", raw_label)
        return key

    return label


def _load_doclayout_model(weights_path: Optional[Any], device: str) -> Any:
    """Default model loader: loads a real DocLayout-YOLO (YOLOv10)
    checkpoint. Swappable via LayoutDetector(model_loader=...) so
    tests never need real weights."""
    try:
        from doclayout_yolo import YOLOv10
    except ImportError as exc:
        raise RuntimeError(
            "doclayout_yolo is not installed (`pip install doclayout-yolo`). "
            "Either install it and pass weights_path, or inject a "
            "model_loader= for testing."
        ) from exc

    if not weights_path:
        raise ValueError("LayoutDetector requires weights_path to load DocLayout-YOLO.")

    return YOLOv10(str(weights_path))


class LayoutDetector:
    """Runs DocLayout-YOLO. Responsibilities, and only these:

        Load model -> Predict -> Normalize boxes -> Return LayoutRegions

    No heuristics, no acceptance/rejection of regions, no region-type
    splitting beyond what the model itself predicts.
    """

    def __init__(
        self,
        *,
        weights_path: Optional[Any] = None,
        confidence_threshold: float = 0.25,
        image_size: int = 1024,
        device: str = "cpu",
        model_loader: Optional[Callable[[Optional[Any], str], Any]] = None,
    ) -> None:
        self.weights_path = weights_path
        self.confidence_threshold = confidence_threshold
        self.image_size = image_size
        self.device = device
        self._model_loader = model_loader or _load_doclayout_model
        self._model: Any = None  # loaded lazily, on first predict()

    # --------------------------------------------------------
    # Load model
    # --------------------------------------------------------
    def _ensure_model_loaded(self) -> Any:
        if self._model is None:
            logger.info(
                "Loading DocLayout-YOLO (weights=%s, device=%s)",
                self.weights_path, self.device,
            )
            self._model = self._model_loader(self.weights_path, self.device)
        return self._model

    # --------------------------------------------------------
    # Predict
    # --------------------------------------------------------
    def predict(self, rendered: RenderedPage) -> list[Any]:
        """Run the model on one rendered page. Returns the raw,
        model-native box objects — normalization happens separately
        in _normalize_box()."""
        model = self._ensure_model_loaded()
        results = model.predict(
            rendered.image,
            imgsz=self.image_size,
            conf=self.confidence_threshold,
            device=self.device,
            verbose=False,
        )

        if not results:
            return []

        result = results[0]
        names = getattr(result, "names", {}) or getattr(model, "names", {})
        boxes = result.boxes

        raw_boxes = []
        for i in range(len(boxes)):
            xyxy = boxes.xyxy[i]
            xyxy = xyxy.tolist() if hasattr(xyxy, "tolist") else list(xyxy)
            confidence = boxes.conf[i]
            confidence = float(confidence.item() if hasattr(confidence, "item") else confidence)
            class_id = boxes.cls[i]
            class_id = int(class_id.item() if hasattr(class_id, "item") else class_id)
            raw_boxes.append(
                {
                    "xyxy": xyxy,
                    "confidence": confidence,
                    "raw_label": names.get(class_id, class_id) if names else class_id,
                }
            )

        return raw_boxes

    # --------------------------------------------------------
    # Normalize boxes
    # --------------------------------------------------------
    def _normalize_box(self, raw_box: dict, rendered: RenderedPage, *, label: str) -> LayoutRegion:
        x0, y0, x1, y1 = raw_box["xyxy"]

        # Model predicts in rendered-image pixel space; every other
        # stage (extractors, OCR, caption association) reasons in the
        # same PDF-point space as `rendered.page`, so convert here,
        # once, rather than making every downstream stage do it.
        scale = rendered.scale
        bbox = (x0 / scale, y0 / scale, x1 / scale, y1 / scale)

        return LayoutRegion(
            bbox=bbox,
            region_class=label,
            confidence=raw_box["confidence"],
            page=rendered.page_number,
            raw=raw_box,
        )

    # --------------------------------------------------------
    # Return LayoutRegions
    # --------------------------------------------------------
    def __call__(self, rendered: RenderedPage) -> list[LayoutRegion]:
        """Implements the RegionDetector protocol:

            Raw Prediction -> Normalize -> Ignore abandon -> LayoutRegion

        Called exactly once per page by DocumentProcessor. Labels that
        normalize to IGNORED_LAYOUT_LABELS (DocLayout-YOLO's own
        "abandon" class) are dropped right here, before a LayoutRegion
        is ever created for them — they never reach
        EducationalRegionBuilder, dispatch_region(), or anything else
        downstream.
        """
        diagnostics.stage_start("Layout Detection")
        raw_boxes = self.predict(rendered)
        regions: list[LayoutRegion] = []
        ignored = 0
        for raw_box in raw_boxes:
            label = normalize_layout_label(raw_box["raw_label"])
            if label in IGNORED_LAYOUT_LABELS:
                ignored += 1
                continue
            regions.append(self._normalize_box(raw_box, rendered, label=label))
        diagnostics.stage_end("Layout Detection")
        diagnostics.stage_stats(
            "Layout Detection",
            received=len(raw_boxes),
            processed=len(regions),
            skipped=ignored,
        )
        return regions


# ============================================================
# EDUCATIONAL REGION BUILDER (Sprint 4, refined)
#
# Turns flat DocLayout-YOLO output (Figure, Caption, Text, Table,
# Photo, ... all as separate, unrelated blocks) into localized
# EducationalRegions (anchor + its caption + its context) whose `type`
# is already dispatch-ready (graph / diagram / table / photo /
# activity) — not just the raw layout label.
#
# The spatial matching (caption/context association) is unambiguous
# geometry. Resolving "figure" into graph vs diagram vs activity is
# not — no OCR text or vision content is available yet at this stage
# — so that decision is delegated to an injectable FigureTypeClassifier
# rather than hardcoded here. table/photo need no classifier: they map
# straight across to ExtractionType.TABLE / ExtractionType.PHOTO.
# ============================================================

# Layout labels that become extraction anchors — i.e. get promoted
# into their own EducationalRegion.
ANCHOR_LAYOUT_LABELS: frozenset[str] = frozenset(
    {LayoutLabel.FIGURE, LayoutLabel.TABLE, LayoutLabel.PHOTO}
)

# Layout labels usable as free-standing "context" for an anchor.
CONTEXT_LAYOUT_LABELS: frozenset[str] = frozenset(
    {LayoutLabel.TEXT, LayoutLabel.TITLE}
)

# Unambiguous LayoutLabel -> ExtractionType mappings. LayoutLabel.FIGURE
# is deliberately absent — it's ambiguous and goes through
# FigureTypeClassifier instead.
_DIRECT_EXTRACTION_TYPE_MAP: dict[str, str] = {
    LayoutLabel.TABLE: ExtractionType.TABLE,
    LayoutLabel.PHOTO: ExtractionType.PHOTO,
}


class FigureTypeClassifier(Protocol):
    """Resolves an ambiguous LayoutLabel.FIGURE anchor into one of
    graph / diagram / activity. Injectable so the real classification
    logic (likely vision-model-backed) can be swapped in without
    touching EducationalRegionBuilder."""
    def __call__(
        self,
        anchor: LayoutRegion,
        context: list[LayoutRegion],
        rendered: RenderedPage,
    ) -> str: ...


def default_figure_type_classifier(
    anchor: LayoutRegion,
    context: list[LayoutRegion],
    rendered: RenderedPage,
) -> str:
    """Placeholder FigureTypeClassifier.

    No OCR text and no visual content analysis are available at
    Educational Region Detection time (PaddleOCR and the extractors
    themselves run later), so this uses the only two signals already
    on hand — layout composition and geometry — and is intentionally
    conservative:

      - a List block nearby often marks a "Let's Do" / "Activity" box
        in these textbooks -> activity
      - a near-square aspect ratio is more chart-like than
        illustration-like -> graph
      - otherwise -> diagram (the safest general bucket)

    This is a stand-in, not a final answer. Replace it (via
    EducationalRegionBuilder(figure_classifier=...)) with a real
    classifier — e.g. one backed by a lightweight vision model — as
    soon as one exists; nothing else in the pipeline needs to change
    when that happens.
    """
    if any(block.region_class == LayoutLabel.LIST for block in context):
        return ExtractionType.ACTIVITY

    x0, y0, x1, y1 = anchor.bbox
    width, height = x1 - x0, y1 - y0

    if height > 0 and 0.8 <= (width / height) <= 1.25:
        return ExtractionType.GRAPH

    return ExtractionType.DIAGRAM


@dataclass
class RegionBuilderConfig:
    """Proximity thresholds for associating captions/context with an
    anchor. Centralized and injectable rather than buried as magic
    numbers inside the matching logic."""
    max_caption_gap: float = 40.0
    min_caption_overlap: float = 0.3
    max_context_gap: float = 80.0
    min_context_overlap: float = 0.15


def _horizontal_overlap_ratio(
    a: tuple[float, float, float, float],
    b: tuple[float, float, float, float],
) -> float:
    """How much `a` and `b` overlap horizontally, as a fraction of the
    narrower box's width. 0.0 means no horizontal overlap at all; 1.0
    means the narrower box's x-range sits entirely inside the wider
    one's. Used to decide whether a caption/context block is plausibly
    "under" or "beside" an anchor, rather than off to the side."""
    a_x0, _, a_x1, _ = a
    b_x0, _, b_x1, _ = b

    overlap = min(a_x1, b_x1) - max(a_x0, b_x0)
    if overlap <= 0:
        return 0.0

    narrower_width = min(a_x1 - a_x0, b_x1 - b_x0)
    if narrower_width <= 0:
        return 0.0

    return overlap / narrower_width


def _vertical_gap(
    a: tuple[float, float, float, float],
    b: tuple[float, float, float, float],
) -> float:
    """Vertical whitespace between `a` and `b`, in PDF points. 0.0 (or
    negative) means the boxes vertically overlap/touch. Direction-
    agnostic — it doesn't matter which box is above the other, only
    how much blank space separates them."""
    _, a_y0, _, a_y1 = a
    _, b_y0, _, b_y1 = b

    if a_y1 <= b_y0:
        return b_y0 - a_y1
    if b_y1 <= a_y0:
        return a_y0 - b_y1
    return 0.0  # vertically overlapping


class EducationalRegionBuilder:
    """Groups a page's flat LayoutRegions into localized
    EducationalRegions, each with a dispatch-ready `type`.

    For every anchor block (figure / table / photo):
      - resolve `type` to one of ALL_EXTRACTION_TYPES (table/photo map
        directly; figure goes through the injected FigureTypeClassifier)
      - find the single nearest, unclaimed caption block, if any
      - collect nearby text/title blocks as context, nearest first

    Captions are assigned uniquely (one caption serves at most one
    anchor); context is not exclusive, since the same surrounding
    paragraph can legitimately give context to more than one figure.
    """

    def __init__(
        self,
        config: Optional[RegionBuilderConfig] = None,
        figure_classifier: Optional[FigureTypeClassifier] = None,
    ) -> None:
        self.config = config or RegionBuilderConfig()
        self.figure_classifier = figure_classifier or default_figure_type_classifier

    def build(self, regions: list[LayoutRegion], rendered: Optional[RenderedPage] = None) -> list[EducationalRegion]:
        diagnostics.stage_start("Educational Region Builder")

        anchors = [r for r in regions if r.region_class in ANCHOR_LAYOUT_LABELS]
        captions = [r for r in regions if r.region_class == LayoutLabel.CAPTION]
        context_pool = [r for r in regions if r.region_class in CONTEXT_LAYOUT_LABELS]

        caption_by_anchor_id = self._assign_captions(anchors, captions)

        educational_regions = []
        for anchor in anchors:
            context = self._select_context(anchor, context_pool)
            educational_regions.append(
                EducationalRegion(
                    region_id=anchor.region_id,
                    type=self._resolve_type(anchor, context, rendered),
                    bbox=anchor.bbox,
                    page=anchor.page,
                    confidence=anchor.confidence,
                    caption=caption_by_anchor_id.get(id(anchor)),
                    context=context,
                    source=anchor,
                )
            )
            diagnostics.count("detected")
            diagnostics.track(anchor.region_id, "Detected")

        diagnostics.stage_end("Educational Region Builder")
        diagnostics.stage_stats(
            "Educational Region Builder",
            received=len(regions),
            processed=len(educational_regions),
            skipped=len(regions) - len(anchors),
        )
        return educational_regions

    def _resolve_type(
        self,
        anchor: LayoutRegion,
        context: list[LayoutRegion],
        rendered: Optional[RenderedPage],
    ) -> str:
        direct = _DIRECT_EXTRACTION_TYPE_MAP.get(anchor.region_class)
        if direct is not None:
            return direct

        # LayoutLabel.FIGURE (the only anchor label left unmapped).
        return self.figure_classifier(anchor, context, rendered)

    def _assign_captions(
        self,
        anchors: list[LayoutRegion],
        captions: list[LayoutRegion],
    ) -> dict[int, LayoutRegion]:
        """Greedy nearest-first matching so no caption is handed to
        more than one anchor."""
        candidates = []
        for anchor in anchors:
            for caption in captions:
                overlap = _horizontal_overlap_ratio(anchor.bbox, caption.bbox)
                if overlap < self.config.min_caption_overlap:
                    continue
                gap = _vertical_gap(anchor.bbox, caption.bbox)
                if gap > self.config.max_caption_gap:
                    continue
                candidates.append((gap, anchor, caption))

        candidates.sort(key=lambda c: c[0])

        assigned: dict[int, LayoutRegion] = {}
        claimed_caption_ids: set[int] = set()

        for _gap, anchor, caption in candidates:
            if id(anchor) in assigned or id(caption) in claimed_caption_ids:
                continue
            assigned[id(anchor)] = caption
            claimed_caption_ids.add(id(caption))

        return assigned

    def _select_context(
        self,
        anchor: LayoutRegion,
        context_pool: list[LayoutRegion],
    ) -> list[LayoutRegion]:
        nearby = [
            block
            for block in context_pool
            if _horizontal_overlap_ratio(anchor.bbox, block.bbox) >= self.config.min_context_overlap
            and _vertical_gap(anchor.bbox, block.bbox) <= self.config.max_context_gap
        ]
        nearby.sort(key=lambda block: _vertical_gap(anchor.bbox, block.bbox))
        return nearby


class EducationalRegionDetector:
    """Composes DocLayout-YOLO (LayoutDetector) with Educational
    Region Detection (EducationalRegionBuilder) into the full
    RegionDetector DocumentProcessor depends on. This is the only
    place those two stages are wired together — DocumentProcessor
    itself has no knowledge that DocLayout-YOLO or region-building
    exist; it just calls a RegionDetector."""

    def __init__(
        self,
        layout_detector: LayoutDetector,
        region_builder: Optional[EducationalRegionBuilder] = None,
    ) -> None:
        self.layout_detector = layout_detector
        self.region_builder = region_builder or EducationalRegionBuilder()

    def __call__(self, rendered: RenderedPage) -> list[EducationalRegion]:
        layout_regions = self.layout_detector(rendered)
        return self.region_builder.build(layout_regions)


# ============================================================
# OCR SERVICE (Sprint 8)
#
# Before this sprint, extract_graphs.py and extract_diagrams.py each
# carried their own OCRLine dataclass, their own OCREngine Protocol,
# and their own lazily-loaded PaddleOCR wrapper class — and
# extract_tables.py carried a fourth copy of the same thing (used
# there only for title/caption text, since PP-StructureV3 already
# does in-table OCR itself). Four modules, four copies of "call
# PaddleOCR, turn its boxes into structured output".
#
# OCRService is now the *only* place that happens. Graph, Diagram,
# and Table extractors are all handed the same OCRService instance
# (see `ocr_service` below, and default_region_extractors()) instead
# of each constructing their own PaddleOCR wrapper — one model load,
# one place to swap backends or inject a fake in tests, no drift
# between three copies of "how do we parse a PaddleOCR box".
#
# Flow, matching the architecture diagram:
#
#     Crop
#       |
#       v
#      OCR        (the backend — PaddleOCR itself, or a fake)
#       |
#       v
#     Text        (OCRResult.text — the crop's full text, reading order)
#       |
#       v
#     Lines       (OCRResult.lines — one OCRLine per detected text line)
#       |
#       v
#     Words       (OCRLine.words / OCRResult.words — per-line word tokens)
#
# PaddleOCR itself only detects/recognizes at the line level, so the
# Words stage is derived here (proportionally, by character count),
# not a separate model call — still one OCR pass per crop, never two.
# ============================================================

@dataclass
class OCRWord:
    """One word within an OCRLine, in crop-local pixel coordinates.
    Derived from the line's own box and text — PaddleOCR reports
    lines, not words, so this is the Words stage's own output, not a
    second OCR pass."""
    text: str
    bbox: tuple[int, int, int, int]
    confidence: float = 0.0


@dataclass
class OCRLine:
    """One line of OCR output, in crop-local pixel coordinates. The
    single shape every extractor (graph, diagram, table) reads OCR
    results as — previously defined three times (once per extractor
    module), now defined once, here."""
    text: str
    bbox: tuple[int, int, int, int]
    confidence: float = 0.0
    words: list["OCRWord"] = field(default_factory=list)


@dataclass
class OCRResult:
    """What OCRService returns for one crop: the Text stage
    (`text`) and the Lines stage (`lines`), with `words` derived from
    `lines` on demand rather than stored twice."""
    text: str
    lines: list[OCRLine] = field(default_factory=list)

    @property
    def words(self) -> list[OCRWord]:
        return [word for line in self.lines for word in line.words]


class OCRBackend(Protocol):
    """The raw engine OCRService wraps — PaddleOCR itself, or a fake
    in tests. Returns PaddleOCR's own per-line shape: a list of
    (box, (text, confidence)) tuples, box being 4 (x, y) corner
    points. OCRService is the only thing that ever talks to this
    directly; extractors talk to OCRService, never to a backend."""
    def __call__(self, image: Image.Image) -> list[Any]: ...


class PaddleOCRBackend:
    """Default OCRBackend. Loaded lazily on first call, so importing
    ingest_textbook_images.py (or any extractor module) never requires
    paddleocr to already be installed — tests inject a fake OCRBackend
    (or a fake OCRService) instead."""

    def __init__(self, lang: str = "en") -> None:
        self.lang = lang
        self._ocr: Any = None

    def _ensure_loaded(self) -> Any:
        if self._ocr is None:
            try:
                from paddleocr import PaddleOCR
            except ImportError as exc:  # pragma: no cover - paddleocr is optional at import time
                raise RuntimeError(
                    "paddleocr is not installed (`pip install paddleocr`). "
                    "Either install it, or inject an ocr_service= backed by a fake OCRBackend for testing."
                ) from exc
            logger.info("Loading PaddleOCR (lang=%s)", self.lang)
            self._ocr = PaddleOCR(
                use_angle_cls=True,
                lang=self.lang,
                use_gpu=False,
                enable_mkldnn=False,
                cpu_threads=1,
                ir_optim=False,
                show_log=True,
            )
        return self._ocr

    def __call__(self, image: Image.Image) -> list[Any]:
        ocr = self._ensure_loaded()
        result = ocr.ocr(np.array(image.convert("RGB")), cls=True)
        return result[0] if result and result[0] else []


def _split_words(text: str, bbox: tuple[int, int, int, int], confidence: float) -> list[OCRWord]:
    """Words stage: splits a line's text on whitespace and divides its
    bbox proportionally by character count. A geometric estimate, not
    a re-detection — PaddleOCR never reports word-level boxes, so this
    is the only way to get per-word boxes without a second OCR call."""
    tokens = text.split()
    if not tokens:
        return []

    x0, y0, x1, y1 = bbox
    width = x1 - x0
    total_chars = sum(len(token) for token in tokens) or 1

    words: list[OCRWord] = []
    cursor = float(x0)
    for token in tokens:
        span = width * (len(token) / total_chars)
        word_bbox = (int(cursor), y0, int(round(cursor + span)), y1)
        words.append(OCRWord(text=token, bbox=word_bbox, confidence=confidence))
        cursor += span
    return words


class OCRService:
    """The single OCR entrypoint every RegionExtractor calls — Graph,
    Diagram, and Table alike. Sequences Crop -> OCR -> Text -> Lines ->
    Words exactly once per crop; no extractor runs OCR on its own.

    A specific extractor may not need every stage (extract_tables.py,
    for instance, only reads `.lines`/`.text` off of caption/title
    crops — PP-StructureV3 already returns in-table text itself), but
    all four stages are always computed here, once, so nothing has to
    call back into OCRService a second time for a different granularity.
    """

    def __init__(self, backend: Optional[OCRBackend] = None) -> None:
        self.backend: OCRBackend = backend or PaddleOCRBackend()

    def __call__(self, image: Image.Image) -> OCRResult:
        raw_lines = self.backend(image)  # Crop -> OCR

        lines: list[OCRLine] = []
        for box, (text, confidence) in raw_lines:
            xs = [point[0] for point in box]
            ys = [point[1] for point in box]
            bbox = (int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys)))
            clean_text = (text or "").strip()
            lines.append(
                OCRLine(
                    text=clean_text,
                    bbox=bbox,
                    confidence=float(confidence),
                    words=_split_words(clean_text, bbox, float(confidence)),  # Lines -> Words
                )
            )

        text = "\n".join(line.text for line in lines if line.text)  # Lines -> Text (reading order)
        return OCRResult(text=text, lines=lines)


def run_ocr(image: Image.Image, ocr_service: "OCRService") -> list[OCRLine]:
    """Thin, named wrapper so "OCR runs exactly once, here" is a
    single obvious call site in every extractor, rather than an inline
    detail — same convention each extractor used to keep locally, now
    pointed at the shared OCRService instead of a local engine."""
    return ocr_service(image).lines


# Module-level default instance. default_region_extractors() hands
# this same OCRService to every extractor it constructs, and each
# extractor module's own module-level default instance
# (extract_graph_region, extract_diagram_region, extract_table_region)
# falls back to it too — so unless a caller explicitly injects a
# different OCRService, the whole pipeline shares exactly one.
ocr_service = OCRService()

# Private alias so code later in *this* module (CaptionAssociationEngine,
# below) can default to the singleton without a parameter named
# `ocr_service` shadowing the module-level name of the same spelling.
_default_ocr_service = ocr_service


# ============================================================
# CAPTION ASSOCIATION ENGINE (Sprint 9)
#
# The "Caption Association" box in the architecture diagram at the top
# of this file — runs after a page's regions have been extracted and
# OCR'd (Sprint 8's shared OCRService), before Qwen Validation. For
# every VisualCandidate on the page, resolves and attaches a caption
# by trying these sources, in order, and stopping at the first that
# yields non-empty text:
#
#     Caption Block
#       |            the CAPTION-labeled LayoutRegion
#       |            EducationalRegionBuilder already assigned to this
#       |            anchor (region.caption) — the best bbox to read a
#       |            caption from, when DocLayout-YOLO found one.
#       v
#     PDF Text
#       |            read directly from the PDF's own text layer at
#       |            that bbox (fitz.Page.get_text) — exact and free
#       |            when the PDF has selectable text there.
#       v
#     OCR
#       |            only if the PDF had nothing there (e.g. a scanned
#       |            page) — OCR that same bbox through the shared
#       |            OCRService instead of a second, separate OCR pass.
#       v
#     Nearest Text
#                    no CAPTION block was assigned at all (or it read
#                    empty) — fall back to the anchor's own nearby
#                    TEXT/TITLE context, searched Above -> Below ->
#                    Nearby, then read the same PDF-Text-then-OCR way.
#
# Stored per candidate: Figure Number, Caption, Reference, Caption Box
# — see CaptionMatch below.
# ============================================================

# "Figure 3.2:", "Fig. 3.2 —", "TABLE 4.1.", "Photo 1 " ... — the
# label prefix textbooks put at the start of a caption. Captured
# separately from the caption body so a figure can be looked up by
# number without re-parsing free text every time.
_CAPTION_LABEL_RE = re.compile(
    r"^\s*(?P<kind>figure|fig\.?|table|photo|image|chart|diagram)\s*"
    r"(?P<number>[0-9]+(?:[.\-][0-9]+)*)\s*[:.\-\u2014\u2013]?\s*",
    re.IGNORECASE,
)

# Canonical spelling for each recognized label kind, so "fig"/"Fig."/
# "FIGURE" all normalize to the same `reference` string.
_CAPTION_LABEL_CANONICAL: dict[str, str] = {
    "figure": "Figure",
    "fig": "Figure",
    "table": "Table",
    "photo": "Photo",
    "image": "Image",
    "chart": "Chart",
    "diagram": "Diagram",
}


def _parse_caption_label(text: str) -> tuple[Optional[str], Optional[str], str]:
    """Splits raw caption text into (figure_number, reference, body).

    "Figure 3.2: Total cost curve" -> ("3.2", "Figure 3.2", "Total cost curve")
    "Weekly rainfall by region"    -> (None, None, "Weekly rainfall by region")

    A caption with no parseable label prefix is still a usable
    caption — figure_number/reference are simply left None rather than
    guessed at.
    """
    match = _CAPTION_LABEL_RE.match(text)
    if not match:
        return None, None, text.strip()

    kind_key = match.group("kind").lower().rstrip(".")
    canonical = _CAPTION_LABEL_CANONICAL.get(kind_key, kind_key.capitalize())
    number = match.group("number")
    body = text[match.end():].strip()
    return number, f"{canonical} {number}", body


@dataclass
class CaptionMatch:
    """What Caption Association resolves for one VisualCandidate —
    exactly the four things this stage stores, plus `source` for
    provenance (which waterfall step actually produced the text)."""
    figure_number: Optional[str] = None                              # e.g. "3.2"
    caption: Optional[str] = None                                    # caption body, label prefix stripped
    reference: Optional[str] = None                                  # canonical label, e.g. "Figure 3.2"
    caption_box: Optional[tuple[float, float, float, float]] = None  # PDF point space
    source: str = "none"  # "caption_block+pdf_text" | "caption_block+ocr" | "nearest_text+pdf_text" | "nearest_text+ocr" | "none"

    def as_dict(self) -> dict:
        return {
            "figure_number": self.figure_number,
            "caption": self.caption,
            "reference": self.reference,
            "caption_box": list(self.caption_box) if self.caption_box else None,
            "source": self.source,
        }


def _clamp_box_to_image(box: tuple[float, float, float, float], image_size: tuple[int, int]) -> tuple[int, int, int, int]:
    width, height = image_size
    x0, y0, x1, y1 = box
    x0 = max(0, min(int(x0), width - 1))
    y0 = max(0, min(int(y0), height - 1))
    x1 = max(x0 + 1, min(int(x1), width))
    y1 = max(y0 + 1, min(int(y1), height))
    return (x0, y0, x1, y1)


def _pdf_text_in_bbox(page: fitz.Page, bbox: tuple[float, float, float, float]) -> Optional[str]:
    """PDF Text step — read straight from the PDF's own text layer, no
    OCR involved. Returns None (never raises) when the PDF has nothing
    selectable there, so the caller can fall through to OCR."""
    try:
        text = page.get_text("text", clip=fitz.Rect(*bbox))
    except Exception:  # pragma: no cover - malformed bbox / page edge cases
        return None
    text = " ".join((text or "").split())
    return text or None


def _ocr_text_in_bbox(
    rendered: RenderedPage,
    bbox: tuple[float, float, float, float],
    ocr_service: "OCRService",
) -> Optional[str]:
    """OCR step — only reached when PDF Text found nothing at this
    bbox. Crops the rendered page image at `bbox` and runs it through
    the shared OCRService (Sprint 8) — never a second, module-local
    OCR wrapper."""
    scale = rendered.scale
    px_box = _clamp_box_to_image(tuple(v * scale for v in bbox), rendered.image.size)
    if px_box[2] <= px_box[0] or px_box[3] <= px_box[1]:
        return None
    crop = rendered.image.crop(px_box)
    text = ocr_service(crop).text
    return text or None


def _resolve_text_at_bbox(
    rendered: RenderedPage,
    bbox: tuple[float, float, float, float],
    ocr_service: "OCRService",
) -> tuple[Optional[str], str]:
    """PDF Text -> OCR waterfall for one bbox. Returns (text, step)
    where step is "pdf_text" or "ocr" (or "none" if both came up empty)."""
    text = _pdf_text_in_bbox(rendered.page, bbox)
    if text:
        return text, "pdf_text"

    text = _ocr_text_in_bbox(rendered, bbox, ocr_service)
    if text:
        return text, "ocr"

    return None, "none"


def _nearest_text_block(
    anchor_bbox: tuple[float, float, float, float],
    context: list["LayoutRegion"],
) -> Optional["LayoutRegion"]:
    """Nearest Text step — no CAPTION block was assigned to this
    anchor at all, so search its own nearby TEXT/TITLE context
    (already gathered by EducationalRegionBuilder, nearest-first)
    Above -> Below -> Nearby.

    `context` is already sorted nearest-first overall (by vertical gap,
    direction-agnostic), so filtering by direction preserves that
    ordering — above[0] is the nearest block above, below[0] the
    nearest below. "Nearby" is the catch-all for the rare case where a
    context block overlaps the anchor vertically (sits beside it)
    rather than sitting cleanly above or below.
    """
    _, ay0, _, ay1 = anchor_bbox
    above = [block for block in context if block.bbox[3] <= ay0]
    below = [block for block in context if block.bbox[1] >= ay1]

    if above:
        return above[0]
    if below:
        return below[0]
    if context:
        return context[0]
    return None


def associate_caption(
    region: "EducationalRegion",
    rendered: RenderedPage,
    ocr_service: "OCRService",
) -> CaptionMatch:
    """Resolves one region's caption via the full priority waterfall.
    Never raises — a region with no findable caption anywhere gets a
    CaptionMatch() of all-None fields (source="none"), not an
    exception, since a missing caption should never fail extraction.
    """
    # Priority 1 (bbox) — an explicit DocLayout CAPTION block.
    if region.caption is not None:
        text, step = _resolve_text_at_bbox(rendered, region.caption.bbox, ocr_service)
        if text:
            number, reference, body = _parse_caption_label(text)
            return CaptionMatch(
                figure_number=number, caption=body, reference=reference,
                caption_box=region.caption.bbox, source=f"caption_block+{step}",
            )

    # Priority 2 (bbox fallback) — no caption block at all (or it read
    # empty): search the anchor's own nearby text instead.
    block = _nearest_text_block(region.bbox, region.context)
    if block is not None:
        text, step = _resolve_text_at_bbox(rendered, block.bbox, ocr_service)
        if text:
            number, reference, body = _parse_caption_label(text)
            return CaptionMatch(
                figure_number=number, caption=body, reference=reference,
                caption_box=block.bbox, source=f"nearest_text+{step}",
            )

    return CaptionMatch()


class CaptionAssociationEngine:
    """PageEnricher implementing the Caption Association stage.

    Runs once per page, after every region on that page has already
    been extracted (Graph / Diagram / Table). For each RegionResult
    with a candidate, resolves associate_caption() and attaches the
    result to VisualCandidate.metadata["caption_association"] —
    leaving caption_text (set by the individual extractors, from
    whatever their own crop happened to cover) untouched, and filling
    it in only if the extractor hadn't already found one. This is the
    pipeline's single authoritative caption resolution, shared by
    every region type rather than each extractor guessing on its own
    from a possibly-too-small crop.
    """

    def __init__(self, *, ocr_service: Optional["OCRService"] = None) -> None:
        self.ocr_service: OCRService = ocr_service or _default_ocr_service

    def __call__(self, page_result: PageResult, rendered: RenderedPage, **context: Any) -> PageResult:
        diagnostics.stage_start("OCR")
        ocr_success = 0
        for region_result in page_result.region_results:
            candidate = region_result.candidate
            if candidate is None:
                continue

            print(f"[Candidate] Region={candidate.region_id}")
            print(f"    Type : {candidate.type}")
            print(f"    Image None : {candidate.image is None}")
            diagnostics.track(candidate.region_id, "OCR Completed")
            if candidate.ocr_text:
                ocr_success += 1
                diagnostics.count("ocr_success")
                diagnostics.track(candidate.region_id, "OCR Added")
        diagnostics.stage_end("OCR")
        diagnostics.stage_stats(
            "OCR",
            received=sum(1 for r in page_result.region_results if r.candidate is not None),
            processed=ocr_success,
        )

        diagnostics.stage_start("Caption Association")
        caption_success = 0
        for region_result in page_result.region_results:
            candidate = region_result.candidate
            if candidate is None:
                continue  # extraction failed outright — nothing to attach a caption to

            print(f"[Candidate] Region={candidate.region_id}")
            print(f"    Type : {candidate.type}")
            print(f"    Image None : {candidate.image is None}")

            match = associate_caption(region_result.region, rendered, self.ocr_service)
            candidate.metadata["caption_association"] = match.as_dict()
            diagnostics.track(candidate.region_id, "Caption Associated")

            if not candidate.caption_text and match.caption:
                candidate.caption_text = match.caption

            if candidate.caption_text:
                caption_success += 1
                diagnostics.count("caption_success")
                diagnostics.track(candidate.region_id, "Caption Added")
        diagnostics.stage_end("Caption Association")
        diagnostics.stage_stats(
            "Caption Association",
            received=sum(1 for r in page_result.region_results if r.candidate is not None),
            processed=caption_success,
        )

        return page_result


def default_page_enrichers(*, ocr_service: Optional["OCRService"] = None) -> list["PageEnricher"]:
    """Page enrichers implemented so far, ready to hand to
    DocumentProcessor(page_enrichers=default_page_enrichers()). Kept as
    a factory (mirroring default_region_extractors()) rather than
    DocumentProcessor's own default, so existing callers that rely on
    the current `[_noop_page_enricher]` default aren't changed by
    adding a new stage here.
    """
    return [CaptionAssociationEngine(ocr_service=ocr_service or _default_ocr_service)]


# ============================================================
# DEFAULT REGION EXTRACTORS (Sprint 5+)
#
# Wires ExtractionType -> concrete RegionExtractor. Types with no
# entry here simply have no extractor yet; dispatch_region() already
# handles that gracefully (skips the region, logs a warning), so
# nothing needs a placeholder for diagram/table/photo/activity until
# their own sprints land.
# ============================================================

def default_region_extractors() -> dict[str, "RegionExtractor"]:
    """Extractors implemented so far, ready to hand to
    DocumentProcessor(region_extractors=default_region_extractors()).

    The import is local to this function, not top-of-file, so simply
    importing ingest_textbook_images.py never pulls in
    scripts/extract_graphs's, scripts/extract_diagrams's, or
    scripts/extract_tables's dependencies (opencv-python, paddleocr)
    unless this factory is actually called.

    graph    -> GraphRecoveryEngine     (extract_graph_region)
    diagram  -> DiagramExtractionEngine (extract_diagram_region)
    photo    -> DiagramExtractionEngine (same instance — its
                 SUPPORTED_TYPES already covers diagram/photo/activity,
                 so photo and activity route to it too rather than
                 going unregistered)
    activity -> DiagramExtractionEngine (same instance)
    table    -> TableExtractionEngine   (extract_table_region)
    """
    from scripts.extract_graphs import extract_graph_region
    from scripts.extract_diagrams import extract_diagram_region
    from scripts.extract_tables import extract_table_region

    return {
        ExtractionType.GRAPH: extract_graph_region,
        ExtractionType.DIAGRAM: extract_diagram_region,
        ExtractionType.PHOTO: extract_diagram_region,
        ExtractionType.ACTIVITY: extract_diagram_region,
        ExtractionType.TABLE: extract_table_region,
    }


# ============================================================
# QWEN VALIDATION (Sprint 10)
#
# Qwen never detects. Educational Region Detection (DocLayout-YOLO +
# EducationalRegionBuilder, Sprint 4) already decided *where* every
# region is; the region extractors (Sprint 5+) already produced the
# crop. This stage only looks at an already-final VisualCandidate and
# answers six yes/no questions about it:
#
#     Is crop complete?   -> crop_complete   (gating: must be True)
#     Caption attached?   -> caption_attached (recorded, non-gating)
#     Educational?        -> educational     (gating: must be True)
#     Readable?           -> readable        (gating: must be True)
#     Decorative?         -> decorative      (gating: must be False)
#     Duplicate?          -> duplicate       (gating: must be False)
#
# If invalid -> reject: the RegionResult is flipped to ok=False and its
# candidate is dropped, exactly like an extractor failure, so nothing
# downstream (Metadata, Duplicate Removal, Embeddings, Qdrant) ever
# sees it. If valid -> continue: the candidate is left untouched, with
# the verdict attached to metadata["qwen_validation"] for provenance.
#
# `caption_attached` is answered and recorded but does not gate
# validity on its own — Caption Association (Sprint 8) is the
# pipeline's authoritative source for whether a caption exists, and
# plenty of legitimate figures in this corpus have none. Qwen's answer
# here is a cross-check, not a second gate.
#
# `duplicate` here is Qwen's single-glance judgment on one image in
# isolation (an obviously repeated watermark/logo/running header) —
# not the corpus-wide Duplicate Removal stage that runs later over
# every embedding. The two are complementary: this one screens out the
# obvious cases per-candidate, before an embedding is ever computed.
# ============================================================

class ValidationQuestion:
    CROP_COMPLETE = "crop_complete"
    CAPTION_ATTACHED = "caption_attached"
    EDUCATIONAL = "educational"
    READABLE = "readable"
    DECORATIVE = "decorative"
    DUPLICATE = "duplicate"


ALL_VALIDATION_QUESTIONS: tuple[str, ...] = (
    ValidationQuestion.CROP_COMPLETE,
    ValidationQuestion.CAPTION_ATTACHED,
    ValidationQuestion.EDUCATIONAL,
    ValidationQuestion.READABLE,
    ValidationQuestion.DECORATIVE,
    ValidationQuestion.DUPLICATE,
)

# Which boolean value each question must return to keep a candidate
# valid. CAPTION_ATTACHED is deliberately absent — recorded, not
# gating (see module note above). This dict is the *only* place
# "invalid" is decided; ValidationVerdict just evaluates it.
_GATING_REQUIREMENTS: dict[str, bool] = {
    ValidationQuestion.CROP_COMPLETE: True,
    ValidationQuestion.EDUCATIONAL: True,
    ValidationQuestion.READABLE: True,
    ValidationQuestion.DECORATIVE: False,
    ValidationQuestion.DUPLICATE: False,
}


@dataclass
class ValidationVerdict:
    """Qwen's answers to the six validation questions for one
    VisualCandidate, plus the derived overall decision.

    `valid` and `failed_questions` are always derived in
    __post_init__ from `_GATING_REQUIREMENTS` — never set directly —
    so there is exactly one place that decides what "invalid" means.
    """
    crop_complete: bool = False
    caption_attached: bool = False
    educational: bool = False
    readable: bool = False
    decorative: bool = True
    duplicate: bool = True
    reason: str = ""             # Qwen's own short free-text explanation, if given
    raw_response: str = ""       # untouched model output, for provenance/debugging
    valid: bool = field(init=False)
    failed_questions: list[str] = field(init=False, default_factory=list)

    def __post_init__(self) -> None:
        answers = {
            ValidationQuestion.CROP_COMPLETE: self.crop_complete,
            ValidationQuestion.CAPTION_ATTACHED: self.caption_attached,
            ValidationQuestion.EDUCATIONAL: self.educational,
            ValidationQuestion.READABLE: self.readable,
            ValidationQuestion.DECORATIVE: self.decorative,
            ValidationQuestion.DUPLICATE: self.duplicate,
        }
        self.failed_questions = [
            question
            for question, required in _GATING_REQUIREMENTS.items()
            if answers[question] != required
        ]
        self.valid = not self.failed_questions

    def as_dict(self) -> dict:
        return {
            "crop_complete": self.crop_complete,
            "caption_attached": self.caption_attached,
            "educational": self.educational,
            "readable": self.readable,
            "decorative": self.decorative,
            "duplicate": self.duplicate,
            "valid": self.valid,
            "failed_questions": list(self.failed_questions),
            "reason": self.reason,
        }


# A validation attempt that could not be completed (no image, backend
# error, unparseable response) fails safe — every gating question
# defaults to its "bad" value, so the candidate is rejected rather
# than silently waved through.
def _failed_verdict(reason: str, raw_response: str = "") -> ValidationVerdict:
    return ValidationVerdict(
        crop_complete=False, caption_attached=False, educational=False,
        readable=False, decorative=True, duplicate=True,
        reason=reason, raw_response=raw_response,
    )


_VALIDATION_PROMPT = """You are validating one already-cropped image taken from a textbook, for a retrieval pipeline. You do not detect or locate anything — this crop is already final and cannot be resized or moved. Look only at this exact image and answer the six questions below about it.

Context gathered elsewhere in the pipeline (may be empty — do not treat empty as a failure):
Caption: {caption}
OCR text found in this crop: {ocr_text}

Respond with strictly valid JSON and nothing else — no preamble, no markdown fences:
{{
  "crop_complete": true or false,   // is the visual fully inside the frame, not cut off at an edge?
  "caption_attached": true or false, // is a caption/label visible in or clearly tied to this crop?
  "educational": true or false,     // does this convey educational content (a graph, diagram, table, labelled figure, or instructive photo) rather than pure page furniture?
  "readable": true or false,        // is it legible at this resolution — not blurry, not too small, not garbled?
  "decorative": true or false,      // is this purely decorative (icon, border, logo, ornamental clip-art) with no informational content?
  "duplicate": true or false,       // is this an obviously repeated element (e.g. a watermark, running header/logo) rather than unique content?
  "reason": "one short sentence"
}}"""


def _build_validation_prompt(candidate: "VisualCandidate") -> str:
    return _VALIDATION_PROMPT.format(
        caption=candidate.caption_text or "(none)",
        ocr_text=(candidate.ocr_text or "(none)")[:500],
    )


def _coerce_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "yes", "1"}
    return default


def _parse_validation_response(raw: str) -> ValidationVerdict:
    """Turns Qwen's raw text into a ValidationVerdict. Never raises —
    a response that isn't parseable JSON fails safe via
    _failed_verdict() rather than throwing and killing the document.
    """
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return _failed_verdict("unparseable_qwen_response", raw_response=raw)

    return ValidationVerdict(
        crop_complete=_coerce_bool(payload.get("crop_complete")),
        caption_attached=_coerce_bool(payload.get("caption_attached")),
        educational=_coerce_bool(payload.get("educational")),
        readable=_coerce_bool(payload.get("readable")),
        decorative=_coerce_bool(payload.get("decorative"), default=True),
        duplicate=_coerce_bool(payload.get("duplicate"), default=True),
        reason=str(payload.get("reason", ""))[:300],
        raw_response=raw,
    )


# ============================================================
# PAGE ASSET METADATA ACCUMULATION (Sprint 18.3, storage-native since
# Sprint 19)
#
# Accumulates, per page, references to every asset accepted/rejected
# on that page (grouped by visual type, plus a flat "rejected" list)
# together with each asset's identifiers (region_id, filename,
# visual_type, page, bbox, confidence, status) so a filename alone
# (graph_002.png) never has to carry an ID — metadata.json is the
# place that's kept.
#
# Purely bookkeeping over decisions QwenValidator already made (accept/
# reject) — never re-evaluates any of them. Accumulated in
# PipelineResult.context (keyed "page_asset_metadata") across the
# whole document, then uploaded to each page's own metadata.json key
# once, after Qwen Validation finishes processing every candidate
# (Part 6 — storage.upload_json(workspace.page_metadata_key(page), ...)).
# ------------------------------------------------------------

def _new_page_metadata_entry(page_no: int) -> dict:
    # Sprint 20: every accepted visual — graph, diagram, table, or
    # photo alike — lives as a plain figure inside this page's own
    # storage folder, so there's no more per-visual-type list to bucket
    # it into; "figures" is the single flat list of accepted filenames
    # for this page, alongside "rejected" and the full "visuals" audit
    # trail (kept for every candidate regardless of outcome).
    return {
        "page": page_no,
        "figures": [],
        "rejected": [],
        "visuals": [],
    }


def _record_page_visual(
    context: dict,
    candidate: "VisualCandidate",
    *,
    status: str,
    reason: Optional[str] = None,
) -> None:
    """Records one accepted/rejected asset into this document's
    in-progress page-metadata accumulator. No-op when this candidate
    was never assigned a visual index in the first place (e.g.
    candidate.image was None, so extraction never had bytes to
    upload) — there is no asset to reference."""
    filename = candidate.metadata.get("workspace_filename")
    if filename is None:
        return

    pages_metadata: dict[int, dict] = context.setdefault("page_asset_metadata", {})
    entry = pages_metadata.setdefault(candidate.page, _new_page_metadata_entry(candidate.page))

    visual_record = {
        "region_id": candidate.region_id,
        "filename": filename,
        "visual_type": candidate.type,
        "page": candidate.page,
        "bbox": list(candidate.bbox),
        "confidence": candidate.confidence,
        "status": status,
        "storage_key": (candidate.metadata.get("storage") or {}).get("storage_key"),
    }
    if reason:
        visual_record["reason"] = reason
    entry["visuals"].append(visual_record)

    if status == "accepted":
        entry["figures"].append(filename)
    else:
        entry["rejected"].append(filename)


def _enrich_page_visual_metadata(context: dict, candidate: "VisualCandidate", payload_dict: dict) -> None:
    """Folds MetadataBuilder's richer per-candidate metadata (ncert
    metadata + storage key) into the same page-level accumulator
    QwenValidator already started via _record_page_visual — so each
    page ends up with exactly one metadata.json (Part 6), containing
    both the accept/reject bookkeeping and the full metadata payload,
    rather than two separate uploads to the same key. No-op if this
    candidate's page was never recorded (e.g. it was rejected before
    ever reaching an index, or workspace was unavailable)."""
    pages_metadata: dict[int, dict] = context.get("page_asset_metadata") or {}
    entry = pages_metadata.get(candidate.page)
    if entry is None:
        return
    for visual_record in entry["visuals"]:
        if visual_record["region_id"] == candidate.region_id:
            visual_record["metadata"] = payload_dict
            visual_record["storage"] = candidate.metadata.get("storage")
            break


def _upload_page_asset_metadata(
    workspace: ChapterWorkspace, storage: Optional["LocalImageStorage"], context: dict
) -> None:
    """Uploads every page's accumulated metadata.json (built up by
    _record_page_visual across the whole document) directly to local
    storage at workspace.page_metadata_key(page) — Part 6: no more
    workspace.page_metadata_path(...) local write outside of
    LocalImageStorage. Called once, after Qwen Validation has finished
    deciding every candidate in the document. A failure on one page's
    upload is logged and swallowed rather than raised — it must not
    lose the accept/reject decisions already recorded on every
    candidate. No-op when storage isn't configured (e.g. in tests)."""
    if storage is None:
        return
    pages_metadata: dict[int, dict] = context.get("page_asset_metadata") or {}
    for page_no, entry in pages_metadata.items():
        key = workspace.page_metadata_key(page_no)
        try:
            storage.upload_json(key, entry)
            diagnostics.count("storage_page_asset_metadata_uploaded")
            diagnostics.storage_event("Page Metadata Saved", key=key, bucket=storage.config.bucket)
        except Exception as exc:
            logger.exception("Failed to write page metadata for page=%d", page_no)
            diagnostics.storage_event("Page Metadata Saved", key=key, status="FAILED", reason=str(exc))


# ------------------------------------------------------------
# Sprint 19 — Part 2/6: Logs, in memory only.
#
# Nothing is written to a local logs/ directory anymore. A chapter-
# scoped logging.Handler buffers records in memory (io.StringIO) for
# the duration of one process_pdf() call, in addition to — never
# instead of — whatever handlers LOG_LEVEL / _init_logging() already
# set up; its buffered text is uploaded once, as a single object, to
# workspace.log_key() when the chapter finishes.
# ------------------------------------------------------------

def _attach_chapter_log_handler(workspace: ChapterWorkspace) -> tuple[logging.Handler, "io.StringIO"]:
    import io as _io
    buffer = _io.StringIO()
    handler = logging.StreamHandler(buffer)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logging.getLogger().addHandler(handler)
    return handler, buffer


def _detach_and_upload_chapter_log(
    handler: logging.Handler,
    buffer: "io.StringIO",
    workspace: ChapterWorkspace,
    storage: Optional["LocalImageStorage"],
) -> None:
    logging.getLogger().removeHandler(handler)
    handler.close()
    if storage is None:
        return
    try:
        storage.upload_text(workspace.log_key(), buffer.getvalue())
    except Exception:
        logger.exception("Failed to upload chapter log for %s", workspace.chapter_name)


# ============================================================
# LOCAL IMAGE STORAGE INTEGRATION (Sprint 18)
#
# Same posture as the Sprint 17 local-storage helpers just above:
# pure storage side effects, called *from* the stage that already made
# an extraction/acceptance/metadata decision, never a place that makes
# one itself. A storage hiccup is logged and swallowed here — it must
# never take down extraction, validation, or Qdrant upload for the
# rest of the document. Every object key used below comes from
# ChapterWorkspace (core/chapter_workspace.py) — nothing here builds a
# key by hand.
# ============================================================

def _get_storage() -> Optional[LocalImageStorage]:
    """Returns the LocalImageStorage singleton (core/local_image_storage.py,
    files under LOCAL_MEDIA_ROOT) this pipeline writes every
    image/PDF/metadata artifact through. Every per-document/per-page/
    per-candidate call site below reuses the same singleton rather than
    constructing its own, so a run always writes through one consistent
    storage instance.

    Returns None (rather than raising) only if local storage itself
    could not be initialized (e.g. LOCAL_MEDIA_ROOT is not writable) —
    every upload call site below already treats a None storage as
    "skip this write, log it, keep processing" rather than crashing
    the run."""
    try:
        return get_local_image_storage()
    except Exception:
        logger.exception("Local image storage could not be initialized — uploads will be skipped.")
        return None


# ============================================================
# UPLOAD VERIFICATION (Sprint 14.6 — Part 2)
#
# A verification check running *after* upload_image() has already
# returned successfully (no exception) is a belt-and-suspenders
# diagnostic, not the thing that decides whether the upload worked.
# LocalImageStorage.object_exists() is a plain local os.path check, so
# there's no real read-after-write lag to absorb the way an S3-
# compatible backend could exhibit — the short retry loop is kept
# anyway as cheap insurance, and it never raises: a persistent False
# here is meant to be logged and moved past, not treated as an upload
# failure.
# ============================================================

def _verify_upload(
    storage: LocalImageStorage,
    key: str,
    *,
    bucket: Optional[str] = None,
    attempts: int = 3,
    delay_seconds: float = 0.25,
) -> bool:
    for attempt in range(1, attempts + 1):
        if storage.exists(key, bucket=bucket):
            return True
        if attempt < attempts:
            time.sleep(delay_seconds)
    return False


def _upload_original_pdf(pdf_path: Path, workspace: ChapterWorkspace, storage: LocalImageStorage) -> None:
    """Part 8 — Original PDF Storage. Uploaded once per chapter
    (re-ingestion, OCR improvements, and audit all read the same
    original/textbook.pdf back) — `object_exists` makes the call
    idempotent, so re-running the same chapter never re-uploads it."""
    key = workspace.original_pdf_key()
    try:
        if storage.object_exists(key):
            return
        storage.upload_pdf(key, pdf_path)
        diagnostics.count("storage_pdf_uploaded")
    except Exception:
        logger.exception("Failed to write original PDF to local storage key=%s", key)


def _upload_page_image(rendered: "RenderedPage", workspace: ChapterWorkspace, storage: LocalImageStorage, page_number: int) -> None:
    """Part 3/9 — Page Asset Storage: page.png, uploaded immediately
    from the already-rendered page image (Page Rendering's own output,
    untouched) — nothing is re-rendered here, and nothing is ever
    written to an ad-hoc local disk path first (LocalImageStorage owns
    the one disk location everything durable lands at)."""
    key = workspace.rendered_page_key(page_number)
    try:
        storage.upload_image(key, rendered.image)
        diagnostics.count("storage_page_images_uploaded")
        diagnostics.storage_event("Rendered Page Saved", key=key, bucket=storage.config.bucket, size=rendered.image.size)
    except Exception as exc:
        logger.exception("Failed to write page image to local storage key=%s", key)
        diagnostics.storage_event("Rendered Page Saved", key=key, bucket=storage.config.bucket, status="FAILED", reason=str(exc))


def _upload_debug_page_image(
    rendered: "RenderedPage",
    regions: list["EducationalRegion"],
    workspace: ChapterWorkspace,
    storage: Optional[LocalImageStorage],
    page_number: int,
) -> None:
    """Optional debug dump of Layout Detection's own output (region
    boxes, untouched) onto a copy of Page Rendering's own output
    (untouched), uploaded straight to workspace.debug_key(...) — no
    separate local debug/ folder anymore, only LocalImageStorage's own
    layout under LOCAL_MEDIA_ROOT. Only ever called when debugging is
    enabled; a failure here is logged and swallowed, never allowed to
    affect extraction."""
    if storage is None:
        return
    try:
        from PIL import ImageDraw

        image = rendered.image.convert("RGB").copy()
        draw = ImageDraw.Draw(image)
        for region in regions:
            draw.rectangle(region.bbox, outline="red", width=3)
        key = workspace.debug_key(f"page_{page_number}_regions.png")
        storage.upload_image(key, image)
        diagnostics.count("storage_debug_images_uploaded")
    except Exception:
        logger.exception("Failed to write debug image for page %d", page_number)


def _upload_temp_extracted_visual(candidate: "VisualCandidate", workspace: ChapterWorkspace, storage: Optional[LocalImageStorage]) -> None:
    """Sprint 25 — Deferred Storage Upload, Phase 1 (Visual Extraction).
    Replaces Sprint 19–23's "upload immediately to page_<NNN>/, rename
    in place later" flow (_upload_extracted_visual + the since-removed
    _promote_figure_filename): that flow's rename was also its exact
    failure mode — if the key logged at upload time and the key
    assumed at rename time ever drifted, move_object()'s copy_object()
    call failed with "source not found" and the visual vanished from
    its page folder having never actually been renamed.

    Sprint 25 closes that by not naming the visual as a finished asset
    at all here. No figure number, visual type decision, or accept/
    reject verdict is known yet at this point (OCR, Caption
    Association, and Qwen Validation haven't run) — so this always
    parks the crop in the chapter's temporary extraction workspace,
    named only from its own region_id
    (workspace.extracted_filename/extracted_key), and stops. It is not
    touched again until Qwen Validation calls
    _finalize_visual_storage() below, which uploads it exactly once,
    already under its final name, straight into page_<NNN>/ — no
    rename, ever. The resolved temp filename is stashed on
    candidate.metadata["extracted_filename"] so that later finalize
    step (and cleanup, on success) knows which temp object is this
    candidate's. A missing crop or upload failure is reported (never
    raised) — must not take down extraction for the rest of the page."""
    diagnostics.storage_event("Visual Extracted", region_id=candidate.region_id, key=None, status="SUCCESS")

    filename = ChapterWorkspace.extracted_filename(candidate.region_id)
    candidate.metadata["extracted_filename"] = filename
    key = workspace.extracted_key(filename)

    if candidate.image is None:
        diagnostics.storage_event(
            "Temporary Image Saved", region_id=candidate.region_id, key=key,
            status="FAILED", reason="candidate.image is None",
        )
        return
    if storage is None:
        diagnostics.storage_event(
            "Temporary Image Saved", region_id=candidate.region_id, key=key,
            status="SKIPPED", reason="local storage not configured",
        )
        return
    try:
        stored = storage.upload_image(key, candidate.image)
        candidate.metadata["extracted_key"] = stored.key
        diagnostics.count("storage_temp_visuals_uploaded")
        diagnostics.storage_event(
            "Temporary Image Saved", region_id=candidate.region_id, key=stored.key,
            bucket=stored.bucket, size=candidate.image.size,
        )
    except Exception as exc:
        logger.exception("Failed to write temporary extracted crop to local storage key=%s", key)
        diagnostics.storage_event(
            "Temporary Image Saved", region_id=candidate.region_id, key=key,
            status="FAILED", reason=str(exc),
        )


def _finalize_visual_storage(
    candidate: "VisualCandidate",
    workspace: ChapterWorkspace,
    storage: Optional[LocalImageStorage],
    *,
    accepted: bool,
    reason: Optional[str] = None,
) -> None:
    """Sprint 25 — Final Visual Storage. Called once per candidate,
    from QwenValidator, immediately after that candidate's accept/
    reject verdict is decided — this is the *only* place a visual's
    bytes are ever written to its permanent page_<NNN>/ home, and it
    always writes them under their final name, in one upload. There is
    no rename step anymore (Sprint 21–23's _promote_figure_filename is
    removed) and no move_object() call anywhere in this pipeline.

        1. Determine Final Filename — the same three-priority naming
           resolve_figure_name() has used since Sprint 23 (figure
           number > visual type + chapter sequence > region id), just
           computed here instead of at extraction time, now that
           Caption Association's figure number (if any) and Qwen's
           verdict are both actually available.
        2. Page Image Uploaded — candidate.image (still the same
           in-memory crop from extraction; never round-tripped back
           out of extracted/) goes to page_<NNN>/<final_filename>,
           once.
        3. Accepted/Rejected Storage — page_<NNN>/<final_filename> is
           copied (never moved) to accepted/ or rejected/, exactly as
           Sprint 21 already did — this part is unchanged.
        4. Temporary Image Deleted — the extracted/region_<id>.png
           parked at extraction time is deleted, but only after 2 and
           3 have both already succeeded. If either fails, the temp
           copy is left in place on purpose (Sprint 25's cleanup rule:
           retain temp files for debugging whenever processing for a
           visual didn't fully complete), so nothing is ever lost.

    A missing crop, missing workspace/storage, or any upload/copy
    failure is reported (never raised) — Qwen Validation must keep
    moving to the next candidate regardless."""
    figure_number = _resolve_figure_number(candidate)
    filename = workspace.resolve_figure_name(
        candidate.page,
        figure_number=figure_number,
        visual_type=candidate.type,
        region_id=candidate.region_id,
    )
    candidate.metadata["figure_filename"] = filename
    diagnostics.storage_event("Final Filename Generated", region_id=candidate.region_id, key=filename)

    decision_event = "Accepted Image Saved" if accepted else "Rejected Image Saved"
    page_key = workspace.figure_key(candidate.page, filename)

    if reason:
        print("Qwen Decision Reason:")
        print(reason)
        print()

    if candidate.image is None:
        diagnostics.storage_event(
            "Page Image Uploaded", region_id=candidate.region_id, key=page_key,
            status="FAILED", reason="candidate.image is None",
        )
        return
    if storage is None:
        diagnostics.storage_event(
            "Page Image Uploaded", region_id=candidate.region_id, key=page_key,
            status="SKIPPED", reason="local storage not configured",
        )
        return

    try:
        stored = storage.upload_image(page_key, candidate.image)

        # Sprint 14.6 — Part 2: this check is a diagnostic on top of an
        # upload that has already succeeded (upload_image() above did
        # not raise) — see _verify_upload() and
        # LocalImageStorage.object_exists() for why a False here is no
        # longer treated as proof the upload failed.
        verified = _verify_upload(storage, stored.key, bucket=stored.bucket)

        print("=" * 60)
        print("UPLOAD CHECK")
        print("=" * 60)
        print("Requested :", page_key)
        print("Stored    :", stored.key)
        print("Bucket    :", stored.bucket)
        print("Verified  :", verified)
        print("=" * 60)

        if not verified:
            # upload_image() succeeded; only the (best-effort, now
            # retried) existence check couldn't confirm it. Log it
            # loudly and keep going rather than discarding a visual
            # whose bytes genuinely made it to local storage. Never
            # silent, never fatal.
            logger.warning(
                "Upload verification could not confirm key=%s exists in bucket=%s "
                "after upload_image() succeeded — continuing anyway; treating the "
                "successful write as authoritative.",
                stored.key, stored.bucket,
            )
            diagnostics.storage_event(
                "Page Image Uploaded", region_id=candidate.region_id, key=stored.key,
                bucket=stored.bucket, size=candidate.image.size, status="UNVERIFIED",
            )

        candidate.metadata["storage"] = {"storage_key": stored.key, "public_url": stored.public_url}
        diagnostics.count("storage_visuals_uploaded")
        diagnostics.storage_event(
            "Page Image Uploaded", region_id=candidate.region_id, key=stored.key,
            bucket=stored.bucket, size=candidate.image.size,
        )
    except Exception as exc:
        logger.exception("Failed to write final visual to local storage key=%s", page_key)
        diagnostics.storage_event(
            "Page Image Uploaded", region_id=candidate.region_id, key=page_key,
            status="FAILED", reason=str(exc),
        )
        return

    dest_key = workspace.accepted_key(filename) if accepted else workspace.rejected_key(filename)
    try:
        uploaded_key = candidate.metadata["storage"]["storage_key"]

        stored = storage.copy_object(uploaded_key, dest_key)
        diagnostics.count("storage_accepted" if accepted else "storage_rejected")
        diagnostics.storage_event(
            decision_event, region_id=candidate.region_id, key=stored.key,
            bucket=stored.bucket, source_key=page_key, exists=True,
        )
    except Exception as exc:
        logger.exception("Failed to save %s for region_id=%s", decision_event, candidate.region_id)
        diagnostics.storage_event(
            decision_event, region_id=candidate.region_id, key=dest_key,
            source_key=page_key, exists=True, status="FAILED", reason=str(exc),
        )
        return  # keep the temp copy around for debugging — decision storage never finished

    extracted_filename = candidate.metadata.get("extracted_filename")
    if not extracted_filename:
        return
    temp_key = workspace.extracted_key(extracted_filename)
    try:
        storage.delete_object(temp_key)
        diagnostics.storage_event("Temporary Image Deleted", region_id=candidate.region_id, key=temp_key)
    except Exception as exc:
        logger.exception("Failed to delete temporary extracted image key=%s", temp_key)
        diagnostics.storage_event(
            "Temporary Image Deleted", region_id=candidate.region_id, key=temp_key,
            status="FAILED", reason=str(exc),
        )


def _upload_chapter_metadata(workspace: ChapterWorkspace, storage: LocalImageStorage, payload: dict) -> None:
    """Part 10 — chapter_metadata.json, at the chapter root."""
    key = workspace.chapter_metadata_key()
    try:
        storage.upload_json(key, payload)
        diagnostics.count("storage_chapter_metadata_uploaded")
        diagnostics.storage_event("Chapter Metadata Updated", key=key, bucket=storage.config.bucket)
    except Exception as exc:
        logger.exception("Failed to write chapter metadata to local storage key=%s", key)
        diagnostics.storage_event("Chapter Metadata Updated", key=key, status="FAILED", reason=str(exc))


def _upload_embeddings(workspace: ChapterWorkspace, storage: LocalImageStorage, payload: dict) -> None:
    """Part 10 — embeddings.json, at the chapter root. A durable copy
    of what was embedded and stored in Qdrant, useful for
    reprocessing/audit the same way the original PDF is (Part 8) —
    Qdrant remains the only thing ever queried for search."""
    key = workspace.embeddings_key()
    try:
        storage.upload_json(key, payload)
        diagnostics.count("storage_embeddings_uploaded")
    except Exception:
        logger.exception("Failed to write embeddings to local storage key=%s", key)


def _collect_embedding_records(result: "PipelineResult") -> list[dict]:
    """Gathers the qdrant_record EmbeddingBuilder already attached to
    every surviving candidate (nothing is recomputed here) into the
    flat list embeddings.json stores as a durable, local-storage-side
    copy of what was embedded and pushed to Qdrant."""
    records: list[dict] = []
    for page in result.pages:
        for region_result in page.region_results:
            candidate = region_result.candidate
            if candidate is None:
                continue

            print(f"[Candidate] Region={candidate.region_id}")
            print(f"    Type : {candidate.type}")
            print(f"    Image None : {candidate.image is None}")
            record = candidate.metadata.get("qdrant_record")
            if not isinstance(record, dict):
                continue
            records.append({
                "id": record.get("id"),
                "page": page.page_number,
                "visual_type": candidate.type,
                "embedding": record.get("embedding"),
                "storage_key": (candidate.metadata.get("storage") or {}).get("storage_key"),
            })
    return records


def _upload_processing_report(workspace: ChapterWorkspace, storage: LocalImageStorage, payload: dict) -> None:
    """Part 10 — processing_report.json, at the chapter root."""
    key = workspace.processing_report_key()
    try:
        storage.upload_json(key, payload)
        diagnostics.count("storage_processing_report_uploaded")
        diagnostics.storage_event("Processing Report Updated", key=key, bucket=storage.config.bucket)
    except Exception as exc:
        logger.exception("Failed to write processing report to local storage key=%s", key)
        diagnostics.storage_event("Processing Report Updated", key=key, status="FAILED", reason=str(exc))


class QwenVisionBackend(Protocol):
    """The raw call QwenValidator wraps — Ollama's /api/chat with an
    image attached, or a fake in tests. Returns the model's raw text
    response; QwenValidator (via _parse_validation_response) is the
    only thing that ever parses it."""
    def __call__(self, image: Image.Image, prompt: str) -> str: ...


class OllamaQwenBackend:
    """Default QwenVisionBackend. Talks to the same Ollama instance
    (OLLAMA_URL) and vision model (VISION_MODEL) already configured at
    the top of this file — validation gets no separate client or
    config of its own. `requests` is imported lazily, inside __call__,
    so importing this module never requires it to already be
    installed — tests inject a fake QwenVisionBackend instead.

    Sprint 16: the only thing that changed here is *how* the request
    is shaped, not what it does. A VisionRuntime, if given, contributes
    its `request_options()` (e.g. `{"num_gpu": 0}` for CPU mode) into
    the request body's "options" field — the same /api/chat call as
    before, just runtime-aware about which device Ollama uses.
    """

    def __init__(
        self,
        *,
        base_url: str = OLLAMA_URL,
        model: str = VISION_MODEL,
        timeout: float = 600.0,
        runtime: Optional[VisionRuntime] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        # Falls back to reading VISION_RUNTIME from the environment if
        # no runtime is injected, so this backend is never left
        # running in an undefined mode.
        self.runtime: VisionRuntime = runtime or get_vision_runtime()

    def __call__(self, image: Image.Image, prompt: str) -> str:
        try:
            import requests
        except ImportError as exc:
            raise RuntimeError(
                "requests is not installed (`pip install requests`). "
                "Either install it, or inject a backend= for testing."
            ) from exc

        import base64
        import io

        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")

        print("\n" + "=" * 80)
        print("OLLAMA REQUEST")
        print("=" * 80)
        print("Base URL :", self.base_url)
        print("Model    :", self.model)
        print("Timeout  :", self.timeout)
        print("Options  :", self.runtime.request_options())
        print("Endpoint :", f"{self.base_url}/api/chat")
        print("=" * 80)

        try:
            response = requests.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt,
                            "images": [encoded],
                        }
                    ],
                    "format": "json",
                    "stream": False,
                    "options": self.runtime.request_options(),
                },
                timeout=self.timeout,
            )
        except Exception as e:
            print("\nREQUEST FAILED")
            print(type(e))
            print(e)
            raise
        if not response.ok:
            print("=" * 80)
            print("OLLAMA ERROR")
            print("Status:", response.status_code)
            print("Response:")
            print(response.text)
            print("=" * 80)
            response.raise_for_status()

        return response.json().get("message", {}).get("content", "")


class QwenValidator:


    """DocumentEnricher implementing the Qwen Validation stage.

    Qwen never detects here — every candidate it sees already came out
    of Educational Region Detection plus a RegionExtractor. This stage
    only answers the six validation questions per VisualCandidate and
    decides accept/reject; it never proposes new regions, moves a
    bbox, or re-crops anything.

    Runs once per document (a DocumentEnricher, not a PageEnricher),
    after every page's extraction + OCR + Caption Association is
    already complete, so `caption_text` / `ocr_text` are available as
    prompt context. A rejected candidate is dropped from its
    RegionResult (candidate -> None, ok -> False, error ->
    "qwen_rejected:<questions>") exactly like an extraction failure,
    so nothing downstream ever sees it. An accepted candidate is left
    exactly as it was, with the verdict recorded at
    metadata["qwen_validation"].
    """

    def __init__(
        self,
        *,
        backend: Optional[QwenVisionBackend] = None,
        skip_types: frozenset[str] = frozenset(),
        runtime: Optional[VisionRuntime] = None,
    ) -> None:
        # Sprint 16: runtime only matters when *this class* has to
        # build its own default backend — if a backend is injected
        # (e.g. a fake in tests, or one already wired to a runtime by
        # the caller), that backend's own runtime wins and this one is
        # ignored. Nothing about validate_candidate()/__call__() below
        # changes: same Visual Candidate -> Vision Runtime -> Ollama
        # flow, just resolved once here at construction time.
        self.runtime: VisionRuntime = runtime or get_vision_runtime()
        self.backend: QwenVisionBackend = backend or OllamaQwenBackend(runtime=self.runtime)
        # Extraction types this validator should leave untouched (e.g.
        # a type with its own dedicated acceptance policy upstream).
        # Empty by default — Qwen validates every candidate type.
        self.skip_types = skip_types

    # --------------------------------------------------------
    # Questions -> Verdict, for one candidate
    # --------------------------------------------------------
    def validate_candidate(self, candidate: "VisualCandidate") -> ValidationVerdict:
        if candidate.image is None:
            return _failed_verdict("no_crop_image")

        prompt = _build_validation_prompt(candidate)
        try:
            raw = self.backend(candidate.image, prompt)
        except Exception as exc:  # backend failures must not kill the document
            logger.exception(
                "Qwen validation call failed for region_id=%s (page %d)",
                candidate.region_id, candidate.page,
            )
            return _failed_verdict(f"qwen_call_failed: {exc}")

        return _parse_validation_response(raw)

    # --------------------------------------------------------
    # Invalid -> Reject. Valid -> Continue.
    # --------------------------------------------------------
    def __call__(self, result: PipelineResult) -> PipelineResult:
        diagnostics.stage_start("Qwen Validation")
        received = 0
        accepted = 0
        # Sprint 19: purely a storage side effect of the decision made
        # below — never consulted by validate_candidate() itself, and
        # a missing workspace/storage (e.g. in tests) just skips the
        # local storage copy/move.
        workspace: Optional[ChapterWorkspace] = result.context.get("chapter_workspace")
        storage: Optional[LocalImageStorage] = _get_storage() if workspace is not None else None

        for page in result.pages:
            for region_result in page.region_results:
                candidate = region_result.candidate
                if candidate is None:
                    continue  # extraction already failed — nothing to validate

                print(f"[Candidate] Region={candidate.region_id}")
                print(f"    Type : {candidate.type}")
                print(f"    Image None : {candidate.image is None}")

                if candidate.type in self.skip_types:
                    continue

                received += 1
                verdict = self.validate_candidate(candidate)
                confidence = getattr(verdict, "confidence", None)
                diagnostics.track(candidate.region_id, "Qwen Validation Completed")

                if not verdict.valid:
                    logger.info(
                        "Qwen rejected region_id=%s (page %d): failed=%s (%s)",
                        candidate.region_id, candidate.page,
                        verdict.failed_questions, verdict.reason,
                    )
                    diagnostics.qwen_result(
                        candidate.region_id,
                        accepted=False,
                        confidence=confidence,
                        reason=verdict.reason or ",".join(verdict.failed_questions),
                    )
                    diagnostics.drop(candidate.region_id, f"qwen_rejected:{','.join(verdict.failed_questions)}")
                    reject_reason = verdict.reason or ",".join(verdict.failed_questions)
                    if workspace is not None:
                        _finalize_visual_storage(candidate, workspace, storage, accepted=False, reason=reject_reason)
                        _record_page_visual(result.context, candidate, status="rejected", reason=reject_reason)
                    region_result.ok = False
                    region_result.error = f"qwen_rejected:{','.join(verdict.failed_questions)}"
                    region_result.candidate = None
                    continue

                candidate.metadata["qwen_validation"] = verdict.as_dict()
                accepted += 1
                diagnostics.count("qwen_accepted")
                diagnostics.qwen_result(candidate.region_id, accepted=True, confidence=confidence)
                diagnostics.track(candidate.region_id, "Qwen Accepted")
                if workspace is not None:
                    _finalize_visual_storage(candidate, workspace, storage, accepted=True)
                    _record_page_visual(result.context, candidate, status="accepted")

        # Sprint 19: page metadata.json is no longer written here —
        # MetadataBuilder (which runs next, as a document_enricher)
        # still needs to fold its own per-candidate ncert_metadata into
        # this same accumulator before it's uploaded once, in
        # process_pdf, after every document enricher has run.
        diagnostics.stage_end("Qwen Validation")
        diagnostics.stage_stats(
            "Qwen Validation",
            received=received,
            processed=accepted,
            failed=received - accepted,
        )
        return result


# ============================================================
# NCERT CLASS 9 METADATA BUILDER (Sprint 11)
#
# Runs after Graph Extractor / Diagram Extractor / OCR / Validation —
# i.e. after every candidate that's going to exist for a page already
# has its crop, its OCR text, its caption, and has survived Qwen
# Validation (Sprint 10) — and before Embeddings / Qdrant Upload.
#
# No LLM. Every field is deterministic, sourced only from: PDF
# structure, chapter information, OCR, caption, the file system,
# upstream visual analysis (Sprint 5/6's subtype classifiers), or the
# bounding box already sitting on the candidate. Re-running this stage
# on the same PipelineResult always produces the same payload (aside
# from `created_at`, a plain wall-clock timestamp, not a derived
# fact).
#
#     Subject Detection    -> filesystem: knowledge_base/<Subject>/...
#     Chapter Detection    -> chapter folder / PDF metadata / filename
#     Figure Metadata      -> Caption Association's own resolved reference
#     Reference Extraction -> every Fig./Figure/Table reference in the text
#     OCR Metadata         -> candidate.ocr_text, verbatim, never summarized
#     Image Metadata       -> width / height / aspect_ratio off the crop
#     Hash Generation      -> sha256 of the crop's own PNG bytes
#     Search Metadata      -> chapter + caption + ocr + labels + subtype + figure_number
#     Metadata Payload     -> VisualMetadata, attached to the candidate
# ============================================================

NCERT_CLASS_LEVEL = 9  # Sprint 11 is class-9-only. Always this value — never inferred.
PIPELINE_VERSION = "v2"

# knowledge_base/Science/... , knowledge_base/Maths/... — only spelling
# normalization ("Maths" -> "Mathematics"), never a guess: a folder name
# not listed here is passed through as-is (title-cased) rather than
# silently mapped to some other subject.
_SUBJECT_FOLDER_ALIASES: dict[str, str] = {
    "science": "Science",
    "maths": "Mathematics",
    "math": "Mathematics",
    "mathematics": "Mathematics",
}

_SUBJECT_BOOK_NAMES: dict[str, str] = {
    "Science": "NCERT Science",
    "Mathematics": "NCERT Mathematics",
}

# "Figure 2.3", "Fig. 5.2", "Table 6.1" ... found *anywhere* in a text,
# not just at its start (that's what _CAPTION_LABEL_RE, defined above
# for Caption Association, is for). Reuses the same kind vocabulary /
# canonicalization (_CAPTION_LABEL_CANONICAL) so "Figure 2.3" always
# means the same thing whether it's the anchor's own label or a
# reference mentioned in passing.
_REFERENCE_LABEL_RE = re.compile(
    r"\b(?P<kind>figure|fig\.?|table|photo|image|chart|diagram)\s*"
    r"(?P<number>[0-9]+(?:[.\-][0-9]+)*)\b",
    re.IGNORECASE,
)

_CHAPTER_NUMBER_RE = re.compile(r"chapter[\s_-]*0*([0-9]+)", re.IGNORECASE)
_BARE_CHAPTER_FOLDER_RE = re.compile(r"^chapter[\s_-]*0*[0-9]+$", re.IGNORECASE)
# Strips a leading "chapter2_" / "chapter-2 " off a chapter folder name
# before humanizing it, so "chapter2_matter_in_our_surroundings" titles
# as "Matter In Our Surroundings" rather than "Chapter2 Matter In Our
# Surroundings" — the number is already captured separately, by
# _extract_chapter_number().
_CHAPTER_FOLDER_PREFIX_RE = re.compile(r"^chapter[\s_-]*0*[0-9]+[\s_-]*", re.IGNORECASE)

# Extractor-specific metadata keys that all mean "visual subtype" —
# extract_diagrams.py (Sprint 6) writes "visual_subtype",
# extract_graphs.py (Sprint 5) writes "graph_subtype". Checked in this
# order; the first one present wins. This only picks which key to
# read — it never classifies anything itself.
_SUBTYPE_METADATA_KEYS: tuple[str, ...] = (
    "visual_subtype", "graph_subtype", "diagram_subtype",
    "table_subtype", "photo_subtype", "subtype",
)


@dataclass
class SubjectInfo:
    """Output of Subject Detection: what folder + human-readable book
    name a PDF belongs to."""
    subject: str
    book: str


@dataclass
class ChapterInfo:
    """Output of Chapter Detection. Either field may be None — an
    unfound chapter title or number is left unset, never guessed."""
    chapter: Optional[str]
    chapter_number: Optional[int]


@dataclass
class ImageMetadata:
    """Output of the Image Metadata step — plain geometry of the crop
    actually produced, not the region's original bbox."""
    width: Optional[int] = None
    height: Optional[int] = None
    aspect_ratio: Optional[float] = None


@dataclass
class VisualMetadata:
    """The Metadata Payload: everything Sprint 11 resolves for one
    accepted VisualCandidate, ready for Embeddings (Sprint 13) and
    Qdrant Upload to consume as-is.

    Field is named `class_level`, not `class` — `class` is a reserved
    word in Python (same reason LayoutRegion uses `region_class`) —
    and is exposed under the schema's actual key ("class") only in
    as_dict().
    """
    id: str
    subject: str
    book: str
    class_level: int
    chapter: Optional[str]
    chapter_number: Optional[int]
    page: int
    figure_number: Optional[str]
    visual_type: str
    visual_subtype: Optional[str]
    caption: Optional[str]
    title: Optional[str]
    ocr_text: Optional[str]
    labels: list[str]
    panel_labels: list[str]
    reference_labels: list[str]
    keywords: list[str]
    bbox: tuple[float, float, float, float]
    image_width: Optional[int]
    image_height: Optional[int]
    aspect_ratio: Optional[float]
    crop_path: str
    source_pdf: str
    image_hash: Optional[str]
    search_text: str
    created_at: str
    pipeline_version: str = PIPELINE_VERSION

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "subject": self.subject,
            "book": self.book,
            "class": self.class_level,
            "chapter": self.chapter,
            "chapter_number": self.chapter_number,
            "page": self.page,
            "figure_number": self.figure_number,
            "visual_type": self.visual_type,
            "visual_subtype": self.visual_subtype,
            "caption": self.caption,
            "title": self.title,
            "ocr_text": self.ocr_text,
            "labels": list(self.labels),
            "panel_labels": list(self.panel_labels),
            "reference_labels": list(self.reference_labels),
            "keywords": list(self.keywords),
            "bbox": list(self.bbox),
            "image_width": self.image_width,
            "image_height": self.image_height,
            "aspect_ratio": self.aspect_ratio,
            "crop_path": self.crop_path,
            "source_pdf": self.source_pdf,
            "image_hash": self.image_hash,
            "search_text": self.search_text,
            "created_at": self.created_at,
            "pipeline_version": self.pipeline_version,
        }


# --------------------------------------------------------
# Subject Detection
# --------------------------------------------------------
def _relative_kb_parts(pdf_path: Path) -> tuple[str, ...]:
    """Directory components of pdf_path below KNOWLEDGE_BASE_DIR, e.g.
    knowledge_base/Science/chapter5/foo.pdf -> ("Science", "chapter5").
    Falls back to just the PDF's own parent directory name when the
    path isn't under KNOWLEDGE_BASE_DIR at all (e.g. a test fixture
    living elsewhere), so detection degrades instead of raising."""
    try:
        relative = pdf_path.resolve().relative_to(KNOWLEDGE_BASE_DIR.resolve())
        return relative.parts[:-1]  # drop the filename itself
    except ValueError:
        parent_name = pdf_path.parent.name
        return (parent_name,) if parent_name else ()


def detect_subject(pdf_path: Path) -> SubjectInfo:
    """Subject Detection stage. Never AI, never inferred from page
    content — read straight off the filesystem layout
    (knowledge_base/<Subject>/...). `_SUBJECT_FOLDER_ALIASES` only
    normalizes spelling ("Maths" -> "Mathematics"); an unrecognized
    folder name is title-cased and passed through rather than mapped
    to some other subject.
    """
    parts = _relative_kb_parts(pdf_path)
    folder_name = parts[0] if parts else "Unknown"
    key = folder_name.strip().lower()
    subject = _SUBJECT_FOLDER_ALIASES.get(key, folder_name.strip().title())
    book = _SUBJECT_BOOK_NAMES.get(subject, f"NCERT {subject}")
    return SubjectInfo(subject=subject, book=book)


# --------------------------------------------------------
# Chapter Detection
# --------------------------------------------------------
def _read_pdf_title(pdf_path: Path) -> Optional[str]:
    """PDF Metadata step: the document's own /Title, if set. Opens the
    file just to read its metadata dict (cheap — no page rendering)
    and never raises; a PDF that can't be opened here simply
    contributes no metadata-sourced title."""
    try:
        doc = fitz.open(pdf_path)
        try:
            title = (doc.metadata or {}).get("title", "")
        finally:
            doc.close()
    except Exception:
        return None
    title = (title or "").strip()
    return title or None


def _humanize_folder_name(name: str) -> str:
    """"matter_in_our_surroundings" -> "Matter In Our Surroundings".
    Only ever applied to a chapter folder that has actual title content
    in it — see detect_chapter()."""
    words = re.split(r"[\s_\-]+", name.strip())
    return " ".join(word.capitalize() for word in words if word)


def _extract_chapter_number(*sources: Optional[str]) -> Optional[int]:
    """Chapter Number step: scans each candidate source in turn
    (chapter folder name, filename, PDF metadata title) for a
    "chapter <N>" pattern and returns the first hit."""
    for source in sources:
        if not source:
            continue
        match = _CHAPTER_NUMBER_RE.search(source)
        if match:
            return int(match.group(1))
    return None


def detect_chapter(pdf_path: Path) -> ChapterInfo:
    """Chapter Detection stage. Title comes from — in priority order —
    the PDF's own metadata title, then a descriptive chapter folder
    name (a folder that's just "chapter2" carries no title content and
    is skipped as a title source, though it still counts for chapter
    number). chapter_number is resolved independently, from whichever
    of chapter-folder-name / filename / metadata-title first contains
    a "chapter <N>" pattern. An unfound title stays None — never
    guessed from the subject or from other chapters.
    """
    parts = _relative_kb_parts(pdf_path)
    chapter_folder = parts[1] if len(parts) >= 2 else None
    metadata_title = _read_pdf_title(pdf_path)
    filename_stem = pdf_path.stem

    chapter_number = _extract_chapter_number(chapter_folder, filename_stem, metadata_title)

    chapter_title: Optional[str] = None
    if metadata_title and not _CHAPTER_NUMBER_RE.fullmatch(metadata_title):
        chapter_title = metadata_title
    elif chapter_folder and not _BARE_CHAPTER_FOLDER_RE.match(chapter_folder.strip()):
        title_source = _CHAPTER_FOLDER_PREFIX_RE.sub("", chapter_folder.strip())
        if title_source:
            chapter_title = _humanize_folder_name(title_source)

    return ChapterInfo(chapter=chapter_title, chapter_number=chapter_number)


# --------------------------------------------------------
# Document Context (Sprint 18)
# --------------------------------------------------------
def build_document_context(pdf_path: Path, subject_info: SubjectInfo, chapter_info: ChapterInfo) -> DocumentContext:
    """Wraps Subject Detection + Chapter Detection's own output (never
    re-derived here) into the DocumentContext every storage object key
    is built from. `chapter_number` isn't always found (see
    detect_chapter) — a missing one is never guessed, it falls back to
    0 so a chapter_no is always available to build a key with, exactly
    the same "degrade, don't guess" posture chapter_folder detection
    already has. `chapter_name` falls back to the PDF's own filename
    stem for the same reason."""
    return DocumentContext(
        class_no=NCERT_CLASS_LEVEL,
        board=TEXTBOOK_BOARD,
        publisher=TEXTBOOK_PUBLISHER,
        subject=subject_info.subject,
        chapter_no=chapter_info.chapter_number or 0,
        chapter_name=chapter_info.chapter or pdf_path.stem,
        pdf_name=pdf_path.name,
    )


# --------------------------------------------------------
# Figure Metadata / Reference Extraction
# --------------------------------------------------------
def _resolve_figure_number(candidate: "VisualCandidate") -> Optional[str]:
    """Figure Metadata step: the canonical "Figure 4.3"-style label for
    *this* candidate. Caption Association (Sprint 9) already resolved
    this whenever a caption was found — reuse its `reference` rather
    than re-parsing the same text. Only falls through to this
    candidate's own OCR text (the figure's number printed inside the
    crop itself, with no separate caption block) when Caption
    Association found nothing at all."""
    association = candidate.metadata.get("caption_association") or {}
    reference = association.get("reference")
    if reference:
        return reference

    if candidate.ocr_text:
        _, reference, _ = _parse_caption_label(candidate.ocr_text.strip())
        if reference:
            return reference

    return None


def _extract_reference_labels(*texts: Optional[str]) -> list[str]:
    """Reference Extraction step: every "Figure 2.3" / "Fig. 5.2" /
    "Table 6.1"-style reference mentioned anywhere across the given
    texts (caption + full OCR text) — not just this figure's own
    number. Useful later for grounding an answer like "Refer to
    Figure 2.3." even when 2.3 isn't *this* image. Deduplicated,
    first-seen order preserved."""
    combined = "\n".join(text for text in texts if text)
    seen: dict[str, None] = {}
    for match in _REFERENCE_LABEL_RE.finditer(combined):
        kind_key = match.group("kind").lower().rstrip(".")
        canonical = _CAPTION_LABEL_CANONICAL.get(kind_key, kind_key.capitalize())
        seen.setdefault(f"{canonical} {match.group('number')}", None)
    return list(seen.keys())


# --------------------------------------------------------
# Labels / Panel Labels / Visual Subtype
# --------------------------------------------------------
def _resolve_labels(candidate: "VisualCandidate") -> list[str]:
    """Labels step: individual on-image text labels. An extractor that
    already produced a `labels` list (extract_diagrams.py, Sprint 6)
    is used as-is; one that didn't (extract_graphs.py, Sprint 5) falls
    back to the crop's own OCR lines — same underlying source, just
    not already split out by the extractor."""
    labels = candidate.metadata.get("labels")
    if labels:
        return [str(label).strip() for label in labels if str(label).strip()]

    if candidate.ocr_text:
        return [line.strip() for line in candidate.ocr_text.splitlines() if line.strip()]

    return []


def _resolve_panel_labels(candidate: "VisualCandidate") -> list[str]:
    """Panel Labels step: "(a)" / "(b)" / "(c)" -> ["a", "b", "c"],
    read from panel detection Sprint 6 already did
    (metadata["panels"]) — not re-detected here."""
    panels = candidate.metadata.get("panels") or []
    labels: list[str] = []
    for panel in panels:
        label = str(panel.get("label", "")).strip().strip("()[]. ")
        if label:
            labels.append(label)
    return labels


def _resolve_visual_subtype(candidate: "VisualCandidate") -> Optional[str]:
    """Visual Subtype step: already produced upstream by Sprint 5/6's
    subtype classifiers, just filed under a type-specific metadata key
    per extractor. This only normalizes which key to read from — it
    never classifies anything itself."""
    for key in _SUBTYPE_METADATA_KEYS:
        value = candidate.metadata.get(key)
        if value:
            return str(value)
    return None


# --------------------------------------------------------
# Keywords (Sprint 13 — Embedding Generation)
#
# Deterministic term extraction, never an LLM: every keyword is a
# token that already appears, verbatim, in one of the listed source
# fields. No paraphrasing, no taxonomy lookups (e.g. no inferring
# "biology" from a Science chapter), no synonym expansion.
# --------------------------------------------------------
_KEYWORD_STOPWORDS = frozenset({
    "the", "a", "an", "of", "in", "on", "at", "to", "and", "or",
    "is", "are", "with", "for", "by", "from", "this", "that", "it",
    "as", "its", "fig", "figure", "no", "not",
})


def _tokenize_for_keywords(text: Optional[str]) -> list[str]:
    """Lowercased alphabetic(-numeric) word tokens, in the order they
    appear in `text`. Purely mechanical splitting — no stemming, no
    spell-correction."""
    if not text:
        return []
    return re.findall(r"[a-zA-Z][a-zA-Z0-9]*", text.lower())


def _build_keywords(
    *,
    visual_type: Optional[str],
    visual_subtype: Optional[str],
    caption: Optional[str],
    ocr_text: Optional[str],
    labels: list[str],
    figure_number: Optional[str],
    chapter: Optional[str],
    chapter_number: Optional[int],
) -> list[str]:
    """Keywords step: deterministic term extraction from visual
    subtype, caption, labels, figure number, OCR, and chapter (plus
    visual_type, which the architecture spec's own example keyword
    list implies — "diagram" appears there with no other possible
    source). Stopwords and single-character tokens are dropped, a
    `chapter<N>` token is added from chapter_number (not from parsing
    the chapter title), and everything is deduplicated in first-seen
    order. No subject-to-domain mapping ("Science" -> "biology") is
    performed here — that would require a taxonomy this stage doesn't
    have, and isn't one of the sources the spec lists.
    """
    keywords: list[str] = []
    seen: set[str] = set()

    def add_all(text: Optional[str]) -> None:
        for token in _tokenize_for_keywords(text):
            if token in _KEYWORD_STOPWORDS or len(token) < 2:
                continue
            if token not in seen:
                seen.add(token)
                keywords.append(token)

    add_all(visual_subtype)
    add_all(visual_type)
    add_all(caption)
    for label in labels:
        add_all(label)
    add_all(ocr_text)
    add_all(chapter)

    if chapter_number is not None:
        token = f"chapter{chapter_number}"
        if token not in seen:
            seen.add(token)
            keywords.append(token)

    add_all(figure_number)

    return keywords


# --------------------------------------------------------
# Image Metadata / Hash Generation / Image Path
# --------------------------------------------------------
def _resolve_image_metadata(candidate: "VisualCandidate") -> ImageMetadata:
    if candidate.image is None:
        return ImageMetadata()
    width, height = candidate.image.size
    aspect_ratio = round(width / height, 4) if height else None
    return ImageMetadata(width=width, height=height, aspect_ratio=aspect_ratio)


def _compute_image_hash(image: Optional[Image.Image]) -> Optional[str]:
    """Hash Generation step: sha256 of the crop's own PNG-encoded
    bytes. Deterministic for identical pixel content no matter how
    many times the pipeline re-runs — used later for exact-duplicate
    detection. Distinct from Sprint 10's per-candidate "does this look
    like an obvious repeat" judgment and from the corpus-wide,
    embedding-based Duplicate Removal stage still to come."""
    if image is None:
        return None
    import io
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="PNG")
    return hashlib.sha256(buffer.getvalue()).hexdigest()


def _slugify(text: str) -> str:
    slug = re.sub(r"[^0-9a-zA-Z]+", "_", text).strip("_").lower()
    return slug or "figure"


def _resolve_crop_key(candidate: "VisualCandidate", workspace: Optional[ChapterWorkspace]) -> Optional[str]:
    """Image Path step, Sprint 19: there is no ad-hoc local media/ path
    anymore — `crop_path` in VisualMetadata now holds the local storage
    object key the crop was uploaded to (set on
    candidate.metadata["storage"] — Sprint 25: by
    _finalize_visual_storage, once Qwen Validation has decided
    accept/reject and the final filename is known, not at extraction
    time). Nothing is written to disk here directly; this only reads
    back a key that's already durable in local storage. Falls back to
    recomputing the deterministic key from `workspace` if the upload
    metadata is missing for some reason (e.g. storage was unavailable
    for this run) — still just a key string, never a filesystem path."""
    storage_meta = candidate.metadata.get("storage")
    if isinstance(storage_meta, dict) and storage_meta.get("storage_key"):
        return storage_meta["storage_key"]
    filename = candidate.metadata.get("figure_filename")
    if workspace is not None and filename is not None:
        return workspace.figure_key(candidate.page, filename)
    return None


# --------------------------------------------------------
# Search Metadata
# --------------------------------------------------------
def _build_search_text(
    *,
    chapter: Optional[str],
    caption: Optional[str],
    ocr_text: Optional[str],
    labels: list[str],
    visual_subtype: Optional[str],
    figure_number: Optional[str],
) -> str:
    """Search Metadata step: chapter + caption + ocr + labels +
    visual_subtype + figure_number, concatenated in exactly that
    order, whitespace-normalized. Sprint 13 embeds this text as-is —
    nothing here is summarized or reworded."""
    parts = [
        chapter or "", caption or "", ocr_text or "",
        " ".join(labels), visual_subtype or "", figure_number or "",
    ]
    return " ".join(" ".join(parts).split())


class MetadataBuilder:
    """DocumentEnricher implementing the NCERT Class 9 Metadata Builder
    stage (Sprint 11).

    Runs after Graph Extractor / Diagram Extractor / OCR / Validation
    are all complete (a DocumentEnricher, like QwenValidator, not a
    PageEnricher) and before Embeddings / Qdrant Upload. For every
    still-accepted VisualCandidate, walks the same stages the
    architecture diagram names: Subject Detection -> Chapter Detection
    -> Figure Metadata -> Reference Extraction -> OCR Metadata ->
    Image Metadata -> Hash Generation -> Search Metadata -> Metadata
    Payload.

    Subject/Chapter Detection are computed once per document (they
    don't vary per candidate) and reused for every candidate on every
    page, rather than re-derived per candidate.

    Candidates already rejected upstream (region_result.candidate is
    None — e.g. dropped by Qwen Validation in Sprint 10) are skipped:
    there is nothing to build metadata for.
    """

    def __init__(self, *, write_crops: bool = True) -> None:
        # Sprint 25: crops are uploaded to local storage once Qwen
        # Validation has decided accept/reject and the final filename
        # is known
        # (_finalize_visual_storage) — which has already happened by
        # the time this stage runs (MetadataBuilder is a
        # DocumentEnricher that runs after QwenValidator). This flag
        # no longer controls any disk write. Kept for backward
        # compatibility with existing call sites/tests; when False,
        # this stage simply doesn't attach a crop_path to the metadata
        # it builds (as if no crop were ever produced for it).
        self.write_crops = write_crops

    def __call__(self, result: PipelineResult) -> PipelineResult:
        diagnostics.stage_start("Metadata Builder")
        # Admin-triggered chapter processing (ingest_chapter_images in
        # image_ingestion_tasks.py) passes a real document_context built
        # from Node's own chapter metadata rather than letting it be
        # guessed from the PDF's on-disk path — this pipeline's path-based
        # detect_subject/detect_chapter assumes a knowledge_base/<Subject>/
        # <chapter folder>/ layout that an admin-uploaded PDF (saved to a
        # temp path, not that layout) doesn't have, and even for
        # discover-mode batch runs, real metadata should always win over a
        # guess when it's available. Falls back to path-based detection
        # exactly as before when nothing was injected (batch/CLI mode).
        doc_context: Optional[DocumentContext] = result.context.get("document_context")
        if doc_context is not None:
            subject_info = SubjectInfo(
                subject=doc_context.subject,
                book=_SUBJECT_BOOK_NAMES.get(doc_context.subject, f"NCERT {doc_context.subject}"),
            )
            chapter_info = ChapterInfo(chapter=doc_context.chapter_name, chapter_number=doc_context.chapter_no or None)
        else:
            subject_info = detect_subject(result.pdf_path)
            chapter_info = detect_chapter(result.pdf_path)
        # Sprint 19: purely a storage side effect — Metadata Generation
        # itself (build_metadata below) is untouched. A missing
        # workspace (e.g. in tests) just skips folding results into
        # the page_asset_metadata accumulator.
        workspace: Optional[ChapterWorkspace] = result.context.get("chapter_workspace")
        # Sprint 14.5: same singleton every other storage-writing call
        # site in this module reuses (_get_storage()), fetched once
        # per document rather than per candidate. None when local
        # storage could not be initialized — every call below already
        # handles that by skipping the upload.
        storage: Optional[LocalImageStorage] = _get_storage() if workspace is not None else None
        # Sprint 14.6 — Part 1: chapter_info.chapter (Chapter Detection's
        # raw output) is frequently None — detect_chapter() only finds a
        # title, never guesses one. chapter_metadata.json never shows
        # that gap because it's built from doc_context.chapter_name
        # instead, which already has this exact fallback (see
        # build_document_context: "chapter_info.chapter or
        # pdf_path.stem"). Reuse that same resolved value here so a
        # visual's own metadata.json never disagrees with its chapter's
        # chapter_metadata.json about what the chapter is called.
        chapter_name = (
            doc_context.chapter_name if doc_context is not None
            else (chapter_info.chapter or result.pdf_path.stem)
        )

        received = 0
        processed = 0
        images_saved = 0
        images_failed = 0

        for page in result.pages:
            for region_result in page.region_results:
                candidate = region_result.candidate
                if candidate is None:
                    continue  # rejected upstream — nothing to build metadata for

                received += 1
                try:
                    payload = self.build_metadata(
                        candidate,
                        page_number=page.page_number,
                        pdf_path=result.pdf_path,
                        subject_info=subject_info,
                        chapter_info=chapter_info,
                        workspace=workspace,
                        class_level=doc_context.class_no if doc_context is not None else NCERT_CLASS_LEVEL,
                    )
                except Exception as exc:
                    images_failed += 1
                    diagnostics.metadata_result(
                        subject=subject_info.subject, chapter=chapter_info.chapter,
                        figure_number=None, caption=None, crop_path=None,
                        image_hash=None, search_text_length=0, status=f"FAILED: {exc}",
                    )
                    diagnostics.drop(candidate.region_id, f"metadata_build_failed:{exc}")
                    continue

                candidate.metadata["ncert_metadata"] = payload.as_dict()
                processed += 1
                diagnostics.count("metadata_generated")

                crop_uploaded = bool(self.write_crops and payload.crop_path)
                if crop_uploaded:
                    images_saved += 1
                    diagnostics.count("images_saved")
                elif self.write_crops:
                    images_failed += 1

                diagnostics.metadata_result(
                    subject=payload.subject, chapter=payload.chapter,
                    figure_number=payload.figure_number, caption=payload.caption,
                    crop_path=payload.crop_path, image_hash=payload.image_hash,
                    search_text_length=len(payload.search_text or ""),
                    status="SUCCESS",
                )
                diagnostics.track(candidate.region_id, "Metadata Generated")

                # Sprint 19 — Part 6: fold this candidate's full
                # metadata payload into the SAME page_asset_metadata
                # accumulator QwenValidator already started (accept/
                # reject bookkeeping) — one metadata.json per page,
                # uploaded once, in process_pdf, after every document
                # enricher (this one included) has run.
                if workspace is not None:
                    _enrich_page_visual_metadata(result.context, candidate, payload.as_dict())

                    # Sprint 14.5: Generate Visual Asset Metadata ->
                    # Save Metadata JSON in page_xxx Folder. Separate
                    # from the page_asset_metadata fold just above —
                    # that accumulator still produces the one
                    # metadata.json per page (Sprint 18.3/19); this is
                    # the new per-asset <filename>.json living beside
                    # the image itself. Skipped when this candidate
                    # never reached a finalized filename (e.g. its
                    # image upload failed upstream) — nothing to name
                    # the JSON after.
                    filename = candidate.metadata.get("figure_filename")
                    if filename:
                        asset_metadata = _build_visual_asset_metadata(
                            candidate,
                            page_number=page.page_number,
                            subject_info=subject_info,
                            chapter_name=chapter_name,
                            payload=payload,
                            filename=filename,
                            workspace=workspace,
                            storage=storage,
                        )
                        _upload_visual_asset_metadata(candidate, workspace, storage, asset_metadata)

        diagnostics.stage_end("Metadata Builder")
        diagnostics.stage_stats(
            "Metadata Builder",
            received=received,
            processed=processed,
            saved=images_saved,
            failed=images_failed,
        )
        return result

    def build_metadata(
        self,
        candidate: "VisualCandidate",
        *,
        page_number: int,
        pdf_path: Path,
        subject_info: SubjectInfo,
        chapter_info: ChapterInfo,
        workspace: Optional[ChapterWorkspace] = None,
        class_level: int = NCERT_CLASS_LEVEL,
    ) -> VisualMetadata:
        # Figure Metadata -> Reference Extraction
        figure_number = _resolve_figure_number(candidate)
        caption = candidate.caption_text
        title = candidate.metadata.get("title")
        reference_labels = _extract_reference_labels(caption, candidate.ocr_text)

        # OCR Metadata
        ocr_text = candidate.ocr_text

        # Image Metadata -> Hash Generation
        image_meta = _resolve_image_metadata(candidate)
        image_hash = _compute_image_hash(candidate.image)

        # Image Path step, Sprint 19: the crop already lives in local
        # storage (uploaded immediately at extraction time, Part 3) —
        # this is just reading that key back, never writing anything.
        crop_path = _resolve_crop_key(candidate, workspace) if self.write_crops else None

        labels = _resolve_labels(candidate)
        panel_labels = _resolve_panel_labels(candidate)
        visual_subtype = _resolve_visual_subtype(candidate)

        keywords = _build_keywords(
            visual_type=candidate.type, visual_subtype=visual_subtype,
            caption=caption, ocr_text=ocr_text, labels=labels,
            figure_number=figure_number, chapter=chapter_info.chapter,
            chapter_number=chapter_info.chapter_number,
        )

        # Search Metadata
        search_text = _build_search_text(
            chapter=chapter_info.chapter, caption=caption, ocr_text=ocr_text,
            labels=labels, visual_subtype=visual_subtype, figure_number=figure_number,
        )

        # Metadata Payload
        return VisualMetadata(
            id=candidate.region_id,
            subject=subject_info.subject,
            book=subject_info.book,
            class_level=class_level,
            chapter=chapter_info.chapter,
            chapter_number=chapter_info.chapter_number,
            page=page_number,
            figure_number=figure_number,
            visual_type=candidate.type,
            visual_subtype=visual_subtype,
            caption=caption,
            title=str(title) if title else None,
            ocr_text=ocr_text,
            labels=labels,
            panel_labels=panel_labels,
            reference_labels=reference_labels,
            keywords=keywords,
            bbox=candidate.bbox,
            image_width=image_meta.width,
            image_height=image_meta.height,
            aspect_ratio=image_meta.aspect_ratio,
            crop_path=crop_path or "",
            source_pdf=pdf_path.name,
            image_hash=image_hash,
            search_text=search_text,
            created_at=datetime.now(timezone.utc).isoformat(),
            pipeline_version=PIPELINE_VERSION,
        )


# ============================================================
# VISUAL ASSET METADATA (Sprint 14.5)
#
# A second, separate metadata artifact from the ncert_metadata payload
# above. VisualMetadata/as_dict() (Sprint 11) exists to feed Embeddings
# and Qdrant (Sprint 13) — it is a search/embedding record. The
# schema built here exists to feed the Visual Asset Retrieval System
# and Sprint 15's Educational Enrichment — it is the canonical,
# durable record for one accepted visual asset, and is never treated
# as a figure/graph/table in its own right: every accepted visual is a
# "visual_asset", with its concrete kind stored as metadata under
# visual.type/visual.subtype.
#
# Written once per accepted visual, as <filename>.json next to
# <filename>.png in that visual's own page_<NNN>/ folder (the same
# storage key prefix workspace.figure_key() already uses for the image
# itself) — never inside chapter_metadata.json, which stays
# chapter-level only (Part 10, unchanged by this sprint).
#
# No extraction, OCR, caption, or validation logic lives here — every
# value below is read off the candidate / payload / workspace state
# those earlier stages already produced.
# ============================================================

def _split_figure_table_number(
    visual_type: str, reference: Optional[str]
) -> tuple[Optional[str], Optional[str]]:
    """VisualMetadata.figure_number (Sprint 11, via
    _resolve_figure_number) is a single combined label — "Figure 4.3"
    or "Table 6.1" alike. The Visual Asset schema wants those as two
    separate fields (figure_number / table_number, the other left
    null), so this only splits the label already resolved upstream —
    it never re-parses OCR or caption text itself. A visual typed
    "table", or a reference that itself reads "Table ...", is treated
    as a table number; everything else is a figure number."""
    if not reference:
        return None, None
    is_table = visual_type == "table" or reference.strip().lower().startswith("table")
    return (None, reference) if is_table else (reference, None)


def _build_visual_asset_metadata(
    candidate: "VisualCandidate",
    *,
    page_number: int,
    subject_info: SubjectInfo,
    chapter_name: str,
    payload: VisualMetadata,
    filename: str,
    workspace: ChapterWorkspace,
    storage: Optional[LocalImageStorage],
) -> dict:
    """Assembles the Sprint 14.5 metadata schema for one accepted
    visual asset, reusing fields VisualMetadata (payload) already
    resolved rather than recomputing anything.

    Chapter (Sprint 14.6 — Part 1): `chapter_name` is the caller's
    already-resolved value — the same doc_context.chapter_name
    chapter_metadata.json's own "chapter_name" is built from (see
    MetadataBuilder.__call__) — never the raw ChapterInfo.chapter,
    which is frequently None. This keeps a visual's own metadata.json
    in agreement with its chapter's chapter_metadata.json instead of
    reporting "chapter": null whenever Chapter Detection didn't find a
    title.

    Page Information: this pipeline only ever tracks one page number —
    the 1-indexed position fitz enumerates the PDF at (page_number /
    candidate.page), which is also what names this asset's
    page_<NNN>/ folder. That is the "pdf" page. There is no dedicated
    textbook-printed-page-number detection stage in this pipeline yet
    (out of scope for Sprint 14.5/14.6 — OCR Pipeline is unchanged), so
    "textbook" is populated with that same value until such a stage
    exists, rather than left absent.
    """
    figure_number, table_number = _split_figure_table_number(
        candidate.type, payload.figure_number
    )

    return {
        "id": candidate.region_id,
        "asset_type": "visual_asset",
        "subject": subject_info.subject,
        "chapter": chapter_name,
        "page": {
            "textbook": page_number,
            "pdf": page_number,
        },
        "visual": {
            "type": candidate.type,
            "subtype": payload.visual_subtype,
            "figure_number": figure_number,
            "table_number": table_number,
            "title": payload.title,
            "caption": payload.caption,
        },
        "storage": {
            "bucket": storage.config.bucket if storage is not None else None,
            "object_key": workspace.accepted_key(filename),
        },
        "ocr": {
            "text": payload.ocr_text,
            # No OCR-summarization stage exists in this pipeline yet —
            # left null rather than fabricated. Reserved for a future
            # sprint, same as the four empty sections below.
            "summary": None,
        },
        "education": {},
        "retrieval": {},
        "visual_analysis": {},
        "assessment": {},
    }


def _upload_visual_asset_metadata(
    candidate: "VisualCandidate",
    workspace: ChapterWorkspace,
    storage: Optional[LocalImageStorage],
    payload: dict,
) -> None:
    """Saves the Visual Asset metadata JSON alongside its image, at
    workspace.figure_key(candidate.page, "<same-stem>.json") — i.e.
    the same page_<NNN>/ folder the accepted image itself lives in,
    same basename, .json instead of .png. A missing filename (asset
    never finalized), missing workspace, or upload failure is reported
    and swallowed — must not take down Metadata Builder for the rest
    of the document."""
    filename = candidate.metadata.get("figure_filename")
    if not filename:
        return

    json_filename = f"{Path(filename).stem}.json"
    key = workspace.figure_key(candidate.page, json_filename)

    if storage is None:
        diagnostics.storage_event(
            "Visual Asset Metadata Saved", region_id=candidate.region_id, key=key,
            status="SKIPPED", reason="local storage not configured",
        )
        return

    try:
        storage.upload_json(key, payload)
        diagnostics.count("storage_visual_asset_metadata_uploaded")
        diagnostics.storage_event(
            "Visual Asset Metadata Saved", region_id=candidate.region_id, key=key,
            bucket=storage.config.bucket,
        )
    except Exception as exc:
        logger.exception(
            "Failed to write visual asset metadata to local storage key=%s", key
        )
        diagnostics.storage_event(
            "Visual Asset Metadata Saved", region_id=candidate.region_id, key=key,
            status="FAILED", reason=str(exc),
        )


# ============================================================
# DUPLICATE REMOVAL (Sprint 12)
#
# Runs after Metadata Builder (Sprint 11) — every surviving candidate
# already has its image hash, caption, and OCR text resolved — and
# before Embeddings (Sprint 13), so the corpus handed to the embedder
# is already deduplicated. Signal-based, not embedding-based: it
# combines four cheap, already-available signals rather than anything
# vector-similarity driven:
#
#     Hash                -> exact sha256 match on the crop's own PNG
#                            bytes (Sprint 11's Hash Generation step)
#     IoU                 -> bbox overlap, same page only
#     Caption Similarity  -> text-similarity ratio on caption_text
#     OCR Similarity      -> text-similarity ratio on ocr_text
#
# Distinct from Sprint 10's per-candidate "does this look like an
# obvious repeat" Qwen judgment (one image, in isolation) — this stage
# looks across the whole document.
# ============================================================

def _normalize_text_for_similarity(text: Optional[str]) -> str:
    """Whitespace-collapsed, lowercased text, so two OCR/caption reads
    that differ only in case or incidental spacing still compare as
    identical. Returns "" for None/blank input, never raises."""
    return " ".join((text or "").strip().lower().split())


def _text_similarity(a: Optional[str], b: Optional[str]) -> float:
    """Caption Similarity / OCR Similarity signal: a 0.0-1.0
    difflib.SequenceMatcher ratio over the normalized text. Either
    side blank always yields 0.0 — two candidates with no caption (or
    no OCR text) are never treated as matching *because* of that
    absence; the absence just means this particular signal contributes
    nothing to the decision."""
    norm_a = _normalize_text_for_similarity(a)
    norm_b = _normalize_text_for_similarity(b)
    if not norm_a or not norm_b:
        return 0.0
    return SequenceMatcher(None, norm_a, norm_b).ratio()


def _bbox_iou(
    a: tuple[float, float, float, float],
    b: tuple[float, float, float, float],
) -> float:
    """IoU signal: intersection-over-union of two bboxes in the same
    coordinate space. Callers are responsible for only comparing
    bboxes that actually share a space (same page) — this function
    does no page check of its own."""
    a_x0, a_y0, a_x1, a_y1 = a
    b_x0, b_y0, b_x1, b_y1 = b

    inter_w = max(0.0, min(a_x1, b_x1) - max(a_x0, b_x0))
    inter_h = max(0.0, min(a_y1, b_y1) - max(a_y0, b_y0))
    intersection = inter_w * inter_h
    if intersection <= 0:
        return 0.0

    area_a = max(0.0, a_x1 - a_x0) * max(0.0, a_y1 - a_y0)
    area_b = max(0.0, b_x1 - b_x0) * max(0.0, b_y1 - b_y0)
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def _resolve_image_hash(candidate: "VisualCandidate") -> Optional[str]:
    """Hash signal, sourced without recomputing work Metadata Builder
    already did: reuse candidate.metadata["ncert_metadata"]["image_hash"]
    when present (the normal case — this stage runs after
    MetadataBuilder), falling back to computing it fresh off
    candidate.image so this stage still works standalone (e.g. in
    tests that build a DuplicateRemover without a MetadataBuilder
    ahead of it)."""
    ncert_metadata = candidate.metadata.get("ncert_metadata")
    if isinstance(ncert_metadata, dict) and ncert_metadata.get("image_hash"):
        return ncert_metadata["image_hash"]
    return _compute_image_hash(candidate.image)


@dataclass
class DuplicateSignals:
    """The four inputs one duplicate decision is made from, for a
    (candidate, kept-candidate) pair — recorded on the surviving
    candidate so a later review can see why something was dropped,
    the same way ValidationVerdict records Qwen's per-question
    answers."""
    hash_match: bool
    iou: float
    caption_similarity: float
    ocr_similarity: float

    def as_dict(self) -> dict:
        return {
            "hash_match": self.hash_match,
            "iou": round(self.iou, 4),
            "caption_similarity": round(self.caption_similarity, 4),
            "ocr_similarity": round(self.ocr_similarity, 4),
        }


def _compute_duplicate_signals(
    candidate: "VisualCandidate",
    other: "VisualCandidate",
) -> DuplicateSignals:
    """Computes all four signals for one pair. IoU is only meaningful
    between bboxes on the same page — a different page gets 0.0 rather
    than a geometrically meaningless cross-page overlap."""
    hash_a = _resolve_image_hash(candidate)
    hash_b = _resolve_image_hash(other)
    hash_match = hash_a is not None and hash_a == hash_b

    iou = _bbox_iou(candidate.bbox, other.bbox) if candidate.page == other.page else 0.0

    return DuplicateSignals(
        hash_match=hash_match,
        iou=iou,
        caption_similarity=_text_similarity(candidate.caption_text, other.caption_text),
        ocr_similarity=_text_similarity(candidate.ocr_text, other.ocr_text),
    )


@dataclass
class DuplicateRemovalConfig:
    """Thresholds the duplicate decision is made against. Centralized
    and injectable (like RegionBuilderConfig) rather than buried as
    magic numbers inside the matching logic.

    Three independent routes to "duplicate", checked in this order:
      - an exact Hash match is always a duplicate on its own,
        regardless of geometry or text.
      - same_page_iou_threshold + a text-similarity threshold: the
        same physical spot on the same page, extracted twice (e.g. by
        two overlapping region proposals), with a matching caption or
        OCR read confirming it's the same content rather than just
        coincidentally overlapping.
      - cross_page_text_threshold: no usable geometric overlap (a
        different page, or no overlap at all) but caption AND OCR text
        both read as near-identical — the same figure reused elsewhere
        in the book (e.g. a repeated safety symbol or reference
        chart). Requiring both keeps a single shared caption number
        from false-matching two unrelated figures.
    """
    same_page_iou_threshold: float = 0.75
    same_page_text_threshold: float = 0.85
    cross_page_text_threshold: float = 0.92


def _is_duplicate(signals: DuplicateSignals, config: DuplicateRemovalConfig) -> bool:
    if signals.hash_match:
        return True

    if signals.iou >= config.same_page_iou_threshold and (
        signals.caption_similarity >= config.same_page_text_threshold
        or signals.ocr_similarity >= config.same_page_text_threshold
    ):
        return True

    if (
        signals.caption_similarity >= config.cross_page_text_threshold
        and signals.ocr_similarity >= config.cross_page_text_threshold
    ):
        return True

    return False


class DuplicateRemover:
    """DocumentEnricher implementing the Duplicate Removal stage
    (Sprint 12).

    Walks candidates in document reading order (page number, then
    region order within the page) and keeps a running gallery of
    "kept" candidates. Each new candidate is compared — via IoU +
    Caption Similarity + OCR Similarity + Hash — against every kept
    candidate so far; the first match makes it a duplicate of that
    kept candidate, and it is dropped exactly like a Qwen rejection:
    candidate -> None, ok -> False, error -> "duplicate_of:<region_id>",
    so nothing downstream (Embeddings, Qdrant) ever sees it. The
    earliest-appearing candidate in a duplicate group is always the
    one kept; later ones never displace it, so re-running the pipeline
    on the same document keeps the same survivor every time.
    """

    def __init__(self, *, config: Optional[DuplicateRemovalConfig] = None) -> None:
        self.config = config or DuplicateRemovalConfig()

    def __call__(self, result: PipelineResult) -> PipelineResult:
        diagnostics.stage_start("Duplicate Removal")
        kept: list[VisualCandidate] = []
        received = 0
        removed = 0

        for page in result.pages:
            for region_result in page.region_results:
                candidate = region_result.candidate
                if candidate is None:
                    continue  # already dropped upstream — nothing to dedup

                print(f"[Candidate] Region={candidate.region_id}")
                print(f"    Type : {candidate.type}")
                print(f"    Image None : {candidate.image is None}")

                received += 1
                match = self._find_duplicate(candidate, kept)
                if match is not None:
                    original, signals = match
                    logger.info(
                        "Duplicate region_id=%s (page %d) matches region_id=%s "
                        "(page %d): %s",
                        candidate.region_id, candidate.page,
                        original.region_id, original.page, signals.as_dict(),
                    )
                    diagnostics.duplicate_result(
                        image_hash=signals.as_dict().get("hash_match"),
                        duplicate_found=True,
                        original_region=original.region_id,
                        removed_region=candidate.region_id,
                    )
                    diagnostics.drop(candidate.region_id, f"duplicate_of:{original.region_id}")
                    diagnostics.count("duplicate_removed")
                    removed += 1
                    region_result.ok = False
                    region_result.error = f"duplicate_of:{original.region_id}"
                    region_result.candidate = None
                    original.metadata.setdefault("duplicate_region_ids", [])
                    original.metadata["duplicate_region_ids"].append(candidate.region_id)
                    continue

                diagnostics.track(candidate.region_id, "Duplicate Removed = NO")
                kept.append(candidate)

        diagnostics.stage_end("Duplicate Removal")
        diagnostics.stage_stats(
            "Duplicate Removal",
            received=received,
            processed=len(kept),
            failed=removed,
        )
        return result

    def _find_duplicate(
        self,
        candidate: "VisualCandidate",
        kept: list["VisualCandidate"],
    ) -> Optional[tuple["VisualCandidate", DuplicateSignals]]:
        for original in kept:
            signals = _compute_duplicate_signals(candidate, original)
            if _is_duplicate(signals, self.config):
                return original, signals
        return None


# ============================================================
# NCERT CLASS 9 EMBEDDING GENERATION (Sprint 13)
#
# Runs after Duplicate Removal (Sprint 12) — every candidate reaching
# this stage is already accepted, deduplicated, and metadata-complete
# — and before Qdrant Upload. One high-quality 768-D embedding per
# accepted visual, built entirely from deterministic metadata:
#
#     VisualCandidate -> Metadata -> Search Text Builder ->
#     Text Normalization -> Embedding Model -> 768-D Vector ->
#     Store with Metadata
#
# "Metadata" here is Sprint 11's VisualMetadata.as_dict() payload
# (candidate.metadata["ncert_metadata"]), extended with Sprint 13's
# own `keywords` field — this stage builds no metadata of its own; it
# only turns already-resolved metadata into text, then into a vector.
# ============================================================

# --------------------------------------------------------
# Search Text Builder
#
# A structured, labeled document — not a flat concatenation — so the
# embedding captures which field a given piece of text came from
# (a caption reads differently from an OCR dump of the same words).
# Every section is optional: a candidate missing a field simply omits
# that section instead of embedding a placeholder like "Caption: None".
# --------------------------------------------------------
def _search_text_line(header: str, value: Any) -> list[str]:
    """One "Header: value" block, or nothing if the value is missing
    (None, "", or an explicit skip)."""
    if value is None or value == "":
        return []
    return [f"{header}: {value}"]


def _search_text_block(header: str, items: list[str]) -> list[str]:
    """One "Header:" line followed by each item on its own line, or
    nothing at all if there are no items to list."""
    items = [str(item).strip() for item in items if str(item).strip()]
    if not items:
        return []
    return [f"{header}:", *items]


def _build_structured_search_text(metadata: dict) -> str:
    """Search Text Builder step: the structured retrieval document —
    Class, Subject, Book, Chapter, Chapter Number, Page, Figure,
    Visual Type, Visual Subtype, Caption, Labels, OCR, Keywords — each
    its own clearly labeled block, blank-line separated.

    Takes the already-built metadata *payload*
    (VisualMetadata.as_dict() shape) rather than a VisualMetadata
    instance, so this function — and anything reading records back out
    of Qdrant for re-embedding later — depends only on that schema,
    not on the dataclass itself.
    """
    class_level = metadata.get("class")
    blocks: list[list[str]] = [[f"Class {class_level}" if class_level is not None else "Class"]]

    blocks += [b for b in (
        _search_text_line("Subject", metadata.get("subject")),
        _search_text_line("Book", metadata.get("book")),
        _search_text_line("Chapter", metadata.get("chapter")),
        _search_text_line("Chapter Number", metadata.get("chapter_number")),
        _search_text_line("Page", metadata.get("page")),
        _search_text_line("Figure", metadata.get("figure_number")),
        _search_text_line("Visual Type", (metadata.get("visual_type") or "").title() or None),
        _search_text_line("Visual Subtype", metadata.get("visual_subtype")),
    ) if b]

    caption = metadata.get("caption")
    if caption:
        blocks.append(["Caption:", str(caption)])

    labels_block = _search_text_block("Labels", metadata.get("labels") or [])
    if labels_block:
        blocks.append(labels_block)

    ocr_text = metadata.get("ocr_text")
    if ocr_text:
        ocr_lines = [line.strip() for line in str(ocr_text).splitlines() if line.strip()]
        if ocr_lines:
            blocks.append(["OCR:", *ocr_lines])

    keywords_block = _search_text_block("Keywords", metadata.get("keywords") or [])
    if keywords_block:
        blocks.append(keywords_block)

    return "\n\n".join("\n".join(block) for block in blocks)


# --------------------------------------------------------
# Text Normalization
#
# Whitespace cleanup only — never reworded, reordered, or
# case-changed, so the labeled structure the Search Text Builder
# produced (and its human readability) survives into what actually
# gets embedded.
# --------------------------------------------------------
def _normalize_search_text(text: str) -> str:
    lines = [re.sub(r"[ \t]+", " ", line).rstrip() for line in text.splitlines()]

    normalized_lines: list[str] = []
    blank_run = 0
    for line in lines:
        if line == "":
            blank_run += 1
            if blank_run > 1:
                continue  # collapse 3+ blank lines down to a single separator
        else:
            blank_run = 0
        normalized_lines.append(line)

    return "\n".join(normalized_lines).strip()


# --------------------------------------------------------
# Embedding Model
# --------------------------------------------------------
class EmbeddingBackend(Protocol):
    """The raw call EmbeddingBuilder wraps — Ollama's /api/embeddings,
    or a fake in tests. Returns the embedding vector for one piece of
    text."""
    def __call__(self, text: str) -> list[float]: ...


class OllamaEmbeddingBackend:
    """Default EmbeddingBackend. Talks to the same Ollama instance
    (OLLAMA_URL) already configured at the top of this file, using
    EMBEDDING_MODEL (default "nomic-embed-text", 768-dimensional —
    matches QDRANT_VECTOR_DIM). `requests` is imported lazily, inside
    __call__, so importing this module never requires it to already be
    installed — tests inject a fake EmbeddingBackend instead."""

    def __init__(
        self,
        *,
        base_url: str = OLLAMA_URL,
        model: str = EMBEDDING_MODEL,
        timeout: float = 180.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def __call__(self, text: str) -> list[float]:
        try:
            import requests
        except ImportError as exc:
            raise RuntimeError(
                "requests is not installed (`pip install requests`). "
                "Either install it, or inject a backend= for testing."
            ) from exc

        print("\n" + "=" * 80)
        print("OLLAMA REQUEST")
        print("=" * 80)
        print("Base URL :", self.base_url)
        print("Model    :", self.model)
        print("Timeout  :", self.timeout)
        print("\n" + "=" * 80)
        print("OLLAMA REQUEST")
        print("=" * 80)
        print("Base URL :", self.base_url)
        print("Model    :", self.model)
        print("Timeout  :", self.timeout)
        print("Endpoint :", f"{self.base_url}/api/embeddings")
        print("=" * 80)


        response = requests.post(
            f"{self.base_url}/api/embeddings",
            json={"model": self.model, "prompt": text},
            timeout=self.timeout,
        )
        response.raise_for_status()
        embedding = response.json().get("embedding")
        if not embedding:
            raise RuntimeError(f"Ollama returned no embedding for model={self.model!r}")
        return embedding


# --------------------------------------------------------
# Store with Metadata
# --------------------------------------------------------
@dataclass
class EmbeddingRecord:
    """What Duplicate Removal's successor, Qdrant Upload, consumes
    as-is for one accepted visual: the vector, the metadata payload it
    was built from, the exact (normalized) text that was embedded, and
    where the crop itself lives on disk."""
    id: str
    embedding: list[float]
    metadata: dict
    search_text: str
    image_path: str

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "embedding": self.embedding,
            "metadata": self.metadata,
            "search_text": self.search_text,
            "image_path": self.image_path,
        }


class EmbeddingBuilder:
    """DocumentEnricher implementing the Embedding Generation stage
    (Sprint 13).

    Runs after Duplicate Removal, once per still-accepted
    VisualCandidate: Search Text Builder -> Text Normalization ->
    Embedding Model -> EmbeddingRecord, attached to
    candidate.metadata["qdrant_record"] for Qdrant Upload to read
    directly. A candidate that reached this stage without
    metadata["ncert_metadata"] (Metadata Builder didn't run, or ran
    and this candidate was somehow skipped) is left alone and logged
    — there's no metadata to build a search document from. A backend
    call that fails is treated like an extraction failure: the
    candidate is dropped (candidate -> None, ok -> False, error ->
    "embedding_failed:<reason>") rather than forwarded to Qdrant
    Upload without a vector.
    """

    def __init__(
        self,
        *,
        backend: Optional[EmbeddingBackend] = None,
        expected_dim: int = QDRANT_VECTOR_DIM,
    ) -> None:
        self.backend: EmbeddingBackend = backend or OllamaEmbeddingBackend()
        self.expected_dim = expected_dim

    def __call__(self, result: PipelineResult) -> PipelineResult:
        diagnostics.stage_start("Embedding Builder")
        received = 0
        processed = 0
        failed = 0
        skipped = 0

        for page in result.pages:
            for region_result in page.region_results:
                candidate = region_result.candidate
                if candidate is None:
                    continue  # already dropped upstream — nothing to embed

                print(f"[Candidate] Region={candidate.region_id}")
                print(f"    Type : {candidate.type}")
                print(f"    Image None : {candidate.image is None}")

                metadata = candidate.metadata.get("ncert_metadata")
                if not isinstance(metadata, dict):
                    logger.warning(
                        "region_id=%s (page %d) has no ncert_metadata — "
                        "skipping embedding (run MetadataBuilder first).",
                        candidate.region_id, candidate.page,
                    )
                    skipped += 1
                    continue

                received += 1
                record = self.build_record(candidate, metadata)
                if record is None:
                    failed += 1
                    diagnostics.drop(candidate.region_id, "embedding_failed")
                    region_result.ok = False
                    region_result.error = "embedding_failed"
                    region_result.candidate = None
                    continue

                candidate.metadata["qdrant_record"] = record.as_dict()
                processed += 1
                diagnostics.count("embeddings")
                diagnostics.track(candidate.region_id, "Embedding Generated")

        diagnostics.stage_end("Embedding Builder")
        diagnostics.stage_stats(
            "Embedding Builder",
            received=received,
            processed=processed,
            failed=failed,
            skipped=skipped,
        )
        return result

    def build_record(
        self,
        candidate: "VisualCandidate",
        metadata: dict,
    ) -> Optional[EmbeddingRecord]:
        search_text = _normalize_search_text(_build_structured_search_text(metadata))

        embed_start = time.perf_counter()
        try:
            embedding = self.backend(search_text)
        except Exception as exc:  # backend failures must not kill the document
            logger.exception(
                "Embedding call failed for region_id=%s (page %d)",
                candidate.region_id, candidate.page,
            )
            diagnostics.embedding_result(success=False, reason=str(exc))
            return None
        embed_time = time.perf_counter() - embed_start

        if self.expected_dim and len(embedding) != self.expected_dim:
            logger.warning(
                "region_id=%s: embedding has %d dims, expected %d "
                "(EMBEDDING_MODEL=%r) — storing it anyway.",
                candidate.region_id, len(embedding), self.expected_dim, EMBEDDING_MODEL,
            )

        diagnostics.embedding_result(success=True, dimension=len(embedding), time_sec=embed_time)

        return EmbeddingRecord(
            id=metadata.get("id", candidate.region_id),
            embedding=embedding,
            metadata=metadata,
            search_text=search_text,
            image_path=metadata.get("crop_path", ""),
        )


def default_document_enrichers(
    *,
    qwen_backend: Optional["QwenVisionBackend"] = None,
    write_crops: bool = True,
    duplicate_config: Optional[DuplicateRemovalConfig] = None,
    embedding_backend: Optional["EmbeddingBackend"] = None,
    vision_runtime: Optional[VisionRuntime] = None,
) -> list["DocumentEnricher"]:
    """Document enrichers implemented so far, ready to hand to
    DocumentProcessor(document_enrichers=default_document_enrichers()).
    Mirrors default_page_enrichers() / default_region_extractors() —
    kept as a factory rather than DocumentProcessor's own default, so
    existing callers relying on the current `[_noop_document_enricher]`
    default aren't changed by adding a new stage here. Order matches
    the architecture diagram: Qwen Validation runs first (so rejected
    candidates never reach the Metadata Builder), then Metadata, then
    Duplicate Removal (needs Metadata's image hash and every
    candidate's resolved caption/OCR text to already be in place),
    then Embedding Generation (needs Duplicate Removal to have already
    dropped repeats, so the corpus handed to Qdrant Upload isn't
    embedded twice for the same figure).
    """
    return [
        QwenValidator(backend=qwen_backend, runtime=vision_runtime),
        MetadataBuilder(write_crops=write_crops),
        DuplicateRemover(config=duplicate_config),
        EmbeddingBuilder(backend=embedding_backend),
    ]


# ============================================================
# QDRANT UPLOAD (Sprint 14)
#
# Runs after Embedding Generation (Sprint 13) — a ResultStore, not a
# DocumentEnricher, so it runs where DocumentProcessor already calls
# out to storage (save_results(), after every document enricher).
#
# Stores exactly four things per accepted visual, nothing else:
#
#     Embedding    -> the point's vector
#     Metadata     -> the point's payload["metadata"]
#     Image        -> the point's payload["image"] (crop_path)
#     Search Text  -> the point's payload["search_text"]
#
# Reads candidate.metadata["qdrant_record"] verbatim (built by
# EmbeddingBuilder) — this stage computes nothing of its own, it only
# shapes that record into a Qdrant point and upserts it.
# ============================================================

def _qdrant_point_id(candidate_id: str) -> str:
    """Qdrant point ids must be an unsigned integer or a UUID —
    region_id ("region_<hash>") is neither. uuid5 over the region_id
    gives a deterministic UUID: the same region_id always maps to the
    same point id, so re-running the pipeline on the same document
    upserts (overwrites) the same points rather than duplicating
    them."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, candidate_id))


class QdrantResultStore:

    """ResultStore implementing the Qdrant Upload stage (Sprint 14).

    For every candidate with an attached qdrant_record (i.e. it
    survived Qwen Validation, Duplicate Removal, and got a real
    embedding from EmbeddingBuilder), upserts one point:

        id      -> deterministic UUID derived from the record's id
        vector  -> record["embedding"]
        payload -> {"metadata": ..., "image": ..., "search_text": ...}

    A candidate with no qdrant_record (EmbeddingBuilder hasn't run, or
    skipped it) is logged and left out of the upload — nothing partial
    is ever stored. `client` is injectable so tests exercise this
    without a real Qdrant instance; the default lazily imports
    qdrant_client so importing this module never requires it to
    already be installed.
    """

    def __init__(
        self,
        *,
        client: Optional[Any] = None,
        url: str = QDRANT_URL,
        collection: str = IMAGE_COLLECTION,
        vector_dim: int = QDRANT_VECTOR_DIM,
    ) -> None:
        self.client = client or self._default_client(url)
        self.collection = collection
        self.vector_dim = vector_dim

    @staticmethod
    def _default_client(url: str) -> Any:
        try:
            from qdrant_client import QdrantClient
        except ImportError as exc:
            raise RuntimeError(
                "qdrant_client is not installed (`pip install qdrant-client`). "
                "Either install it, or inject a client= for testing."
            ) from exc
        return QdrantClient(
            url=url,
            timeout=300,
        )

    def __call__(self, result: PipelineResult) -> int:
        diagnostics.stage_start("Qdrant Upload")
        points = list(self._iter_points(result))

        if not points:
            diagnostics.stage_end("Qdrant Upload")
            diagnostics.stage_stats("Qdrant Upload", received=0, processed=0)
            return 0

        diagnostics.qdrant_upload_start(len(points), self.collection)
        try:
            self._ensure_collection()

            print("=" * 80)
            print("POINT COUNT:", len(points))
            print("FIRST ID:", points[0].id)
            print("VECTOR LEN:", len(points[0].vector))
            print("PAYLOAD KEYS:", points[0].payload.keys())
            print("=" * 80)
            self.client.upsert(collection_name=self.collection, points=points)
        except Exception:
            diagnostics.qdrant_upload_result(uploaded=0, failed=len(points))
            diagnostics.stage_end("Qdrant Upload")
            raise

        diagnostics.qdrant_upload_result(uploaded=len(points), failed=0)
        diagnostics.count("qdrant_uploaded", len(points))
        diagnostics.stage_end("Qdrant Upload")
        diagnostics.stage_stats("Qdrant Upload", received=len(points), processed=len(points))
        return len(points)

    @staticmethod
    def _iter_points(result: PipelineResult) -> Any:
        from qdrant_client.models import PointStruct

        for page in result.pages:
            for region_result in page.region_results:
                candidate = region_result.candidate
                if candidate is None:
                    continue  # already dropped upstream — nothing to upload

                print(f"[Candidate] Region={candidate.region_id}")
                print(f"    Type : {candidate.type}")
                print(f"    Image None : {candidate.image is None}")

                record = candidate.metadata.get("qdrant_record")
                if not isinstance(record, dict):
                    logger.warning(
                        "region_id=%s (page %d) has no qdrant_record — "
                        "skipping upload (run EmbeddingBuilder first).",
                        candidate.region_id, candidate.page,
                    )
                    continue

                # Sprint 18 — Part 12: Qdrant stores only metadata and
                # the storage object key, never the asset itself.
                # `storage` is attached by _upload_visual() in
                # MetadataBuilder; a candidate whose local storage
                # write never happened simply has no such key, and the
                # point is upserted without it exactly as before this
                # sprint.
                storage_info = candidate.metadata.get("storage") or {}
                payload = {
                    "metadata": record["metadata"],
                    "image": record["image_path"],
                    "search_text": record["search_text"],
                }

                import json

                print("Payload size:", len(json.dumps(payload)))
                if storage_info.get("storage_key"):
                    payload["storage_key"] = storage_info["storage_key"]
                if storage_info.get("public_url"):
                    payload["public_url"] = storage_info["public_url"]

                yield PointStruct(
                    id=_qdrant_point_id(record["id"]),
                    vector=record["embedding"],
                    payload=payload,
                )

    def _ensure_collection(self) -> None:
        from qdrant_client.models import Distance, VectorParams

        print("=" * 80)
        print("Collection:", self.collection)
        print("Exists:", self.client.collection_exists(self.collection))
        print("=" * 80)

        if self.client.collection_exists(self.collection):
            return

        print("CREATING COLLECTION")

        self.client.create_collection(
            collection_name=self.collection,
            vectors_config=VectorParams(
                size=self.vector_dim,
                distance=Distance.COSINE,
            ),
        )


def default_result_store(
    *,
    client: Optional[Any] = None,
    collection: str = IMAGE_COLLECTION,
) -> "ResultStore":
    """Mirrors default_document_enrichers() / default_page_enrichers():
    a factory rather than DocumentProcessor's own default, so existing
    callers relying on `_noop_store` aren't changed by this stage
    existing. Ready to hand to
    DocumentProcessor(result_store=default_result_store())."""
    return QdrantResultStore(client=client, collection=collection)


# ============================================================
# NO-OP DEFAULTS
#
# Stages not yet implemented in this sprint fall back to these so the
# orchestrator runs end-to-end today. They contain zero heuristics —
# they simply pass their input through unchanged.
# ============================================================

def _noop_page_enricher(page_result: PageResult, rendered: RenderedPage, **context: Any) -> PageResult:
    return page_result


def _noop_document_enricher(result: PipelineResult) -> PipelineResult:
    return result


def _noop_store(result: PipelineResult) -> int:
    logger.warning(
        "No ResultStore configured — %d page(s) processed but not persisted.",
        len(result.pages),
    )
    return 0


# ============================================================
# ORCHESTRATOR
# ============================================================

class DocumentProcessor:
    """Sequences the pipeline stages. Contains no extraction logic,
    no layout heuristics, and no acceptance policy of its own — it
    only calls the stage it was configured with and passes results
    along to the next stage.
    """

    def __init__(
        self,
        *,
        page_renderer: Optional[PageRenderer] = None,
        region_detector: RegionDetector,
        region_extractors: dict[str, RegionExtractor],
        page_enrichers: Optional[list[PageEnricher]] = None,
        document_enrichers: Optional[list[DocumentEnricher]] = None,
        result_store: Optional[ResultStore] = None,
        dpi: int = PAGE_RENDER_DPI,
        debug_images_enabled: bool = DEBUG_IMAGES_ENABLED,
    ) -> None:
        self.dpi = dpi
        self.debug_images_enabled = debug_images_enabled

        # Sprint 2: Page Rendering is real, not a stub. Still
        # overridable (e.g. in tests) via the page_renderer argument.
        self.page_renderer: PageRenderer = page_renderer or (
            lambda page, page_number: render_page(page, page_number, dpi=self.dpi)
        )

        self.region_detector = region_detector
        self.region_extractors = region_extractors

        # PaddleOCR, Caption Association, etc. — run in order, per page.
        self.page_enrichers: list[PageEnricher] = page_enrichers or [_noop_page_enricher]

        # Qwen Validation, Metadata, Duplicate Removal, Embeddings,
        # Pass2 Enrichment — run in order, on the whole document.
        self.document_enrichers: list[DocumentEnricher] = document_enrichers or [_noop_document_enricher]

        self.result_store: ResultStore = result_store or _noop_store

        # Sprint 11: how many points the last save_results() call
        # actually persisted — not part of PipelineResult itself (that
        # would change process_pdf's return type), just a side channel
        # the execution layer's summary report reads after each call.
        self.last_store_count: int = 0

    # --------------------------------------------------------
    # Load PDF -> ... -> Collect Results -> Store Results
    # --------------------------------------------------------
    def process_pdf(
        self,
        pdf_path: Path,
        *,
        on_page: Optional[Callable[[int, int, PageResult], None]] = None,
        document_context: Optional["DocumentContext"] = None,
        start_page: int = 1,
        resume_pages: Optional[list[PageResult]] = None,
        should_pause: Optional[Callable[[], bool]] = None,
        **context: Any,
    ) -> PipelineResult:
        """Top-level entry point: one PDF in, one PipelineResult out.

        `on_page`, if given, is called after every page finishes (with
        page_number, total_pages, and that page's PageResult) — purely
        a progress-reporting hook (Sprint 11 Part 7), never consulted
        for control flow. A single page failing (corrupt page, a
        detector blowing up, ...) is caught here and recorded on that
        page's PageResult rather than aborting the rest of the
        document (Sprint 11 Part 8) — one bad page never costs the
        other pages in the same book.

        `document_context`, if given, is used as-is instead of running
        Subject/Chapter Detection against pdf_path's on-disk location —
        for admin-triggered single-chapter processing
        (image_ingestion_tasks.py), where the real subject/chapter/board/
        class come from Node's own chapter record, not a
        knowledge_base/<Subject>/<chapter folder>/ directory layout the
        uploaded file was never placed under. MetadataBuilder (a
        document_enricher below) independently prefers the same injected
        context via PipelineResult.context["document_context"], so both
        stages agree on one real chapter identity rather than each
        guessing separately.

        `start_page`/`resume_pages`/`should_pause` — checkpointed
        pause/resume for admin-triggered image ingestion (a single real
        page can be a multi-second vision call, so a 20-60 page chapter
        is genuinely worth being able to interrupt). `resume_pages` seeds
        the result with a prior paused run's already-extracted
        PageResults (real region/candidate data — see image_ingestion_
        tasks.py's checkpoint file) and `start_page` skips re-processing
        those page numbers; `should_pause`, if given, is polled after
        every page and — if it returns True — stops the loop early and
        returns immediately with `context["paused"] = True`, before any
        of the document-level stages (Qwen Validation, Metadata,
        Duplicate Removal, Embeddings, Qdrant Upload) run. Those stages
        only ever run once, on the complete `pages` list, so a paused
        return deliberately skips them rather than partially applying
        them to an incomplete document.
        """
        pdf_path = Path(pdf_path)
        start = time.perf_counter()
        logger.info("Opening %s", pdf_path)
        diagnostics.begin_document()

        # Sprint 17 — Part 1 & 6: chapter workspace + its log file exist
        # before anything else touches disk for this book. `context`
        # already flows into process_page -> dispatch_region ->
        # finalize_page via **context (unchanged plumbing) and into
        # PipelineResult.context for the document_enrichers below, so
        # threading the workspace through here is the only wiring
        # needed for every other stage to reach it.
        # Sprint 18: Subject/Chapter Detection run once here (same
        # detection Sprint 4/11 already implement, just called a page
        # earlier than before) so the chapter's storage hierarchy is
        # known before the workspace — and therefore the original PDF
        # upload below — is created.
        doc_context = document_context or build_document_context(pdf_path, detect_subject(pdf_path), detect_chapter(pdf_path))
        workspace = build_chapter_workspace(pdf_path, context=doc_context)
        log_handler, log_buffer = _attach_chapter_log_handler(workspace)
        context = dict(context)
        context["chapter_workspace"] = workspace
        context["document_context"] = doc_context
        context["debug_images_enabled"] = self.debug_images_enabled

        storage = _get_storage()
        if storage is not None:
            _upload_original_pdf(pdf_path, workspace, storage)

        try:
            document = fitz.open(pdf_path)
            paused_at_page = None
            try:
                total_pages = document.page_count
                # Seeded with a prior paused run's already-extracted pages
                # (real region/candidate data, not just a count) so a
                # resumed call never re-pays the vision/OCR cost for pages
                # already done — see resume_pages' docstring on this
                # method's signature.
                pages: list[PageResult] = list(resume_pages) if resume_pages else []
                for page_number, page in enumerate(document, start=1):
                    if page_number < start_page:
                        continue
                    try:
                        page_result = self.process_page(document, page, page_number, **context)
                    except Exception as exc:  # a corrupt page / detector failure must not kill the document
                        logger.exception(
                            "Page %d of %s failed outright — skipping it, continuing the document.",
                            page_number, pdf_path,
                        )
                        page_result = PageResult(page_number=page_number, region_results=[], error=str(exc))

                    pages.append(page_result)
                    if on_page is not None:
                        on_page(page_number, total_pages, page_result)

                    # Checked after each page (not just once at the end) so
                    # a pause request lands within one page's processing
                    # time, not after the whole remaining document. Never
                    # on the last page — nothing left to save progress on,
                    # just let the normal completion path run.
                    if should_pause is not None and page_number < total_pages and should_pause():
                        paused_at_page = page_number
                        break
            finally:
                document.close()

            if paused_at_page is not None:
                # Deliberately returns here, before any of the
                # document-level stages below (Qwen Validation, Metadata,
                # Duplicate Removal, Embeddings, Qdrant Upload) ever run —
                # those all operate on the FULL `pages` list once, at the
                # end, and nothing in this pipeline persists per-page
                # incrementally (see this method's own docstring). The
                # caller (image_ingestion_tasks.py) is responsible for
                # checkpointing `pages` to disk so a future resume call
                # can pass it back in as resume_pages.
                paused_result = PipelineResult(pdf_path=pdf_path, pages=pages, context=context)
                paused_result.context["paused"] = True
                return paused_result

            result = PipelineResult(pdf_path=pdf_path, pages=pages, context=context)

            # Document-level stages: Qwen Validation, Metadata, Duplicate
            # Removal, Embeddings, Pass2 Enrichment. One stage failing
            # outright (e.g. the embedding backend is unreachable for the
            # whole call) must not lose the work already done by the
            # stages before it — skip it, keep the result as-is, move on.
            for enrich in self.document_enrichers:
                try:
                    result = enrich(result)
                except Exception:
                    logger.exception(
                        "Document enricher %r failed on %s — leaving results as-is, continuing.",
                        getattr(enrich, "__class__", enrich), pdf_path,
                    )

            try:
                self.save_results(result)
            except Exception:
                logger.exception("Storing results for %s failed — continuing with the next document.", pdf_path)

            # Sprint 18 — Part 10: chapter-level metadata, uploaded
            # once the document enrichers (Metadata Builder, Duplicate
            # Removal, Embeddings, Qdrant Upload) have all already run
            # — every count below is read from diagnostics, never
            # recomputed. A candidate's own per-visual metadata already
            # went up per-page (MetadataBuilder); this is the
            # chapter-wide summary sitting alongside it.
            if storage is not None:
                _upload_chapter_metadata(workspace, storage, {
                    "class": doc_context.class_no,
                    "board": doc_context.board,
                    "publisher": doc_context.publisher,
                    "subject": doc_context.subject,
                    "chapter_no": doc_context.chapter_no,
                    "chapter_name": doc_context.chapter_name,
                    "source_pdf": pdf_path.name,
                    "pages": len(pages),
                    "visuals_uploaded": diagnostics.get_count("storage_visuals_uploaded"),
                    "pipeline_version": PIPELINE_VERSION,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                _upload_embeddings(workspace, storage, {
                    "chapter_name": doc_context.chapter_name,
                    "embedding_model": EMBEDDING_MODEL,
                    "records": _collect_embedding_records(result),
                })

            # Pass2 Enrichment has no dedicated implementation yet (see the
            # architecture diagram at the top of this file) — there is no
            # stage to instrument here. Diagnostics reports it as equal to
            # the Qdrant upload count, the same "not yet a real stage"
            # placeholder the rest of the pipeline already treats it as.
            pass2_enriched = diagnostics.get_count("qdrant_uploaded")

            pipeline_time = time.perf_counter() - start
            diagnostics.final_report(
                **{
                    "PDF": pdf_path.name,
                    "Pages": len(pages),
                    "Detected Regions": diagnostics.get_count("detected"),
                    "Extracted": diagnostics.get_count("extracted"),
                    "OCR Success": diagnostics.get_count("ocr_success"),
                    "Caption Success": diagnostics.get_count("caption_success"),
                    "Qwen Accepted": diagnostics.get_count("qwen_accepted"),
                    "Metadata Generated": diagnostics.get_count("metadata_generated"),
                    "Images Saved": diagnostics.get_count("images_saved"),
                    "Duplicate Removed": diagnostics.get_count("duplicate_removed"),
                    "Embeddings": diagnostics.get_count("embeddings"),
                    "Qdrant Uploaded": diagnostics.get_count("qdrant_uploaded"),
                    "Pass2 Enriched": pass2_enriched,
                    "Pipeline Time": f"{pipeline_time:.1f} sec",
                }
            )

            # Sprint 17 — Part 8: End-of-Chapter Summary.
            diagnostics.chapter_workspace_summary(
                chapter=workspace.chapter_name,
                workspace=workspace.chapter_prefix,
                extracted=diagnostics.get_count("workspace_extracted"),
                accepted=diagnostics.get_count("workspace_accepted"),
                rejected=diagnostics.get_count("workspace_rejected"),
                metadata_files=diagnostics.get_count("workspace_metadata_files"),
                debug_images=diagnostics.get_count("workspace_debug_images"),
                elapsed_seconds=pipeline_time,
            )

            # Sprint 18 — Part 10: processing_report.json, the same
            # numbers just printed above (and in final_report), kept
            # as a durable local-storage-side record of this run.
            if storage is not None:
                _upload_processing_report(workspace, storage, {
                    "source_pdf": pdf_path.name,
                    "pages": len(pages),
                    "detected_regions": diagnostics.get_count("detected"),
                    "extracted": diagnostics.get_count("extracted"),
                    "qwen_accepted": diagnostics.get_count("qwen_accepted"),
                    "metadata_generated": diagnostics.get_count("metadata_generated"),
                    "duplicate_removed": diagnostics.get_count("duplicate_removed"),
                    "embeddings": diagnostics.get_count("embeddings"),
                    "qdrant_uploaded": diagnostics.get_count("qdrant_uploaded"),
                    "storage_visuals_uploaded": diagnostics.get_count("storage_visuals_uploaded"),
                    "storage_page_images_uploaded": diagnostics.get_count("storage_page_images_uploaded"),
                    "pipeline_time_seconds": round(pipeline_time, 1),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })

            logger.info(
                "Finished %s in %.3fs (%d page(s))",
                pdf_path, pipeline_time, len(pages),
            )
            diagnostics.storage_event(
                "Processing Completed",
                key=f"{workspace.chapter_prefix} ({pdf_path.name})",
            )
            return result
        finally:
            _detach_and_upload_chapter_log(log_handler, log_buffer, workspace, storage)

    # --------------------------------------------------------
    # Render Pages -> Call DocLayout -> Receive Regions -> Dispatch
    # --------------------------------------------------------
    def process_page(
        self,
        document: fitz.Document,
        page: fitz.Page,
        page_number: int,
        **context: Any,
    ) -> PageResult:
        rendered = self.page_renderer(page, page_number)
        regions = self.region_detector(rendered)

        # Sprint 19 — Part 2/3: no ad-hoc local pages/page_<NNN>/
        # directory is ever created. The already-rendered page image
        # (Page Rendering's own output, untouched) goes straight to
        # local storage at rendered_page_key().
        workspace = context.get("chapter_workspace")
        storage = _get_storage() if workspace is not None else None
        if workspace is not None and storage is not None:
            _upload_page_image(rendered, workspace, storage, page_number)

        # Sprint 17 — Part 5 / Sprint 19 — Part 3: optional debug dump
        # of Layout Detection's own output onto Page Rendering's own
        # output, uploaded straight to local storage — no separate
        # local debug/ folder.
        if context.get("debug_images_enabled") and workspace is not None:
            _upload_debug_page_image(rendered, regions, workspace, storage, page_number)

        diagnostics.stage_start("Graph / Diagram / Table Extraction")
        region_results = [
            self.dispatch_region(region, rendered, **context)
            for region in regions
        ]
        diagnostics.stage_end("Graph / Diagram / Table Extraction")
        extracted = sum(1 for r in region_results if r.ok and r.candidate is not None)
        diagnostics.stage_stats(
            "Graph / Diagram / Table Extraction",
            received=len(regions),
            processed=len(region_results),
            saved=extracted,
            failed=len(region_results) - extracted,
        )

        return self.finalize_page(page_number, region_results, rendered, **context)

    # --------------------------------------------------------
    # Dispatch Regions
    # --------------------------------------------------------
    def dispatch_region(
        self,
        region: EducationalRegion,
        rendered: RenderedPage,
        **context: Any,
    ) -> RegionResult:
        """Route a single detected region to its extractor. This is a
        lookup, not a heuristic — the classification decision itself
        was already made upstream by Educational Region Detection."""
        extractor = self.region_extractors.get(region.type)

        if extractor is None:
            logger.warning(
                "No extractor registered for type=%r (page %d) — skipping.",
                region.type, region.page,
            )
            diagnostics.drop(region.region_id, f"no_extractor_registered:{region.type}")
            return RegionResult(region=region, ok=False, error="no_extractor_registered")

        try:
            result = extractor(region, rendered, **context)
        except Exception as exc:  # extractor failures must not kill the page
            logger.exception(
                "Extractor for type=%r failed on page %d",
                region.type, region.page,
            )
            diagnostics.drop(region.region_id, f"extractor_failed:{exc}")
            return RegionResult(region=region, ok=False, error=str(exc))

        if result.ok and result.candidate is not None:
            diagnostics.count("extracted")
            diagnostics.track(region.region_id, "Extracted")
            # Sprint 25: parked in extracted/ here, before this
            # candidate ever reaches a page_enricher (OCR, Caption
            # Association) — a pure storage side effect of the
            # extraction that already succeeded, not a change to
            # extraction itself. This is a *temporary* home, not the
            # visual's final page_<NNN>/ key — see
            # _upload_temp_extracted_visual's docstring. Written
            # straight through LocalImageStorage.
            workspace = context.get("chapter_workspace")
            if workspace is not None:
                storage = _get_storage()
                _upload_temp_extracted_visual(result.candidate, workspace, storage)
        else:
            diagnostics.drop(region.region_id, result.error or "extraction_failed")

        return result

    # --------------------------------------------------------
    # Collect Results (per page)
    # --------------------------------------------------------
    def finalize_page(
        self,
        page_number: int,
        region_results: list[RegionResult],
        rendered: RenderedPage,
        **context: Any,
    ) -> PageResult:
        page_result = PageResult(page_number=page_number, region_results=region_results)

        # Page-level stages: PaddleOCR, Caption Association. A single
        # enricher failing (e.g. an OCR call) must not lose the
        # extraction work already sitting in region_results — skip
        # that enricher for this page and keep going.
        for enrich in self.page_enrichers:
            try:
                page_result = enrich(page_result, rendered, **context)
            except Exception:
                logger.exception(
                    "Page enricher %r failed on page %d — leaving page results as-is, continuing.",
                    getattr(enrich, "__class__", enrich), page_number,
                )

        return page_result

    # --------------------------------------------------------
    # Store Results
    # --------------------------------------------------------
    def save_results(self, result: PipelineResult) -> int:
        count = self.result_store(result)
        self.last_store_count = count
        return count


# ============================================================
# SPRINT 11 — PIPELINE EXECUTION & ORCHESTRATION
#
# Everything above this point is a library: data contracts, stage
# protocols, concrete stage implementations, and DocumentProcessor,
# the pure orchestrator that sequences them. None of it runs on its
# own. This section is the execution layer that turns that library
# into `python -m scripts.ingest_textbook_images`:
#
#     Load Config -> Initialize Services -> Discover PDFs ->
#     Build Queue -> Process PDF (per document) -> Progress Reporting
#     -> Generate Report
#
# No extraction logic lives here — only configuration, discovery,
# wiring (dependency injection into DocumentProcessor), the batch
# loop, console progress, and the summary report.
# ============================================================

# --------------------------------------------------------
# Part 2 — Configuration Loader
# --------------------------------------------------------

@dataclass
class PipelineConfig:
    """Every setting the execution layer needs, gathered into one
    object instead of scattered `os.getenv()` calls at each call site.
    Values themselves are still sourced from the same module-level
    constants every stage above already reads (KNOWLEDGE_BASE_DIR,
    OLLAMA_URL, ...) — this doesn't redefine them, it just gives the
    runtime entry point one thing to load and validate."""
    knowledge_base_dir: Path = KNOWLEDGE_BASE_DIR
    ollama_url: str = OLLAMA_URL
    vision_model: str = VISION_MODEL
    vision_runtime_mode: str = VISION_RUNTIME
    embedding_model: str = EMBEDDING_MODEL
    qdrant_url: str = QDRANT_URL
    collection_name: str = IMAGE_COLLECTION
    render_dpi: int = PAGE_RENDER_DPI
    doclayout_weights_path: Optional[str] = DOCLAYOUT_WEIGHTS_PATH
    doclayout_device: str = DOCLAYOUT_DEVICE
    debug_images_enabled: bool = DEBUG_IMAGES_ENABLED

    def validate(self) -> None:
        """Fail fast, before a single PDF is opened, on anything that
        would otherwise surface as a confusing error many pages into a
        run."""
        problems: list[str] = []

        if not self.knowledge_base_dir.exists():
            problems.append(
                f"Knowledge Base Directory does not exist: {self.knowledge_base_dir} "
                "(set KNOWLEDGE_BASE_DIR)"
            )
        if not self.ollama_url:
            problems.append("Ollama URL is empty (set OLLAMA_HOST)")
        if not self.vision_model:
            problems.append("Vision Model is empty (set VISION_MODEL)")
        if not self.embedding_model:
            problems.append("Embedding Model is empty (set EMBEDDING_MODEL)")
        if not self.qdrant_url:
            problems.append("Qdrant URL is empty (set QDRANT_URL)")
        if not self.collection_name:
            problems.append("Collection Name is empty (set IMAGE_COLLECTION)")
        if self.render_dpi <= 0:
            problems.append(f"Render DPI must be positive, got {self.render_dpi} (set PAGE_RENDER_DPI)")
        if not self.doclayout_weights_path:
            problems.append(
                "DocLayout-YOLO weights path is not set (set DOCLAYOUT_WEIGHTS_PATH) — "
                "Layout Detection cannot run without it"
            )

        if problems:
            raise ValueError("Invalid pipeline configuration:\n  - " + "\n  - ".join(problems))

        # Sprint 19 — Part 2: no ad-hoc local media/ directory exists
        # anymore, so there is nothing left to create here. Local
        # storage is validated and connected separately, at startup
        # (_init_storage_at_startup).


def load_config() -> PipelineConfig:
    """Part 2 — Configuration Loader. Reads every setting the pipeline
    needs, then validates it before anything else happens."""
    config = PipelineConfig()
    config.validate()
    return config


# --------------------------------------------------------
# Part 3 — PDF Discovery
# --------------------------------------------------------

SUPPORTED_PDF_SUFFIXES = frozenset({".pdf"})


def discover_textbooks(base_dir: Path) -> list[Path]:
    """Recursively scan `base_dir` for PDFs, ignore anything else, and
    return them in a deterministic (sorted, by path) order so re-runs
    always process the same documents in the same sequence."""
    pdf_paths = [
        path for path in base_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_PDF_SUFFIXES
    ]
    pdf_paths.sort(key=lambda path: str(path).lower())
    return pdf_paths


# --------------------------------------------------------
# Part 4 — Document Queue
# --------------------------------------------------------

@dataclass
class QueuedDocument:
    """One entry in the processing queue: everything about a
    discovered PDF that's known before it's ever opened.

    Sprint 19 — Part 2: no ad-hoc local media/ directory exists
    anymore, so there is no per-document output_dir to precompute
    here — every generated asset's home is a local storage object key,
    derived later from a ChapterWorkspace built with this document's
    DocumentContext (see DocumentProcessor.process_pdf)."""
    path: Path
    subject: str
    chapter: Optional[str]
    filename: str


def build_document_queue(pdf_paths: list[Path]) -> list[QueuedDocument]:
    """Part 4 — Document Queue. Reuses Subject/Chapter Detection
    (already implemented for the Metadata Builder, Sprint 11) so a
    document's queue entry and its eventual metadata always agree —
    detection isn't done twice, once loosely here and once precisely
    later."""
    queue: list[QueuedDocument] = []
    for pdf_path in pdf_paths:
        subject_info = detect_subject(pdf_path)
        chapter_info = detect_chapter(pdf_path)
        queue.append(
            QueuedDocument(
                path=pdf_path,
                subject=subject_info.subject,
                chapter=chapter_info.chapter,
                filename=pdf_path.name,
            )
        )
    return queue


# --------------------------------------------------------
# Part 5 — Dependency Injection
# --------------------------------------------------------

def build_document_processor(config: PipelineConfig) -> DocumentProcessor:
    """Part 5 — Dependency Injection. Instantiates every stage and
    wires it into a DocumentProcessor. No business logic of its own —
    every class constructed here already exists; this function only
    decides which concrete implementation plugs into which slot:

        LayoutDetector -> EducationalRegionDetector -> Region
        Extractors -> OCR Service -> Caption Association ->
        Validation -> Metadata -> Duplicate Removal -> Embedding
        Service -> Qdrant Store
    """
    layout_detector = LayoutDetector(
        weights_path=config.doclayout_weights_path,
        device=config.doclayout_device,
    )
    region_detector = EducationalRegionDetector(layout_detector=layout_detector)

    # Sprint 16: Vision Runtime is resolved once here (not re-read from
    # the environment inside the validator) and logged immediately, so
    # every startup makes it obvious which mode (cpu/gpu/auto ->
    # resolved) the Vision Validation stage will run in. Nothing else
    # about wiring below changes — the runtime is only ever injected
    # into the Vision Validator's stage.
    vision_runtime = get_vision_runtime(
        config.vision_runtime_mode,
        host=config.ollama_url,
        model=config.vision_model,
    )
    vision_runtime.log_startup()

    return DocumentProcessor(
        region_detector=region_detector,
        region_extractors=default_region_extractors(),
        page_enrichers=default_page_enrichers(ocr_service=ocr_service),
        document_enrichers=default_document_enrichers(vision_runtime=vision_runtime),
        result_store=default_result_store(collection=config.collection_name),
        dpi=config.render_dpi,
        debug_images_enabled=config.debug_images_enabled,
    )


# --------------------------------------------------------
# Part 9 — Summary Report
# --------------------------------------------------------

@dataclass
class BatchStats:
    """Running tally the batch loop updates after every document,
    printed as the final summary once every queued document has been
    attempted."""
    start_time: float = field(default_factory=time.perf_counter)
    books_processed: int = 0
    pages: int = 0
    regions_detected: dict[str, int] = field(default_factory=dict)
    accepted: int = 0
    rejected: int = 0
    duplicates: int = 0
    embeddings_created: int = 0
    qdrant_uploads: int = 0

    def record(self, result: PipelineResult, store_count: int) -> None:
        self.books_processed += 1
        self.pages += len(result.pages)
        self.qdrant_uploads += store_count

        for page in result.pages:
            for region_result in page.region_results:
                region_type = region_result.region.type
                self.regions_detected[region_type] = self.regions_detected.get(region_type, 0) + 1

                if region_result.ok and region_result.candidate is not None:
                    self.accepted += 1
                    if isinstance(region_result.candidate.metadata.get("qdrant_record"), dict):
                        self.embeddings_created += 1
                else:
                    self.rejected += 1
                    if region_result.error and region_result.error.startswith("duplicate_of:"):
                        self.duplicates += 1

    @property
    def elapsed_seconds(self) -> float:
        return time.perf_counter() - self.start_time

    def render(self) -> str:
        elapsed = self.elapsed_seconds
        minutes, seconds = divmod(int(elapsed), 60)
        lines = [
            "=====================",
            f"Books Processed:      {self.books_processed}",
            f"Pages:                {self.pages}",
            f"Regions Detected:     {sum(self.regions_detected.values())}",
            f"  Graphs:             {self.regions_detected.get(ExtractionType.GRAPH, 0)}",
            f"  Diagrams:           {self.regions_detected.get(ExtractionType.DIAGRAM, 0)}",
            f"  Tables:             {self.regions_detected.get(ExtractionType.TABLE, 0)}",
            f"  Photos:             {self.regions_detected.get(ExtractionType.PHOTO, 0)}",
            f"Accepted:             {self.accepted}",
            f"Rejected:             {self.rejected}",
            f"Duplicates:           {self.duplicates}",
            f"Embeddings Created:   {self.embeddings_created}",
            f"Qdrant Uploads:       {self.qdrant_uploads}",
            f"Elapsed Time:         {minutes}m {seconds}s",
            "=====================",
        ]
        return "\n".join(lines)


# --------------------------------------------------------
# Part 7 — Progress Reporting
# --------------------------------------------------------

def _print_book_header(document: QueuedDocument, total_pages: int) -> None:
    print("Processing:")
    print("------------------------")
    print()
    print("Book:")
    print(document.subject)
    print()
    print("Chapter:")
    print(document.chapter or "Unknown")
    print()
    print("Pages:")
    print(total_pages)
    print()


def _print_page_progress(page_number: int, total_pages: int, page_result: PageResult) -> None:
    detected = len(page_result.region_results)
    accepted = sum(1 for r in page_result.region_results if r.ok and r.candidate is not None)
    rejected = detected - accepted

    print(f"Current Page:\n{page_number} / {total_pages}")
    print()
    print("Detected Regions:")
    print(detected)
    print()
    print("Accepted:")
    print(accepted)
    print()
    print("Rejected:")
    print(rejected)
    print()


# --------------------------------------------------------
# Part 6 & 8 — Processing Loop, with Error Handling
# --------------------------------------------------------

def run_pipeline(config: PipelineConfig, queue: list[QueuedDocument], processor: DocumentProcessor) -> BatchStats:
    """Part 6 — Processing Loop:

        For every PDF -> Open PDF -> Process every page ->
        Collect results -> Finalize document -> Store output

    Part 8 — Error Handling: one document failing outright (a truly
    unreadable PDF, for instance) is caught here and logged; the batch
    moves on to the next document rather than stopping. Per-page and
    per-stage failures are already handled inside DocumentProcessor
    itself (see process_pdf / finalize_page above) — this is the outer
    layer, for failures that would otherwise take down the whole book.
    """
    stats = BatchStats()

    for document in queue:
        try:
            total_pages = fitz.open(document.path).page_count
        except Exception:
            logger.exception("Could not open %s — skipping this book.", document.path)
            continue

        _print_book_header(document, total_pages)

        try:
            result = processor.process_pdf(document.path, on_page=_print_page_progress)
        except Exception:
            logger.exception("Processing %s failed outright — skipping this book, continuing the batch.", document.path)
            continue

        stats.record(result, processor.last_store_count)

    return stats


# --------------------------------------------------------
# Part 1 — Runtime Entry Point
# --------------------------------------------------------

def _init_logging(level: str = LOG_LEVEL) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def _init_storage_at_startup() -> None:
    """Fail Fast at Startup — local-only deployment version of Sprint
    18.1's original MinIO check. There is no remote object store to
    validate credentials/connectivity against anymore, so this simply
    resolves the LocalImageStorage singleton (core/local_image_storage.py,
    under LOCAL_MEDIA_ROOT), confirms its root directory is writable,
    and prints the same startup report the old check did.

    A local disk problem (e.g. LOCAL_MEDIA_ROOT points somewhere not
    writable) still stops the pipeline here — that's a setup mistake
    worth fixing before any page is rendered, same posture the old
    MinioConfigError branch had — rather than discovering it mid-run
    on the first upload.
    """
    try:
        storage = get_local_image_storage()
        storage.verify_connection()
    except OSError as exc:
        logger.error("Local image storage could not be initialized under LOCAL_MEDIA_ROOT:\n%s", exc)
        raise SystemExit(1) from exc

    # Startup Diagnostics: printed once, only after the storage root
    # above has actually been verified writable.
    print(storage.config.startup_report(status="Connected"))


def main() -> None:
    """Runtime entry point: load env -> init logging -> validate/verify
    local storage -> discover PDFs -> create DocumentProcessor -> start
    ingestion. Running `python -m scripts.ingest_textbook_images` calls
    this and nothing else."""
    _init_logging()
    print("Pipeline Started")

    try:
        config = load_config()
    except ValueError as exc:
        logger.error("%s", exc)
        raise SystemExit(1) from exc

    # Local storage is validated and connected before any textbook is
    # discovered or opened. A SystemExit raised here (e.g. an
    # unwritable LOCAL_MEDIA_ROOT) stops the pipeline immediately — it
    # never reaches page rendering or extraction.
    _init_storage_at_startup()

    pdf_paths = discover_textbooks(config.knowledge_base_dir)
    print(f"Found {len(pdf_paths)} textbooks")
    if not pdf_paths:
        logger.warning("No PDFs found under %s — nothing to do.", config.knowledge_base_dir)
        return

    queue = build_document_queue(pdf_paths)
    processor = build_document_processor(config)

    stats = run_pipeline(config, queue, processor)

    print(stats.render())


if __name__ == "__main__":
    main()


__all__ = [
    "RenderedPage",
    "LayoutLabel",
    "ALL_LAYOUT_LABELS",
    "LayoutRegion",
    "make_region_id",
    "ExtractionType",
    "ALL_EXTRACTION_TYPES",
    "EducationalRegion",
    "VisualCandidate",
    "ANCHOR_LAYOUT_LABELS",
    "CONTEXT_LAYOUT_LABELS",
    "RegionBuilderConfig",
    "EducationalRegionBuilder",
    "EducationalRegionDetector",
    "RegionResult",
    "PageResult",
    "PipelineResult",
    "PageRenderer",
    "RegionDetector",
    "RegionExtractor",
    "PageEnricher",
    "DocumentEnricher",
    "ResultStore",
    "render_page",
    "normalize_layout_label",
    "LayoutDetector",
    "OCRWord",
    "OCRLine",
    "OCRResult",
    "OCRBackend",
    "PaddleOCRBackend",
    "OCRService",
    "run_ocr",
    "ocr_service",
    "CaptionMatch",
    "associate_caption",
    "CaptionAssociationEngine",
    "default_page_enrichers",
    "default_region_extractors",
    "ValidationQuestion",
    "ALL_VALIDATION_QUESTIONS",
    "ValidationVerdict",
    "QwenVisionBackend",
    "OllamaQwenBackend",
    "QwenValidator",
    "NCERT_CLASS_LEVEL",
    "PIPELINE_VERSION",
    "SubjectInfo",
    "ChapterInfo",
    "ImageMetadata",
    "VisualMetadata",
    "detect_subject",
    "detect_chapter",
    "MetadataBuilder",
    "DuplicateSignals",
    "DuplicateRemovalConfig",
    "DuplicateRemover",
    "EmbeddingBackend",
    "OllamaEmbeddingBackend",
    "EmbeddingRecord",
    "EmbeddingBuilder",
    "QdrantResultStore",
    "default_result_store",
    "default_document_enrichers",
    "DocumentProcessor",
    "PipelineConfig",
    "load_config",
    "discover_textbooks",
    "QueuedDocument",
    "build_document_queue",
    "build_document_processor",
    "BatchStats",
    "run_pipeline",
    "main",
    "VisionRuntime",
    "get_vision_runtime",
    "ChapterWorkspace",
    "build_chapter_workspace",
    "DocumentContext",
    "build_document_context",
    "LocalImageStorage",
    "StoredObject",
    "get_local_image_storage",
]