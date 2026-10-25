import logging
import os

from rag.image_service import ImageService
from core.mindmap_images import resolve_chapter_number

logger = logging.getLogger(__name__)

# A fresh ImageService here, same reasoning as slide_deck_images.py's own
# _image_service — the Celery worker (core/infographic_tasks.py) must be
# able to call attach_infographic_images without importing main.py
# (main.py imports the worker's task to call .delay() on it, so the
# reverse import would be circular).
_image_service = ImageService()

# Same empirically-validated threshold as SLIDE_DECK_IMAGE_MIN_SCORE /
# MIND_MAP_IMAGE_MIN_SCORE. Its own env var so it can be tuned
# independently if this ever needs to diverge.
INFOGRAPHIC_IMAGE_MIN_SCORE = float(os.getenv("INFOGRAPHIC_IMAGE_MIN_SCORE", "0.62"))


def attach_infographic_images(infographic: dict, subject: str, chapter: str, min_score: float = INFOGRAPHIC_IMAGE_MIN_SCORE):
    """Resolves a real textbook figure for every key_concepts item with
    image_required=true — the only section that carries image_required
    (see INFOGRAPHIC_PROMPT in core/prompts.py; attaching a figure to
    every section would make a single-page overview too busy). Mutates
    infographic["key_concepts"] in place, attaching item["image"] =
    {"image_url", "caption"} only when a real match clears min_score —
    otherwise item["image"] = None, same grounded-or-nothing discipline
    as attach_slide_images/attach_branch_images. Soft-fails per item (a
    single lookup failing never breaks the rest of the page)."""
    chapter_number = resolve_chapter_number(subject, chapter)

    for concept in infographic.get("key_concepts", []):
        concept["image"] = None
        if not concept.get("image_required"):
            continue
        query = concept.get("visual_query") or concept.get("title") or concept.get("summary", "")
        try:
            figures = _image_service.retrieve(
                query=query,
                subject=subject,
                chapter_number=chapter_number,
                top_k=1,
            )
        except Exception:
            logger.exception(
                "Infographic image lookup failed for query=%r — leaving image unset", query
            )
            continue

        if not figures:
            continue

        best = figures[0]
        if (best.get("score") or 0) < min_score:
            continue

        concept["image"] = {
            "image_url": best.get("image_url"),
            "caption": best.get("caption"),
        }
