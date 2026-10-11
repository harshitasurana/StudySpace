import logging
import os

import requests

from core.celery_app import celery_app

logger = logging.getLogger(__name__)

NODE_BACKEND_ORIGIN = os.getenv("NODE_BACKEND_ORIGIN")
AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY")


def _post_callback(job_id: str, payload: dict):
    """Reports the job's outcome back to Node, which owns persistence
    (education_book_ingestions). Best-effort, same posture as every
    other callback in this app — a failed POST leaves the job visibly
    stuck rather than silently vanishing."""
    if not NODE_BACKEND_ORIGIN:
        logger.error("NODE_BACKEND_ORIGIN not configured — cannot report enrichment job %s status", job_id)
        return
    try:
        requests.post(
            f"{NODE_BACKEND_ORIGIN}/api/admin/ingestion/callback/{job_id}",
            json=payload,
            headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
            timeout=10,
        )
    except Exception:
        logger.exception("Failed to POST enrichment callback for job_id=%s", job_id)


def _post_progress(job_id: str, *, current_stage: str, items_processed: int | None = None, total_items: int | None = None):
    """Interim 'what's happening right now' report — see the identical
    helper in image_ingestion_tasks.py for the full reasoning (best-effort,
    silent on failure, short timeout). Enrichment's own stages are coarse
    (whole-batch calls, not a per-item loop this task controls), so
    progress here is "which stage" rather than "item N of M" within a
    stage — still real signal for an admin watching a job that discovered,
    say, 40 visuals and is now sitting in the Qwen Vision stage."""
    if not NODE_BACKEND_ORIGIN:
        return
    payload = {"current_stage": current_stage}
    if items_processed is not None:
        payload["items_processed"] = items_processed
    if total_items is not None:
        payload["total_items"] = total_items
    try:
        requests.post(
            f"{NODE_BACKEND_ORIGIN}/api/admin/ingestion/progress/{job_id}",
            json=payload,
            headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
            timeout=5,
        )
    except Exception:
        logger.warning("Failed to POST enrichment progress for job_id=%s (non-fatal)", job_id)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def enrich_chapter_images_task(self, job_id: str, subject: str | None, chapter: str | None):
    """Background enrichment for one chapter's already-ingested visuals.
    Hard-depends on a prior ingest_chapter_images_task having already
    written local storage metadata + Qdrant points for this chapter —
    enrichment only ever set_payloads onto an existing point, never creates one
    (see scripts/enrich_textbook_images.py's own module docstring).
    Node's ingestion_service.js only ever dispatches this once an
    'images' job has actually completed, so that precondition is
    guaranteed by the caller, not re-checked here.

    Reuses every stage scripts/enrich_textbook_images.py's own main()
    calls, scoped to just this subject/chapter via the same
    --subject/--chapter filters the CLI tool already supports — config
    building goes through parse_args/build_config exactly as the CLI
    path does, so this task and a manual CLI run can never silently
    diverge on what "enrich chapter X" means.
    """
    import dataclasses

    from core.local_image_storage import get_local_image_storage
    from scripts.enrich_textbook_images import (
        build_config,
        build_pass2_search_representation_batch,
        discover_accepted_visuals,
        download_visual_image_batch,
        generate_educational_metadata_batch,
        init_qdrant_client,
        init_vision_runtime,
        load_visual_metadata_batch,
        normalize_enriched_visual_batch,
        OllamaQwenBackend,
        parse_args,
        update_qdrant_payload_batch,
        validate_normalized_visual_batch,
        write_visual_metadata_batch,
    )

    try:
        _post_progress(job_id, current_stage="Starting up (connecting to local storage/Qdrant)…")

        # Deliberately NOT routed through parse_args(["--chapter", chapter])
        # like the rest of this config is — --chapter/--subject are CLI
        # convenience flags that split on "," to enrich several chapters
        # in one run (_parse_str_list), but this task always has exactly
        # ONE already-resolved chapter/subject name, and some real chapter
        # names contain commas themselves (e.g. "Work, Energy, and Simple
        # Machines"). Splitting that string as if it were a CSV list of
        # chapters silently turned it into ["Work", "Energy", "and Simple
        # Machines"] — none of which matched anything, so
        # discover_accepted_visuals found 0 assets and the job "completed"
        # having enriched nothing. Get every other setting (thresholds,
        # model, etc.) from parse_args as before, then overwrite just the
        # subject/chapter filters with exact single-value lists.
        args = parse_args([])
        config = dataclasses.replace(
            build_config(args),
            subjects=[subject] if subject else None,
            chapters=[chapter] if chapter else None,
        )

        storage = get_local_image_storage()
        qdrant_client = init_qdrant_client(config)
        vision_runtime = init_vision_runtime(config)
        vision_backend = OllamaQwenBackend(base_url=config.ollama_url, model=config.vision_model, runtime=vision_runtime)

        _post_progress(job_id, current_stage="Finding already-ingested visuals to enrich…")
        assets = discover_accepted_visuals(storage, config)
        total = len(assets)
        metadata_list = load_visual_metadata_batch(assets)

        _post_progress(job_id, current_stage="Downloading images from local storage", items_processed=0, total_items=total)
        visuals = download_visual_image_batch(storage, metadata_list)

        _post_progress(job_id, current_stage="Analyzing with Qwen Vision", items_processed=0, total_items=total)
        enriched = generate_educational_metadata_batch(
            visuals,
            backend=vision_backend,
            # Real per-image progress instead of one static stage message
            # for the whole batch — this is the slowest stage by far (one
            # real vision-model call per image), and was previously
            # indistinguishable from a hang to anyone watching a chapter
            # with 20-40 visuals (confirmed hitting exactly this).
            on_progress=lambda i, n: _post_progress(
                job_id, current_stage="Analyzing with Qwen Vision", items_processed=i, total_items=n
            ),
        )
        normalized = normalize_enriched_visual_batch(enriched)

        _post_progress(job_id, current_stage="Validating grounding/confidence", items_processed=0, total_items=total)
        validation_config = config.to_validation_config()
        validation_results = validate_normalized_visual_batch(normalized, validation_config=validation_config)

        _post_progress(job_id, current_stage="Writing enriched metadata", items_processed=0, total_items=total)
        written = write_visual_metadata_batch(storage, validation_results)
        pass2_visuals = build_pass2_search_representation_batch(written)

        _post_progress(job_id, current_stage="Updating Qdrant", items_processed=len(written), total_items=total)
        qdrant_updated = update_qdrant_payload_batch(qdrant_client, config.collection_name, pass2_visuals)

        _post_callback(job_id, {"status": "completed", "items_processed": len(qdrant_updated)})
    except Exception as exc:
        logger.exception("Image enrichment failed for job_id=%s", job_id)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _post_callback(job_id, {"status": "failed", "error_message": str(exc)})
