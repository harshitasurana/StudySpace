import logging
import os
import time

import requests

from core.celery_app import celery_app
from core.mindmap_retrieval import retrieve_varied_chapter_chunks
from core.slide_deck_images import attach_slide_images
from core.tutor_engine import TutorEngine, validate_slide_deck

logger = logging.getLogger(__name__)

NODE_BACKEND_ORIGIN = os.getenv("NODE_BACKEND_ORIGIN")
AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY")

# A fresh TutorEngine here, same reasoning as mindmap_tasks.py's own
# _tutor — the worker process must not import main.py (main.py imports
# this module's task to call .delay() on it, so the reverse import would
# be circular).
_tutor = TutorEngine()


def _post_slide_deck_callback(slide_deck_id: str, payload: dict):
    """Reports the deck's outcome back to Node, which owns persistence
    (education_slide_decks). Retries with backoff — the identical real
    failure mode already confirmed for mind maps: a transient network
    blip can hit this POST at exactly the wrong moment, after generation
    has ALREADY succeeded — a single unretried attempt would silently
    discard the whole generated deck with the row stranded at
    "processing" forever. Deliberately its own small retry loop rather
    than letting the exception propagate into Celery's task-level retry
    — that would re-run the entire generation (real Ollama compute) just
    to retry a lightweight HTTP POST."""
    if not NODE_BACKEND_ORIGIN:
        logger.error("NODE_BACKEND_ORIGIN not configured — cannot report slide deck %s status", slide_deck_id)
        return
    delays = [2, 5, 10]
    for attempt, delay in enumerate([0, *delays], start=1):
        if delay:
            time.sleep(delay)
        try:
            requests.post(
                f"{NODE_BACKEND_ORIGIN}/api/slide-deck/callback/{slide_deck_id}",
                json=payload,
                headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
                timeout=10,
            ).raise_for_status()
            return
        except Exception:
            logger.exception(
                "Failed to POST slide deck callback for slide_deck_id=%s (attempt %d/%d)",
                slide_deck_id, attempt, len(delays) + 1,
            )
    logger.error(
        "Slide deck callback permanently failed for slide_deck_id=%s after %d attempts — "
        "generated content is lost; Node's own stuck-row recovery (see "
        "slide_deck_service.js) is what eventually re-triggers it.",
        slide_deck_id, len(delays) + 1,
    )


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def generate_slide_deck_task(self, slide_deck_id, subject, chapter, board, standard):
    """Background generation for a chapter's AI Learning Deck. Unlike
    mind maps (one variant generated synchronously because nothing was
    cached yet for a brand-new chapter, only the other 4 going through
    Celery), EVERY slide deck generation goes through this task,
    including a chapter's very first request — see main.py's
    generate_slide_deck route. Phase 1 ships exactly one deck per
    chapter+scope, so there's no "variant a student is actively waiting
    on" to justify a synchronous path. Retries transient failures
    (network blip, momentary Ollama error) up to max_retries; once
    exhausted, reports "failed" rather than leaving the row stuck at
    "processing" forever."""
    try:
        # Wider than the mind-map/quiz/flashcard default (6 chunks /
        # 5000 chars) — a 12-18 slide deck covering the chapter in real
        # depth (see SLIDE_DECK_PROMPT) needs more source material to
        # draw distinct concepts from, not just a bigger output budget
        # for the same small evidence set.
        chunks = retrieve_varied_chapter_chunks(
            subject,
            chapter,
            "slide deck generation",
            class_name=standard,
            max_chunks=10,
            max_context_chars=8000,
        )
        deck = _tutor.generate_slide_deck(chunks=chunks, subject=subject, chapter=chapter)
        # Cheap (embedding + vector search, no LLM generation).
        attach_slide_images(deck, subject, chapter)
        # Log-only — see validate_slide_deck's own docstring for why
        # Phase 1 never blocks or regenerates on this.
        validate_slide_deck(deck)
        _post_slide_deck_callback(slide_deck_id, {"status": "completed", "payload": deck})
    except Exception as exc:
        logger.exception(
            "Slide deck generation failed for slide_deck_id=%s", slide_deck_id
        )
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _post_slide_deck_callback(slide_deck_id, {"status": "failed", "error_message": str(exc)})
