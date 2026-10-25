"""
scripts/extract_graphs.py

Sprint 5 — Graph Recovery Engine.

This module is one RegionExtractor: the concrete implementation
registered for EducationalRegion.type == ExtractionType.GRAPH.
DocumentProcessor never imports this module directly — it calls
whatever RegionExtractor is registered under "graph" in the
region_extractors dict handed to it (see
ingest_textbook_images.default_region_extractors()).

    EducationalRegion
            |
            v
      Initial Crop            (Stage 1)
            |
            v
      Crop Expansion           (Stage 2)
            |
            v
   Graph Boundary Detection    (Stage 3)
            |
            v
           OCR                (Stage 4)
            |
            v
      Axis Detection           (Stage 5)
            |
            v
     Legend Detection          (Stage 6)
            |
            v
      Title Detection          (Stage 7)
            |
            v
     Graph Validation          (Stage 8)
            |
            v
      VisualCandidate

The whole point of this pipeline is that DocLayout-YOLO's box is only
a starting point, not the answer: it typically bounds the plot area
alone, clipping the title, axis labels, legend, and caption that sit
just outside it. Stage 2/3 recover the *complete* graph; everything
after that (OCR, axis/legend/title detection, validation) operates on
the recovered crop, not the original DocLayout box.

Stage 4 (OCR) no longer belongs to this module — as of Sprint 8 it
runs once through the shared ingest_textbook_images.OCRService, the
same instance extract_diagrams.py and extract_tables.py also use, so
a crop is never OCR'd twice by two different extractors. Every other
stage with a genuine modeling choice behind it (boundary detection) is
still injectable here, the same pattern LayoutDetector and
EducationalRegionBuilder use elsewhere in this pipeline, so this
module is fully testable without opencv-python or paddleocr installed
— inject a fake OCRService and a fake boundary detector in tests.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional, Protocol

import numpy as np
from PIL import Image

try:
    import cv2
except ImportError:  # pragma: no cover - opencv is optional at import time
    cv2 = None

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
        run_ocr,
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
        run_ocr,
    )

logger = logging.getLogger(__name__)

BBox = tuple[float, float, float, float]


# ============================================================
# CONFIG
#
# Every threshold this pipeline uses, centralized and injectable —
# no magic numbers buried in the detection logic.
# ============================================================

@dataclass
class GraphExtractionConfig:
    """Thresholds for the graph recovery pipeline."""

    # Stage 2 — crop expansion.
    expansion_margin_ratio: float = 0.15   # grow the DocLayout box by 15% per side, initially
    blank_row_std_threshold: float = 6.0   # a row/column with std-dev below this counts as "blank"
    blank_row_streak: int = 6              # require this many consecutive blank rows/cols before trimming

    # Stage 3 — boundary detection (OpenCV line detection).
    canny_low: int = 50
    canny_high: int = 150
    hough_threshold: int = 60
    hough_min_line_fraction: float = 0.35  # min line length, as a fraction of crop width/height
    hough_max_line_gap: int = 10
    axis_angle_tolerance_deg: float = 5.0
    max_expansion_rounds: int = 2          # re-expand + re-detect this many times if the frame touches the edge

    # Stage 6 — legend detection.
    legend_swatch_size: int = 10           # px sampled immediately left of a candidate legend line
    legend_min_lines: int = 1
    legend_max_label_chars: int = 40

    # Stage 8 — validation.
    min_ocr_chars: int = 3
    min_content_fraction: float = 0.02     # plot area must cover at least this fraction of the crop
    max_content_fraction: float = 0.98     # ...and, if undetected (fallback), not effectively the whole crop


# ============================================================
# STAGE OUTPUT SHAPES
#
# OCRLine itself is no longer defined here (Sprint 8 moved it to
# ingest_textbook_images.OCRLine, shared with every other extractor)
# — only the shapes specific to graph recovery live in this file.
# ============================================================

@dataclass
class GraphAxes:
    """Axis geometry, in crop-local pixel coordinates. Any field may
    be None if that axis/origin wasn't found."""
    x_axis: Optional[tuple[int, int, int, int]] = None
    y_axis: Optional[tuple[int, int, int, int]] = None
    origin: Optional[tuple[int, int]] = None

    def as_dict(self) -> dict:
        return {
            "x_axis": list(self.x_axis) if self.x_axis else None,
            "y_axis": list(self.y_axis) if self.y_axis else None,
            "origin": list(self.origin) if self.origin else None,
        }


@dataclass
class LegendEntry:
    label: str
    color: Optional[tuple[int, int, int]] = None
    bbox: Optional[tuple[int, int, int, int]] = None


@dataclass
class GraphBoundary:
    """The recovered plot-frame rectangle, in crop-local pixel
    coordinates, plus provenance: `source` tells later stages whether
    this came from real line detection or is just "no lines found,
    used the whole crop" so validation can weigh it accordingly."""
    bbox: tuple[int, int, int, int]
    source: str  # "axis_lines" | "fallback_full_crop"
    confidence: float = 0.0


@dataclass
class GraphValidationResult:
    ok: bool
    reasons: list[str] = field(default_factory=list)


@dataclass
class CropGeometry:
    """Where a recovered crop sits, in both coordinate spaces, so
    later stages can map LayoutRegion bboxes (PDF points) and OCR
    boxes (crop-local pixels) onto each other without re-deriving the
    transform every time."""
    origin_px: tuple[float, float]   # top-left of the crop, in rendered-page pixel space
    scale: float                     # rendered-image px per PDF pt (copied from RenderedPage.scale)
    size_px: tuple[int, int]         # (width, height) of the crop, in pixels

    def page_bbox_to_crop_px(self, bbox_pdf_pt: BBox) -> tuple[int, int, int, int]:
        x0, y0, x1, y1 = bbox_pdf_pt
        ox, oy = self.origin_px
        return (
            int(x0 * self.scale - ox),
            int(y0 * self.scale - oy),
            int(x1 * self.scale - ox),
            int(y1 * self.scale - oy),
        )

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

class BoundaryDetector(Protocol):
    def __call__(
        self, image: Image.Image, config: GraphExtractionConfig
    ) -> tuple[GraphBoundary, GraphAxes]: ...


# ============================================================
# STAGE 1 — INITIAL CROP
#
# Exactly the EducationalRegion bbox. No page scan — the bbox was
# already localized upstream by Educational Region Detection.
# ============================================================

def _clamp_box(box: tuple[float, float, float, float], image_size: tuple[int, int]) -> tuple[int, int, int, int]:
    width, height = image_size
    x0, y0, x1, y1 = box
    x0 = max(0, min(int(x0), width - 1))
    y0 = max(0, min(int(y0), height - 1))
    x1 = max(x0 + 1, min(int(x1), width))
    y1 = max(y0 + 1, min(int(y1), height))
    return (x0, y0, x1, y1)


def _region_geometry(rendered: RenderedPage, region: EducationalRegion) -> CropGeometry:
    x0, y0, x1, y1 = region.bbox
    scale = rendered.scale
    px = (x0 * scale, y0 * scale, x1 * scale, y1 * scale)
    return CropGeometry(
        origin_px=(px[0], px[1]),
        scale=scale,
        size_px=(int(px[2] - px[0]), int(px[3] - px[1])),
    )


def initial_crop(rendered: RenderedPage, region: EducationalRegion) -> tuple[Image.Image, CropGeometry]:
    """Stage 1 — crop = rendered.crop(region.bbox). Kept as its own
    function (rather than inlined) so it's independently testable and
    so callers who genuinely only want the raw DocLayout box (e.g.
    debugging) don't have to run the rest of the pipeline."""
    geometry = _region_geometry(rendered, region)
    ox, oy = geometry.origin_px
    width, height = geometry.size_px
    box = _clamp_box((ox, oy, ox + width, oy + height), rendered.image.size)
    return rendered.image.crop(box), geometry


# ============================================================
# STAGE 2 — SMART CROP EXPANSION
#
# Grow the DocLayout box outward, then trim back any run of near-
# blank rows/columns at the outer edge, so the crop captures title /
# axis labels / legend / caption without dragging in acres of page
# whitespace or a neighboring figure.
# ============================================================

def _scan_edge(gray: np.ndarray, config: GraphExtractionConfig, *, axis: int, reverse: bool) -> int:
    """Count consecutive near-blank rows (axis=0) or columns (axis=1)
    starting from one edge of `gray`, stopping at the first line that
    isn't near-blank. Only commits the trim if the blank run is at
    least `blank_row_streak` long, so a single stray blank line right
    next to real content is never mistaken for page margin."""
    length = gray.shape[axis]
    indices = range(length) if not reverse else range(length - 1, -1, -1)
    trimmed = 0
    for i in indices:
        line = gray[i, :] if axis == 0 else gray[:, i]
        if float(np.std(line)) < config.blank_row_std_threshold:
            trimmed += 1
        else:
            break
    return trimmed if trimmed >= config.blank_row_streak else 0


def _trim_blank_border(image: Image.Image, config: GraphExtractionConfig) -> tuple[int, int, int, int]:
    gray = np.array(image.convert("L"), dtype=np.float32)
    height, width = gray.shape

    top = _scan_edge(gray, config, axis=0, reverse=False)
    bottom = _scan_edge(gray, config, axis=0, reverse=True)
    left = _scan_edge(gray, config, axis=1, reverse=False)
    right = _scan_edge(gray, config, axis=1, reverse=True)

    x0, y0 = left, top
    x1, y1 = width - right, height - bottom
    if x1 <= x0 or y1 <= y0:
        # Degenerate (whole crop looked blank, or trims overlapped) —
        # keep the untrimmed crop rather than return an empty box.
        return (0, 0, width, height)
    return (x0, y0, x1, y1)


def expand_crop(
    rendered: RenderedPage,
    region: EducationalRegion,
    config: GraphExtractionConfig,
    *,
    margin_ratio: Optional[float] = None,
) -> tuple[Image.Image, CropGeometry]:
    """Stage 2 — expand region.bbox outward by `margin_ratio` (of its
    own width/height, each side), then trim back to content so the
    expansion stops at blank margins / before a neighboring figure.

    Re-derives from `region.bbox` directly (not from initial_crop()'s
    output) to avoid compounding rounding error from cropping twice.
    """
    margin_ratio = config.expansion_margin_ratio if margin_ratio is None else margin_ratio
    x0, y0, x1, y1 = region.bbox
    width, height = x1 - x0, y1 - y0
    margin_x, margin_y = width * margin_ratio, height * margin_ratio

    expanded_bbox_pt = (x0 - margin_x, y0 - margin_y, x1 + margin_x, y1 + margin_y)
    scale = rendered.scale
    px_box = _clamp_box(tuple(v * scale for v in expanded_bbox_pt), rendered.image.size)

    raw_crop = rendered.image.crop(px_box)
    lx0, ly0, lx1, ly1 = _trim_blank_border(raw_crop, config)

    final_px_box = _clamp_box(
        (px_box[0] + lx0, px_box[1] + ly0, px_box[0] + lx1, px_box[1] + ly1),
        rendered.image.size,
    )
    crop = rendered.image.crop(final_px_box)
    geometry = CropGeometry(
        origin_px=(final_px_box[0], final_px_box[1]),
        scale=scale,
        size_px=(final_px_box[2] - final_px_box[0], final_px_box[3] - final_px_box[1]),
    )
    return crop, geometry


# ============================================================
# STAGE 3 (+ 5) — GRAPH BOUNDARY / AXIS DETECTION
#
# OpenCV line detection recovers the plot frame: the longest near-
# horizontal line is treated as the x-axis, the longest near-vertical
# line as the y-axis, and their combined extent (plus a small pad) is
# the plot rectangle. Falls back to "use the whole crop" when no
# strong lines are found — the graph is still emitted, just flagged
# with low boundary confidence for Stage 8 to weigh.
# ============================================================

def _fallback_boundary(size: tuple[int, int]) -> tuple[GraphBoundary, GraphAxes]:
    width, height = size
    return (
        GraphBoundary(bbox=(0, 0, width, height), source="fallback_full_crop", confidence=0.0),
        GraphAxes(),
    )


def _intersect(
    h_line: tuple[int, int, int, int], v_line: tuple[int, int, int, int]
) -> Optional[tuple[int, int]]:
    """Approximate intersection of a near-horizontal and near-
    vertical segment (either may be slightly tilted), used as the
    axis origin."""
    x1, y1, x2, y2 = h_line
    x3, y3, x4, y4 = v_line
    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if denom == 0:
        return None
    px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom
    py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom
    return (int(px), int(py))


def _iter_hough_lines(raw_lines: Any) -> list[tuple[int, int, int, int]]:
    """Normalizes cv2.HoughLinesP()'s return value into a flat list of
    (x0, y0, x1, y1) int tuples.

    OpenCV has shipped more than one shape for this call depending on
    version/bindings:
        - (N, 1, 4)  -- the documented shape; each line lives at line[0]
        - (N, 4)     -- some builds return it already flattened, so
                        line[0] is just x0 (a bare int/float), and
                        `x0, y0, x1, y1 = line[0]` fails to unpack
    A single detected line can also come back with the batch
    dimension squeezed out entirely -- shape (4,) instead of (1, 1, 4)
    or (1, 4). This normalizes all of the above into the same flat
    list. Anything that still doesn't resolve to exactly 4 numbers per
    line is logged and skipped rather than raised, so a single
    malformed detection never takes down the whole boundary-detection
    stage (or the page it belongs to).
    """
    if raw_lines is None:
        return []

    array = np.asarray(raw_lines)
    if array.size == 0:
        return []

    # Collapse a singleton middle dimension ((N, 1, 4) -> (N, 4)), and
    # promote a single flat line ((4,) -- the squeezed single-line
    # case) to a one-line batch ((1, 4)), so both feed the same
    # per-row loop below.
    if array.ndim == 1 and array.shape[0] == 4:
        array = array.reshape(1, 4)
    elif array.ndim == 3:
        array = array.reshape(array.shape[0], -1)
    elif array.ndim != 2:
        logger.warning(
            "cv2.HoughLinesP returned an unexpected shape %s — ignoring these detections.",
            array.shape,
        )
        return []

    lines: list[tuple[int, int, int, int]] = []
    for row in array:
        values = np.asarray(row).reshape(-1)
        if values.shape[0] != 4:
            logger.warning("Malformed Hough line detection %r — skipping.", row.tolist())
            continue
        try:
            x0, y0, x1, y1 = (int(v) for v in values)
        except (TypeError, ValueError):
            logger.warning("Malformed Hough line detection %r — skipping.", row.tolist())
            continue
        lines.append((x0, y0, x1, y1))
    return lines


def default_boundary_detector(
    image: Image.Image, config: GraphExtractionConfig
) -> tuple[GraphBoundary, GraphAxes]:
    """Default BoundaryDetector: Canny edges -> probabilistic Hough
    transform -> longest horizontal/vertical line = x/y axis."""
    width, height = image.size

    if cv2 is None:
        logger.warning("opencv-python not installed — skipping boundary detection, using full crop.")
        return _fallback_boundary((width, height))

    gray = np.array(image.convert("L"))
    edges = cv2.Canny(gray, config.canny_low, config.canny_high)

    min_length = max(int(config.hough_min_line_fraction * max(width, height)), 1)
    raw_lines = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 180,
        threshold=config.hough_threshold,
        minLineLength=min_length,
        maxLineGap=config.hough_max_line_gap,
    )

    # Accepts either common cv2.HoughLinesP() return shape (and a
    # squeezed single-line result); None or an empty result both fall
    # straight through to the "no lines found" fallback below.
    lines = _iter_hough_lines(raw_lines)
    if not lines:
        return _fallback_boundary((width, height))

    horizontals: list[tuple[float, tuple[int, int, int, int]]] = []
    verticals: list[tuple[float, tuple[int, int, int, int]]] = []
    for x0, y0, x1, y1 in lines:
        angle = abs(np.degrees(np.arctan2(y1 - y0, x1 - x0)))
        length = float(np.hypot(x1 - x0, y1 - y0))
        if angle <= config.axis_angle_tolerance_deg or angle >= 180 - config.axis_angle_tolerance_deg:
            horizontals.append((length, (x0, y0, x1, y1)))
        elif abs(angle - 90) <= config.axis_angle_tolerance_deg:
            verticals.append((length, (x0, y0, x1, y1)))

    x_axis = max(horizontals, key=lambda item: item[0])[1] if horizontals else None
    y_axis = max(verticals, key=lambda item: item[0])[1] if verticals else None
    axes = GraphAxes(x_axis=x_axis, y_axis=y_axis)

    if x_axis is None and y_axis is None:
        return _fallback_boundary((width, height))

    if x_axis is not None and y_axis is not None:
        axes.origin = _intersect(x_axis, y_axis)

    xs: list[int] = []
    ys: list[int] = []
    for axis_line in (x_axis, y_axis):
        if axis_line is not None:
            xs.extend([axis_line[0], axis_line[2]])
            ys.extend([axis_line[1], axis_line[3]])

    pad = 5
    plot_bbox = (
        max(min(xs) - pad, 0),
        max(min(ys) - pad, 0),
        min(max(xs) + pad, width),
        min(max(ys) + pad, height),
    )
    confidence = min(1.0, (len(horizontals) + len(verticals)) / 4.0)
    return GraphBoundary(bbox=plot_bbox, source="axis_lines", confidence=confidence), axes


def _touches_edge(bbox: tuple[int, int, int, int], size: tuple[int, int], tolerance: int = 3) -> bool:
    x0, y0, x1, y1 = bbox
    width, height = size
    return x0 <= tolerance or y0 <= tolerance or x1 >= width - tolerance or y1 >= height - tolerance


def recover_graph_crop(
    rendered: RenderedPage,
    region: EducationalRegion,
    config: GraphExtractionConfig,
    boundary_detector: BoundaryDetector,
) -> tuple[Image.Image, CropGeometry, GraphBoundary, GraphAxes]:
    """Stages 1-3 combined: expand -> detect boundary, re-expanding
    (up to `config.max_expansion_rounds` times) whenever the detected
    plot frame touches the crop's own edge — a sign the true graph
    extends past the current margin."""
    margin_ratio = config.expansion_margin_ratio
    crop, geometry = expand_crop(rendered, region, config, margin_ratio=margin_ratio)
    boundary, axes = boundary_detector(crop, config)

    rounds = 0
    while _touches_edge(boundary.bbox, crop.size) and rounds < config.max_expansion_rounds:
        margin_ratio *= 1.5
        crop, geometry = expand_crop(rendered, region, config, margin_ratio=margin_ratio)
        boundary, axes = boundary_detector(crop, config)
        rounds += 1

    return crop, geometry, boundary, axes


# ============================================================
# STAGE 4 — OCR
#
# Sprint 8: this stage is now just a call into the shared
# ingest_textbook_images.OCRService (imported as run_ocr() /
# _default_ocr_service above) — no PaddleOCR wrapper lives in this
# file anymore. Run once on the recovered crop; every later stage
# (legend, title, validation) reuses this same OCR output rather than
# re-running it.
# ============================================================



# ============================================================
# STAGE 6 — LEGEND DETECTION
# ============================================================

def _is_near_grayscale(rgb: np.ndarray, saturation_threshold: float = 12.0) -> bool:
    return float(np.max(rgb) - np.min(rgb)) < saturation_threshold


def detect_legend(
    image: Image.Image,
    ocr_lines: list[OCRLine],
    boundary: GraphBoundary,
    config: GraphExtractionConfig,
) -> list[LegendEntry]:
    """Stage 6 — legend entries: short OCR lines sitting outside the
    plot rectangle, each paired with a small color swatch sampled
    just to its left. Heuristic, like the rest of this pipeline's
    detection stages — good enough to seed retrieval/explanation, not
    a guarantee of exact swatch colors."""
    plot_x0, plot_y0, plot_x1, plot_y1 = boundary.bbox
    array = np.array(image.convert("RGB"))
    height, width = array.shape[:2]

    entries: list[LegendEntry] = []
    for line in ocr_lines:
        text = line.text.strip()
        if not text or len(text) > config.legend_max_label_chars:
            continue

        lx0, ly0, lx1, ly1 = line.bbox
        inside_plot = lx0 >= plot_x0 and lx1 <= plot_x1 and ly0 >= plot_y0 and ly1 <= plot_y1
        if inside_plot:
            continue  # tick labels and other in-plot text aren't legend entries

        swatch_x0 = max(0, lx0 - config.legend_swatch_size)
        swatch = array[max(0, ly0):min(height, ly1), swatch_x0:lx0]
        if swatch.size == 0:
            continue

        mean_color = swatch.reshape(-1, 3).mean(axis=0)
        if _is_near_grayscale(mean_color):
            continue  # no colored swatch next to this line -> probably not a legend entry

        entries.append(
            LegendEntry(
                label=text,
                color=tuple(int(c) for c in mean_color),
                bbox=line.bbox,
            )
        )

    return entries if len(entries) >= config.legend_min_lines else []


# ============================================================
# STAGE 7 — TITLE DETECTION
#
# Priority order, exactly as specified — never guesses; falls through
# to None rather than fabricating a title from nothing.
#   1. Caption block attached by EducationalRegion
#   2. OCR text above the plot
#   3. Largest OCR line
#   4. Nearby title block from context
# ============================================================

def _boxes_overlap(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> bool:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    return ax0 < bx1 and ax1 > bx0 and ay0 < by1 and ay1 > by0


def _ocr_text_within(bbox_pdf_pt: BBox, ocr_lines: list[OCRLine], geometry: CropGeometry) -> Optional[str]:
    target = geometry.page_bbox_to_crop_px(bbox_pdf_pt)
    matches = [line for line in ocr_lines if _boxes_overlap(line.bbox, target)]
    if not matches:
        return None
    matches.sort(key=lambda line: line.bbox[1])
    joined = " ".join(line.text.strip() for line in matches if line.text.strip())
    return joined or None


def detect_title(
    region: EducationalRegion,
    ocr_lines: list[OCRLine],
    geometry: CropGeometry,
    boundary: GraphBoundary,
) -> Optional[str]:
    # Priority 1: the caption block EducationalRegion already
    # associated. geometry maps its page-space bbox into this crop's
    # pixel space so we can read whatever OCR line(s) fall inside it.
    if region.caption is not None:
        text = _ocr_text_within(region.caption.bbox, ocr_lines, geometry)
        if text:
            return text

    # Priority 2: OCR text sitting above the detected plot rectangle.
    above_plot = [line for line in ocr_lines if line.bbox[3] <= boundary.bbox[1] and line.text.strip()]
    if above_plot:
        above_plot.sort(key=lambda line: line.bbox[1])
        return above_plot[0].text.strip()

    # Priority 3: the single tallest OCR line in the crop — textbooks
    # consistently set figure titles in the largest type on the figure.
    non_empty = [line for line in ocr_lines if line.text.strip()]
    if non_empty:
        largest = max(non_empty, key=lambda line: line.bbox[3] - line.bbox[1])
        return largest.text.strip()

    # Priority 4: a title block EducationalRegionBuilder attached as context.
    for block in region.context:
        if block.region_class == LayoutLabel.TITLE:
            text = _ocr_text_within(block.bbox, ocr_lines, geometry)
            if text:
                return text

    return None


# ============================================================
# GRAPH SUBTYPE (enrichment only — never blocks validation)
# ============================================================

def classify_graph_subtype(image: Image.Image, boundary: GraphBoundary) -> str:
    """Lightweight, heuristic subtype guess (bar / line / scatter /
    unknown) from contour shapes inside the plot rectangle. Purely
    enrichment for retrieval — a wrong or "unknown" guess never blocks
    acceptance in Stage 8."""
    if cv2 is None:
        return "unknown"

    x0, y0, x1, y1 = boundary.bbox
    plot = np.array(image.convert("L"))[max(0, y0):y1, max(0, x0):x1]
    if plot.size == 0:
        return "unknown"

    edges = cv2.Canny(plot, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return "unknown"

    tall_rects = small_blobs = long_curves = 0
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = cv2.contourArea(contour)
        if w > 0 and h / w > 2 and area > 20:
            tall_rects += 1
        elif w < 8 and h < 8:
            small_blobs += 1
        elif cv2.arcLength(contour, False) > 0.5 * plot.shape[1]:
            long_curves += 1

    counts = {"bar": tall_rects, "scatter": small_blobs, "line": long_curves}
    best_type, best_count = max(counts.items(), key=lambda item: item[1])
    return best_type if best_count >= 3 else "unknown"


# ============================================================
# STAGE 8 — GRAPH VALIDATION
#
# Accept/reject gate. A rejected candidate is still returned (ok=False,
# candidate populated) rather than dropped, so recover_mixed_regions.py
# can attempt recovery under a different strategy.
# ============================================================

def _is_mostly_blank(image: Image.Image, config: GraphExtractionConfig) -> bool:
    gray = np.array(image.convert("L"), dtype=np.float32)
    return float(np.std(gray)) < config.blank_row_std_threshold


def validate_graph(
    image: Image.Image,
    boundary: GraphBoundary,
    axes: GraphAxes,
    ocr_lines: list[OCRLine],
    config: GraphExtractionConfig,
) -> GraphValidationResult:
    reasons: list[str] = []

    plot_x0, plot_y0, plot_x1, plot_y1 = boundary.bbox
    plot_area = max(0, plot_x1 - plot_x0) * max(0, plot_y1 - plot_y0)
    if plot_area <= 0:
        reasons.append("no_plot_area")

    if axes.x_axis is None and axes.y_axis is None:
        reasons.append("no_axis_detected")

    ocr_chars = sum(len(line.text.strip()) for line in ocr_lines)
    if ocr_chars < config.min_ocr_chars:
        reasons.append("insufficient_ocr_text")

    width, height = image.size
    crop_area = width * height
    if crop_area > 0 and plot_area > 0:
        content_fraction = plot_area / crop_area
        if content_fraction < config.min_content_fraction:
            reasons.append("plot_area_too_small")
        elif content_fraction > config.max_content_fraction and boundary.source == "fallback_full_crop":
            reasons.append("plot_area_not_localized")

    if _is_mostly_blank(image, config):
        reasons.append("crop_mostly_blank")

    return GraphValidationResult(ok=not reasons, reasons=reasons)


# ============================================================
# ENTRYPOINT — implements the RegionExtractor protocol
# ============================================================

class GraphRecoveryEngine:
    """RegionExtractor for EducationalRegion.type == ExtractionType.GRAPH.

    Sequences Stages 1-8 and packages the result as a VisualCandidate.
    OCR service and boundary detector are both injectable so this can
    be exercised in tests without opencv-python or paddleocr.
    """

    def __init__(
        self,
        *,
        config: Optional[GraphExtractionConfig] = None,
        ocr_service: Optional[OCRService] = None,
        boundary_detector: Optional[BoundaryDetector] = None,
    ) -> None:
        self.config = config or GraphExtractionConfig()
        self.ocr_service: OCRService = ocr_service or _default_ocr_service
        self.boundary_detector: BoundaryDetector = boundary_detector or default_boundary_detector

    def __call__(self, region: EducationalRegion, rendered: RenderedPage, **context: Any) -> RegionResult:
        if region.type != ExtractionType.GRAPH:
            # dispatch_region() only routes GRAPH regions here, but a
            # misconfigured region_extractors map shouldn't crash oddly.
            return RegionResult(
                region=region,
                ok=False,
                error=f"GraphRecoveryEngine received type={region.type!r}, expected {ExtractionType.GRAPH!r}",
            )

        try:
            crop, geometry, boundary, axes = recover_graph_crop(
                rendered, region, self.config, self.boundary_detector,
            )
            ocr_lines = run_ocr(crop, self.ocr_service)
            legend = detect_legend(crop, ocr_lines, boundary, self.config)
            title = detect_title(region, ocr_lines, geometry, boundary)
            subtype = classify_graph_subtype(crop, boundary)
            validation = validate_graph(crop, boundary, axes, ocr_lines, self.config)

            recovered_bbox = geometry.crop_px_to_page_bbox((0, 0, crop.size[0], crop.size[1]))
            ocr_text = "\n".join(line.text.strip() for line in ocr_lines if line.text.strip()) or None
            confidence = (
                min(region.confidence, boundary.confidence)
                if boundary.source == "axis_lines"
                else region.confidence * 0.5
            )

            candidate = VisualCandidate.from_region(
                region,
                bbox=recovered_bbox,  # the *recovered* graph bbox, not just the DocLayout box
                image=crop,
                ocr_text=ocr_text,
                confidence=confidence,
                metadata={
                    "graph_subtype": subtype,
                    "title": title,
                    "axis": axes.as_dict(),
                    "legend": [
                        {"label": entry.label, "color": entry.color, "bbox": entry.bbox}
                        for entry in legend
                    ],
                    "boundary_source": boundary.source,
                    "boundary_bbox_px": list(boundary.bbox),
                    "validation_reasons": validation.reasons,
                },
            )

            return RegionResult(
                region=region,
                candidate=candidate,
                ok=validation.ok,
                error=None if validation.ok else "graph_validation_failed: " + ", ".join(validation.reasons),
            )
        except Exception as exc:  # extractor failures must not kill the page
            logger.exception(
                "Graph extraction failed for region_id=%s (page %d)", region.region_id, region.page,
            )
            return RegionResult(region=region, ok=False, error=str(exc))


# Module-level default instance — what
# ingest_textbook_images.default_region_extractors() registers under
# ExtractionType.GRAPH. Construct your own GraphRecoveryEngine(...)
# instead if you need custom config/ocr_service/boundary_detector.
extract_graph_region = GraphRecoveryEngine()


__all__ = [
    "GraphExtractionConfig",
    "GraphAxes",
    "LegendEntry",
    "GraphBoundary",
    "GraphValidationResult",
    "CropGeometry",
    "BoundaryDetector",
    "initial_crop",
    "expand_crop",
    "default_boundary_detector",
    "recover_graph_crop",
    "detect_legend",
    "detect_title",
    "classify_graph_subtype",
    "validate_graph",
    "GraphRecoveryEngine",
    "extract_graph_region",
]