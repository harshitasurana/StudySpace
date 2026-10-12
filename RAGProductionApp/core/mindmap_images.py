import logging
import os

from rag.image_service import ImageService

logger = logging.getLogger(__name__)

# A fresh ImageService here (its own Qdrant/local-storage/embedding-
# backend clients, none of them app-singleton state — confirmed via its own
# docstring: "Construction never raises for a subsystem that is merely
# unreachable") rather than importing main.py's `image_service` instance.
# Same reasoning as mindmap_retrieval.py's own VectorDB client: the
# Celery worker (core/mindmap_tasks.py) must be able to call
# attach_branch_images without importing main.py, which imports the
# worker's task to call .delay() on it — the reverse import would be
# circular.
_image_service = ImageService()

# Matches main.py's own IMAGE_MIN_SCORE (used by /api/tutor/chat) rather
# than picking a fresh number — confirmed empirically that a lower bar
# doesn't actually discriminate: with a small, chapter-scoped image pool
# (as few as ~10 candidates), even a nonsense/unrelated query still
# returns a "best of the pool" match scoring ~0.58, well above an 0.5
# threshold. 0.62 was the first value that actually separated a real
# match (~0.70 for a genuinely on-topic query) from that nonsense-query
# floor in direct testing.
MIND_MAP_IMAGE_MIN_SCORE = float(os.getenv("MIND_MAP_IMAGE_MIN_SCORE", "0.62"))


def resolve_chapter_number(subject: str, chapter_title: str) -> int | None:
    """Maps a chapter *title* (what the UI shows and what the request
    carries as `chapter`) to its 1-based chapter number, using the
    same CURRICULUM ordering get_curriculum() already relies on
    (index i -> chapter_number i+1).

    This exists because the image collection's real payloads store
    chapter identity only as an int under metadata.chapter_number —
    metadata.chapter (the title) is always None in production data —
    so ImageService.retrieve() needs the number, not the title, to
    filter textbook images by chapter. Returns None if the title
    isn't found (e.g. subject not in CURRICULUM, or a title that
    doesn't match any configured chapter), so callers can fall back
    to an unfiltered-by-chapter retrieval rather than erroring.

    Moved here from main.py (originally only used by /api/tutor/chat)
    so both main.py's synchronous mind-map route and the Celery worker
    can call it without main.py needing to be imported."""
    from config.curriculum import CURRICULUM

    for i, c in enumerate(CURRICULUM.get(subject, [])):
        if c.get("chapter") == chapter_title:
            return i + 1

    return None


def attach_branch_images(mind_map: dict, subject: str, chapter: str, min_score: float = MIND_MAP_IMAGE_MIN_SCORE):
    """Resolves a real textbook figure for each top-level branch (not
    children/grandchildren — bounds this to ~6-10 cheap lookups per
    variant, and branches are the concepts most likely to have a
    genuinely distinct figure). Mutates `mind_map["branches"]` in place,
    attaching `branch["image"] = {"image_url", "caption"}` only when a
    real match clears `min_score` — otherwise `branch["image"] = None`,
    same grounded-or-nothing discipline as citations and relationships;
    a mind map should never show a forced/irrelevant image just to have
    one. Soft-fails per branch (a single lookup failing, e.g. Qdrant
    briefly unreachable, never breaks the rest of generation) —
    ImageService.retrieve() itself does no vision-model inference at call
    time (that only happens at ingestion time), so this is a cheap
    embedding + vector search per branch, not another expensive
    generation call."""
    chapter_number = resolve_chapter_number(subject, chapter)

    for branch in mind_map.get("branches", []):
        branch["image"] = None
        try:
            figures = _image_service.retrieve(
                query=branch.get("label", ""),
                subject=subject,
                chapter_number=chapter_number,
                top_k=1,
            )
        except Exception:
            logger.exception(
                "Mind map branch image lookup failed for label=%r — leaving image unset", branch.get("label")
            )
            continue

        if not figures:
            continue

        best = figures[0]
        if (best.get("score") or 0) < min_score:
            continue

        branch["image"] = {
            "image_url": best.get("image_url"),
            "caption": best.get("caption"),
        }
