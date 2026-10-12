import logging
import os
import time

import requests

from core.celery_app import celery_app
from core.mindmap_retrieval import retrieve_varied_chapter_chunks
from core.infographic_images import attach_infographic_images
from core.tutor_engine import TutorEngine, validate_infographic

logger = logging.getLogger(__name__)

NODE_BACKEND_ORIGIN = os.getenv("NODE_BACKEND_ORIGIN")
AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY")

# A fresh TutorEngine here, same reasoning as slide_deck_tasks.py's own
# _tutor — the worker process must not import main.py (main.py imports
# this module's task to call .delay() on it, so the reverse import
# would be circular).
_tutor = TutorEngine()


def _post_infographic_callback(infographic_id: str, payload: dict):
    """Reports the infographic's outcome back to Node, which owns
    persistence (education_infographics). Retries with backoff — the
    identical real failure mode already confirmed for slide decks/mind
    maps: a transient network blip can hit this POST at exactly the
    wrong moment, after generation has ALREADY succeeded — a single
    unretried attempt would silently discard the whole generated
    infographic with the row stranded at "processing" forever.
    Deliberately its own small retry loop rather than letting the
    exception propagate into Celery's task-level retry — that would
    re-run the entire generation (real Ollama compute) just to retry a
    lightweight HTTP POST."""
    if not NODE_BACKEND_ORIGIN:
        logger.error("NODE_BACKEND_ORIGIN not configured — cannot report infographic %s status", infographic_id)
        return
    delays = [2, 5, 10]
    for attempt, delay in enumerate([0, *delays], start=1):
        if delay:
            time.sleep(delay)
        try:
            requests.post(
                f"{NODE_BACKEND_ORIGIN}/api/infographic/callback/{infographic_id}",
                json=payload,
                headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
                timeout=10,
            ).raise_for_status()
            return
        except Exception:
            logger.exception(
                "Failed to POST infographic callback for infographic_id=%s (attempt %d/%d)",
                infographic_id, attempt, len(delays) + 1,
            )
    logger.error(
        "Infographic callback permanently failed for infographic_id=%s after %d attempts — "
        "generated content is lost; Node's own stuck-row recovery (see "
        "infographic_service.js) is what eventually re-triggers it.",
        infographic_id, len(delays) + 1,
    )


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def generate_infographic_task(self, infographic_id, subject, chapter, board, standard):
    """Background generation for a chapter's Infographic. Every
    infographic generation goes through this task, including a
    chapter's very first request — there is exactly one infographic per
    chapter+scope (same posture as slide decks; see
    infographic_service.js's get-or-create flow), so there's no
    "variant a student is actively waiting on" to justify a synchronous
    path. Retries transient failures (network blip, momentary Ollama
    error) up to max_retries; once exhausted, reports "failed" rather
    than leaving the row stuck at "processing" forever."""
    try:
        # Same wide retrieval as slide decks (10 chunks / 8000 chars,
        # vs. the 6/5000 mind-map/quiz/flashcard default) — a whole-
        # chapter overview needs the same breadth of source material a
        # 12-18 slide deck needs, not just a bigger output budget for
        # the same small evidence set.
        chunks = retrieve_varied_chapter_chunks(
            subject,
            chapter,
            "infographic generation",
            class_name=standard,
            max_chunks=10,
            max_context_chars=8000,
        )
        infographic = _tutor.generate_infographic(chunks=chunks, subject=subject, chapter=chapter)
        # Cheap (embedding + vector search, no LLM generation).
        attach_infographic_images(infographic, subject, chapter)
        # Log-only — see validate_infographic's own docstring for why
        # this never blocks or regenerates.
        validate_infographic(infographic)
        _post_infographic_callback(infographic_id, {"status": "completed", "payload": infographic})
    except Exception as exc:
        logger.exception(
            "Infographic generation failed for infographic_id=%s", infographic_id
        )
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _post_infographic_callback(infographic_id, {"status": "failed", "error_message": str(exc)})
