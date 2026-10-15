"""
scripts/extract_tables.py

Sprint 7 — Table Engine.

This module is one RegionExtractor: the concrete implementation
registered for EducationalRegion.type == ExtractionType.TABLE.
DocumentProcessor never imports this module directly — it calls
whatever RegionExtractor is registered under "table" in the
region_extractors dict handed to it (see
ingest_textbook_images.default_region_extractors()).

    EducationalRegion
            |
            v
      Initial Crop            (Stage 1)
            |
            v
   PaddleOCR Structure Engine  (Stage 2)
      (PPStructureV3, or the
       legacy PPStructure API)
            |
            v
      Title Detection          (Stage 3)
            |
            v
     Table Validation          (Stage 4)
            |
            v
      VisualCandidate

Where extract_graphs.py and extract_diagrams.py each carry their own
OpenCV-based boundary recovery (find the plot frame / find the content
mask), this module has no boundary-detection stage at all, by design.
Row count, column count, cell grid, and cell-level OCR are exactly the
problem PaddleOCR's structure pipelines were built to solve, and they
solve it far better than any bespoke line-detection heuristic this
pipeline could grow — so Stage 2 hands the crop to whichever PaddleOCR
structure API is installed and takes its structure verbatim. There is
no manual table detection anywhere in this file: no line/grid
heuristics, no cell-counting-by-whitespace, no row-splitting logic. If
the structure engine doesn't find a table, Stage 4 rejects the
candidate; this module never tries to recover one itself.

Sprint "Legacy PaddleOCR 2.10 Compatibility Layer": the project's
current environment ships paddleocr==2.10.0 / paddlepaddle==3.0.0,
which exposes `PPStructure` (the 2.x API), not the `PPStructureV3`
pipeline this module originally assumed. Stage 2 is now a small
compatibility layer, `PaddleStructureEngine`, that detects whichever
API is actually installed, calls it correctly, and parses either
output shape into the exact same `TableStructureResult`. Every stage
downstream of Stage 2 — title detection, validation, the
`TableExtractionEngine` that sequences everything — is written against
`TableStructureResult` only and has no idea which PaddleOCR API
produced it. When PPStructureV3 becomes available in this environment,
`PaddleStructureEngine` will prefer it automatically; no other change
is required anywhere in this file.

The one piece the structure engine does *not* own is the table's
title, since a textbook title/caption usually sits just outside the
DocLayout table box (a Title or Caption block detected separately by
DocLayout-YOLO). Stage 3 resolves that the same way the other two
extractors do: check the EducationalRegionBuilder-assigned caption
first, then any TITLE block carried in `region.context`, then fall
back to the table's own header row if the structure engine flagged one.

Self-contained by design (imports only from ingest_textbook_images,
not from scripts/extract_graphs.py or scripts/extract_diagrams.py) —
same convention as the rest of this pipeline's stage modules, so each
extractor script can be read, tested, and replaced independently. This
does mean small pieces of crop-geometry plumbing are duplicated with
those two modules rather than shared; that duplication is intentional,
not an oversight.

The structure pipeline object itself is injectable (see
TableStructureEngine below), so this module is fully testable without
paddleocr/paddlex installed — inject a fake in tests. Title/caption
text (never in-table text, which the structure engine already returns
per-cell) is read through the shared ingest_textbook_images.OCRService
as of Sprint 8 — the same instance extract_graphs.py and
extract_diagrams.py use, so a crop is never OCR'd twice by two
different extractors. Inject a fake OCRService in tests the same way.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any, Optional, Protocol

import numpy as np
from PIL import Image

try:
    from .ingest_textbook_images import (
        EducationalRegion,
        ExtractionType,
        LayoutLabel,
        OCRLine,
        OCRService,
        RegionResult,
        RenderedPage,
        VisualCandidate,
        ocr_service as _default_ocr_service,
    )
except ImportError:  # pragma: no cover - fallback if scripts/ isn't already on sys.path
    import sys as _sys
    from pathlib import Path as _Path

    _sys.path.insert(0, str(_Path(__file__).resolve().parent.parent))
    from .ingest_textbook_images import (
        EducationalRegion,
        ExtractionType,
        LayoutLabel,
        OCRLine,
        OCRService,
        RegionResult,
        RenderedPage,
        VisualCandidate,
        ocr_service as _default_ocr_service,
    )

logger = logging.getLogger(__name__)

BBox = tuple[float, float, float, float]


# ============================================================
# CONFIG
#
# Every threshold this pipeline uses, centralized and injectable —
# no magic numbers buried in the parsing/validation logic. Notably
# short compared to GraphExtractionConfig / DiagramExtractionConfig:
# there is no boundary-recovery stage here for thresholds to belong to.
# ============================================================

@dataclass
class TableExtractionConfig:
    """Thresholds for the table pipeline."""

    # Stage 1 — initial crop. A small fixed pad, not content-based
    # expansion (that's a graph/diagram-specific heuristic) — just
    # enough to avoid clipping a cell border DocLayout-YOLO drew a
    # pixel or two tight.
    crop_pad_px: int = 4

    # Stage 4 — validation.
    min_rows: int = 1
    min_columns: int = 1
    min_cells: int = 1
    min_ocr_chars: int = 1
    blank_row_std_threshold: float = 6.0  # crop-is-blank check, same convention as the other extractors


# ============================================================
# STAGE OUTPUT SHAPES
#
# OCRLine itself is no longer defined here (Sprint 8 moved it to
# ingest_textbook_images.OCRLine, shared with every other extractor).
# Only used here for title/caption text — never for in-table text,
# which comes from PP-StructureV3's own per-cell OCR.
# ============================================================


@dataclass
class TableCell:
    """One cell of a recognized table, exactly as PP-StructureV3
    reported it — no re-derivation of row/column geometry here."""
    row: int
    col: int
    row_span: int = 1
    col_span: int = 1
    bbox: Optional[tuple[int, int, int, int]] = None  # crop-local pixel coords, if PP-StructureV3 gave one
    text: str = ""

    def as_dict(self) -> dict:
        return {
            "row": self.row,
            "col": self.col,
            "row_span": self.row_span,
            "col_span": self.col_span,
            "bbox": list(self.bbox) if self.bbox else None,
            "text": self.text,
        }


@dataclass
class TableStructureResult:
    """What Stage 2 (PP-StructureV3) produces for one table crop —
    rows / columns / cells / OCR, taken verbatim from the model, plus
    the HTML PP-StructureV3 emits (kept as-is for downstream consumers
    that want the full markup rather than the cell list)."""
    rows: int = 0
    columns: int = 0
    cells: list[TableCell] = field(default_factory=list)
    html: Optional[str] = None
    confidence: float = 0.0
    raw: Any = None  # untouched pipeline output, for downstream provenance only

    @property
    def ocr_text(self) -> str:
        """Reading-order concatenation of every cell's text — the
        table's own OCR, as opposed to any caption/title OCR done in
        Stage 3."""
        ordered = sorted(self.cells, key=lambda c: (c.row, c.col))
        return "\n".join(cell.text.strip() for cell in ordered if cell.text.strip())


@dataclass
class TableValidationResult:
    ok: bool
    reasons: list[str] = field(default_factory=list)


@dataclass
class CropGeometry:
    """Where the table crop sits, in both coordinate spaces — the same
    shape/contract extract_graphs.py and extract_diagrams.py each keep
    their own copy of, duplicated here rather than imported for the
    same reason (see module docstring)."""
    origin_px: tuple[float, float]   # top-left of the crop, in rendered-page pixel space
    scale: float                     # rendered-image px per PDF pt (copied from RenderedPage.scale)
    size_px: tuple[int, int]         # (width, height) of the crop, in pixels

    def crop_px_to_page_bbox(self, bbox_px: tuple[float, float, float, float]) -> BBox:
        x0, y0, x1, y1 = bbox_px
        ox, oy = self.origin_px
        return (
            (x0 + ox) / self.scale,
            (y0 + oy) / self.scale,
            (x1 + ox) / self.scale,
            (y1 + oy) / self.scale,
        )


# ============================================================
# INJECTABLE STAGE INTERFACES
# ============================================================

class TableStructureEngine(Protocol):
    """PPStructureV3, the legacy PPStructure API, or a fake (in
    tests). Receives exactly the Stage 1 crop and returns
    rows/columns/cells/OCR — no bbox, no hints, since resolving
    structure from the crop is the whole job this stage is delegated
    to do. Whichever PaddleOCR API is behind an implementation of this
    protocol is that implementation's own concern; every caller in
    this file (TableExtractionEngine included) only ever sees
    TableStructureResult."""
    def __call__(self, image: Image.Image) -> TableStructureResult: ...


# ============================================================
# STAGE 1 — INITIAL CROP
#
# Exactly the EducationalRegion bbox, plus a small fixed pad. No
# content-based expansion and no boundary search — the bbox was
# already localized upstream by Educational Region Detection, and
# structure recovery is PP-StructureV3's job, not this stage's.
# ============================================================

def _clamp_box(box: tuple[float, float, float, float], image_size: tuple[int, int]) -> tuple[int, int, int, int]:
    width, height = image_size
    x0, y0, x1, y1 = box
    x0 = max(0, min(int(x0), width - 1))
    y0 = max(0, min(int(y0), height - 1))
    x1 = max(x0 + 1, min(int(x1), width))
    y1 = max(y0 + 1, min(int(y1), height))
    return (x0, y0, x1, y1)


def initial_crop(
    rendered: RenderedPage,
    region: EducationalRegion,
    config: TableExtractionConfig,
) -> tuple[Image.Image, CropGeometry]:
    """Stage 1 — crop = rendered.crop(region.bbox), padded by
    `crop_pad_px` on every side and clamped to the page image."""
    x0, y0, x1, y1 = region.bbox
    scale = rendered.scale
    px_box = (x0 * scale, y0 * scale, x1 * scale, y1 * scale)

    pad = config.crop_pad_px
    padded = (px_box[0] - pad, px_box[1] - pad, px_box[2] + pad, px_box[3] + pad)
    box = _clamp_box(padded, rendered.image.size)

    crop = rendered.image.crop(box)
    geometry = CropGeometry(
        origin_px=(box[0], box[1]),
        scale=scale,
        size_px=(box[2] - box[0], box[3] - box[1]),
    )
    return crop, geometry


# ============================================================
# STAGE 2 — PADDLEOCR STRUCTURE ENGINE
#
# The only structure-recognition stage in this file. Rows, columns,
# cells, and per-cell OCR all come straight from the pipeline's own
# output — parsed here, never re-derived from pixels.
#
# Two parsers live here, one per PaddleOCR structure API:
#   _parse_ppstructure_output()  — PPStructureV3 (future/preferred)
#   _parse_ppstructure_legacy()  — PPStructure 2.x (what this project's
#                                   paddleocr==2.10.0 / paddlepaddle==3.0.0
#                                   environment actually ships)
# Both return the same TableStructureResult; PaddleStructureEngine
# below is the only thing that knows which parser to call.
# ============================================================

def _parse_ppstructure_output(outputs: Any) -> TableStructureResult:
    """Normalizes whatever PP-StructureV3 handed back into a
    TableStructureResult. Kept as its own function (rather than
    inlined in PaddleStructureEngine.__call__) so it's independently
    testable against recorded pipeline output without a real model.

    PP-StructureV3's `predict()` returns an iterable of per-image
    results; each result exposes a `table_res_list` with, per detected
    table, `pred_html` and a `cell_box_list` of
    (bbox, row, col, row_span, col_span, text) — the pipeline's own
    words for "this is the grid". This function only reshapes that
    into TableCell/TableStructureResult; it makes no structural
    decisions of its own.
    """
    results = list(outputs) if outputs is not None else []
    if not results:
        return TableStructureResult(raw=outputs)

    # A table region should yield exactly one recognized table; if the
    # pipeline reports more than one (e.g. a split/nested table), take
    # the first — same "don't second-guess the model" stance as the
    # rest of this stage.
    table_res_list = getattr(results[0], "table_res_list", None) or results[0].get("table_res_list", [])
    if not table_res_list:
        return TableStructureResult(raw=outputs)

    table_res = table_res_list[0]
    html = table_res.get("pred_html") if isinstance(table_res, dict) else getattr(table_res, "pred_html", None)
    raw_cells = table_res.get("cell_box_list") if isinstance(table_res, dict) else getattr(table_res, "cell_box_list", None)
    raw_cells = raw_cells or []

    cells: list[TableCell] = []
    max_row = max_col = -1
    for entry in raw_cells:
        bbox = entry.get("bbox") if isinstance(entry, dict) else getattr(entry, "bbox", None)
        row = int(entry.get("row", 0) if isinstance(entry, dict) else getattr(entry, "row", 0))
        col = int(entry.get("col", 0) if isinstance(entry, dict) else getattr(entry, "col", 0))
        row_span = int(entry.get("row_span", 1) if isinstance(entry, dict) else getattr(entry, "row_span", 1))
        col_span = int(entry.get("col_span", 1) if isinstance(entry, dict) else getattr(entry, "col_span", 1))
        text = entry.get("text", "") if isinstance(entry, dict) else getattr(entry, "text", "")

        cells.append(
            TableCell(
                row=row, col=col, row_span=row_span, col_span=col_span,
                bbox=tuple(int(v) for v in bbox) if bbox else None,
                text=text or "",
            )
        )
        max_row = max(max_row, row + row_span - 1)
        max_col = max(max_col, col + col_span - 1)

    rows = max_row + 1 if not html else max(max_row + 1, _count_html_rows(html))
    columns = max_col + 1 if not html else max(max_col + 1, _count_html_columns(html))

    confidence = table_res.get("score", 0.0) if isinstance(table_res, dict) else getattr(table_res, "score", 0.0)

    return TableStructureResult(
        rows=max(rows, 0), columns=max(columns, 0), cells=cells,
        html=html, confidence=float(confidence or 0.0), raw=outputs,
    )


def _count_html_rows(html: str) -> int:
    """Fallback row count straight from the HTML PP-StructureV3
    emits, used only when cell_box_list under-reports (e.g. a
    fully-merged row PP-StructureV3 didn't enumerate per-cell).
    Counting <tr> tags is reading the model's own markup, not
    re-detecting table structure from the image."""
    return len(re.findall(r"<tr\b", html, flags=re.IGNORECASE))


def _count_html_columns(html: str) -> int:
    first_row = re.search(r"<tr\b.*?</tr>", html, flags=re.IGNORECASE | re.DOTALL)
    if not first_row:
        return 0
    return len(re.findall(r"<t[dh]\b", first_row.group(0), flags=re.IGNORECASE))


# ------------------------------------------------------------------
# Legacy PPStructure (2.x) support
#
# PPStructure's `res` for a detected table region carries an `html`
# string (same convention as PP-StructureV3's `pred_html`) but, unlike
# PP-StructureV3, has no `cell_box_list` with per-cell row/col/span
# already resolved — 2.x only ever hands back the table's own HTML
# markup, plus (depending on version/config) a flat `cell_bbox` list
# of quad boxes in reading order. Row/column/span structure therefore
# has to be read out of the HTML itself: `_HTMLTableParser` below is a
# minimal <table>/<tr>/<td>/<th> reader (stdlib html.parser, no new
# dependency) that reconstructs the occupied-cell grid, including
# rowspan/colspan, exactly the way a browser would lay the table out.
# ------------------------------------------------------------------

class _HTMLTableParser(HTMLParser):
    """Reads the first <table> in an HTML fragment into a flat list of
    (text, row_span, col_span) cells, one list per <tr>, in document
    order. Does not resolve row/col grid positions itself — occupancy
    (cells pushed right/down by a previous row's rowspan) is a
    layout concern, handled by `_cells_from_html` below, not parsing."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[dict]] = []
        self._current_row: Optional[list[dict]] = None
        self._current_cell: Optional[dict] = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        attrs_dict = dict(attrs)
        if tag == "tr":
            self._current_row = []
        elif tag in ("td", "th"):
            def _as_int(value: Optional[str]) -> int:
                try:
                    return max(1, int(value))
                except (TypeError, ValueError):
                    return 1

            self._current_cell = {
                "text": "",
                "row_span": _as_int(attrs_dict.get("rowspan")),
                "col_span": _as_int(attrs_dict.get("colspan")),
            }

    def handle_data(self, data: str) -> None:
        if self._current_cell is not None:
            self._current_cell["text"] += data

    def handle_endtag(self, tag: str) -> None:
        if tag in ("td", "th") and self._current_cell is not None:
            if self._current_row is not None:
                self._current_row.append(self._current_cell)
            self._current_cell = None
        elif tag == "tr" and self._current_row is not None:
            self.rows.append(self._current_row)
            self._current_row = None


def _cells_from_html(html: str) -> list[TableCell]:
    """Turns an HTML `<table>` string into TableCells with resolved
    row/col grid positions (accounting for rowspan/colspan occupancy).
    No bbox is set here — legacy PPStructure's cell_bbox list (when
    present) is zipped in separately, in the same reading order, by
    `_parse_ppstructure_legacy`."""
    parser = _HTMLTableParser()
    parser.feed(html)

    cells: list[TableCell] = []
    occupied: set[tuple[int, int]] = set()  # (row, col) cells already claimed by a span

    for row_idx, raw_row in enumerate(parser.rows):
        col_idx = 0
        for raw_cell in raw_row:
            while (row_idx, col_idx) in occupied:
                col_idx += 1

            row_span = raw_cell["row_span"]
            col_span = raw_cell["col_span"]
            text = re.sub(r"\s+", " ", raw_cell["text"]).strip()

            cells.append(
                TableCell(row=row_idx, col=col_idx, row_span=row_span, col_span=col_span, text=text)
            )

            for r in range(row_idx, row_idx + row_span):
                for c in range(col_idx, col_idx + col_span):
                    occupied.add((r, c))

            col_idx += col_span

    return cells


def _quad_to_bbox(quad: Any) -> Optional[tuple[int, int, int, int]]:
    """Legacy PPStructure's `cell_bbox` entries are either an 8-value
    quad [x1,y1,x2,y2,x3,y3,x4,y4] (four corners) or a plain 4-value
    rect [x0,y0,x1,y1] — normalizes either into an axis-aligned rect."""
    try:
        values = [float(v) for v in quad]
    except (TypeError, ValueError):
        return None

    if len(values) == 4:
        x0, y0, x1, y1 = values
    elif len(values) == 8:
        xs = values[0::2]
        ys = values[1::2]
        x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    else:
        return None

    return (int(x0), int(y0), int(x1), int(y1))


def _parse_ppstructure_legacy(outputs: Any) -> TableStructureResult:
    """Normalizes legacy PPStructure (2.x) output into a
    TableStructureResult — the counterpart to _parse_ppstructure_output
    for the API this project's paddleocr==2.10.0 environment actually
    exposes.

    `PPStructure(...)(image)` returns a list of per-region dicts, each
    shaped roughly:

        {"type": "table", "bbox": [...], "res": {"html": "...",
         "cell_bbox": [[x1,y1,x2,y2,x3,y3,x4,y4], ...]}}

    (confirm the exact shape for the installed paddleocr version with
    scripts/debug_ppstructure.py before trusting this in production —
    the dict key names below are the ones PPStructure 2.x documents,
    but PaddleX has changed minor-version output shapes before).

    Only the first "table"-typed region is used, matching
    _parse_ppstructure_output's "one table crop -> one table" stance.
    Row/column/span structure is read from `res["html"]`
    (`_cells_from_html`); `cell_bbox`, when present and the same length
    as the parsed cell list, is zipped in purely for per-cell bboxes —
    it is never used to derive row/col/span, since legacy PPStructure's
    cell_bbox is a flat reading-order list with no row/col of its own.
    """
    regions = list(outputs) if outputs is not None else []

    table_region = None
    for region in regions:
        region_type = region.get("type") if isinstance(region, dict) else getattr(region, "type", None)
        if isinstance(region_type, str) and region_type.lower() == "table":
            table_region = region
            break

    if table_region is None:
        return TableStructureResult(raw=outputs)

    res = table_region.get("res") if isinstance(table_region, dict) else getattr(table_region, "res", None)
    if res is None:
        return TableStructureResult(raw=outputs)

    html = res.get("html") if isinstance(res, dict) else getattr(res, "html", None)
    if not html:
        return TableStructureResult(raw=outputs)

    cells = _cells_from_html(html)

    raw_bboxes = res.get("cell_bbox") if isinstance(res, dict) else getattr(res, "cell_bbox", None)
    if raw_bboxes and len(raw_bboxes) == len(cells):
        # cell_bbox is in the same reading order _cells_from_html
        # produces its cell list in (document order, row-major) —
        # zip is only safe because both are that same reading order.
        for cell, quad in zip(cells, raw_bboxes):
            cell.bbox = _quad_to_bbox(quad)

    max_row = max((c.row + c.row_span - 1 for c in cells), default=-1)
    max_col = max((c.col + c.col_span - 1 for c in cells), default=-1)
    rows = max(max_row + 1, _count_html_rows(html))
    columns = max(max_col + 1, _count_html_columns(html))

    confidence = table_region.get("score") if isinstance(table_region, dict) else getattr(table_region, "score", None)

    return TableStructureResult(
        rows=max(rows, 0), columns=max(columns, 0), cells=cells,
        html=html, confidence=float(confidence or 0.0), raw=outputs,
    )


# ------------------------------------------------------------------
# API detection + unified engine (Goals 1, 4, 5)
# ------------------------------------------------------------------

def _detect_paddle_structure_api() -> str:
    """Detects which PaddleOCR table-structure API is importable in
    this environment. Prefers PPStructureV3 (future/preferred) and
    falls back to the legacy PPStructure 2.x API this project's
    paddleocr==2.10.0 / paddlepaddle==3.0.0 environment currently
    ships. Raises only if neither is available — same failure the old
    hardcoded PPStructureV3 import used to produce, just delayed to
    first use instead of import time."""
    try:
        from paddleocr import PPStructureV3  # noqa: F401
        return "v3"
    except ImportError:
        pass

    try:
        from paddleocr import PPStructure  # noqa: F401
        return "legacy"
    except ImportError:
        pass

    raise RuntimeError(
        "paddleocr is not installed, or neither PPStructureV3 nor the "
        "legacy PPStructure API is available in it — table extraction "
        "is unavailable. Install paddleocr/paddlex to enable table "
        "extraction."
    )


class PaddleStructureEngine:
    """Default TableStructureEngine (Goal 5 — the engine factory).

    Auto-detects whichever PaddleOCR structure API is installed —
    PPStructureV3 or the legacy PPStructure 2.x API — builds the
    matching pipeline, and always hands the caller back a
    TableStructureResult. TableExtractionEngine (and everything else
    downstream of Stage 2) never sees which API actually ran; that
    branch lives entirely inside this class (Goal 4).

    Construction is deferred to first use — building either pipeline
    loads several models from disk, and importing this module (e.g.
    from ingest_textbook_images.default_region_extractors()) should
    never require paddleocr/paddlex to already be installed.

    Pass `api="v3"` or `api="legacy"` to force a specific API instead
    of auto-detecting (useful in tests, or to pin behavior explicitly
    once PPStructureV3 is available alongside the legacy install).
    """

    def __init__(self, *, api: Optional[str] = None, **pipeline_kwargs: Any) -> None:
        if api is not None and api not in ("v3", "legacy"):
            raise ValueError(f"api must be 'v3', 'legacy', or None (auto-detect); got {api!r}")
        self._requested_api = api
        self._pipeline_kwargs = pipeline_kwargs
        self._pipeline: Any = None
        self._resolved_api: Optional[str] = None

    @property
    def api(self) -> Optional[str]:
        """Which PaddleOCR API this engine is using — 'v3' or
        'legacy'. None until the pipeline has actually been built
        (auto-detection only runs at first call), unless `api=` was
        forced at construction time."""
        return self._resolved_api or self._requested_api

    def _ensure_pipeline(self) -> Any:
        if self._pipeline is not None:
            return self._pipeline

        api = self._requested_api or _detect_paddle_structure_api()

        if api == "v3":
            try:
                from paddleocr import PPStructureV3
            except ImportError as exc:  # pragma: no cover - paddleocr is optional at import time
                raise RuntimeError(
                    "PPStructureV3 was requested but is not installed."
                ) from exc
            self._pipeline = PPStructureV3(**self._pipeline_kwargs)
        else:  # "legacy"
            try:
                from paddleocr import PPStructure
            except ImportError as exc:  # pragma: no cover - paddleocr is optional at import time
                raise RuntimeError(
                    "The legacy PPStructure API was requested but is not "
                    "installed."
                ) from exc
            self._pipeline = PPStructure(**self._pipeline_kwargs)

        self._resolved_api = api
        logger.info("PaddleStructureEngine using PaddleOCR structure API: %s", api)
        return self._pipeline

    def __call__(self, image: Image.Image) -> TableStructureResult:
        pipeline = self._ensure_pipeline()
        array = np.array(image.convert("RGB"))[:, :, ::-1]  # RGB -> BGR, what both APIs expect

        if self._resolved_api == "v3":
            outputs = pipeline.predict(array)
            return _parse_ppstructure_output(outputs)
        else:  # "legacy"
            outputs = pipeline(array)
            return _parse_ppstructure_legacy(outputs)


class PPStructureV3Engine(PaddleStructureEngine):
    """Backward-compat alias for Sprint 7's original engine name.
    Sprint 7 code (and any external call site that imported
    `PPStructureV3Engine` directly) keeps working unchanged — this is
    just `PaddleStructureEngine` with the API pinned to "v3" rather
    than auto-detected. New code should construct
    `PaddleStructureEngine()` directly (or `PaddleStructureEngine(api="v3")`
    to pin explicitly) instead of this alias."""

    def __init__(self, **pipeline_kwargs: Any) -> None:
        super().__init__(api="v3", **pipeline_kwargs)


def run_table_structure(
    crop: Image.Image,
    structure_engine: TableStructureEngine,
) -> TableStructureResult:
    """Stage 2 entrypoint. Left as its own function (mirroring
    run_ocr() in extract_graphs.py / extract_diagrams.py) so it's
    swappable/testable independent of the class that sequences it."""
    return structure_engine(crop)


# ============================================================
# GENERIC OCR (title/caption only — never in-table text)
#
# Sprint 8: reads title/caption blocks through the shared
# ingest_textbook_images.OCRService (the same instance
# extract_graphs.py and extract_diagrams.py use) — no PaddleOCR
# wrapper lives in this file anymore.
# ============================================================

def _ocr_block_text(
    rendered: RenderedPage,
    block: "LayoutRegion",
    ocr_service: OCRService,
) -> Optional[str]:
    """OCRs one LayoutRegion (a caption or title block) directly off
    the rendered page — these blocks live outside the table crop, so
    Stage 1's crop can't be reused for them."""
    scale = rendered.scale
    box = _clamp_box(tuple(v * scale for v in block.bbox), rendered.image.size)
    crop = rendered.image.crop(box)
    lines = ocr_service(crop).lines
    text = " ".join(line.text.strip() for line in lines if line.text.strip())
    return text or None


# ============================================================
# STAGE 3 — TITLE DETECTION
#
# Same priority convention as extract_graphs.py / extract_diagrams.py:
# prefer whatever Educational Region Detection already associated,
# and only fall back to something derived from the table itself as a
# last resort.
# ============================================================

def detect_title(
    region: EducationalRegion,
    rendered: RenderedPage,
    ocr_service: OCRService,
    structure: TableStructureResult,
) -> Optional[str]:
    # Priority 1: the caption EducationalRegionBuilder assigned.
    if region.caption is not None:
        text = _ocr_block_text(rendered, region.caption, ocr_service)
        if text:
            return text

    # Priority 2: a TITLE block carried in context (nearest first).
    for block in region.context:
        if block.region_class == LayoutLabel.TITLE:
            text = _ocr_block_text(rendered, block, ocr_service)
            if text:
                return text

    # Priority 3: a full-width header row PP-StructureV3 itself
    # returned (common when a textbook sets the table's title as its
    # own first row rather than as a separate DocLayout block).
    if structure.columns > 0:
        header_cells = [c for c in structure.cells if c.row == 0]
        if len(header_cells) == 1 and header_cells[0].col_span >= structure.columns and header_cells[0].text.strip():
            return header_cells[0].text.strip()

    return None


# ============================================================
# STAGE 4 — TABLE VALIDATION
#
# Accept/reject gate. A rejected candidate is still returned (ok=False,
# candidate populated) rather than dropped, same convention as the
# other extractors, so a later recovery pass can still see what
# PP-StructureV3 produced.
# ============================================================

def _is_mostly_blank(image: Image.Image, config: TableExtractionConfig) -> bool:
    gray = np.array(image.convert("L"), dtype=np.float32)
    return float(np.std(gray)) < config.blank_row_std_threshold


def validate_table(
    crop: Image.Image,
    structure: TableStructureResult,
    config: TableExtractionConfig,
) -> TableValidationResult:
    reasons: list[str] = []

    if structure.rows < config.min_rows or structure.columns < config.min_columns:
        reasons.append("insufficient_rows_or_columns")

    if len(structure.cells) < config.min_cells:
        reasons.append("no_cells_detected")

    if len(structure.ocr_text.strip()) < config.min_ocr_chars:
        reasons.append("insufficient_ocr_text")

    if _is_mostly_blank(crop, config):
        reasons.append("crop_mostly_blank")

    return TableValidationResult(ok=not reasons, reasons=reasons)


# ============================================================
# ENTRYPOINT — implements the RegionExtractor protocol
# ============================================================

class TableExtractionEngine:
    """RegionExtractor for EducationalRegion.type == ExtractionType.TABLE.

    Sequences Stages 1-4 and packages the result as a VisualCandidate.
    Both the structure engine (PaddleStructureEngine, which auto-detects
    PPStructureV3 vs. the legacy PPStructure API — see Goal 5) and the
    OCR service (used only for title/caption text) are injectable so
    this can be exercised in tests without paddleocr/paddlex installed.
    """

    def __init__(
        self,
        *,
        config: Optional[TableExtractionConfig] = None,
        structure_engine: Optional[TableStructureEngine] = None,
        ocr_service: Optional[OCRService] = None,
    ) -> None:
        self.config = config or TableExtractionConfig()
        self.structure_engine: TableStructureEngine = structure_engine or PaddleStructureEngine()
        self.ocr_service: OCRService = ocr_service or _default_ocr_service

    def __call__(self, region: EducationalRegion, rendered: RenderedPage, **context: Any) -> RegionResult:
        if region.type != ExtractionType.TABLE:
            # dispatch_region() only routes TABLE regions here, but a
            # misconfigured region_extractors map shouldn't crash oddly.
            return RegionResult(
                region=region,
                ok=False,
                error=f"TableExtractionEngine received type={region.type!r}, expected {ExtractionType.TABLE!r}",
            )

        try:
            crop, geometry = initial_crop(rendered, region, self.config)
            structure = run_table_structure(crop, self.structure_engine)
            title = detect_title(region, rendered, self.ocr_service, structure)
            validation = validate_table(crop, structure, self.config)

            recovered_bbox = geometry.crop_px_to_page_bbox((0, 0, crop.size[0], crop.size[1]))

            candidate = VisualCandidate.from_region(
                region,
                bbox=recovered_bbox,
                image=crop,
                ocr_text=structure.ocr_text or None,
                confidence=min(region.confidence, structure.confidence) if structure.confidence else region.confidence * 0.5,
                metadata={
                    "rows": structure.rows,
                    "columns": structure.columns,
                    "cells": [cell.as_dict() for cell in structure.cells],
                    "html": structure.html,
                    "title": title,
                    "structure_confidence": structure.confidence,
                    "validation_reasons": validation.reasons,
                },
            )

            return RegionResult(
                region=region,
                candidate=candidate,
                ok=validation.ok,
                error=None if validation.ok else "table_validation_failed: " + ", ".join(validation.reasons),
            )
        except Exception as exc:  # extractor failures must not kill the page
            logger.exception(
                "Table extraction failed for region_id=%s (page %d)", region.region_id, region.page,
            )
            return RegionResult(region=region, ok=False, error=str(exc))


# Module-level default instance — what
# ingest_textbook_images.default_region_extractors() registers under
# ExtractionType.TABLE. Uses PaddleStructureEngine's auto-detection, so
# this same line works unchanged whether the installed environment has
# only the legacy PPStructure API (today) or PPStructureV3 (later).
# Construct your own TableExtractionEngine(...) instead if you need
# custom config/structure_engine/ocr_service — e.g.
# TableExtractionEngine(structure_engine=PaddleStructureEngine(api="legacy"))
# to pin the API explicitly rather than auto-detect.
extract_table_region = TableExtractionEngine()


__all__ = [
    "TableExtractionConfig",
    "TableCell",
    "TableStructureResult",
    "TableValidationResult",
    "CropGeometry",
    "TableStructureEngine",
    "PaddleStructureEngine",
    "PPStructureV3Engine",
    "initial_crop",
    "run_table_structure",
    "detect_title",
    "validate_table",
    "TableExtractionEngine",
    "extract_table_region",
]