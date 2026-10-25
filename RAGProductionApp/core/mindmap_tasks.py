import logging
import os
import time

import requests

from core.celery_app import celery_app
from core.mindmap_retrieval import retrieve_varied_chapter_chunks
from core.mindmap_images import attach_branch_images
from core.tutor_engine import TutorEngine

logger = logging.getLogger(__name__)

NODE_BACKEND_ORIGIN = os.getenv("NODE_BACKEND_ORIGIN")
AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY")

# A fresh TutorEngine here (a lightweight Ollama Client wrapper, no shared
# mutable state) rather than importing main.py's `tutor` instance — same
# reasoning as mindmap_retrieval.py's own VectorDB client: the worker
# process must not import main.py (main.py imports this module's task to
# call .delay() on it, so the reverse import would be circular).
_tutor = TutorEngine()


def _post_mindmap_callback(mind_map_id: str, payload: dict):
    """Reports one variant's outcome back to Node, which owns persistence
    for this row (Node's education_mind_maps table). Retries a few times
    with backoff — this is a real failure mode confirmed in testing: a
    transient network blip (Node briefly restarting, a deploy) can hit
    the POST at exactly the wrong moment, and generation has ALREADY
    succeeded by this point — a single unretried attempt meant the whole
    generated mind map was silently discarded with the DB row stranded
    at "processing" forever (nothing re-triggers a row that already
    exists). Deliberately its own small retry loop rather than letting
    the callback's exception propagate into Celery's task-level retry —
    that would re-run the entire generation (15-25s of Ollama compute)
    just to retry a lightweight HTTP POST."""
    if not NODE_BACKEND_ORIGIN:
        logger.error("NODE_BACKEND_ORIGIN not configured — cannot report mind map %s status", mind_map_id)
        return
    delays = [2, 5, 10]
    for attempt, delay in enumerate([0, *delays], start=1):
        if delay:
            time.sleep(delay)
        try:
            requests.post(
                f"{NODE_BACKEND_ORIGIN}/api/mindmap/callback/{mind_map_id}",
                json=payload,
                headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
                timeout=10,
            ).raise_for_status()
            return
        except Exception:
            logger.exception(
                "Failed to POST mind map callback for mind_map_id=%s (attempt %d/%d)",
                mind_map_id, attempt, len(delays) + 1,
            )
    logger.error(
        "Mind map callback permanently failed for mind_map_id=%s after %d attempts — "
        "generated content for this variant is lost; Node's own stuck-row recovery "
        "(see mindmap_service.js) is what eventually re-triggers it.",
        mind_map_id, len(delays) + 1,
    )


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def generate_mind_map_variant_task(self, mind_map_id, subject, chapter, board, standard, variant):
    """Background generation for one of the 4 non-default mind-map
    variants — the primary "concept_overview" variant is generated
    synchronously in the request the student is actively waiting on (see
    main.py's generate_mindmap route); this task is only ever fired for
    the other 4. Retries transient failures (network blip to Node,
    momentary Ollama error) up to max_retries; once exhausted, reports
    "failed" rather than leaving the row stuck at "processing" forever.

    board is accepted for symmetry with the synchronous call site's
    signature but not used directly here — class-scoping goes through
    `standard` (see retrieve_varied_chapter_chunks' class_name param),
    matching the synchronous path.
    """
    try:
        chunks = retrieve_varied_chapter_chunks(
            subject, chapter, f"mind map generation ({variant})", class_name=standard
        )
        mind_map = _tutor.generate_mind_map(
            chunks=chunks,
            subject=subject,
            chapter=chapter,
            variant=variant,
        )
        # Cheap (embedding + vector search, no LLM generation) so it runs
        # for all 5 variants, unlike the grandchildren depth expansion
        # which is concept_overview-only.
        attach_branch_images(mind_map, subject, chapter)
        _post_mindmap_callback(mind_map_id, {"status": "completed", "payload": mind_map})
    except Exception as exc:
        logger.exception(
            "Mind map variant generation failed for mind_map_id=%s variant=%s", mind_map_id, variant
        )
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _post_mindmap_callback(mind_map_id, {"status": "failed", "error_message": str(exc)})
