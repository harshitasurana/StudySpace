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

# A fresh TutorEngine here, same reasoning as mindmap_tasks.py/
# slide_deck_tasks.py's own module-level _tutor — the worker process must
# not import main.py (main.py imports this module's task to call
# .delay() on it, so the reverse import would be circular).
_tutor = TutorEngine()


def _retrieve_quiz_context(subject: str, chapter: str) -> str:
    """Same retrieval call main.py's own _retrieve_varied_chapter_context
    made for /api/quiz/generate before it moved to this background task —
    default max_chunks/max_context_chars, no class_name override, so
    quiz question grounding is unchanged from before this feature."""
    chunks = retrieve_varied_chapter_chunks(subject, chapter, "quiz generation")
    return "\n\n".join(chunk["text"] for chunk in chunks)


def _post_quiz_callback(attempt_id: str, payload: dict):
    """Reports the quiz's outcome back to Node, which owns persistence
    (quiz_attempts). Retries with backoff — the identical real failure
    mode already confirmed for mind maps/slide decks: a transient network
    blip can hit this POST at exactly the wrong moment, after generation
    has ALREADY succeeded — a single unretried attempt would silently
    discard the whole generated quiz with the row stranded at
    "processing" forever. Deliberately its own small retry loop rather
    than letting the exception propagate into Celery's task-level retry
    — that would re-run the entire generation (real Ollama compute) just
    to retry a lightweight HTTP POST."""
    if not NODE_BACKEND_ORIGIN:
        logger.error("NODE_BACKEND_ORIGIN not configured — cannot report quiz attempt %s status", attempt_id)
        return
    delays = [2, 5, 10]
    for attempt, delay in enumerate([0, *delays], start=1):
        if delay:
            time.sleep(delay)
        try:
            requests.post(
                f"{NODE_BACKEND_ORIGIN}/api/quiz/attempts/{attempt_id}/callback",
                json=payload,
                headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
                timeout=10,
            ).raise_for_status()
            return
        except Exception:
            logger.exception(
                "Failed to POST quiz callback for attempt_id=%s (attempt %d/%d)",
                attempt_id, attempt, len(delays) + 1,
            )
    logger.error(
        "Quiz callback permanently failed for attempt_id=%s after %d attempts — "
        "generated content is lost; Node's own stuck-row recovery (see "
        "quiz_service.js) is what eventually re-triggers it.",
        attempt_id, len(delays) + 1,
    )


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def generate_quiz_task(self, attempt_id, subject, chapter, num_questions, board, standard, focus, source_text):
    """Background generation for a quiz/mock-test/pre-assessment attempt.
    EVERY generation goes through this task now, including a chapter's
    very first request — same reasoning as slide decks (core/
    slide_deck_tasks.py): each attempt is a fresh, personalized quiz, not
    a cached per-chapter resource, so there's no "wait everyone already
    accepts" synchronous case to preserve. Retries transient failures
    (network blip, momentary Ollama error) up to max_retries; once
    exhausted, reports "failed" rather than leaving the row stuck at
    "processing" forever."""
    try:
        if source_text:
            context_text = source_text.strip()[:5000]
        else:
            context_text = _retrieve_quiz_context(subject, chapter)

        question_instruction = f"Generate a quiz covering the chapter '{chapter}'"
        if focus:
            question_instruction += f". {focus}"

        questions = _tutor.generate_quiz(
            question=question_instruction,
            context=context_text,
            subject=subject,
            chapter=chapter,
            num_questions=num_questions,
            board=board or "CBSE",
            standard=standard or "Standard 9",
        )
        if not questions:
            raise ValueError("AI service returned an empty quiz")

        _post_quiz_callback(attempt_id, {"status": "completed", "questions": questions})
    except Exception as exc:
        logger.exception("Quiz generation failed for attempt_id=%s", attempt_id)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _post_quiz_callback(attempt_id, {"status": "failed", "error_message": str(exc)})
