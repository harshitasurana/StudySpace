"""
scripts/extract_diagrams.py

Sprint 6 — Educational Visual Extractor.

RegionExtractor for every educational visual EXCEPT graphs and tables:
EducationalRegion.type in {"diagram", "photo", "activity"}. Tables stay
on their own path (PP-StructureV3, a later sprint) since cell/row/
column extraction is a fundamentally different problem from "recover
and classify a figure" — everything covered by this file needs a
single, shared pipeline: crop recovery, OCR, subtype classification,
panel detection, structural analysis, validation.

    EducationalRegion
            |
            v
      Initial Crop              (Stage 1a)
            |
            v
      Crop Expansion             (Stage 1b)
            |
            v
  Visual Boundary Recovery       (Stage 1c)
            |
            v
           OCR                  (Stage 2)
            |
            v
 Educational Visual Classification (Stage 3)
            |
            v
      Panel Detection            (Stage 4)
            |
            v
     Structural Analysis         (Stage 5)
            |
            v
     Visual Validation           (Stage 6)
            |
            v
      VisualCandidate

Where extract_graphs.py anchors crop/boundary recovery on axis lines
(graphs reliably have them), this module can't assume any particular
geometric cue — a photograph, a circuit diagram, and a map have
almost nothing in common at the pixel level. So Stage 1c instead
recovers "wherever the non-blank content is" (a dilated edge mask),
and Stage 3's subtype classification is what tells every later stage
(panel detection heuristics aside) what kind of structure to expect.

Self-contained by design (imports only from ingest_textbook_images,
not from scripts/extract_graphs.py) — same convention as the rest of
this pipeline's stage modules, so each extractor script can be read,
tested, and replaced independently. This does mean the crop-recovery
plumbing (CropGeometry, blank-border trimming) is duplicated with
extract_graphs.py rather than shared; that duplication is intentional,
not an oversight. OCR is the one exception: as of Sprint 8, Stage 2
runs through the shared ingest_textbook_images.OCRService rather than
a PaddleOCR wrapper of this module's own, so a crop is never OCR'd
twice by two different extractors.

Every stage with a genuine modeling choice behind it (boundary
detector, subtype classifier) is injectable, so this is fully
testable without opencv-python or paddleocr installed — inject a fake
OCRService the same way.
"""

from __future__ import annotations

import logging
import re
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

# EducationalRegion.type values this extractor accepts. Registered in
# ingest_textbook_images.default_region_extractors() under each of
# these keys, pointing at the same DiagramExtractionEngine instance.
SUPPORTED_TYPES: frozenset[str] = frozenset(
    {ExtractionType.DIAGRAM, ExtractionType.PHOTO, ExtractionType.ACTIVITY}
)


# ============================================================
# CONFIG
# ============================================================

@dataclass
class DiagramExtractionConfig:
    """Thresholds for the educational visual extraction pipeline."""

    # Stage 1b — crop expansion (same knobs/logic as extract_graphs.py).
    expansion_margin_ratio: float = 0.15
    blank_row_std_threshold: float = 6.0
    blank_row_streak: int = 6
    max_expansion_rounds: int = 2

    # Stage 1c — visual boundary recovery (content-mask based).
    canny_low: int = 50
    canny_high: int = 150
    content_pad_px: int = 6
    boundary_dilate_kernel: int = 9
    boundary_dilate_iterations: int = 2

    # Stage 3 — classification.
    min_keyword_hits: int = 1

    # Stage 4 — panel detection.
    panel_gap_std_threshold: float = 6.0
    panel_min_gap_px: int = 12
    panel_min_size_px: int = 40
    panel_label_regex: str = r"^\(?[A-Za-z]\)?[:.]?$"

    # Stage 6 — validation.
    min_ocr_chars: int = 3
    min_content_fraction: float = 0.02
    max_content_fraction: float = 0.995


# ============================================================
# STAGE OUTPUT SHAPES
#
# OCRLine itself is no longer defined here (Sprint 8 moved it to
# ingest_textbook_images.OCRLine, shared with every other extractor)
# — only the shapes specific to visual extraction live in this file.
# ============================================================

@dataclass
class DiagramBoundary:
    """Recovered content rectangle, in crop-local pixel coordinates.
    `source` tells later stages whether this came from real content
    detection or is "nothing found, used the whole crop"."""
    bbox: tuple[int, int, int, int]
    source: str  # "content_mask" | "fallback_full_crop"
    confidence: float = 0.0


@dataclass
class Panel:
    """One sub-figure of a composite figure (e.g. panel "A" of an
    A/B/C/D grid)."""
    label: Optional[str]
    bbox: tuple[int, int, int, int]      # crop-local px
    ocr_text: Optional[str]
    crop: Any                             # PIL.Image, cropped to `bbox`


@dataclass
class ClassificationResult:
    subtype: str
    domain: str
    confidence: float
    matched_keywords: list[str] = field(default_factory=list)


@dataclass
class VisualStructure:
    """Free-form structural-extraction result; `kind` says which
    domain-specific shape `data` follows (see analyze_structure)."""
    kind: str
    data: dict = field(default_factory=dict)


@dataclass
class DiagramValidationResult:
    ok: bool
    reasons: list[str] = field(default_factory=list)


@dataclass
class CropGeometry:
    """Where a recovered crop sits, in both coordinate spaces — same
    contract as extract_graphs.CropGeometry (duplicated here
    intentionally; see module docstring)."""
    origin_px: tuple[float, float]
    scale: float
    size_px: tuple[int, int]

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
    def __call__(self, image: Image.Image, config: DiagramExtractionConfig) -> DiagramBoundary: ...


class SubtypeClassifier(Protocol):
    def __call__(
        self,
        ocr_lines: list[OCRLine],
        region: EducationalRegion,
        title: Optional[str],
        caption_text: Optional[str],
        panel_bboxes: list[tuple[int, int, int, int]],
        image: Image.Image,
        boundary: DiagramBoundary,
        config: DiagramExtractionConfig,
    ) -> ClassificationResult: ...


# ============================================================
# GEOMETRY / CROP HELPERS
# ============================================================

def _clamp_box(box: tuple[float, float, float, float], image_size: tuple[int, int]) -> tuple[int, int, int, int]:
    width, height = image_size
    x0, y0, x1, y1 = box
    x0 = max(0, min(int(x0), width - 1))
    y0 = max(0, min(int(y0), height - 1))
    x1 = max(x0 + 1, min(int(x1), width))
    y1 = max(y0 + 1, min(int(y1), height))
    return (x0, y0, x1, y1)


def _boxes_overlap(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> bool:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    return ax0 < bx1 and ax1 > bx0 and ay0 < by1 and ay1 > by0


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
    """Stage 1a — crop = rendered.crop(region.bbox). No page scan."""
    geometry = _region_geometry(rendered, region)
    ox, oy = geometry.origin_px
    width, height = geometry.size_px
    box = _clamp_box((ox, oy, ox + width, oy + height), rendered.image.size)
    return rendered.image.crop(box), geometry


def _scan_edge(gray: np.ndarray, config: DiagramExtractionConfig, *, axis: int, reverse: bool) -> int:
    """Count consecutive near-blank rows (axis=0) or columns (axis=1)
    from one edge of `gray`, stopping at the first non-blank line.
    Only commits the trim once the run is at least `blank_row_streak`
    long, so a thin gap next to real content isn't mistaken for
    page margin."""
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


def _trim_blank_border(image: Image.Image, config: DiagramExtractionConfig) -> tuple[int, int, int, int]:
    gray = np.array(image.convert("L"), dtype=np.float32)
    height, width = gray.shape

    top = _scan_edge(gray, config, axis=0, reverse=False)
    bottom = _scan_edge(gray, config, axis=0, reverse=True)
    left = _scan_edge(gray, config, axis=1, reverse=False)
    right = _scan_edge(gray, config, axis=1, reverse=True)

    x0, y0 = left, top
    x1, y1 = width - right, height - bottom
    if x1 <= x0 or y1 <= y0:
        return (0, 0, width, height)
    return (x0, y0, x1, y1)


def expand_crop(
    rendered: RenderedPage,
    region: EducationalRegion,
    config: DiagramExtractionConfig,
    *,
    margin_ratio: Optional[float] = None,
) -> tuple[Image.Image, CropGeometry]:
    """Stage 1b — expand region.bbox outward by `margin_ratio`, then
    trim back to content so expansion stops at blank page margin
    rather than dragging in a neighboring figure."""
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
# STAGE 1c — VISUAL BOUNDARY RECOVERY
#
# No axis lines to anchor on (unlike graphs), so this recovers "where
# the actual content is" via a dilated Canny edge mask: dilation
# merges nearby strokes (an apparatus's outline, a map's coastline, a
# photo's subject edges) into a single solid region whose bounding box
# is a much better estimate of the figure than the raw DocLayout box.
# ============================================================

def default_boundary_detector(image: Image.Image, config: DiagramExtractionConfig) -> DiagramBoundary:
    width, height = image.size
    if cv2 is None:
        logger.warning("opencv-python not installed — skipping boundary recovery, using full crop.")
        return DiagramBoundary(bbox=(0, 0, width, height), source="fallback_full_crop", confidence=0.0)

    gray = np.array(image.convert("L"))
    edges = cv2.Canny(gray, config.canny_low, config.canny_high)
    kernel = np.ones((config.boundary_dilate_kernel, config.boundary_dilate_kernel), np.uint8)
    dilated = cv2.dilate(edges, kernel, iterations=config.boundary_dilate_iterations)

    ys, xs = np.nonzero(dilated)
    if len(xs) == 0:
        return DiagramBoundary(bbox=(0, 0, width, height), source="fallback_full_crop", confidence=0.0)

    pad = config.content_pad_px
    x0 = max(int(xs.min()) - pad, 0)
    y0 = max(int(ys.min()) - pad, 0)
    x1 = min(int(xs.max()) + pad, width)
    y1 = min(int(ys.max()) + pad, height)

    coverage = len(xs) / max(1, width * height)
    confidence = min(1.0, coverage * 10)
    return DiagramBoundary(bbox=(x0, y0, x1, y1), source="content_mask", confidence=confidence)


def _touches_edge(bbox: tuple[int, int, int, int], size: tuple[int, int], tolerance: int = 3) -> bool:
    x0, y0, x1, y1 = bbox
    width, height = size
    return x0 <= tolerance or y0 <= tolerance or x1 >= width - tolerance or y1 >= height - tolerance


def recover_visual_crop(
    rendered: RenderedPage,
    region: EducationalRegion,
    config: DiagramExtractionConfig,
    boundary_detector: BoundaryDetector,
) -> tuple[Image.Image, CropGeometry, DiagramBoundary]:
    """Stages 1a-1c combined: expand -> recover boundary, re-expanding
    (up to `max_expansion_rounds` times) whenever the recovered
    boundary touches the crop's own edge."""
    margin_ratio = config.expansion_margin_ratio
    crop, geometry = expand_crop(rendered, region, config, margin_ratio=margin_ratio)
    boundary = boundary_detector(crop, config)

    rounds = 0
    while _touches_edge(boundary.bbox, crop.size) and rounds < config.max_expansion_rounds:
        margin_ratio *= 1.5
        crop, geometry = expand_crop(rendered, region, config, margin_ratio=margin_ratio)
        boundary = boundary_detector(crop, config)
        rounds += 1

    return crop, geometry, boundary


# ============================================================
# STAGE 2 — OCR
#
# Sprint 8: delegates to the shared ingest_textbook_images.OCRService
# (imported above as run_ocr() / _default_ocr_service) — no PaddleOCR
# wrapper lives in this file anymore. Run once on the recovered crop;
# every later stage (classification, panel labeling, title/caption,
# validation) reuses this same output.
# ============================================================

def _ocr_text_within(bbox_pdf_pt: BBox, ocr_lines: list[OCRLine], geometry: CropGeometry) -> Optional[str]:
    target = geometry.page_bbox_to_crop_px(bbox_pdf_pt)
    matches = [line for line in ocr_lines if _boxes_overlap(line.bbox, target)]
    if not matches:
        return None
    matches.sort(key=lambda line: line.bbox[1])
    joined = " ".join(line.text.strip() for line in matches if line.text.strip())
    return joined or None


# ============================================================
# TITLE / CAPTION
#
# Kept distinct (unlike extract_graphs.py, which conflates them):
# `caption_text` is the figure's own caption line ("Fig 4.1: ..."),
# read straight from the caption block EducationalRegion already
# associated. `title` is a separate heading describing the figure
# ("The Human Digestive System") when the textbook prints one.
# ============================================================

def detect_title(
    region: EducationalRegion,
    ocr_lines: list[OCRLine],
    geometry: CropGeometry,
    boundary: DiagramBoundary,
    caption_text: Optional[str],
) -> Optional[str]:
    caption_line_texts: set[str] = set()
    if region.caption is not None:
        target = geometry.page_bbox_to_crop_px(region.caption.bbox)
        caption_line_texts = {
            line.text.strip() for line in ocr_lines if _boxes_overlap(line.bbox, target) and line.text.strip()
        }

    candidates = [line for line in ocr_lines if line.text.strip() and line.text.strip() not in caption_line_texts]

    # Priority 1: text sitting above the recovered visual boundary —
    # textbooks commonly print a heading directly above a figure.
    above = [line for line in candidates if line.bbox[3] <= boundary.bbox[1]]
    if above:
        above.sort(key=lambda line: line.bbox[1])
        return above[0].text.strip()

    # Priority 2: a title block EducationalRegionBuilder attached as context.
    for block in region.context:
        if block.region_class == LayoutLabel.TITLE:
            text = _ocr_text_within(block.bbox, ocr_lines, geometry)
            if text and text not in caption_line_texts:
                return text

    # Priority 3: the single largest OCR line in the crop, excluding the caption.
    if candidates:
        largest = max(candidates, key=lambda line: line.bbox[3] - line.bbox[1])
        return largest.text.strip()

    return None


# ============================================================
# STAGE 3 — EDUCATIONAL VISUAL CLASSIFICATION
#
# Keyword-based over the recovered OCR text, with a structural
# fallback (edge/line statistics) when text gives no signal — e.g. a
# photograph with no printed labels. This is intentionally simple and
# deterministic; swap in a real vision-backed SubtypeClassifier via
# DiagramExtractionEngine(subtype_classifier=...) without touching
# anything else in the pipeline once one exists.
# ============================================================

class VisualSubtype:
    # Biology
    BIOLOGY_ANATOMY_HUMAN = "biology_anatomy_human"
    BIOLOGY_ANATOMY_PLANT = "biology_anatomy_plant"
    BIOLOGY_CELL = "biology_cell"
    BIOLOGY_TISSUE = "biology_tissue"
    BIOLOGY_ORGAN_SYSTEM = "biology_organ_system"
    BIOLOGY_FOOD_CHAIN = "biology_food_chain"
    BIOLOGY_FOOD_WEB = "biology_food_web"
    BIOLOGY_LIFE_CYCLE = "biology_life_cycle"
    BIOLOGY_MICROORGANISM = "biology_microorganism"
    BIOLOGY_ECOSYSTEM = "biology_ecosystem"
    BIOLOGY_CLASSIFICATION_CHART = "biology_classification_chart"

    # Chemistry
    CHEMISTRY_APPARATUS = "chemistry_apparatus"
    CHEMISTRY_EXPERIMENT_SETUP = "chemistry_experiment_setup"
    CHEMISTRY_MOLECULAR_STRUCTURE = "chemistry_molecular_structure"
    CHEMISTRY_ATOMIC_MODEL = "chemistry_atomic_model"
    CHEMISTRY_SEPARATION_TECHNIQUE = "chemistry_separation_technique"
    CHEMISTRY_MIXTURE_DIAGRAM = "chemistry_mixture_diagram"
    CHEMISTRY_PROCESS_DIAGRAM = "chemistry_process_diagram"
    CHEMISTRY_CRYSTAL_STRUCTURE = "chemistry_crystal_structure"

    # Physics
    PHYSICS_CIRCUIT = "physics_circuit"
    PHYSICS_RAY_DIAGRAM = "physics_ray_diagram"
    PHYSICS_FORCE_DIAGRAM = "physics_force_diagram"
    PHYSICS_MOTION_DIAGRAM = "physics_motion_diagram"
    PHYSICS_REFLECTION_REFRACTION = "physics_reflection_refraction"
    PHYSICS_INSTRUMENT = "physics_instrument"
    PHYSICS_MACHINE = "physics_machine"
    PHYSICS_OPTICAL_INSTRUMENT = "physics_optical_instrument"

    # Mathematics
    MATH_GEOMETRY_FIGURE = "math_geometry_figure"
    MATH_ANGLE = "math_angle"
    MATH_TRIANGLE = "math_triangle"
    MATH_CIRCLE = "math_circle"
    MATH_POLYGON = "math_polygon"
    MATH_COORDINATE_GEOMETRY = "math_coordinate_geometry"
    MATH_CONSTRUCTION = "math_construction"
    MATH_SOLID = "math_solid"
    MATH_NET = "math_net"
    MATH_MEASUREMENT_DIAGRAM = "math_measurement_diagram"

    # Geography / Maps
    MAP_INDIA = "map_india"
    MAP_WORLD = "map_world"
    MAP_PHYSICAL = "map_physical"
    MAP_POLITICAL = "map_political"
    MAP_REGION = "map_region"

    # Process diagrams
    PROCESS_WATER_CYCLE = "process_water_cycle"
    PROCESS_CARBON_CYCLE = "process_carbon_cycle"
    PROCESS_NITROGEN_CYCLE = "process_nitrogen_cycle"
    PROCESS_FLOWCHART = "process_flowchart"
    PROCESS_CYCLE = "process_cycle"
    PROCESS_PIPELINE = "process_pipeline"
    PROCESS_SEQUENTIAL = "process_sequential"

    # Educational activities
    ACTIVITY_THINK_AND_ANSWER = "activity_think_and_answer"
    ACTIVITY_OBSERVE = "activity_observe"
    ACTIVITY_EXPERIMENT = "activity_experiment"
    ACTIVITY_BOX = "activity_box"
    ACTIVITY_PRACTICAL_SETUP = "activity_practical_setup"
    ACTIVITY_CLASSROOM = "activity_classroom"

    # Images
    IMAGE_HISTORICAL = "image_historical"
    IMAGE_ANIMAL = "image_animal"
    IMAGE_PLANT = "image_plant"
    IMAGE_ROCK = "image_rock"
    IMAGE_BUILDING = "image_building"
    IMAGE_SPACE_OBJECT = "image_space_object"
    IMAGE_PHOTOGRAPH = "image_photograph"

    # Composite / fallback
    COMPOSITE_FIGURE = "composite_figure"
    UNKNOWN = "unknown"


# domain -> {subtype: (keyword, ...)}. Keywords are lowercase
# substrings matched against joined OCR + title + caption text.
_TAXONOMY: dict[str, dict[str, tuple[str, ...]]] = {
    "biology": {
        VisualSubtype.BIOLOGY_ANATOMY_HUMAN: (
            "human anatomy", "skeleton", "muscular system", "digestive system",
            "respiratory system", "circulatory system", "nervous system",
            "human body", "kidney", "human brain",
        ),
        VisualSubtype.BIOLOGY_ANATOMY_PLANT: (
            "plant anatomy", "root system", "stem", "leaf structure", "xylem",
            "phloem", "stomata", "petal", "sepal", "ovary", "anther",
        ),
        VisualSubtype.BIOLOGY_CELL: (
            "cell diagram", "plant cell", "animal cell", "nucleus", "mitochondria",
            "cell membrane", "cytoplasm", "chloroplast", "ribosome", "golgi",
            "endoplasmic reticulum", "cell wall",
        ),
        VisualSubtype.BIOLOGY_TISSUE: (
            "tissue", "epithelial", "connective tissue", "muscular tissue",
            "nervous tissue", "meristematic", "parenchyma",
        ),
        VisualSubtype.BIOLOGY_ORGAN_SYSTEM: (
            "organ system", "excretory system", "reproductive system",
            "endocrine system", "skeletal system",
        ),
        VisualSubtype.BIOLOGY_FOOD_CHAIN: (
            "food chain", "producer", "consumer", "predator", "prey",
            "trophic level", "decomposer",
        ),
        VisualSubtype.BIOLOGY_FOOD_WEB: ("food web",),
        VisualSubtype.BIOLOGY_LIFE_CYCLE: (
            "life cycle", "larva", "pupa", "metamorphosis", "germination",
            "tadpole", "egg stage",
        ),
        VisualSubtype.BIOLOGY_MICROORGANISM: (
            "bacteria", "virus", "protozoa", "fungi", "microorganism",
            "amoeba", "paramecium",
        ),
        VisualSubtype.BIOLOGY_ECOSYSTEM: (
            "ecosystem", "habitat", "biosphere", "biotic", "abiotic",
        ),
        VisualSubtype.BIOLOGY_CLASSIFICATION_CHART: (
            "classification chart", "kingdom", "phylum", "taxonomy",
            "genus", "classification of",
        ),
    },
    "chemistry": {
        VisualSubtype.CHEMISTRY_APPARATUS: (
            "test tube", "beaker", "flask", "burette", "pipette", "apparatus",
            "conical flask", "round bottom flask", "tripod stand",
            "bunsen burner", "funnel", "condenser",
        ),
        VisualSubtype.CHEMISTRY_EXPERIMENT_SETUP: (
            "experimental setup", "setup for", "arrangement to show",
            "laboratory setup",
        ),
        VisualSubtype.CHEMISTRY_MOLECULAR_STRUCTURE: (
            "molecular structure", "molecule", "covalent bond",
            "structural formula", "bond angle",
        ),
        VisualSubtype.CHEMISTRY_ATOMIC_MODEL: (
            "atomic model", "electron", "proton", "neutron", "nucleus of",
            "bohr model", "rutherford", "thomson model", "orbit",
        ),
        VisualSubtype.CHEMISTRY_SEPARATION_TECHNIQUE: (
            "filtration", "distillation", "evaporation", "sublimation",
            "chromatography", "decantation", "centrifugation", "separating funnel",
        ),
        VisualSubtype.CHEMISTRY_MIXTURE_DIAGRAM: (
            "mixture", "solute", "solvent", "suspension", "colloid",
        ),
        VisualSubtype.CHEMISTRY_PROCESS_DIAGRAM: (
            "chemical reaction", "reactant", "product", "exothermic",
            "endothermic", "oxidation", "reduction",
        ),
        VisualSubtype.CHEMISTRY_CRYSTAL_STRUCTURE: (
            "crystal structure", "crystal lattice", "unit cell", "crystalline",
        ),
    },
    "physics": {
        VisualSubtype.PHYSICS_CIRCUIT: (
            "circuit diagram", "resistor", "battery", "ammeter", "voltmeter",
            "switch", "circuit", "series circuit", "parallel circuit",
        ),
        VisualSubtype.PHYSICS_RAY_DIAGRAM: (
            "ray diagram", "incident ray", "refracted ray", "reflected ray",
            "angle of incidence", "angle of reflection",
        ),
        VisualSubtype.PHYSICS_FORCE_DIAGRAM: (
            "force diagram", "free body diagram", "applied force",
            "normal force", "tension", "friction force",
        ),
        VisualSubtype.PHYSICS_MOTION_DIAGRAM: (
            "motion diagram", "displacement", "velocity time graph",
            "distance time", "trajectory", "projectile",
        ),
        VisualSubtype.PHYSICS_REFLECTION_REFRACTION: (
            "reflection", "refraction", "concave mirror", "convex mirror",
            "concave lens", "convex lens", "refractive index",
        ),
        VisualSubtype.PHYSICS_INSTRUMENT: (
            "measuring instrument", "vernier caliper", "screw gauge",
            "thermometer", "spring balance", "stopwatch",
        ),
        VisualSubtype.PHYSICS_MACHINE: (
            "simple machine", "lever", "pulley", "inclined plane",
            "wheel and axle", "mechanical advantage",
        ),
        VisualSubtype.PHYSICS_OPTICAL_INSTRUMENT: (
            "microscope", "telescope", "periscope", "optical instrument",
        ),
    },
    "mathematics": {
        VisualSubtype.MATH_ANGLE: (
            "angle", "protractor", "acute angle", "obtuse angle", "right angle",
        ),
        VisualSubtype.MATH_TRIANGLE: (
            "triangle", "hypotenuse", "isosceles", "equilateral triangle", "scalene",
        ),
        VisualSubtype.MATH_CIRCLE: (
            "circle", "radius", "diameter", "circumference", "chord",
            "tangent", "arc", "sector", "segment of circle",
        ),
        VisualSubtype.MATH_POLYGON: (
            "polygon", "quadrilateral", "pentagon", "hexagon",
            "parallelogram", "rhombus", "trapezium",
        ),
        VisualSubtype.MATH_COORDINATE_GEOMETRY: (
            "coordinate geometry", "x-axis", "y-axis", "cartesian plane",
            "abscissa", "ordinate",
        ),
        VisualSubtype.MATH_CONSTRUCTION: (
            "construction of", "compass and ruler", "construct a", "bisector",
        ),
        VisualSubtype.MATH_SOLID: (
            "cuboid", "cube", "cylinder", "cone", "sphere", "solid figure",
            "prism", "pyramid",
        ),
        VisualSubtype.MATH_NET: ("net of", "surface net", "unfolded"),
        VisualSubtype.MATH_MEASUREMENT_DIAGRAM: (
            "perimeter", "area of", "volume of", "surface area",
        ),
        VisualSubtype.MATH_GEOMETRY_FIGURE: ("geometric figure", "geometry"),
    },
    "geography": {
        VisualSubtype.MAP_INDIA: ("map of india", "india map", "indian states"),
        VisualSubtype.MAP_WORLD: ("world map", "map of the world"),
        VisualSubtype.MAP_PHYSICAL: ("physical map", "relief map", "contour"),
        VisualSubtype.MAP_POLITICAL: ("political map", "state boundary", "country boundary"),
        VisualSubtype.MAP_REGION: ("region map", "district map", "locate on map"),
    },
    "process": {
        VisualSubtype.PROCESS_WATER_CYCLE: (
            "water cycle", "evaporation", "condensation", "precipitation",
            "hydrological cycle",
        ),
        VisualSubtype.PROCESS_CARBON_CYCLE: (
            "carbon cycle", "photosynthesis", "respiration",
        ),
        VisualSubtype.PROCESS_NITROGEN_CYCLE: (
            "nitrogen cycle", "nitrogen fixation", "nitrification", "denitrification",
        ),
        VisualSubtype.PROCESS_FLOWCHART: ("flowchart", "flow chart"),
        VisualSubtype.PROCESS_CYCLE: ("cycle diagram", "cyclical process"),
        VisualSubtype.PROCESS_PIPELINE: (
            "process pipeline", "production process", "manufacturing process",
        ),
        VisualSubtype.PROCESS_SEQUENTIAL: (
            "sequence of", "sequential steps", "stage 1", "stage 2",
        ),
    },
    "activity": {
        VisualSubtype.ACTIVITY_THINK_AND_ANSWER: (
            "think and answer", "think and discuss", "let us think",
        ),
        VisualSubtype.ACTIVITY_OBSERVE: (
            "observe and", "observation activity", "let us observe",
        ),
        VisualSubtype.ACTIVITY_EXPERIMENT: (
            "activity", "experiment", "let us do", "try this", "do it yourself",
        ),
        VisualSubtype.ACTIVITY_BOX: ("activity box", "did you know"),
        VisualSubtype.ACTIVITY_PRACTICAL_SETUP: (
            "practical", "procedure", "materials required",
        ),
        VisualSubtype.ACTIVITY_CLASSROOM: (
            "group activity", "classroom activity", "discuss in groups",
        ),
    },
    "image": {
        VisualSubtype.IMAGE_HISTORICAL: ("historical", "ancient", "monument", "archive photo"),
        VisualSubtype.IMAGE_ANIMAL: ("animal", "mammal", "reptile", "insect species"),
        VisualSubtype.IMAGE_PLANT: ("tree species", "flower", "plant species", "shrub"),
        VisualSubtype.IMAGE_ROCK: ("rock", "mineral", "igneous", "sedimentary", "metamorphic rock"),
        VisualSubtype.IMAGE_BUILDING: ("building", "architecture", "temple", "fort"),
        VisualSubtype.IMAGE_SPACE_OBJECT: (
            "planet", "galaxy", "solar system", "asteroid", "comet", "space",
        ),
        VisualSubtype.IMAGE_PHOTOGRAPH: ("photograph", "photo of"),
    },
}

SUBTYPE_DOMAIN: dict[str, str] = {
    subtype: domain
    for domain, subtypes in _TAXONOMY.items()
    for subtype in subtypes
}
SUBTYPE_DOMAIN[VisualSubtype.COMPOSITE_FIGURE] = "composite"
SUBTYPE_DOMAIN[VisualSubtype.UNKNOWN] = "unknown"

KEYWORD_RULES: dict[str, tuple[str, ...]] = {
    subtype: keywords
    for subtypes in _TAXONOMY.values()
    for subtype, keywords in subtypes.items()
}


def _structural_fallback_subtype(image: Image.Image, boundary: DiagramBoundary) -> str:
    """When OCR text gives no keyword signal at all (e.g. an unlabeled
    photograph), fall back to coarse edge/line statistics. Deliberately
    conservative — returns UNKNOWN rather than a confident-looking
    wrong answer whenever the signal is ambiguous."""
    if cv2 is None:
        return VisualSubtype.UNKNOWN

    x0, y0, x1, y1 = boundary.bbox
    gray = np.array(image.convert("L"))[max(0, y0):y1, max(0, x0):x1]
    if gray.size == 0:
        return VisualSubtype.UNKNOWN

    edges = cv2.Canny(gray, 50, 150)
    edge_density = float(np.mean(edges > 0))

    color = np.array(image.convert("RGB"))[max(0, y0):y1, max(0, x0):x1]
    color_std = float(np.std(color))

    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180, threshold=40,
        minLineLength=int(0.2 * max(gray.shape)), maxLineGap=10,
    )
    n_lines = 0 if lines is None else len(lines)

    if n_lines >= 6 and edge_density < 0.15:
        return VisualSubtype.MATH_GEOMETRY_FIGURE
    if color_std > 40 and n_lines < 4:
        return VisualSubtype.IMAGE_PHOTOGRAPH
    return VisualSubtype.UNKNOWN


def default_subtype_classifier(
    ocr_lines: list[OCRLine],
    region: EducationalRegion,
    title: Optional[str],
    caption_text: Optional[str],
    panel_bboxes: list[tuple[int, int, int, int]],
    image: Image.Image,
    boundary: DiagramBoundary,
    config: DiagramExtractionConfig,
) -> ClassificationResult:
    # A composite figure (multiple detected panels) takes priority
    # over text-keyword classification — the structural signal here is
    # stronger than any single keyword match.
    if len(panel_bboxes) >= 2:
        return ClassificationResult(
            subtype=VisualSubtype.COMPOSITE_FIGURE, domain="composite",
            confidence=0.9, matched_keywords=[],
        )

    text_parts = [line.text for line in ocr_lines if line.text.strip()]
    if title:
        text_parts.append(title)
    if caption_text:
        text_parts.append(caption_text)
    combined = " ".join(text_parts).lower()

    best_subtype: Optional[str] = None
    best_hits: list[str] = []
    for subtype, keywords in KEYWORD_RULES.items():
        hits = [kw for kw in keywords if kw in combined]
        if len(hits) > len(best_hits):
            best_subtype, best_hits = subtype, hits

    if best_subtype is not None and len(best_hits) >= config.min_keyword_hits:
        confidence = min(1.0, len(best_hits) / 3.0)
        return ClassificationResult(
            subtype=best_subtype, domain=SUBTYPE_DOMAIN[best_subtype],
            confidence=confidence, matched_keywords=best_hits,
        )

    fallback_subtype = _structural_fallback_subtype(image, boundary)
    return ClassificationResult(
        subtype=fallback_subtype,
        domain=SUBTYPE_DOMAIN.get(fallback_subtype, "unknown"),
        confidence=0.3 if fallback_subtype != VisualSubtype.UNKNOWN else 0.0,
        matched_keywords=[],
    )


# ============================================================
# STAGE 4 — PANEL DETECTION
#
# Recursive blank-band split: find content bands along rows first,
# then columns within each row band. Enough to recover the typical
# NCERT panel grids (1xN strips, 2x2 grids) without a general layout
# solver. A figure that doesn't actually split into >= 2 bands is not
# composite — detect_panels() returns [] rather than a single "panel"
# wrapping the whole figure.
# ============================================================

def _find_content_bands(
    array: np.ndarray, axis: int, config: DiagramExtractionConfig
) -> list[tuple[int, int]]:
    length = array.shape[axis]
    is_blank = np.empty(length, dtype=bool)
    for i in range(length):
        line = array[i, :] if axis == 0 else array[:, i]
        is_blank[i] = float(np.std(line)) < config.panel_gap_std_threshold

    bands: list[tuple[int, int]] = []
    start: Optional[int] = None
    blank_run = 0
    for i in range(length):
        if not is_blank[i]:
            if start is None:
                start = i
            blank_run = 0
        else:
            blank_run += 1
            if start is not None and blank_run >= config.panel_min_gap_px:
                bands.append((start, i - blank_run + 1))
                start = None
    if start is not None:
        bands.append((start, length))

    bands = [b for b in bands if (b[1] - b[0]) >= config.panel_min_size_px]
    return bands or [(0, length)]


def _detect_panel_bboxes(
    image: Image.Image, boundary: DiagramBoundary, config: DiagramExtractionConfig
) -> list[tuple[int, int, int, int]]:
    x0, y0, x1, y1 = boundary.bbox
    sub = np.array(image.convert("L"))[y0:y1, x0:x1]
    if sub.size == 0:
        return [boundary.bbox]

    row_bands = _find_content_bands(sub, axis=0, config=config)
    panels: list[tuple[int, int, int, int]] = []
    for ry0, ry1 in row_bands:
        row_slice = sub[ry0:ry1, :]
        col_bands = _find_content_bands(row_slice, axis=1, config=config)
        for cx0, cx1 in col_bands:
            panels.append((x0 + cx0, y0 + ry0, x0 + cx1, y0 + ry1))

    if len(panels) <= 1:
        return [boundary.bbox]
    return panels


def detect_panels(
    image: Image.Image,
    ocr_lines: list[OCRLine],
    boundary: DiagramBoundary,
    config: DiagramExtractionConfig,
) -> list[Panel]:
    bboxes = _detect_panel_bboxes(image, boundary, config)
    if len(bboxes) <= 1:
        return []

    label_pattern = re.compile(config.panel_label_regex)
    panels: list[Panel] = []
    for bbox in bboxes:
        panel_lines = [line for line in ocr_lines if _boxes_overlap(line.bbox, bbox)]

        label = None
        label_candidates = [line for line in panel_lines if label_pattern.match(line.text.strip())]
        if label_candidates:
            label_candidates.sort(key=lambda line: (line.bbox[1], line.bbox[0]))
            label = label_candidates[0].text.strip()

        ocr_text = "\n".join(line.text.strip() for line in panel_lines if line.text.strip()) or None
        panels.append(Panel(label=label, bbox=bbox, ocr_text=ocr_text, crop=image.crop(bbox)))

    return panels


# ============================================================
# STAGE 5 — STRUCTURAL ANALYSIS
#
# Domain-specific extraction beyond raw OCR text. All the shape-
# counting helpers here are coarse cv2 heuristics — good enough to
# seed retrieval/tutoring metadata, not a substitute for a trained
# detector. Every helper degrades to 0/empty when opencv isn't
# installed rather than raising.
# ============================================================

_ANGLE_PATTERN = re.compile(r"\b\d{1,3}\s?°|\bangle\b", re.IGNORECASE)
_MEASUREMENT_PATTERN = re.compile(r"\b\d+(\.\d+)?\s?(cm|mm|m|km|in|inch)\b", re.IGNORECASE)


def _looks_like_angle_label(text: str) -> bool:
    return bool(_ANGLE_PATTERN.search(text))


def _looks_like_measurement(text: str) -> bool:
    return bool(_MEASUREMENT_PATTERN.search(text))


def _cropped_gray(image: Image.Image, boundary: DiagramBoundary) -> np.ndarray:
    x0, y0, x1, y1 = boundary.bbox
    return np.array(image.convert("L"))[max(0, y0):y1, max(0, x0):x1]


def _count_line_segments(image: Image.Image, boundary: DiagramBoundary, config: DiagramExtractionConfig) -> int:
    if cv2 is None:
        return 0
    gray = _cropped_gray(image, boundary)
    if gray.size == 0:
        return 0
    edges = cv2.Canny(gray, config.canny_low, config.canny_high)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=40, minLineLength=15, maxLineGap=5)
    return 0 if lines is None else len(lines)


def _count_arrow_like_shapes(image: Image.Image, boundary: DiagramBoundary) -> int:
    """Arrowheads are hard to detect reliably without a trained model
    — this approximates via small triangular-contour count as a rough
    proxy, not a precise arrow count."""
    if cv2 is None:
        return 0
    gray = _cropped_gray(image, boundary)
    if gray.size == 0:
        return 0
    edges = cv2.Canny(gray, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    count = 0
    for contour in contours:
        approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
        if len(approx) == 3 and cv2.contourArea(contour) < 400:
            count += 1
    return count


def _count_rectangular_boxes(image: Image.Image, boundary: DiagramBoundary, config: DiagramExtractionConfig) -> int:
    if cv2 is None:
        return 0
    gray = _cropped_gray(image, boundary)
    if gray.size == 0:
        return 0
    edges = cv2.Canny(gray, config.canny_low, config.canny_high)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    count = 0
    for contour in contours:
        approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
        if len(approx) == 4 and cv2.contourArea(contour) > 200:
            x, y, w, h = cv2.boundingRect(approx)
            if h > 0 and 0.2 < (w / h) < 5:
                count += 1
    return count


def _estimate_geometry_primitives(
    image: Image.Image, boundary: DiagramBoundary, config: DiagramExtractionConfig
) -> tuple[int, int]:
    """Rough (vertex_count, edge_count) estimate for geometry figures."""
    if cv2 is None:
        return (0, 0)
    gray = _cropped_gray(image, boundary)
    if gray.size == 0:
        return (0, 0)
    edges_img = cv2.Canny(gray, config.canny_low, config.canny_high)
    lines = cv2.HoughLinesP(edges_img, 1, np.pi / 180, threshold=40, minLineLength=15, maxLineGap=5)
    edge_count = 0 if lines is None else len(lines)

    contours, _ = cv2.findContours(edges_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    vertex_count = 0
    for contour in contours:
        approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
        vertex_count += len(approx)
    return (vertex_count, edge_count)


def analyze_structure(
    classification: ClassificationResult,
    ocr_lines: list[OCRLine],
    boundary: DiagramBoundary,
    panels: list[Panel],
    image: Image.Image,
    config: DiagramExtractionConfig,
) -> VisualStructure:
    text_labels = [line.text.strip() for line in ocr_lines if line.text.strip()]
    domain = classification.domain

    if panels:
        return VisualStructure(kind="composite", data={
            "panel_count": len(panels),
            "panel_labels": [p.label for p in panels],
        })

    if domain == "biology":
        return VisualStructure(kind="biology", data={
            "labels": text_labels,
            # Arrow/hierarchy detection is a coarse proxy pending a
            # dedicated detector; keys stay present for a stable shape.
            "arrows_detected": _count_arrow_like_shapes(image, boundary),
        })

    if domain == "chemistry":
        return VisualStructure(kind="apparatus", data={
            "instrument_labels": text_labels,
            "connecting_lines": _count_line_segments(image, boundary, config),
        })

    if domain == "physics":
        return VisualStructure(kind="physics_setup", data={
            "labels": text_labels,
            "line_segments": _count_line_segments(image, boundary, config),
        })

    if domain == "mathematics":
        vertices, edges = _estimate_geometry_primitives(image, boundary, config)
        return VisualStructure(kind="geometry", data={
            "vertices_estimate": vertices,
            "edges_estimate": edges,
            "angle_labels": [t for t in text_labels if _looks_like_angle_label(t)],
            "dimension_labels": [t for t in text_labels if _looks_like_measurement(t)],
        })

    if domain == "geography":
        lower_labels = [t.lower() for t in text_labels]
        return VisualStructure(kind="map", data={
            "region_labels": text_labels,
            "legend_present": any("legend" in t for t in lower_labels),
            "scale_present": any("scale" in t for t in lower_labels),
            "compass_present": any("compass" in t or "north" in t for t in lower_labels),
        })

    if domain == "process":
        return VisualStructure(kind="flowchart", data={
            "box_count_estimate": _count_rectangular_boxes(image, boundary, config),
            "arrow_count_estimate": _count_arrow_like_shapes(image, boundary),
            "sequence_labels": text_labels,
        })

    if domain == "activity":
        return VisualStructure(kind="activity", data={"instructions": text_labels})

    if domain == "image":
        return VisualStructure(kind="photograph", data={"annotations": text_labels})

    return VisualStructure(kind="generic", data={"labels": text_labels})


# ============================================================
# STAGE 6 — VISUAL VALIDATION
# ============================================================

def _is_mostly_blank(image: Image.Image, config: DiagramExtractionConfig) -> bool:
    gray = np.array(image.convert("L"), dtype=np.float32)
    return float(np.std(gray)) < config.blank_row_std_threshold


def validate_visual(
    image: Image.Image,
    boundary: DiagramBoundary,
    ocr_lines: list[OCRLine],
    classification: ClassificationResult,
    config: DiagramExtractionConfig,
) -> DiagramValidationResult:
    reasons: list[str] = []

    x0, y0, x1, y1 = boundary.bbox
    content_area = max(0, x1 - x0) * max(0, y1 - y0)
    if content_area <= 0:
        reasons.append("no_content_area")

    # Photographs legitimately carry little or no printed text — don't
    # penalize the "image" domain for sparse OCR.
    ocr_chars = sum(len(line.text.strip()) for line in ocr_lines)
    if classification.domain != "image" and ocr_chars < config.min_ocr_chars:
        reasons.append("insufficient_ocr_text")

    width, height = image.size
    crop_area = width * height
    if crop_area > 0 and content_area > 0:
        content_fraction = content_area / crop_area
        if content_fraction < config.min_content_fraction:
            reasons.append("visual_too_small_relative_to_crop")
        elif content_fraction > config.max_content_fraction and boundary.source == "fallback_full_crop":
            reasons.append("visual_not_localized")

    if _is_mostly_blank(image, config):
        reasons.append("crop_mostly_blank")

    return DiagramValidationResult(ok=not reasons, reasons=reasons)


# ============================================================
# ENTRYPOINT — implements the RegionExtractor protocol
# ============================================================

class DiagramExtractionEngine:
    """RegionExtractor for EducationalRegion.type in SUPPORTED_TYPES
    (diagram / photo / activity). Sequences Stages 1-6 and packages
    the result as a VisualCandidate. OCR service, boundary detector,
    and subtype classifier are all injectable for testing.
    """

    def __init__(
        self,
        *,
        config: Optional[DiagramExtractionConfig] = None,
        ocr_service: Optional[OCRService] = None,
        boundary_detector: Optional[BoundaryDetector] = None,
        subtype_classifier: Optional[SubtypeClassifier] = None,
    ) -> None:
        self.config = config or DiagramExtractionConfig()
        self.ocr_service: OCRService = ocr_service or _default_ocr_service
        self.boundary_detector: BoundaryDetector = boundary_detector or default_boundary_detector
        self.subtype_classifier: SubtypeClassifier = subtype_classifier or default_subtype_classifier

    def __call__(self, region: EducationalRegion, rendered: RenderedPage, **context: Any) -> RegionResult:
        if region.type not in SUPPORTED_TYPES:
            return RegionResult(
                region=region,
                ok=False,
                error=f"DiagramExtractionEngine received type={region.type!r}, expected one of {sorted(SUPPORTED_TYPES)}",
            )

        try:
            crop, geometry, boundary = recover_visual_crop(rendered, region, self.config, self.boundary_detector)
            ocr_lines = run_ocr(crop, self.ocr_service)

            caption_text = _ocr_text_within(region.caption.bbox, ocr_lines, geometry) if region.caption else None
            title = detect_title(region, ocr_lines, geometry, boundary, caption_text)

            panel_bboxes = _detect_panel_bboxes(crop, boundary, self.config)
            classification = self.subtype_classifier(
                ocr_lines, region, title, caption_text, panel_bboxes, crop, boundary, self.config,
            )

            panels = detect_panels(crop, ocr_lines, boundary, self.config) if len(panel_bboxes) > 1 else []
            structure = analyze_structure(classification, ocr_lines, boundary, panels, crop, self.config)
            validation = validate_visual(crop, boundary, ocr_lines, classification, self.config)

            recovered_bbox = geometry.crop_px_to_page_bbox((0, 0, crop.size[0], crop.size[1]))
            ocr_text = "\n".join(line.text.strip() for line in ocr_lines if line.text.strip()) or None
            labels = [line.text.strip() for line in ocr_lines if line.text.strip()]
            confidence = (
                min(region.confidence, boundary.confidence)
                if boundary.source == "content_mask"
                else region.confidence * 0.5
            )

            candidate = VisualCandidate.from_region(
                region,
                bbox=recovered_bbox,  # the recovered visual bbox, not just the DocLayout box
                image=crop,
                caption_text=caption_text,
                ocr_text=ocr_text,
                confidence=confidence,
                metadata={
                    "visual_subtype": classification.subtype,
                    "domain": classification.domain,
                    "classification_confidence": classification.confidence,
                    "matched_keywords": classification.matched_keywords,
                    "title": title,
                    "labels": labels,
                    "panels": [
                        {"label": p.label, "bbox": p.bbox, "ocr_text": p.ocr_text, "crop": p.crop}
                        for p in panels
                    ],
                    "structure": {"kind": structure.kind, **structure.data},
                    "boundary_source": boundary.source,
                    "boundary_bbox_px": list(boundary.bbox),
                    "validation_reasons": validation.reasons,
                },
            )

            return RegionResult(
                region=region,
                candidate=candidate,
                ok=validation.ok,
                error=None if validation.ok else "visual_validation_failed: " + ", ".join(validation.reasons),
            )
        except Exception as exc:  # extractor failures must not kill the page
            logger.exception(
                "Diagram extraction failed for region_id=%s (page %d)", region.region_id, region.page,
            )
            return RegionResult(region=region, ok=False, error=str(exc))


# Module-level default instance — what
# ingest_textbook_images.default_region_extractors() registers under
# ExtractionType.DIAGRAM / PHOTO / ACTIVITY. Construct your own
# DiagramExtractionEngine(...) instead if you need custom
# config/ocr_service/boundary_detector/subtype_classifier.
extract_diagram_region = DiagramExtractionEngine()


__all__ = [
    "SUPPORTED_TYPES",
    "DiagramExtractionConfig",
    "DiagramBoundary",
    "Panel",
    "ClassificationResult",
    "VisualStructure",
    "DiagramValidationResult",
    "CropGeometry",
    "BoundaryDetector",
    "SubtypeClassifier",
    "VisualSubtype",
    "SUBTYPE_DOMAIN",
    "KEYWORD_RULES",
    "initial_crop",
    "expand_crop",
    "default_boundary_detector",
    "recover_visual_crop",
    "detect_title",
    "default_subtype_classifier",
    "detect_panels",
    "analyze_structure",
    "validate_visual",
    "DiagramExtractionEngine",
    "extract_diagram_region",
]