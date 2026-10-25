import logging
import os

from rag.image_service import ImageService
from core.mindmap_images import resolve_chapter_number

logger = logging.getLogger(__name__)

# A fresh ImageService here, same reasoning as mindmap_images.py's own
# _image_service — the Celery worker (core/slide_deck_tasks.py) must be
# able to call attach_slide_images without importing main.py (main.py
# imports the worker's task to call .delay() on it, so the reverse
# import would be circular).
_image_service = ImageService()

# Same empirically-validated threshold as MIND_MAP_IMAGE_MIN_SCORE (see
# core/mindmap_images.py's comment for how 0.62 was chosen — a lower bar
# doesn't discriminate against a small, chapter-scoped image pool). Its
# own env var so it can be tuned independently of mind maps if the two
# ever need to diverge.
SLIDE_DECK_IMAGE_MIN_SCORE = float(os.getenv("SLIDE_DECK_IMAGE_MIN_SCORE", "0.62"))


def attach_slide_images(deck: dict, subject: str, chapter: str, min_score: float = SLIDE_DECK_IMAGE_MIN_SCORE):
    """Resolves a real textbook figure for every slide with
    image_required=true (any slide type, not only "diagram" — see
    SLIDE_DECK_PROMPT in core/prompts.py). Mutates deck["slides"] in
    place, attaching slide["image"] = {"image_url", "caption"} only when
    a real match clears min_score — otherwise slide["image"] = None,
    same grounded-or-nothing discipline as attach_branch_images. Soft-
    fails per slide (a single lookup failing never breaks the rest of
    the deck) — ImageService.retrieve() does no vision-model inference
    at call time, so this is a cheap embedding + vector search per
    requested slide, not another expensive generation call."""
    chapter_number = resolve_chapter_number(subject, chapter)

    for slide in deck.get("slides", []):
        slide["image"] = None
        if not slide.get("image_required"):
            continue
        # visual_query (model-supplied, see SLIDE_DECK_PROMPT) wins when
        # given — it exists specifically for the case a slide's own
        # heading/question wouldn't describe the figure well on its own
        # (e.g. heading "Your Turn", question just says "point A").
        # Otherwise fall back to the question text (far more descriptive
        # for retrieval than a generic heading like "Challenge" — the
        # concrete reason a question slide's figure wasn't resolving
        # even when image_required was set), then the heading itself.
        query = slide.get("visual_query") or slide.get("question") or slide.get("heading", "")
        try:
            figures = _image_service.retrieve(
                query=query,
                subject=subject,
                chapter_number=chapter_number,
                top_k=1,
            )
        except Exception:
            logger.exception(
                "Slide image lookup failed for query=%r — leaving image unset", query
            )
            continue

        if not figures:
            continue

        best = figures[0]
        if (best.get("score") or 0) < min_score:
            continue

        slide["image"] = {
            "image_url": best.get("image_url"),
            "caption": best.get("caption"),
        }
