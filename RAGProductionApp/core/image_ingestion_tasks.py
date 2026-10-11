import logging
import os
import pickle
import sys
import tempfile
from pathlib import Path

import requests

from core.celery_app import celery_app
from core.document_context import DocumentContext

logger = logging.getLogger(__name__)

NODE_BACKEND_ORIGIN = os.getenv("NODE_BACKEND_ORIGIN")
AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY")

# Checkpointed pause/resume (see process_pdf's own docstring in
# scripts/ingest_textbook_images.py for why this has to hold real
# per-page results, not just a page number): one pickle file per job_id,
# written only when a job is actually paused, deleted once that job
# finishes for real. Lives under this app's existing data/ dir
# (data/chat_history.json, data/student_memory.json — same
# app-local-state convention), not a system temp dir, so it survives a
# Celery worker restart between pause and resume.
_CHECKPOINT_DIR = Path(__file__).resolve().parent.parent / "data" / "ingestion_checkpoints"


def _checkpoint_path(job_id: str) -> Path:
    return _CHECKPOINT_DIR / f"{job_id}.pkl"


def _save_checkpoint(job_id: str, pages: list) -> None:
    _CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    path = _checkpoint_path(job_id)
    tmp_path = path.with_suffix(".pkl.tmp")
    with open(tmp_path, "wb") as f:
        pickle.dump(pages, f)
    tmp_path.replace(path)  # atomic on both POSIX and Windows — never leaves a half-written checkpoint


def _load_checkpoint(job_id: str) -> list | None:
    path = _checkpoint_path(job_id)
    if not path.exists():
        return None
    try:
        with open(path, "rb") as f:
            return pickle.load(f)
    except Exception:
        logger.exception("Failed to load ingestion checkpoint for job_id=%s — resuming from page 1 instead", job_id)
        return None


def _delete_checkpoint(job_id: str) -> None:
    path = _checkpoint_path(job_id)
    if path.exists():
        try:
            path.unlink()
        except Exception:
            logger.warning("Failed to delete ingestion checkpoint for job_id=%s (non-fatal)", job_id)


def _check_pause_requested(job_id: str) -> bool:
    """Polled once per page from inside process_pdf's loop (via
    should_pause). Best-effort and fails closed (never pauses on a
    network hiccup) — same posture as _post_progress below: a dropped
    poll just means this page's pause check was a no-op, not a reason to
    interrupt a chapter that's actually fine."""
    if not NODE_BACKEND_ORIGIN:
        return False
    try:
        resp = requests.get(
            f"{NODE_BACKEND_ORIGIN}/api/admin/ingestion/{job_id}/pause-status",
            headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
            timeout=5,
        )
        if not resp.ok:
            return False
        return bool(resp.json().get("pause_requested"))
    except Exception:
        logger.warning("Failed to poll pause status for job_id=%s (non-fatal, continuing)", job_id)
        return False


def _patch_stdout_encoding_for_doclayout_yolo() -> None:
    """Confirmed live in this Celery worker: doclayout_yolo's own
    import-time logging setup checks `sys.stdout.encoding` (Windows-only
    branch), but Celery replaces sys.stdout with its own LoggingProxy
    when worker_redirect_stdouts is on (the default) — and that proxy has
    no `.encoding` attribute at all, so the very first DocLayout-YOLO
    model load in this worker crashes with `AttributeError: 'LoggingProxy'
    object has no attribute 'encoding'`. process_pdf catches this
    per-page and reports the job "completed" anyway (by design — one
    page's stage failure shouldn't fail the whole document), which made
    the bug initially invisible: the job succeeds while silently
    detecting zero regions on every page.

    Called at the start of the task itself, not at module import time —
    doclayout_yolo's import is lazy (only triggered by the first real
    predict() call, deep inside process_pdf), and whatever object Celery
    has installed as sys.stdout by the time this task actually executes
    is what matters, not whatever it was when this module first loaded
    at worker startup. Patched narrowly here (not in celery_app.py) so it
    only affects this task's own import of doclayout_yolo, not Celery's
    stdout handling for every other task in this app.
    """
    if not hasattr(sys.stdout, "encoding") or sys.stdout.encoding is None:
        sys.stdout.encoding = "utf-8"
    if not hasattr(sys.stderr, "encoding") or sys.stderr.encoding is None:
        sys.stderr.encoding = "utf-8"

_TEXTBOOK_BOARD_DEFAULT = os.getenv("TEXTBOOK_BOARD", "cbse")
_TEXTBOOK_PUBLISHER_DEFAULT = os.getenv("TEXTBOOK_PUBLISHER", "ncert")
_DEFAULT_CLASS_LEVEL = 9  # only used if Node genuinely couldn't resolve one

# Built once per worker process (loads DocLayout-YOLO weights + the vision
# runtime) — same reasoning as mindmap_tasks.py's module-level _tutor:
# cheap to reuse across tasks in the same process, expensive to rebuild
# per call. Imported lazily inside the task, not at module import time —
# scripts/ingest_textbook_images.py does real work at import (module-level
# constants read from env, logging setup) that should only happen once a
# worker actually starts handling this kind of task, not for every worker
# regardless of which tasks it's ever asked to run.
_processor = None


def _get_processor():
    global _processor
    if _processor is None:
        from scripts.ingest_textbook_images import build_document_processor, load_config

        config = load_config()
        _processor = build_document_processor(config)
    return _processor


def _post_callback(job_id: str, payload: dict):
    """Reports the job's outcome back to Node, which owns persistence
    (education_book_ingestions). Best-effort, same posture as
    _post_ingestion_callback in main.py — a failed callback leaves the
    job visibly stuck rather than silently vanishing."""
    if not NODE_BACKEND_ORIGIN:
        logger.error("NODE_BACKEND_ORIGIN not configured — cannot report image ingestion job %s status", job_id)
        return
    try:
        requests.post(
            f"{NODE_BACKEND_ORIGIN}/api/admin/ingestion/callback/{job_id}",
            json=payload,
            headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
            timeout=10,
        )
    except Exception:
        logger.exception("Failed to POST image ingestion callback for job_id=%s", job_id)


def _post_progress(job_id: str, *, current_stage: str, items_processed: int | None = None, total_items: int | None = None):
    """Interim 'what's happening right now' report, separate from
    _post_callback above — fires many times over the job's life instead
    of once at the end. Best-effort and deliberately silent on failure
    (only logged, not retried): a dropped progress update just means the
    admin's status view is a page behind, never a reason to fail or slow
    down the actual ingestion. Short timeout so a slow/unreachable Node
    can't stall page-by-page processing."""
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
        logger.warning("Failed to POST image ingestion progress for job_id=%s (non-fatal)", job_id)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def ingest_chapter_images_task(
    self,
    pdf_bytes: bytes,
    original_filename: str,
    job_id: str,
    board: str | None,
    class_level: int | None,
    subject: str | None,
    chapter: str,
    chapter_number: int | None,
    start_page: int = 1,
):
    """Background image ingestion for one admin-uploaded chapter PDF —
    DocLayout-YOLO + PaddleOCR + Qwen vision validation per page, much
    heavier and longer-running than text ingestion, so unlike
    _run_chapter_ingestion (FastAPI BackgroundTasks, main.py) this goes
    through Celery for real retry/ack semantics, same reasoning as
    mind map/slide deck generation.

    Reuses DocumentProcessor.process_pdf exactly as the batch CLI
    (scripts/ingest_textbook_images.py's own run_pipeline) does — the
    only difference is passing a real document_context built from Node's
    chapter metadata, instead of letting Subject/Chapter Detection guess
    it from a knowledge_base/<Subject>/<chapter folder>/ layout the
    uploaded file was never placed under (see process_pdf's own
    document_context parameter, and MetadataBuilder's matching
    preference for it — both added specifically for this task).

    Retry-safe: every Qdrant point id this pipeline writes is a
    deterministic uuid5 derived from the region's own id, so a retried
    run upserts the same points rather than creating duplicates.

    `start_page` > 1 means this is a resumed run (Node's resume route
    sets it to the paused job's last completed page + 1) — the matching
    checkpoint (real per-page extraction results, not just a count) is
    loaded from disk and handed to process_pdf as resume_pages so the
    pages already done are never re-run through vision/OCR. A missing or
    corrupt checkpoint falls back to start_page=1 rather than failing the
    whole resume — better to re-pay the vision cost once than to leave
    the job permanently stuck.
    """
    _patch_stdout_encoding_for_doclayout_yolo()

    resume_pages = None
    if start_page > 1:
        resume_pages = _load_checkpoint(job_id)
        if resume_pages is None:
            logger.warning("No usable checkpoint for job_id=%s — resuming from page 1 instead", job_id)
            start_page = 1

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name

        doc_context = DocumentContext(
            class_no=class_level if class_level is not None else _DEFAULT_CLASS_LEVEL,
            board=board or _TEXTBOOK_BOARD_DEFAULT,
            publisher=_TEXTBOOK_PUBLISHER_DEFAULT,
            subject=subject or "Unknown",
            chapter_no=chapter_number or 0,
            chapter_name=chapter,
            pdf_name=original_filename,
        )

        _post_progress(job_id, current_stage="Starting up (loading models)…")

        def _on_page(page_number: int, total_pages: int, _page_result) -> None:
            _post_progress(
                job_id,
                current_stage=f"Processing page {page_number} of {total_pages}",
                items_processed=page_number,
                total_items=total_pages,
            )

        processor = _get_processor()
        result = processor.process_pdf(
            Path(tmp_path),
            document_context=doc_context,
            on_page=_on_page,
            start_page=start_page,
            resume_pages=resume_pages,
            should_pause=lambda: _check_pause_requested(job_id),
        )

        if result.context.get("paused"):
            last_page = result.pages[-1].page_number if result.pages else start_page - 1
            _save_checkpoint(job_id, result.pages)
            _post_callback(job_id, {"status": "paused", "items_processed": last_page})
            return

        _delete_checkpoint(job_id)
        _post_callback(
            job_id,
            {"status": "completed", "items_processed": processor.last_store_count, "storage_key": doc_context.chapter_slug},
        )
    except Exception as exc:
        logger.exception("Image ingestion failed for job_id=%s", job_id)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _post_callback(job_id, {"status": "failed", "error_message": str(exc)})
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
