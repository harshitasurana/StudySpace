import os

from celery import Celery
from dotenv import load_dotenv

# `celery -A core.celery_app worker` imports this module first, before
# anything else in the app has had a chance to load .env (main.py and
# rag/vector_db.py each call load_dotenv() themselves, but the worker
# process never imports main.py) — without this, REDIS_URL and every
# other env var this module's importers read (NODE_BACKEND_ORIGIN,
# AI_SERVICE_KEY in mindmap_tasks.py) would silently fall back to
# whatever default is coded here, in a real deployment, not just tests.
load_dotenv()

# Service name "redis", matching the docker-compose hostname convention
# already used for fastapi/streamlit referring to each other.
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# `include` is what actually registers the task with the WORKER process —
# `celery -A core.celery_app worker` only imports this module, not
# core/mindmap_tasks.py, so without this the worker starts cleanly, logs
# an empty [tasks] list, and any task sent to it just sits unconsumed
# with no visible error (confirmed hitting exactly this while testing).
# Importing mindmap_tasks.py directly here instead would be circular
# (mindmap_tasks.py imports celery_app from this module) — `include` is
# Celery's own answer to that: it defers the import until after this
# module has finished loading.
celery_app = Celery(
    "rag_ai_tutor",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "core.mindmap_tasks",
        "core.slide_deck_tasks",
        "core.infographic_tasks",
        "core.image_ingestion_tasks",
        "core.image_enrichment_tasks",
        "core.quiz_tasks",
        "core.flashcard_tasks",
    ],
)

celery_app.conf.update(
    # Don't lose a task if the worker process dies mid-generation — it
    # gets redelivered instead of silently vanishing.
    task_acks_late=True,
    # Don't let one worker grab several long, Ollama-bound tasks at once
    # just because they were queued together.
    worker_prefetch_multiplier=1,
)

# image_ingestion_tasks.py and image_enrichment_tasks.py are genuinely
# heavier than everything else here (DocLayout-YOLO + PaddleOCR + a
# vision call PER PAGE/image, not one bounded Ollama call) and can run
# for hours on a real chapter — confirmed live: a quiz generation request
# sat queued for minutes behind a single in-progress enrichment job
# because both shared the same queue and a `--pool=solo` worker only
# ever runs one task at a time. That's exactly the starvation scenario
# this module used to only warn about speculatively — routed onto their
# own "heavy" queue now so a student's quiz/tutor/mind-map request never
# again waits on someone else's hours-long background ingestion job.
#
# Every other task type here (mindmap, slide deck, infographic, quiz,
# flashcard) is the same SHAPE of work — one bounded, Ollama-bound
# generation per request — and stays on Celery's default "celery" queue
# together, sharing one worker/--concurrency limit, same as before.
#
# IMPORTANT: a `celery worker` started without an explicit `-Q` only
# consumes the default `celery` queue — a task routed to "heavy" would
# sit unconsumed forever with no visible error unless at least one
# worker is started with `-Q heavy` (or `-Q celery,heavy` to consume
# both). See compose files / start scripts for the actual worker
# commands that need updating alongside this.
celery_app.conf.task_routes = {
    "core.image_ingestion_tasks.*": {"queue": "heavy"},
    "core.image_enrichment_tasks.*": {"queue": "heavy"},
}
