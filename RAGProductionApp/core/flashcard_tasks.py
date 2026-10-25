import logging
import os
import time

import requests

from core.celery_app import celery_app
from core.mindmap_retrieval import retrieve_varied_chapter_chunks
from core.tutor_engine import TutorEngine

logger = logging.getLogger(__name__)

NODE_BACKEND_ORIGIN = os.getenv("NODE_BACKEND_ORIGIN")
AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY")

# A fresh TutorEngine here, same reasoning as quiz_tasks.py/mindmap_tasks.py's
# own module-level _tutor — the worker process must not import main.py
# (main.py imports this module's task to call .delay() on it, so the
# reverse import would be circular).
_tutor = TutorEngine()

MAX_CONTEXT_CHARS = 5000


def _retrieve_flashcard_context(subject: str, chapter: str) -> str:
    """Same retrieval call main.py's own _retrieve_varied_chapter_context
    made for /api/flashcards/generate before it moved to this background
    task — default max_chunks/max_context_chars, no class_name override,
    so flashcard grounding is unchanged from before this feature."""
    chunks = retrieve_varied_chapter_chunks(subject, chapter, "flashcard generation")
    return "\n\n".join(chunk["text"] for chunk in chunks)


def _post_flashcard_callback(set_id: str, payload: dict):
    """Reports the set's outcome back to Node, which owns persistence
    (education_flashcard_sets). Retries with backoff — the identical real
    failure mode already confirmed for mind maps/slide decks/quizzes: a
    transient network blip can hit this POST at exactly the wrong moment,
    after generation has ALREADY succeeded — a single unretried attempt
    would silently discard the whole generated set with the row stranded
    at "processing" forever. Deliberately its own small retry loop rather
    than letting the exception propagate into Celery's task-level retry
    — that would re-run the entire generation (real Ollama compute) just
    to retry a lightweight HTTP POST."""
    if not NODE_BACKEND_ORIGIN:
        logger.error("NODE_BACKEND_ORIGIN not configured — cannot report flashcard set %s status", set_id)
        return
    delays = [2, 5, 10]
    for attempt, delay in enumerate([0, *delays], start=1):
        if delay:
            time.sleep(delay)
        try:
            requests.post(
                f"{NODE_BACKEND_ORIGIN}/api/flashcards/sets/{set_id}/callback",
                json=payload,
                headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
                timeout=10,
            ).raise_for_status()
            return
        except Exception:
            logger.exception(
                "Failed to POST flashcard callback for set_id=%s (attempt %d/%d)",
                set_id, attempt, len(delays) + 1,
            )
    logger.error(
        "Flashcard callback permanently failed for set_id=%s after %d attempts — "
        "generated content is lost; Node's own stuck-row recovery (see "
        "flashcards_service.js) is what eventually re-triggers it.",
        set_id, len(delays) + 1,
    )


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def generate_flashcard_set_task(self, set_id, subject, chapter, num_cards, board, standard, source_text):
    """Background generation for a flashcard set. EVERY generation goes
    through this task now, including a chapter's very first request —
    same reasoning as quizzes (core/quiz_tasks.py): each set is a fresh,
    personalized generation, not a cached per-chapter resource, so
    there's no synchronous case to preserve. Retries transient failures
    (network blip, momentary Ollama error) up to max_retries; once
    exhausted, reports "failed" rather than leaving the row stuck at
    "processing" forever."""
    try:
        if source_text:
            context_text = source_text.strip()[:MAX_CONTEXT_CHARS]
        else:
            context_text = _retrieve_flashcard_context(subject, chapter)

        cards = _tutor.generate_flashcards(
            context=context_text,
            subject=subject,
            chapter=chapter,
            num_cards=num_cards,
            board=board or "CBSE",
            standard=standard or "Standard 9",
        )
        if not cards:
            raise ValueError("AI service returned an empty flashcard set")

        _post_flashcard_callback(set_id, {"status": "completed", "cards": cards})
    except Exception as exc:
        logger.exception("Flashcard generation failed for set_id=%s", set_id)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _post_flashcard_callback(set_id, {"status": "failed", "error_message": str(exc)})
