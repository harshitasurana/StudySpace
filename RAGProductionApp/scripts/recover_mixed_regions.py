from __future__ import annotations

"""
recover_mixed_regions.py

Specialized recovery branch for oversized / text-heavy textbook candidates.

Scope
-----
This module does NOT perform general visual extraction. It only:
1. detects oversized or text-heavy mixed page regions;
2. searches inside those parents for bounded visual children;
3. preserves parent/child lineage and recovery evidence;
4. emits crops + JSONL for the shared Pass-1 validation pipeline.

Designed for the uploaded corpus layout:
    knowledge_base/
        Mathematics/math_chapter1.pdf ... math_chapter8.pdf
        Science/science_chapter1.pdf ... science_chapter13.pdf

Recovered child families:
- graph_like_child
- geometry_like_child
- science_figure_child
- raster_child
- table_child
- multi_panel_child
- bounded_visual_child

Important:
- FALLBACK ONLY: this module must never replace or repair normal graph extraction.
- Graph candidates belong to extract_graphs.py and are intentionally not emitted here.
- No Qdrant writes.
- No LLM calls.
- No final semantic acceptance.
- Recovered children must still pass the shared Pass-1 semantic/policy pipeline.
"""

import argparse
import hashlib
import json
import math
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

import fitz


RECOVERY_VERSION = "mixed-region-recovery-v1.2.0-fallback-only"

# Parent detection
MIN_PARENT_RATIO = 0.18
LARGE_PARENT_RATIO = 0.28
OVERSIZED_PARENT_RATIO = 0.40
MIN_PARENT_CHARS = 180
MIN_PARENT_LINES = 4

# Child constraints
MIN_CHILD_SIDE = 20.0
MIN_CHILD_AREA = 500.0
MIN_CHILD_PARENT_RATIO = 0.012
MAX_CHILD_PARENT_RATIO = 0.78
MAX_CHILD_PAGE_RATIO = 0.42
CHILD_PAD = 8.0

# Local clustering
MATH_DRAWING_GAP = 16.0
SCIENCE_DRAWING_GAP = 24.0
RASTER_DRAWING_GAP = 18.0
PANEL_GAP = 32.0

# Dedup
DEDUP_IOU = 0.84
DEDUP_CONTAINMENT = 0.94

PANEL_LABEL_RE = re.compile(r"^\s*[\(\[]?([a-hA-H])[\)\].:]?\s*$")
FIGURE_REF_RE = re.compile(
    r"\b(?:fig(?:ure)?|diagram|graph|plot|table|chart|map)\s*\.?\s*"
    r"(?:\d+(?:\.\d+)*|[a-z])?\b",
    re.I,
)

MATH_GRAPH_TERMS = {
    "graph", "plot", "coordinate", "axis", "axes", "origin", "x-axis",
    "y-axis", "slope", "linear", "curve", "cartesian", "points",
}
MATH_GEOMETRY_TERMS = {
    "triangle", "circle", "angle", "quadrilateral", "polygon", "parallel",
    "perpendicular", "congruent", "radius", "diameter", "chord", "arc",
    "construction", "square", "rectangle", "rhombus", "trapezium",
}
SCIENCE_TERMS = {
    "apparatus", "experiment", "observation", "cell", "tissue", "organ",
    "circuit", "ray", "lens", "mirror", "force", "motion", "atom",
    "molecule", "plant", "animal", "structure", "process", "cycle",
    "system", "reaction", "laboratory", "setup", "specimen", "microscope",
}
TABLE_TERMS = {
    "table", "observation", "result", "results", "value", "values",
    "comparison", "reading", "readings", "data", "frequency", "coordinate",
}


@dataclass
class MixedParent:
    parent_id: str
    subject: str
    chapter: str
    source_pdf: str
    page_number: int
    bbox: list[float]
    page_ratio: float
    reason: str
    text_metrics: dict
    source_types: list[str]


@dataclass
class RecoveredChild:
    candidate_id: str
    # Contract note (Phase 1 detector-contract fix): named parent_candidate_id
    # (not parent_id) to match the same "id of the structural parent this
    # candidate belongs to" field on GraphCandidate and DiagramCandidate.
    # parent_ids (below) is a recovery-specific extension holding the full
    # multi-parent lineage accumulated during dedup merges.
    parent_candidate_id: str
    parent_ids: list[str]
    member_candidate_ids: list[str]
    subject: str
    chapter: str
    source_pdf: str
    page_number: int
    visual_family: str
    visual_subtype: str
    bbox: list[float]
    page_ratio: float
    parent_coverage: float
    confidence: float
    source_types: list[str]
    recovery_method: str
    evidence: dict
    nearby_text: str
    panel_labels: list[str]
    panel_count: int
    is_multi_panel: bool
    crop_path: str = ""


def norm_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def rect_area(r: fitz.Rect) -> float:
    return max(0.0, r.width) * max(0.0, r.height)


def ratio(r: fitz.Rect, container: fitz.Rect) -> float:
    return rect_area(r) / max(1.0, rect_area(container))


def clamp(r: fitz.Rect, page_rect: fitz.Rect) -> fitz.Rect:
    return fitz.Rect(
        max(page_rect.x0, r.x0), max(page_rect.y0, r.y0),
        min(page_rect.x1, r.x1), min(page_rect.y1, r.y1),
    )


def expand(r: fitz.Rect, page_rect: fitz.Rect, pad: float) -> fitz.Rect:
    return clamp(fitz.Rect(r.x0-pad, r.y0-pad, r.x1+pad, r.y1+pad), page_rect)


def union_rect(rects: Iterable[fitz.Rect]) -> fitz.Rect:
    rects = list(rects)
    if not rects:
        return fitz.Rect()
    out = fitz.Rect(rects[0])
    for r in rects[1:]:
        out |= r
    return out


def intersection_area(a: fitz.Rect, b: fitz.Rect) -> float:
    i = a & b
    return 0.0 if i.is_empty else rect_area(i)


def iou(a: fitz.Rect, b: fitz.Rect) -> float:
    inter = intersection_area(a, b)
    union = rect_area(a) + rect_area(b) - inter
    return inter / union if union > 0 else 0.0


def containment(a: fitz.Rect, b: fitz.Rect) -> float:
    return intersection_area(a, b) / max(1.0, min(rect_area(a), rect_area(b)))


def distance(a: fitz.Rect, b: fitz.Rect) -> float:
    dx = max(a.x0-b.x1, b.x0-a.x1, 0.0)
    dy = max(a.y0-b.y1, b.y0-a.y1, 0.0)
    return math.hypot(dx, dy)


def stable_id(prefix: str, *parts) -> str:
    raw = "|".join(str(x) for x in parts)
    return prefix + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def words(page: fitz.Page, region: fitz.Rect) -> list[tuple]:
    return [w for w in page.get_text("words") if fitz.Rect(w[:4]).intersects(region)]


def text_metrics(page: fitz.Page, region: fitz.Rect) -> dict:
    ws = words(page, region)
    chars = sum(len(str(w[4])) for w in ws)
    lines = {(round(w[1], 1), round(w[3], 1)) for w in ws}
    word_area = sum(rect_area(fitz.Rect(w[:4]) & region) for w in ws)
    return {
        "word_count": len(ws),
        "char_count": chars,
        "line_count": len(lines),
        "text_coverage": min(1.0, word_area / max(1.0, rect_area(region))),
        "char_density": chars / max(1.0, rect_area(region)),
    }


def nearby_text(page: fitz.Page, region: fitz.Rect, pad_x=45.0, pad_y=65.0) -> str:
    rr = clamp(
        fitz.Rect(region.x0-pad_x, region.y0-pad_y, region.x1+pad_x, region.y1+pad_y),
        page.rect,
    )
    return norm_text(page.get_text("text", clip=rr))[:1800]


def drawing_rects(page: fitz.Page) -> list[fitz.Rect]:
    out = []
    for d in page.get_drawings():
        r = fitz.Rect(d.get("rect", fitz.Rect()))
        if r.is_empty or r.width < 1.2 or r.height < 1.2 or rect_area(r) < 6:
            continue
        out.append(clamp(r, page.rect))
    return out


def cluster_rects(rects: list[fitz.Rect], max_gap: float) -> list[list[fitz.Rect]]:
    if not rects:
        return []
    remaining = set(range(len(rects)))
    clusters = []
    while remaining:
        seed = remaining.pop()
        comp, stack = [seed], [seed]
        while stack:
            i = stack.pop()
            linked = [
                j for j in list(remaining)
                if rects[i].intersects(rects[j]) or distance(rects[i], rects[j]) <= max_gap
            ]
            for j in linked:
                remaining.remove(j)
                comp.append(j)
                stack.append(j)
        clusters.append([rects[i] for i in comp])
    return clusters


def panel_labels(page: fitz.Page, region: fitz.Rect) -> list[tuple[str, fitz.Rect]]:
    out, seen = [], set()
    for w in words(page, region):
        m = PANEL_LABEL_RE.match(str(w[4]))
        if not m:
            continue
        label = m.group(1).lower()
        r = fitz.Rect(w[:4])
        key = (label, round(r.x0/8), round(r.y0/8))
        if key not in seen:
            seen.add(key)
            out.append((label, r))
    return out


# ============================================================
# PARENT DETECTION
# ============================================================

def is_mixed_parent(page: fitz.Page, region: fitz.Rect) -> tuple[bool, str, dict]:
    pr = ratio(region, page.rect)
    tm = text_metrics(page, region)

    if pr < MIN_PARENT_RATIO:
        return False, "", tm

    if (
        pr >= LARGE_PARENT_RATIO
        and tm["line_count"] >= 6
        and tm["char_count"] >= 350
    ):
        return True, "large_mixed_text_visual_region", tm

    if (
        pr >= OVERSIZED_PARENT_RATIO
        and tm["char_count"] >= 220
    ):
        return True, "oversized_text_heavy_region", tm

    if (
        pr >= 0.22
        and tm["char_count"] >= MIN_PARENT_CHARS
        and tm["line_count"] >= MIN_PARENT_LINES
        and tm["text_coverage"] >= 0.18
    ):
        return True, "text_heavy_region", tm

    return False, "", tm


def page_block_parent_candidates(page: fitz.Page) -> list[dict]:
    """
    Build only oversized/text-heavy parents from page blocks and block groups.
    """
    blocks = []
    for b in page.get_text("blocks"):
        r = clamp(fitz.Rect(b[:4]), page.rect)
        txt = norm_text(str(b[4]))
        if not txt or rect_area(r) < 100:
            continue
        blocks.append((r, txt))

    raw = []

    # Individual large text blocks.
    for r, txt in blocks:
        ok, reason, tm = is_mixed_parent(page, r)
        if ok:
            raw.append({
                "rect": r,
                "reason": reason,
                "text_metrics": tm,
                "source_types": ["text_block_parent"],
            })

    # Spatially grouped neighboring blocks; catches prose + figure + caption zones.
    block_rects = [x[0] for x in blocks]
    for cluster in cluster_rects(block_rects, 26.0):
        if len(cluster) < 2:
            continue
        r = expand(union_rect(cluster), page.rect, 8)
        ok, reason, tm = is_mixed_parent(page, r)
        if ok:
            raw.append({
                "rect": r,
                "reason": reason,
                "text_metrics": tm,
                "source_types": ["block_cluster_parent"],
            })

    # Full-width content bands are useful for textbook layouts.
    page_h = page.rect.height
    band_h = max(180.0, page_h * 0.28)
    y = page.rect.y0
    while y < page.rect.y1:
        r = fitz.Rect(page.rect.x0, y, page.rect.x1, min(page.rect.y1, y+band_h))
        ok, reason, tm = is_mixed_parent(page, r)
        if ok:
            raw.append({
                "rect": r,
                "reason": reason,
                "text_metrics": tm,
                "source_types": ["content_band_parent"],
            })
        y += band_h * 0.65

    return dedup_parents(raw)


def dedup_parents(parents: list[dict]) -> list[dict]:
    ranked = sorted(
        parents,
        key=lambda p: (
            p["text_metrics"].get("char_count", 0),
            ratio(p["rect"], fitz.Rect(0, 0, 1, 1)) if False else rect_area(p["rect"]),
        ),
        reverse=True,
    )
    kept = []
    for p in ranked:
        if any(iou(p["rect"], k["rect"]) >= 0.88 for k in kept):
            continue
        kept.append(p)
    return kept


# ============================================================
# BOUNDED CHILD RECOVERY
# ============================================================

def valid_child(child: fitz.Rect, parent: fitz.Rect, page_rect: fitz.Rect) -> bool:
    if child.is_empty or child.width < MIN_CHILD_SIDE or child.height < MIN_CHILD_SIDE:
        return False
    if rect_area(child) < MIN_CHILD_AREA:
        return False
    pc = ratio(child, parent)
    if pc < MIN_CHILD_PARENT_RATIO or pc > MAX_CHILD_PARENT_RATIO:
        return False
    if ratio(child, page_rect) > MAX_CHILD_PAGE_RATIO:
        return False
    return True


def local_raster_children(page: fitz.Page, parent: fitz.Rect) -> list[dict]:
    out = []
    seen = set()
    for img in page.get_images(full=True):
        xref = int(img[0])
        for rr in page.get_image_rects(xref):
            r = fitz.Rect(rr)
            if intersection_area(r, parent) / max(1.0, rect_area(r)) < 0.75:
                continue
            r = expand(r & parent, page.rect, 5)
            if not valid_child(r, parent, page.rect):
                continue
            key = tuple(round(v, 1) for v in r)
            if key in seen:
                continue
            seen.add(key)
            out.append({
                "rect": r,
                "family": "raster_child",
                "subtype": "bounded_raster_visual",
                "confidence": 0.88,
                "source_types": ["mixed_recovery", "raster"],
                "method": "embedded_raster_inside_parent",
                "evidence": {"xref": xref},
            })
    return out


def axis_score(page: fitz.Page, region: fitz.Rect, local: list[fitz.Rect]) -> dict:
    hs = [r for r in local if r.width >= max(30, region.width*0.30) and r.height <= 7]
    vs = [r for r in local if r.height >= max(30, region.height*0.30) and r.width <= 7]
    crossings = sum(
        1 for h in hs for v in vs
        if h.intersects(v) or distance(h, v) <= 5
    )
    txt = nearby_text(page, region).lower()
    hits = sorted(t for t in MATH_GRAPH_TERMS if t in txt)
    return {
        "horizontal_axis_like": len(hs),
        "vertical_axis_like": len(vs),
        "axis_crossings": crossings,
        "graph_terms": hits[:12],
    }


def local_vector_children(page: fitz.Page, parent: fitz.Rect, subject: str) -> list[dict]:
    all_rects = drawing_rects(page)
    local = [
        r & parent for r in all_rects
        if not (r & parent).is_empty
        and intersection_area(r, parent) / max(1.0, rect_area(r)) >= 0.65
    ]
    gap = MATH_DRAWING_GAP if subject.lower().startswith("math") else SCIENCE_DRAWING_GAP
    out = []

    for cluster in cluster_rects(local, gap):
        if not cluster:
            continue
        r = expand(union_rect(cluster), page.rect, CHILD_PAD)
        r = r & parent
        if not valid_child(r, parent, page.rect):
            continue

        txt = nearby_text(page, r).lower()
        graph_ev = axis_score(page, r, local)
        graph_strength = (
            min(1, graph_ev["horizontal_axis_like"])
            + min(1, graph_ev["vertical_axis_like"])
            + min(1, graph_ev["axis_crossings"])
        )

        # FALLBACK-ONLY BOUNDARY:
        # graph-like geometry is owned by extract_graphs.py. Mixed recovery
        # must not emit a graph fragment, "repair" a normal graph candidate,
        # or compete with a canonical graph envelope.
        if graph_strength >= 2 or (
            graph_strength >= 1 and len(graph_ev["graph_terms"]) >= 2
        ):
            continue

        if subject.lower().startswith("math"):
            terms = sorted(t for t in MATH_GEOMETRY_TERMS if t in txt)
            family, subtype = "geometry_like_child", "bounded_geometry_figure"
            conf = min(0.95, 0.64 + 0.025*len(cluster) + 0.035*len(terms))
            evidence = {"primitive_count": len(cluster), "geometry_terms": terms[:12]}

        else:
            terms = sorted(t for t in SCIENCE_TERMS if t in txt)
            family, subtype = "science_figure_child", "bounded_science_figure"
            conf = min(0.96, 0.62 + 0.022*len(cluster) + 0.035*len(terms))
            evidence = {"primitive_count": len(cluster), "science_terms": terms[:12]}

        out.append({
            "rect": r,
            "family": family,
            "subtype": subtype,
            "confidence": conf,
            "source_types": ["mixed_recovery", "vector_cluster"],
            "method": "bounded_vector_cluster",
            "evidence": evidence,
        })

    return out


def local_table_children(page: fitz.Page, parent: fitz.Rect) -> list[dict]:
    out = []
    try:
        found = page.find_tables(clip=parent)
        for table in getattr(found, "tables", []):
            r = expand(fitz.Rect(table.bbox), page.rect, 5) & parent
            if not valid_child(r, parent, page.rect):
                continue
            txt = nearby_text(page, r).lower()
            terms = sorted(t for t in TABLE_TERMS if t in txt)
            out.append({
                "rect": r,
                "family": "table_child",
                "subtype": "bounded_educational_table",
                "confidence": min(0.98, 0.87 + 0.015*len(terms)),
                "source_types": ["mixed_recovery", "table_finder"],
                "method": "table_finder_inside_parent",
                "evidence": {"table_terms": terms[:10]},
            })
    except Exception:
        pass
    return out


def reference_guided_children(page: fitz.Page, parent: fitz.Rect, subject: str) -> list[dict]:
    """
    Use figure/graph/table reference text only as a search anchor.
    The returned child still requires local visual geometry.
    """
    out = []
    local_drawings = [r for r in drawing_rects(page) if r.intersects(parent)]
    if not local_drawings:
        return out

    for b in page.get_text("blocks"):
        br = fitz.Rect(b[:4])
        txt = norm_text(str(b[4]))
        if not br.intersects(parent) or not FIGURE_REF_RE.search(txt):
            continue

        search = clamp(
            fitz.Rect(br.x0-100, br.y0-130, br.x1+190, br.y1+190),
            page.rect,
        ) & parent
        members = [r for r in local_drawings if r.intersects(search)]
        if not members:
            continue
        r = expand(union_rect(members), page.rect, 10) & parent
        if not valid_child(r, parent, page.rect):
            continue

        family = "bounded_visual_child"
        subtype = "reference_guided_visual"
        low = txt.lower()
        if "graph" in low or "plot" in low:
            # Normal graph extraction owns graph recovery. A textual graph
            # reference is not permission for this fallback branch to create
            # a competing graph crop.
            continue
        elif "table" in low:
            family, subtype = "table_child", "reference_guided_table"
        elif subject.lower().startswith("science"):
            family, subtype = "science_figure_child", "reference_guided_science_figure"
        elif subject.lower().startswith("math"):
            family, subtype = "geometry_like_child", "reference_guided_math_figure"

        out.append({
            "rect": r,
            "family": family,
            "subtype": subtype,
            "confidence": 0.82,
            "source_types": ["mixed_recovery", "reference_anchor"],
            "method": "reference_guided_local_geometry",
            "evidence": {"anchor_text": txt[:300], "primitive_count": len(members)},
        })
    return out


def _is_multi_panel_parent_dict(candidate: dict) -> bool:
    return bool(
        candidate.get("family") == "multi_panel_child"
        or candidate.get("evidence", {}).get("member_rects")
    )


def _member_relation_dict(first: dict, second: dict) -> bool:
    """
    Preserve an aggregate multi-panel parent and its bounded members.

    member_rects are emitted by aggregate_multi_panels before stable child IDs
    exist, so geometry is used only here to protect the explicit aggregate
    lineage. Final IDs are attached later during page processing.
    """
    for parent, child in ((first, second), (second, first)):
        member_rects = parent.get("evidence", {}).get("member_rects", []) or []
        if not member_rects:
            continue
        child_rect = child["rect"]
        for raw in member_rects:
            mr = fitz.Rect(raw)
            if iou(child_rect, mr) >= 0.78 or containment(child_rect, mr) >= 0.92:
                return True
    return False


def dedup_children(children: list[dict]) -> list[dict]:
    """
    Deduplicate only sibling alternatives.

    Explicit multi-panel aggregate parents are preserved alongside their
    bounded member children. This prevents containment dedup from destroying
    parent-child structure.
    """
    ranked = sorted(
        children,
        key=lambda c: (
            int(_is_multi_panel_parent_dict(c)),
            c.get("confidence", 0.0),
            len(c.get("source_types", [])),
            rect_area(c["rect"]),
        ),
        reverse=True,
    )
    kept = []

    for c in ranked:
        merged = False

        for k in kept:
            # Parent and member are related, not duplicates.
            if _member_relation_dict(c, k):
                continue

            if (
                iou(c["rect"], k["rect"]) >= DEDUP_IOU
                or containment(c["rect"], k["rect"]) >= DEDUP_CONTAINMENT
            ):
                k["source_types"] = sorted(
                    set(k["source_types"] + c["source_types"])
                )
                k.setdefault("evidence", {}).update(
                    c.get("evidence", {})
                )

                # Prefer specific family over generic bounded visual.
                if (
                    k["family"] == "bounded_visual_child"
                    and c["family"] != "bounded_visual_child"
                ):
                    k["family"] = c["family"]
                    k["subtype"] = c["subtype"]

                merged = True
                break

        if not merged:
            kept.append(c)

    return kept


def aggregate_multi_panels(page: fitz.Page, parent: fitz.Rect, children: list[dict]) -> list[dict]:
    eligible = [
        c for c in children
        if c["family"] not in {"table_child"}
        and ratio(c["rect"], parent) <= 0.42
    ]
    out = []
    used = set()

    for i, seed in enumerate(eligible):
        members = [
            c for j, c in enumerate(eligible)
            if j == i or distance(seed["rect"], c["rect"]) <= PANEL_GAP
        ]
        uniq = []
        seen = set()
        for m in members:
            key = tuple(round(v, 1) for v in m["rect"])
            if key not in seen:
                seen.add(key)
                uniq.append(m)
        members = uniq
        if len(members) < 2:
            continue

        r = expand(union_rect([m["rect"] for m in members]), page.rect, 8) & parent
        if not valid_child(r, parent, page.rect):
            continue

        labels = panel_labels(page, r)
        xs = [m["rect"].x0 for m in members]
        ys = [m["rect"].y0 for m in members]
        spatial = (max(xs)-min(xs) >= 28) or (max(ys)-min(ys) >= 28)
        if not labels and not spatial:
            continue

        key = tuple(round(v/5) for v in r)
        if key in used:
            continue
        used.add(key)

        names = sorted({x[0] for x in labels})
        out.append({
            "rect": r,
            "family": "multi_panel_child",
            "subtype": "bounded_multi_panel_figure",
            "confidence": min(0.98, 0.76 + 0.04*len(members) + 0.03*len(names)),
            "source_types": ["mixed_recovery", "multi_panel_aggregation"],
            "method": "bounded_multi_panel_aggregation",
            "evidence": {
                "panel_labels": names,
                "panel_count": max(len(members), len(names)),
                "member_rects": [[round(v, 2) for v in m["rect"]] for m in members],
            },
        })
    return out


def recover_children(page: fitz.Page, parent: fitz.Rect, subject: str) -> list[dict]:
    children = []
    children += local_raster_children(page, parent)
    children += local_vector_children(page, parent, subject)
    children += local_table_children(page, parent)
    children += reference_guided_children(page, parent, subject)
    children = dedup_children(children)

    panels = aggregate_multi_panels(page, parent, children)
    # Parent-like multi-panel children first, but preserve members for lineage.
    return dedup_children(panels + children)


def render_crop(page: fitz.Page, region: fitz.Rect, output: Path, dpi: int = 180):
    output.parent.mkdir(parents=True, exist_ok=True)
    page.get_pixmap(clip=region, dpi=dpi, alpha=False).save(str(output))



FORMULA_FRAGMENT_RE = re.compile(
    r"(?:√|=|\^|\b(?:sin|cos|tan|log)\b|\d+\s*[+\-*/]\s*\d+)",
    re.I,
)
RECOVERY_HEADING_RE = re.compile(
    r"^\s*(?:exercise\s+set|chapter|unit|think\s+and\s+reflect|activity)\b",
    re.I,
)

def is_recovery_noise_child(
    page: fitz.Page,
    region: fitz.Rect,
) -> tuple[bool, str]:
    text = " ".join(page.get_text("text", clip=region).split())
    region_page_ratio = ratio(region, page.rect)

    if RECOVERY_HEADING_RE.search(text):
        return True, "heading_or_banner"

    if (
        FORMULA_FRAGMENT_RE.search(text)
        and (region.height < 62 or region_page_ratio < 0.018)
    ):
        return True, "formula_fragment"

    if (
        region.width > page.rect.width * 0.55
        and region.height < page.rect.height * 0.075
    ):
        return True, "decorative_strip"

    return False, ""

def _candidate_id_for_child(
    *,
    subject: str,
    chapter: str,
    page_number: int,
    parent_id: str,
    child: dict,
) -> str:
    r = child["rect"]
    return stable_id(
        "mrc_",
        subject,
        chapter,
        page_number,
        parent_id,
        child["family"],
        *(round(v, 1) for v in r),
    )


def _resolve_member_candidate_ids(
    parent_candidate: dict,
    child_id_pairs: list[tuple[dict, str]],
) -> list[str]:
    """
    Convert aggregate member_rects into stable child IDs.

    Only actual emitted sibling children are linked. The aggregate parent is
    never allowed to claim itself as a member.
    """
    member_rects = (
        parent_candidate.get("evidence", {}).get("member_rects", []) or []
    )
    if not member_rects:
        return []

    out = []
    parent_rect = parent_candidate["rect"]

    for raw in member_rects:
        mr = fitz.Rect(raw)
        best_id = ""
        best_score = 0.0

        for child, child_id in child_id_pairs:
            if child is parent_candidate:
                continue

            cr = child["rect"]
            score = max(iou(mr, cr), containment(mr, cr))

            # Do not link another aggregate parent as a panel member.
            if _is_multi_panel_parent_dict(child):
                continue

            if score > best_score:
                best_score = score
                best_id = child_id

        if best_id and best_score >= 0.72 and best_id not in out:
            out.append(best_id)

    return out


def _process_page_unfiltered(
    page: fitz.Page,
    *,
    subject: str,
    chapter: str,
    source_pdf: Path,
    output_root: Path,
    save_crops: bool,
) -> tuple[list[MixedParent], list[RecoveredChild]]:
    raw_parents = page_block_parent_candidates(page)
    parents_out = []
    children_out = []
    page_number = page.number + 1

    for p in raw_parents:
        pr = p["rect"]
        parent_id = stable_id(
            "mrp_", subject, chapter, page_number,
            *(round(v, 1) for v in pr), p["reason"]
        )

        parent_obj = MixedParent(
            parent_id=parent_id,
            subject=subject,
            chapter=chapter,
            source_pdf=str(source_pdf),
            page_number=page_number,
            bbox=[round(v, 2) for v in pr],
            page_ratio=round(ratio(pr, page.rect), 6),
            reason=p["reason"],
            text_metrics=p["text_metrics"],
            source_types=p["source_types"],
        )
        parents_out.append(parent_obj)

        children = recover_children(page, pr, subject)

        # Filter first, then assign all stable IDs before emission so aggregate
        # parents can preserve explicit member_candidate_ids.
        filtered_children = []
        for c in children:
            cr = c["rect"]
            reject_noise, _noise_reason = is_recovery_noise_child(page, cr)
            if reject_noise:
                continue
            filtered_children.append(c)

        child_id_pairs = [
            (
                c,
                _candidate_id_for_child(
                    subject=subject,
                    chapter=chapter,
                    page_number=page_number,
                    parent_id=parent_id,
                    child=c,
                ),
            )
            for c in filtered_children
        ]

        for c, cid in child_id_pairs:
            cr = c["rect"]
            labels = sorted({x[0] for x in panel_labels(page, cr)})
            panel_count = max(
                len(labels),
                int(c.get("evidence", {}).get("panel_count", 0) or 0),
            )

            member_candidate_ids = _resolve_member_candidate_ids(
                c,
                child_id_pairs,
            )

            evidence = dict(c.get("evidence", {}) or {})
            evidence["fallback_only"] = True
            evidence["normal_graph_repair_allowed"] = False
            if member_candidate_ids:
                evidence["member_candidate_ids"] = list(
                    member_candidate_ids
                )

            crop_path = ""
            if save_crops:
                crop = (
                    output_root / "crops" / subject / chapter /
                    f"page_{page_number:03d}" /
                    f"{cid}_{c['family']}.png"
                )
                render_crop(page, cr, crop)
                crop_path = str(crop)

            children_out.append(RecoveredChild(
                candidate_id=cid,
                parent_candidate_id=parent_id,
                parent_ids=[parent_id],
                member_candidate_ids=member_candidate_ids,
                subject=subject,
                chapter=chapter,
                source_pdf=str(source_pdf),
                page_number=page_number,
                visual_family=c["family"],
                visual_subtype=c["subtype"],
                bbox=[round(v, 2) for v in cr],
                page_ratio=round(ratio(cr, page.rect), 6),
                parent_coverage=round(ratio(cr, pr), 6),
                confidence=round(float(c["confidence"]), 4),
                source_types=sorted(set(c["source_types"])),
                recovery_method=c["method"],
                evidence=evidence,
                nearby_text=nearby_text(page, cr),
                panel_labels=labels,
                panel_count=panel_count,
                is_multi_panel=(
                    c["family"] == "multi_panel_child"
                    or panel_count >= 2
                ),
                crop_path=crop_path,
            ))

    # Final cross-parent dedup: same bounded child can be discovered from overlapping parents.
    children_out = dedup_recovered_objects(children_out)
    return parents_out, children_out


def dedup_recovered_objects(
    items: list[RecoveredChild],
) -> list[RecoveredChild]:
    """
    Cross-parent dedup for the same recovered child.

    Overlapping mixed parents are alternate discovery contexts, not lineage
    to discard. Preserve every parent ID and every member ID on the winner.
    Multi-panel aggregate parents are not collapsed into ordinary members.
    """
    ranked = sorted(
        items,
        key=lambda x: (
            int(x.visual_family == "multi_panel_child"),
            x.confidence,
            len(x.member_candidate_ids),
        ),
        reverse=True,
    )
    kept = []

    for item in ranked:
        r = fitz.Rect(item.bbox)
        duplicate = None

        for k in kept:
            if item.page_number != k.page_number:
                continue

            # Aggregate parent and ordinary member are different records.
            if (
                (item.visual_family == "multi_panel_child")
                != (k.visual_family == "multi_panel_child")
            ):
                continue

            kr = fitz.Rect(k.bbox)
            if (
                iou(r, kr) >= DEDUP_IOU
                or containment(r, kr) >= DEDUP_CONTAINMENT
            ):
                duplicate = k
                break

        if duplicate is None:
            item.parent_ids = sorted(
                set((item.parent_ids or []) + [item.parent_candidate_id])
            )
            kept.append(item)
            continue

        duplicate.source_types = sorted(
            set(duplicate.source_types + item.source_types)
        )

        duplicate.parent_ids = sorted(
            set(
                (duplicate.parent_ids or [])
                + (item.parent_ids or [])
                + [duplicate.parent_candidate_id, item.parent_candidate_id]
            )
        )

        duplicate.member_candidate_ids = sorted(
            set(
                (duplicate.member_candidate_ids or [])
                + (item.member_candidate_ids or [])
            )
        )

        duplicate.evidence.setdefault("alternate_parent_ids", [])
        duplicate.evidence["alternate_parent_ids"] = sorted(
            set(
                duplicate.evidence["alternate_parent_ids"]
                + [
                    pid
                    for pid in duplicate.parent_ids
                    if pid != duplicate.parent_candidate_id
                ]
            )
        )

        if duplicate.member_candidate_ids:
            duplicate.evidence["member_candidate_ids"] = list(
                duplicate.member_candidate_ids
            )

    return kept


def discover_pdfs(root: Path, subject: str = "", chapter: str = "") -> list[tuple[str, Path]]:
    out = []
    for sd in sorted(p for p in root.iterdir() if p.is_dir()):
        if subject and sd.name.lower() != subject.lower():
            continue
        for pdf in sorted(sd.glob("*.pdf")):
            if chapter and pdf.stem.lower() != chapter.lower():
                continue
            out.append((sd.name, pdf))
    return out


def run(args: argparse.Namespace) -> int:
    kb = Path(args.knowledge_base).resolve()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)

    pdfs = discover_pdfs(kb, args.subject, args.chapter)
    if not pdfs:
        raise SystemExit(f"No PDFs found under {kb}")

    parents_path = output / "mixed_region_parents.jsonl"
    children_path = output / "recovered_visual_children.jsonl"
    summary_path = output / "mixed_recovery_summary.json"

    total_parents = 0
    total_children = 0
    family_counts = {}
    reason_counts = {}

    with (
        parents_path.open("w", encoding="utf-8") as pf,
        children_path.open("w", encoding="utf-8") as cf,
    ):
        for subject, pdf in pdfs:
            chapter = pdf.stem
            print(f"\n📘 {subject} / {chapter}")
            doc = fitz.open(pdf)
            chapter_parents = 0
            chapter_children = 0

            for page in doc:
                parents, children = process_page(
                    page,
                    subject=subject,
                    chapter=chapter,
                    source_pdf=pdf,
                    output_root=output,
                    save_crops=not args.no_crops,
                )

                for p in parents:
                    pf.write(json.dumps(asdict(p), ensure_ascii=False) + "\n")
                    reason_counts[p.reason] = reason_counts.get(p.reason, 0) + 1

                for c in children:
                    cf.write(json.dumps(asdict(c), ensure_ascii=False) + "\n")
                    family_counts[c.visual_family] = family_counts.get(c.visual_family, 0) + 1

                chapter_parents += len(parents)
                chapter_children += len(children)
                total_parents += len(parents)
                total_children += len(children)

                if parents or children:
                    print(
                        f"  page {page.number+1:03d}: "
                        f"parents={len(parents):2d} recovered={len(children):2d}"
                    )

            print(
                f"  chapter totals: parents={chapter_parents}, "
                f"recovered_children={chapter_children}"
            )

    summary = {
        "recovery_version": RECOVERY_VERSION,
        "fallback_only": True,
        "normal_graph_repair_allowed": False,
        "knowledge_base": str(kb),
        "pdf_count": len(pdfs),
        "parent_count": total_parents,
        "recovered_child_count": total_children,
        "parent_reason_counts": dict(sorted(reason_counts.items())),
        "child_family_counts": dict(sorted(family_counts.items())),
        "parents_manifest": str(parents_path),
        "children_manifest": str(children_path),
    }
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("\n✅ Mixed-region recovery complete")
    print(f"   PDFs: {len(pdfs)}")
    print(f"   Mixed parents: {total_parents}")
    print(f"   Recovered children: {total_children}")
    print(f"   Families: {dict(sorted(family_counts.items()))}")
    print(f"   Parents: {parents_path}")
    print(f"   Children: {children_path}")
    print(f"   Summary: {summary_path}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Recover bounded visuals from oversized/text-heavy Math and Science textbook regions."
    )
    p.add_argument("--knowledge-base", default="knowledge_base")
    p.add_argument("--output", default="data/mixed_region_recovery")
    p.add_argument("--subject", default="", help="Mathematics or Science")
    p.add_argument("--chapter", default="", help="PDF stem, e.g. science_chapter5")
    p.add_argument("--no-crops", action="store_true", help="Write manifests only")
    return p


def process_page(
    page: fitz.Page,
    *,
    subject: str,
    chapter: str,
    source_pdf: Path,
    output_root: Path,
    save_crops: bool,
):
    """Public recovery API; noise is filtered before child emission."""
    return _process_page_unfiltered(
        page,
        subject=subject,
        chapter=chapter,
        source_pdf=source_pdf,
        output_root=output_root,
        save_crops=save_crops,
    )

def main() -> int:
    return run(build_parser().parse_args())


if __name__ == "__main__":
    raise SystemExit(main())