import json
import logging
import os
import base64
import uuid
import traceback
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
import asyncio
from core.lightweight_router import LightweightRouter
import inngest
import inngest.fast_api
from observability.langfuse_client import langfuse
from rag.data_loader import (
    load_and_chunk_pdf,
    load_pdf_pages,
    embed_texts,
    ollama_client,
)
from rag.vector_db import VectorDB
from config.curriculum import CURRICULUM

from models.custom_types import (
    RAGSearchResults,
    RAGUpsertResults,
    RAGChunkAndSrc,
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends, Header, HTTPException, BackgroundTasks, UploadFile, File, Form
import requests
import tempfile
import io
from PIL import Image
from core.local_image_storage import get_local_image_storage
from core.document_context import DocumentContext
from core.chapter_workspace import build_chapter_workspace
from core.pdf_image_sanitizer import sanitize_pdf_images
from core.image_chat import describe_attached_image
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from core.media_orchestrator import (
    MediaOrchestrator,
)
from core.intent_router import IntentRouter
from core.tutor_engine import TutorEngine
import core.llm_provider as llm_provider
from core.mindmap_retrieval import retrieve_varied_chapter_chunks, retrieve_node_context
from core.mindmap_images import resolve_chapter_number, attach_branch_images
from core.mindmap_tasks import generate_mind_map_variant_task
from core.slide_deck_tasks import generate_slide_deck_task
from core.quiz_tasks import generate_quiz_task
from core.flashcard_tasks import generate_flashcard_set_task
from core.infographic_tasks import generate_infographic_task
from core.image_ingestion_tasks import ingest_chapter_images_task
from core.image_enrichment_tasks import enrich_chapter_images_task
from core.stt_service import transcribe_audio
from core.tts_service import synthesize_speech
import time
from core.media_types import (
    ImageAction,
    MediaDecision,
)

from rag.image_service import (
    ImageService,
)
from functools import lru_cache
from core.ncert_solutions_index import build_ncert_solutions_index

# =========================================
# LOAD ENVIRONMENT VARIABLES
# =========================================

load_dotenv()


# =========================================
# APPLICATION CONFIG
# =========================================

INNGEST_APP_ID = os.getenv(
    "INNGEST_APP_ID",
    "rag-application",
)

INNGEST_PRODUCTION = (
    os.getenv(
        "INNGEST_PRODUCTION",
        "false",
    ).lower()
    == "true"
)

RAG_TOP_K = int(
    os.getenv(
        "RAG_TOP_K",
        "5",
    )
)

IMAGE_RETRIEVE_TOP_K = int(
    os.getenv(
        "IMAGE_RETRIEVE_TOP_K",
        "3",
    )
)

IMAGE_MIN_SCORE = float(
    os.getenv(
        "IMAGE_MIN_SCORE",
        "0.62",
    )
)

IMAGE_STRONG_SCORE = float(
    os.getenv(
        "IMAGE_STRONG_SCORE",
        "0.72",
    )
)

lightweight_router = LightweightRouter()
logger = logging.getLogger(__name__)

def log_timing(stage: str, started_at: float):
    elapsed = time.perf_counter() - started_at

    print(
        f"[PERF] {stage:<35} "
        f"{elapsed:>8.3f}s"
    )

    return elapsed


# resolve_chapter_number moved to core/mindmap_images.py (still used by
# /api/tutor/chat below, imported back from there) so the mind-map
# Celery worker can also call it without importing this module.

router = IntentRouter()
tutor = TutorEngine()
media_orchestrator = MediaOrchestrator()
image_service = ImageService()
vector_store = VectorDB()

# =========================================
# INNGEST CLIENT
# =========================================

inngest_client = inngest.Inngest(
    app_id=INNGEST_APP_ID,
    logger=logging.getLogger(
        "uvicorn"
    ),
    is_production=INNGEST_PRODUCTION,
    serializer=inngest.PydanticSerializer(),
)


# =========================================
# INGEST PDF FUNCTION
# =========================================

@inngest_client.create_function(
    fn_id="RAG: Ingest PDF",
    trigger=inngest.TriggerEvent(
        event="rag/ingest_pdf"
    ),
)
async def rag_ingest_pdf(
    ctx: inngest.Context,
):

    # -------------------------------------
    # LOAD AND CHUNK
    # -------------------------------------

    def _load(
        ctx: inngest.Context,
    ) -> RAGChunkAndSrc:

        pdf_path = ctx.event.data[
            "pdf_path"
        ]

        source_id = ctx.event.data.get(
            "source_id",
            pdf_path,
        )

        chunks = load_and_chunk_pdf(
            pdf_path
        )

        return RAGChunkAndSrc(
            chunks=chunks,
            source_id=source_id,
        )

    # -------------------------------------
    # EMBED AND STORE
    # -------------------------------------

    def _upsert(
        chunks_and_src: RAGChunkAndSrc,
    ) -> RAGUpsertResults:

        chunks = chunks_and_src.chunks
        source_id = (
            chunks_and_src.source_id
        )

        vecs = embed_texts(chunks)

        ids = [
            str(
                uuid.uuid5(
                    uuid.NAMESPACE_URL,
                    f"{source_id}:{i}",
                )
            )
            for i in range(len(chunks))
        ]

        payloads = []

        for i in range(len(chunks)):

            payloads.append(
                {
                    "source": source_id,
                    "subject": "Uploaded",
                    "chapter": source_id,
                    "book_type":
                        "User Upload",
                    "class": "9",
                    "text": chunks[i],
                }
            )

        vector_store.upsert(
            ids,
            vecs,
            payloads,
        )

        return RAGUpsertResults(
            ingested=len(chunks)
        )

    chunks_and_src = await ctx.step.run(
        "load-and-chunk",
        lambda: _load(ctx),
        output_type=RAGChunkAndSrc,
    )

    ingested = await ctx.step.run(
        "embed-and-store",
        lambda: _upsert(
            chunks_and_src
        ),
        output_type=RAGUpsertResults,
    )

    return ingested.model_dump()

@inngest_client.create_function(
    fn_id="RAG: Query PDF",
    trigger=inngest.TriggerEvent(
        event="rag/query_pdf_ai"
    ),
)
async def rag_query_pdf(
    ctx: inngest.Context,
):
    total_start = time.perf_counter()

    # =====================================
    # EVENT DATA
    # =====================================

    question = ctx.event.data[
        "question"
    ]

    subject = ctx.event.data[
        "subject"
    ]

    chapter = ctx.event.data[
        "chapter"
    ]

    mode = ctx.event.data[
        "mode"
    ]

    conversation = ctx.event.data.get(
        "conversation",
        [],
    )

    student_memory = ctx.event.data.get(
        "memory",
        {},
    )

    top_k = int(
        ctx.event.data.get(
            "top_k",
            RAG_TOP_K,
        )
    )

    request_id = ctx.event.data.get(
        "request_id",
        str(uuid.uuid4()),
    )

    print("\n" + "=" * 70)
    print("[PERF] RAG QUERY STARTED")
    print("[PERF] REQUEST ID:", request_id)
    print("=" * 70)

    with langfuse.start_as_current_observation(
        as_type="span",
        name="rag-backend-request",
        input={
            "request_id": request_id,
            "question": question,
            "subject": subject,
            "chapter": chapter,
            "mode": mode,
            "top_k": top_k,
        },
    ) as backend_span:

        try:

            # =================================
            # LIGHTWEIGHT DIRECT ROUTE
            # =================================

            lightweight_result = (
                lightweight_router.detect(question)
            )

            if lightweight_result is not None:
                total_elapsed = (
                        time.perf_counter()
                        - total_start
                )

                backend_span.update(
                    output={
                        "request_id": request_id,
                        "status": "completed",
                        "route": "lightweight-direct",
                        "lightweight_intent": (
                            lightweight_result
                            .intent
                            .value
                        ),
                        "duration_seconds": (
                            total_elapsed
                        ),
                    }
                )

                langfuse.flush()

                return {
                    "type": "chat",
                    "answer": (
                        lightweight_result.answer
                    ),
                    "source": [],
                    "num_contexts": 0,
                    "media_decision": None,
                    "images": [],
                    "image_fallback_required": False,
                    "videos": [],
                }

            def _search() -> RAGSearchResults:

                search_total_start = (
                    time.perf_counter()
                )

                with (
                    langfuse
                    .start_as_current_observation(
                        as_type="span",
                        name="rag-search-stage",
                        input={
                            "request_id": request_id,
                            "top_k": top_k,
                        },
                    )
                ) as search_span:

                    # =========================
                    # QUESTION EMBEDDING
                    # =========================

                    embed_start = (
                        time.perf_counter()
                    )

                    with (
                        langfuse
                        .start_as_current_observation(
                            as_type="span",
                            name="question-embedding",
                            input={
                                "request_id":
                                    request_id,
                                "question_chars":
                                    len(question),
                            },
                        )
                    ) as embedding_span:

                        query_vec = embed_texts(
                            [question]
                        )[0]

                        embed_elapsed = (
                            time.perf_counter()
                            - embed_start
                        )

                        embedding_span.update(
                            output={
                                "vector_dimension":
                                    len(query_vec),
                                "duration_seconds":
                                    embed_elapsed,
                            }
                        )

                    log_timing(
                        "Question embedding",
                        embed_start,
                    )

                    # =========================
                    # QDRANT SEARCH
                    # =========================

                    qdrant_start = time.perf_counter()

                    with langfuse.start_as_current_observation(
                            as_type="span",
                            name="qdrant-search",
                            input={
                                "request_id": request_id,
                                "subject": subject,
                                "chapter": chapter,
                                "top_k": top_k,
                            },
                    ) as qdrant_span:
                        found = vector_store.search(
                            query_vector=query_vec,
                            subject=subject,
                            chapter=chapter,
                            top_k=top_k,
                        )
                        print("=" * 60)
                        print("TEXT SEARCH RESULTS")
                        print("=" * 60)
                        print("Found:", len(found["chunks"]))

                        for chunk in found["chunks"]:
                            print(
                                f"Page={chunk['page']} "
                                f"Score={chunk['score']:.4f}"
                            )

                        qdrant_elapsed = (
                                time.perf_counter()
                                - qdrant_start
                        )

                        qdrant_span.update(
                            output={
                                "context_count": len(
                                    found["contexts"]
                                ),
                                "source_count": len(
                                    found["source"]
                                ),
                                "duration_seconds":
                                    qdrant_elapsed,
                            }
                        )

                    log_timing(
                        "Qdrant vector search",
                        qdrant_start,
                    )

                    search_elapsed = (
                        time.perf_counter()
                        - search_total_start
                    )

                    search_span.update(
                        output={
                            "context_count":
                                len(
                                    found[
                                        "contexts"
                                    ]
                                ),
                            "source_count":
                                len(
                                    found[
                                        "source"
                                    ]
                                ),
                            "duration_seconds":
                                search_elapsed,
                        }
                    )

                    log_timing(
                        "Complete search stage",
                        search_total_start,
                    )

                    return RAGSearchResults(
                        contexts=found[
                            "contexts"
                        ],
                        source=found[
                            "source"
                        ],
                    )

            # =================================
            # INNGEST SEARCH STEP
            # =================================

            inngest_search_start = (
                time.perf_counter()
            )

            found = await ctx.step.run(
                "embed-and-search",
                _search,
                output_type=RAGSearchResults,
            )

            log_timing(
                "Inngest search step",
                inngest_search_start,
            )

            # =================================
            # MEDIA DECISION
            # =================================

            media_start = (
                time.perf_counter()
            )

            with (
                langfuse
                .start_as_current_observation(
                    as_type="span",
                    name="media-decision",
                    input={
                        "request_id":
                            request_id,
                        "question":
                            question,
                    },
                )
            ) as media_span:

                try:
                    media_decision = (
                        media_orchestrator.detect(
                            question
                        )
                    )

                except Exception as exc:

                    logger.exception(
                        "Media decision failed — "
                        "falling back to text-only"
                    )

                    # Media orchestration is an enhancement layer
                    # (deciding whether to fetch/generate images or
                    # video); a failure here should never block the
                    # student from getting a text answer.
                    media_decision = MediaDecision()

                    media_span.update(
                        output={
                            "status": "failed",
                            "error_type":
                                type(exc).__name__,
                            "error": str(exc),
                        }
                    )

                media_elapsed = (
                    time.perf_counter()
                    - media_start
                )

                media_span.update(
                    output={
                        "decision":
                            media_decision
                            .model_dump(),
                        "duration_seconds":
                            media_elapsed,
                    }
                )

            log_timing(
                "Media decision",
                media_start,
            )

            print(
                "MEDIA    :",
                media_decision.model_dump(),
            )

            # =================================
            # IMAGE RETRIEVAL
            # =================================

            figures = []
            image_fallback_required = False

            if (
                    media_decision.image_action
                    in (
                    ImageAction.RETRIEVE,
                    ImageAction.RETRIEVE_FIRST,
            )
                    and not figures
            ):

                image_start = (
                    time.perf_counter()
                )

                with (
                    langfuse
                    .start_as_current_observation(
                        as_type="span",
                        name="image-retrieval",
                        input={
                            "request_id":
                                request_id,
                            "subject":
                                subject,
                            "chapter":
                                chapter,
                            "top_k":
                                10,
                        },
                    )
                ) as image_span:

                    try:
                        chapter_number = (
                            resolve_chapter_number(
                                subject, chapter
                            )
                        )

                        figures = image_service.retrieve(
                            query=question,
                            subject=subject,
                            chapter_number=chapter_number,
                            top_k=10,
                        )

                        print(
                            f"[MEDIA] Retrieved "
                            f"{len(figures)} figure group(s)"
                        )

                    except Exception as exc:

                        logger.exception(
                            "Textbook image "
                            "retrieval failed"
                        )

                        figures = []

                        image_span.update(
                            output={
                                "status": "failed",
                                "error_type":
                                    type(exc)
                                    .__name__,
                                "error": str(exc),
                            }
                        )

                    if (
                            media_decision.image_action
                            in (
                            ImageAction.RETRIEVE,
                            ImageAction.RETRIEVE_FIRST,
                    )
                            and not figures
                    ):
                        image_fallback_required = True

                    image_elapsed = (
                        time.perf_counter()
                        - image_start
                    )

                    image_span.update(
                        output={
                            "approved_figure_count":
                                len(figures),
                            "fallback_required":
                                image_fallback_required,
                            "duration_seconds":
                                image_elapsed,
                        }
                    )

                log_timing(
                    "Textbook image retrieval",
                    image_start,
                )

                print(
                    f"[MEDIA] Approved "
                    f"{len(figures)} figure group(s)"
                )

                print(
                    "[MEDIA] Generation fallback:",
                    image_fallback_required,
                )

            # =================================
            # NO CONTEXT
            # =================================

            if not found.contexts:

                total_elapsed = (
                    time.perf_counter()
                    - total_start
                )

                backend_span.update(
                    output={
                        "request_id":
                            request_id,
                        "status":
                            "completed-no-context",
                        "num_contexts":
                            0,
                        "duration_seconds":
                            total_elapsed,
                    }
                )

                langfuse.flush()

                return {
                    "type": "chat",
                    "answer": (
                        "No relevant text context "
                        "found for the selected "
                        "chapter."
                    ),
                    "source": [],
                    "num_contexts": 0,
                    "media_decision":
                        media_decision.model_dump(),
                    "figures": figures,
                    "image_fallback_required":
                        image_fallback_required,
                    "videos": [],
                }

            # =================================
            # CONTEXT BUILDING
            # =================================

            context_start = (
                time.perf_counter()
            )

            with (
                langfuse
                .start_as_current_observation(
                    as_type="span",
                    name="context-building",
                    input={
                        "request_id":
                            request_id,
                        "available_contexts":
                            len(found.contexts),
                        "max_contexts":
                            3,
                        "max_context_chars":
                            5000,
                    },
                )
            ) as context_span:

                MAX_CONTEXTS = 3
                MAX_CONTEXT_CHARS = 5000

                selected_contexts = []
                current_chars = 0

                for item in found.contexts:

                    if not isinstance(
                        item,
                        str,
                    ):
                        continue

                    clean_item = (
                        item.strip()
                    )

                    if not clean_item:
                        continue

                    remaining = (
                        MAX_CONTEXT_CHARS
                        - current_chars
                    )

                    if remaining <= 0:
                        break

                    selected_text = (
                        clean_item[:remaining]
                    )

                    selected_contexts.append(
                        selected_text
                    )

                    current_chars += len(
                        selected_text
                    )

                    if (
                        len(selected_contexts)
                        >= MAX_CONTEXTS
                    ):
                        break

                context = "\n\n".join(
                    selected_contexts
                )

                context_elapsed = (
                    time.perf_counter()
                    - context_start
                )

                context_span.update(
                    output={
                        "selected_contexts":
                            len(
                                selected_contexts
                            ),
                        "context_chars":
                            len(context),
                        "duration_seconds":
                            context_elapsed,
                    }
                )

            log_timing(
                "Context construction",
                context_start,
            )

            print(
                f"[PERF] Original contexts: "
                f"{len(found.contexts)}"
            )

            print(
                f"[PERF] Selected contexts: "
                f"{len(selected_contexts)}"
            )

            print(
                f"[PERF] Context size: "
                f"{len(context):,} chars"
            )

            # =================================
            # INTENT DETECTION
            # =================================

            intent_start = (
                time.perf_counter()
            )

            with (
                langfuse
                .start_as_current_observation(
                    as_type="span",
                    name="intent-detection",
                    input={
                        "request_id":
                            request_id,
                        "question":
                            question,
                    },
                )
            ) as intent_span:

                intent = router.detect(
                    question
                )

                intent_elapsed = (
                    time.perf_counter()
                    - intent_start
                )

                intent_span.update(
                    output={
                        "intent":
                            str(intent),
                        "duration_seconds":
                            intent_elapsed,
                    }
                )

            log_timing(
                "Intent detection",
                intent_start,
            )

            print("=" * 60)
            print("QUESTION :", question)
            print("SUBJECT  :", subject)
            print("CHAPTER  :", chapter)
            print("MODE     :", mode)
            print("INTENT   :", intent)
            print("=" * 60)

            # =================================
            # TUTOR GENERATION
            # =================================

            def _generate():

                print("=" * 60)
                print(
                    "STARTING TUTOR GENERATION"
                )
                print("=" * 60)

                generation_start = (
                    time.perf_counter()
                )

                with (
                    langfuse
                    .start_as_current_observation(
                        as_type="span",
                        name="tutor-engine",
                        input={
                            "request_id":
                                request_id,
                            "intent":
                                str(intent),
                            "question":
                                question,
                            "context_chars":
                                len(context),
                        },
                    )
                ) as tutor_span:

                    result = tutor.run(
                        intent=intent,
                        question=question,
                        context=context,
                        subject=subject,
                        chapter=chapter,
                        mode=mode,
                        conversation=conversation,
                        memory=student_memory,
                        figures=figures,
                    )

                    generation_elapsed = (
                        time.perf_counter()
                        - generation_start
                    )

                    tutor_span.update(
                        output={
                            "result_type":
                                (
                                    result.get(
                                        "type"
                                    )
                                    if isinstance(
                                        result,
                                        dict,
                                    )
                                    else None
                                ),
                            "duration_seconds":
                                generation_elapsed,
                        }
                    )

                print("=" * 60)
                print(
                    "TUTOR GENERATION COMPLETED"
                )
                print("=" * 60)

                log_timing(
                    "TutorEngine total",
                    generation_start,
                )

                return result

            # =================================
            # INNGEST GENERATION STEP
            # =================================

            inngest_generation_start = (
                time.perf_counter()
            )

            result = await ctx.step.run(
                "generate-tutor-response",
                _generate,
            )

            log_timing(
                "Inngest generation step",
                inngest_generation_start,
            )

            total_elapsed = (
                time.perf_counter()
                - total_start
            )

            log_timing(
                "TOTAL RAG QUERY",
                total_start,
            )

            print("=" * 70)
            print(
                "[PERF] RAG QUERY COMPLETED"
            )
            print(
                "[PERF] REQUEST ID:",
                request_id,
            )
            print("=" * 70)

            # =================================
            # COMPLETE ROOT SPAN
            # =================================

            backend_span.update(
                output={
                    "request_id":
                        request_id,
                    "status":
                        "completed",
                    "result_type":
                        (
                            result.get("type")
                            if isinstance(
                                result,
                                dict,
                            )
                            else None
                        ),
                    "selected_contexts":
                        len(selected_contexts),
                    "context_chars":
                        len(context),
                    "figure_count":
                        len(figures),
                    "duration_seconds":
                        total_elapsed,
                }
            )

            langfuse.flush()

            # =================================
            # FINAL RESPONSE
            # =================================

            return {
                **result,
                "source": found.source,
                "num_contexts": len(selected_contexts),
                "media_decision": media_decision.model_dump(),
                "figures": figures,
                "image_fallback_required": image_fallback_required,
                "videos": [],
            }

        except Exception as exc:

            print("\n" + "=" * 80)
            print("RAG PIPELINE FAILED")
            print("=" * 80)

            traceback.print_exc()

            print("=" * 80)

            backend_span.update(
                output={
                    "request_id": request_id,
                    "status": "failed",
                    "error_type": type(exc).__name__,
                    "error": str(exc),
                    "duration_seconds": (
                            time.perf_counter()
                            - total_start
                    ),
                }
            )

            langfuse.flush()

            raise




# =========================================
# FASTAPI APPLICATION & CORS MIDDLEWARE
# =========================================

# This service is server-to-server only — the Node backend is the sole
# caller, never the browser. CORS previously allowed localhost:5173 (the
# frontend's origin), which was the wrong layer entirely: a browser origin
# has no business being allowed to call this service directly.
NODE_BACKEND_ORIGIN = os.getenv(
    "NODE_BACKEND_ORIGIN",
    "http://localhost:3000",
)

# Shared secret the Node backend's AiServiceClient sends on every request.
# CORS doesn't protect server-to-server calls (browsers enforce it, curl
# doesn't), so this header check is the actual access control. Applied
# per-route (see /api/tutor/chat below) rather than as a global app
# dependency — a global dependency also caught /api/inngest, the endpoint
# Inngest's own dev server calls for its sync handshake, which doesn't
# and shouldn't send this header.
AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY")


async def verify_service_key(
    x_service_key: str | None = Header(default=None),
):
    if not AI_SERVICE_KEY or x_service_key != AI_SERVICE_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing service key")


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[NODE_BACKEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serves whatever LocalImageStorage (core/local_image_storage.py) wrote
# under LOCAL_MEDIA_ROOT at ingestion/enrichment time — same convention
# the Node backend already uses for its own local storage
# (LocalStorageProvider + an express.static mount). This is the only
# image/PDF storage backend in this deployment (local-only, no MinIO/S3).
_local_media_root = Path(os.getenv("LOCAL_MEDIA_ROOT", "local_media")).resolve()
_local_media_root.mkdir(parents=True, exist_ok=True)
app.mount("/local-media", StaticFiles(directory=str(_local_media_root)), name="local-media")


# =========================================
# REST API DATA SCHEMAS
# =========================================

class ChatRequest(BaseModel):
    question: str
    subject: str = "Mathematics"
    # None means "search every chapter of this subject" (see
    # VectorDB.search()'s conditional chapter filter) — used when the
    # student doesn't know which chapter their question belongs to.
    chapter: Optional[str] = None
    mode: str = "Chat"
    conversation: List[Dict[str, str]] = []
    memory: Optional[Dict[str, Any]] = None
    board: Optional[str] = "CBSE"
    standard: Optional[str] = "Standard 9"
    # "voice" makes TutorEngine phrase this exact same grounded answer
    # for speech instead of reading — see VOICE_RESPONSE_INSTRUCTIONS in
    # core/prompts.py. Never changes retrieval/intent/RAG, only phrasing.
    response_mode: str = "text"

class QuizGenerateRequest(BaseModel):
    subject: str
    chapter: str
    num_questions: int = 10
    board: Optional[str] = "CBSE"
    standard: Optional[str] = "Standard 9"
    focus: Optional[str] = None
    # When set, generation is grounded in this exact text (e.g. a
    # student's own note) instead of RAG-retrieved chapter content —
    # skips vector search entirely. subject/chapter are still used for
    # labeling/board-standard phrasing.
    source_text: Optional[str] = None
    # Always True in practice — every quiz/mock-test/pre-assessment
    # generation goes through the Celery worker (core/quiz_tasks.py) now,
    # same reasoning as SlideDeckGenerateRequest.async_mode: each attempt
    # is a fresh, personalized quiz, not a cached per-chapter resource, so
    # there's no synchronous "everyone already accepts this wait" case to
    # preserve. Kept as a real field rather than hardcoded away so this
    # request's shape mirrors the other generate-request models.
    async_mode: bool = True
    attempt_id: Optional[str] = None


class FlashcardGenerateRequest(BaseModel):
    subject: str
    chapter: str
    num_cards: int = 8
    board: Optional[str] = "CBSE"
    standard: Optional[str] = "Standard 9"
    source_text: Optional[str] = None
    # Always True in practice — every flashcard set generation goes
    # through the Celery worker (core/flashcard_tasks.py) now, same
    # reasoning as QuizGenerateRequest.async_mode: each set is a fresh,
    # personalized generation, not a cached per-chapter resource.
    async_mode: bool = True
    set_id: Optional[str] = None


class StudyPlanIntroRequest(BaseModel):
    overall_mastery: float
    total_chapters: int
    chapters_completed: int
    weakest_chapter: Optional[str] = None
    weakest_mastery: Optional[float] = None
    not_started_count: int = 0


class TestReviewRequest(BaseModel):
    latest_score: float
    average_score: float
    tests_taken: int
    previous_score: Optional[float] = None
    weakest_concept: Optional[str] = None


class MindMapGenerateRequest(BaseModel):
    subject: str
    chapter: str
    # Node already sends these (ai_service_client.js's generateMindMap)
    # but this model previously omitted them, so Pydantic silently
    # dropped both — mind-map generation was the one RAG endpoint in this
    # app that wasn't class-scoped. Optional since older callers/tests
    # may still omit them.
    board: Optional[str] = None
    standard: Optional[str] = None
    # Which of MIND_MAP_LENS_INSTRUCTIONS to generate. "concept_overview"
    # is the only variant generated synchronously (a student is actively
    # waiting on it) and the only one that gets the third, grandchildren
    # level — see generate_mindmap below.
    variant: str = "concept_overview"
    # When async_mode is true, this request hands off to the Celery
    # worker (core/mindmap_tasks.py) instead of generating inline, and
    # mind_map_id identifies which Node-owned education_mind_maps row to
    # report the result back to via the callback endpoint. Used for the
    # 4 background variants; the synchronous "concept_overview" request a
    # student is waiting on never sets this.
    async_mode: bool = False
    mind_map_id: Optional[str] = None


class SlideDeckGenerateRequest(BaseModel):
    subject: str
    chapter: str
    board: Optional[str] = None
    standard: Optional[str] = None
    # Always True in practice — every AI Learning Deck generation goes
    # through the Celery worker (core/slide_deck_tasks.py), including a
    # chapter's very first request; there's exactly one deck per
    # chapter+scope in Phase 1, unlike mind maps' 5-variant synchronous
    # exception. Kept as a real field (not hardcoded away) so this
    # request's shape mirrors MindMapGenerateRequest's exactly, not
    # because a synchronous path is expected to be used.
    async_mode: bool = True
    deck_id: Optional[str] = None


class InfographicGenerateRequest(BaseModel):
    subject: str
    chapter: str
    board: Optional[str] = None
    standard: Optional[str] = None
    # Always True in practice — same posture as SlideDeckGenerateRequest's
    # own async_mode: exactly one infographic per chapter+scope, so
    # every generation (including a chapter's very first request) goes
    # through the Celery worker. Kept as a real field so this request's
    # shape mirrors the other two generate requests exactly.
    async_mode: bool = True
    infographic_id: Optional[str] = None


class EnrichChapterImagesRequest(BaseModel):
    job_id: str
    subject: Optional[str] = None
    chapter: Optional[str] = None


# =========================================
# REST API ENDPOINTS
# =========================================
# The mock /api/auth/* routes (login, send-otp, verify-otp, mfa-verify,
# signup, forgot-password, reset-password) have been removed entirely —
# real auth lives in the Node backend. Registering them here, even as
# mocks, meant they were reachable from anything shipped; they now 404
# like any other undefined route.

@app.get("/api/curriculum")
async def get_curriculum():
    from config.curriculum import CURRICULUM

    math_chapters = []
    for i, c in enumerate(CURRICULUM.get("Mathematics", [])):
        progress = 0
        if i == 0: progress = 85
        elif i == 1: progress = 42
        elif i == 2: progress = 12
        math_chapters.append({
            "id": f"math_ch{i+1}",
            "file": c["file"],
            "chapter": c["chapter"],
            "progress": progress,
            "status": "Mastered" if progress >= 80 else ("In-Progress" if progress > 0 else "Locked")
        })

    science_chapters = []
    for i, c in enumerate(CURRICULUM.get("Science", [])):
        progress = 0
        if i == 0: progress = 60
        elif i == 1: progress = 30
        science_chapters.append({
            "id": f"science_ch{i+1}",
            "file": c["file"],
            "chapter": c["chapter"],
            "progress": progress,
            "status": "Mastered" if progress >= 80 else ("In-Progress" if progress > 0 else "Locked")
        })

    return {
        "Mathematics": math_chapters,
        "Science": science_chapters
    }



MAX_CONTEXTS = 3
MAX_CONTEXT_CHARS = 5000


@app.post("/api/tutor/chat", dependencies=[Depends(verify_service_key)])
async def tutor_chat(req: ChatRequest):
    return await _handle_tutor_chat(req)


@app.post("/api/tutor/chat/image", dependencies=[Depends(verify_service_key)])
async def tutor_chat_image(
    image: UploadFile = File(...),
    question: str = Form(""),
    subject: str = Form("Mathematics"),
    chapter: str = Form("Orienting Yourself: The Use of Coordinates"),
    mode: str = Form("Chat"),
    conversation: str = Form("[]"),
    memory: str | None = Form(default=None),
    board: str = Form("CBSE"),
    standard: str = Form("Standard 9"),
    response_mode: str = Form("text"),
):
    """Image-attach counterpart to /api/tutor/chat. Runs the attached
    image through the local Qwen vision reader (core/image_chat.py) to get
    a text description, then hands off to the exact same retrieval +
    TutorEngine pipeline as text chat — only the extra image_description
    argument differs. See core/image_chat.py's module docstring for why
    this is a text pre-processing step rather than true multimodal."""
    image_bytes = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(image_bytes))
        pil_image.load()
    except Exception:
        logger.exception("Could not decode attached chat image")
        pil_image = None

    image_description = describe_attached_image(pil_image) if pil_image is not None else ""

    req = ChatRequest(
        question=question.strip() or "Please look at the attached image and help me understand it.",
        subject=subject,
        chapter=chapter,
        mode=mode,
        conversation=json.loads(conversation) if conversation else [],
        memory=json.loads(memory) if memory else None,
        board=board,
        standard=standard,
        response_mode=response_mode,
    )
    return await _handle_tutor_chat(req, image_description=image_description)


async def _handle_tutor_chat(req: ChatRequest, image_description: Optional[str] = None):
    """Synchronous counterpart to the Inngest rag_query_pdf pipeline —
    same conversational behavior (lightweight-router shortcut, no-context
    handling, trimmed context selection, figure retrieval), just called
    directly instead of via an event, since a chat UI needs a normal
    request/response instead of a background job + poll."""

    # If no image_description was passed in this request, check if any message
    # in conversation history contains an attached image transcription!
    if not image_description and req.conversation:
        for msg in req.conversation:
            if isinstance(msg, dict) and msg.get("role") == "user":
                content = str(msg.get("content", ""))
                if "[Attached Image Content]:" in content:
                    image_description = content.split("[Attached Image Content]:", 1)[1].strip()
                    break

    # =================================
    # LIGHTWEIGHT DIRECT ROUTE
    # =================================
    lightweight_result = lightweight_router.detect(req.question)
    if lightweight_result is not None:
        return {
            "type": "chat",
            "answer": lightweight_result.answer,
            "source": [],
            "num_contexts": 0,
            "figures": [],
            "citations": [],
            "retrieved_chapters": [],
            "image_description": image_description or "",
        }

    # =================================
    # TEXT SEARCH
    # =================================
    # When an image is attached (like a question paper containing questions from
    # multiple chapters) or chapter is not specified / set to "Not sure which chapter",
    # search across ALL chapters of the subject instead of restricting to just one!
    search_chapter = None if (image_description or not req.chapter or req.chapter in ("All Chapters", "Not sure which chapter")) else req.chapter

    try:
        search_text = f"{req.question} {image_description[:500]}".strip() if image_description else req.question
        query_vec = embed_texts([search_text])[0]
        found = vector_store.search(
            query_vector=query_vec,
            subject=req.subject,
            chapter=search_chapter,
            class_name=req.standard,
            top_k=8,
        )
        chunks = found["chunks"]
        contexts = found["contexts"]
        source = found["source"]
    except Exception:
        logger.exception("Vector search failed")
        chunks = []
        contexts = []
        source = []

    # =================================
    # FIGURE RETRIEVAL
    # =================================
    figures = []
    try:
        media_decision = media_orchestrator.detect(req.question)
        # req.chapter is None in "search every chapter of this subject"
        # mode (student doesn't know the chapter) — there's no single
        # chapter_number to resolve figures against yet at this point, so
        # skip figure retrieval rather than guessing; the text answer
        # still names the identified chapter (see retrieved_chapters
        # below), just without inline figures for this one response.
        if req.chapter and media_decision.image_action in (
            ImageAction.RETRIEVE,
            ImageAction.RETRIEVE_FIRST,
        ):
            chapter_number = resolve_chapter_number(req.subject, req.chapter)
            figures = image_service.retrieve(
                query=req.question,
                subject=req.subject,
                chapter_number=chapter_number,
                top_k=10,
            )
    except Exception:
        logger.exception("Media/figure retrieval failed — continuing text-only")
        figures = []

    # =================================
    # NO CONTEXT
    # =================================
    if not contexts:
        return {
            "type": "chat",
            "answer": "No relevant text context found for the selected chapter.",
            "source": [],
            "num_contexts": 0,
            "figures": figures,
            "citations": [],
            "retrieved_chapters": [],
        }

    # =================================
    # CONTEXT SELECTION (same trimming as rag_query_pdf)
    # =================================
    # Iterates `chunks` (not the separate `contexts` list) specifically so
    # each selected context stays paired with the chunk it came from —
    # `chunks`/`contexts` aren't guaranteed to stay index-aligned upstream
    # (vector_db.py's search() only appends to `contexts` when a chunk's
    # text is non-empty, but appends to `chunks` unconditionally), and
    # citations below need the real payload behind whatever text actually
    # made it into the prompt.
    selected_contexts = []
    selected_chunks = []
    current_chars = 0
    for chunk in chunks:
        item = chunk.get("text")
        if not isinstance(item, str):
            continue
        clean_item = item.strip()
        if not clean_item:
            continue
        remaining = MAX_CONTEXT_CHARS - current_chars
        if remaining <= 0:
            break
        selected_text = clean_item[:remaining]
        selected_contexts.append(selected_text)
        selected_chunks.append(chunk)
        current_chars += len(selected_text)
        if len(selected_contexts) >= MAX_CONTEXTS:
            break

    # Structured, page-level citations for whichever selected chunks are
    # NCERT-sourced — resolved from each chunk's own real stored payload,
    # the same "never trust the model, resolve server-side from what was
    # actually retrieved" discipline generate_mind_map already uses for
    # its own citations. Chunks from the textbook (no content_type, or a
    # value outside this set) simply don't produce a citation entry —
    # `source`/`figures` already cover textbook attribution as before.
    citations = []
    for chunk in selected_chunks:
        payload = chunk.get("payload") or {}
        content_type = payload.get("content_type")
        if content_type not in ("ncert_solution", "ncert_notes"):
            continue
        citations.append({
            "content_type": content_type,
            "source": payload.get("source"),
            "page": payload.get("page"),
            "chapter": payload.get("chapter"),
            "exercise": payload.get("exercise"),
            "question_number": payload.get("question_number"),
        })

    # NCERT-sourced chunks are prefixed with a plain-text source label
    # inside the evidence blob itself — plain concatenation gives the
    # model no way to tell which paragraph came from where, so it
    # couldn't cite "NCERT Solutions, Exercise 1.2, Q2" even though the
    # citations list above already carries that same real metadata.
    # Textbook chunks are left unlabeled, unchanged from before —
    # SYSTEM_PROMPT's existing GROUNDING section already treats
    # unlabeled evidence as textbook by default.
    # req.chapter is None means retrieval just spanned every chapter of
    # req.subject (see VectorDB.search()'s conditional chapter filter) —
    # only then does each chunk also need its own [Chapter: ...] label,
    # so the model can tell the student which chapter it's actually
    # answering from. Left off in normal chapter-scoped chat (req.chapter
    # set) to keep that far more common path's prompt byte-identical to
    # before this mode existed.
    searched_all_chapters = req.chapter is None
    labeled_contexts = []
    for text, chunk in zip(selected_contexts, selected_chunks):
        payload = chunk.get("payload") or {}
        content_type = payload.get("content_type")
        if content_type == "ncert_solution":
            page = payload.get("page")
            label = f"[NCERT Solutions — Exercise {payload.get('exercise')}, Question {payload.get('question_number')}, Page {page + 1 if isinstance(page, int) else '?'}]"
            labeled_contexts.append(f"{label}\n{text}")
        elif content_type == "ncert_notes":
            page = payload.get("page")
            label = f"[NCERT Notes — Page {page + 1 if isinstance(page, int) else '?'}]"
            labeled_contexts.append(f"{label}\n{text}")
        elif searched_all_chapters and chunk.get("chapter"):
            labeled_contexts.append(f"[Chapter: {chunk['chapter']}]\n{text}")
        else:
            labeled_contexts.append(text)

    # Structured chapter attribution for the caller (Node resolves this
    # chapter name to a real chapter_id and returns it to the frontend as
    # a clickable reference) — built from the same selected_chunks the
    # prompt itself was built from, not re-derived from the model's
    # prose, so it can't drift from what the LLM actually saw. Only
    # populated in "search every chapter" mode; a normal chapter-scoped
    # request already knows its chapter, nothing new to report.
    retrieved_chapters = []
    if searched_all_chapters:
        seen_chapters = set()
        for chunk in selected_chunks:
            chapter_name = chunk.get("chapter")
            if not chapter_name or chapter_name in seen_chapters:
                continue
            seen_chapters.add(chapter_name)
            retrieved_chapters.append({
                "chapter": chapter_name,
                "subject": chunk.get("subject"),
                "score": chunk.get("score"),
            })
        retrieved_chapters.sort(key=lambda c: c.get("score") or 0, reverse=True)

    context_text = "\n\n".join(labeled_contexts)
    intent = router.detect(req.question)

    # Neither the active cloud provider nor the local Ollama fallback
    # could answer (see TutorEngine._chat's own try/except) — this used
    # to be an unhandled exception straight to a raw 500 for the student,
    # unlike the Help Center/Parent Insights chat handlers, which already
    # catch exactly this and answer gracefully. Same posture here: a
    # normal chat-shaped response the frontend already knows how to
    # render, not a new error contract to build UI for.
    try:
        result = tutor.run(
            intent=intent,
            question=req.question,
            context=context_text,
            subject=req.subject,
            chapter=req.chapter,
            mode=req.mode,
            conversation=req.conversation,
            memory=req.memory or {},
            board=req.board or "CBSE",
            standard=req.standard or "Standard 9",
            figures=figures,
            response_mode=req.response_mode or "text",
            image_description=image_description,
        )
    except llm_provider.LLMUnavailable:
        logger.exception("AI Tutor chat failed — no LLM provider (cloud or local) available")
        return {
            "type": "chat",
            "answer": "I couldn't reach the AI Tutor right now. Please try again in a moment.",
            "source": [],
            "num_contexts": 0,
            "figures": [],
            "citations": [],
            "retrieved_chapters": [],
        }
    return {
        **result,
        "source": source,
        "num_contexts": len(selected_contexts),
        "figures": figures,
        "citations": citations,
        "retrieved_chapters": retrieved_chapters,
        "image_description": image_description or "",
    }

# Moved to core/mindmap_retrieval.py so the Celery worker (core/
# mindmap_tasks.py, generating the 4 background mind-map variants) can
# call the exact same retrieval logic without importing this module (main.py
# imports the worker's task to call .delay() on it — the reverse import
# would be circular). Aliased back to their original names here so every
# existing call site in this file is unchanged.
_retrieve_varied_chapter_chunks = retrieve_varied_chapter_chunks


def _expand_concept_overview_depth(mind_map: dict, subject: str, chapter: str, class_name: Optional[str]):
    """Only for the "concept_overview" variant (the one synchronous
    generation a student is actively waiting on) — walks the branches'
    level-2 children and, for the ones worth going deeper on, generates a
    third level (grandchildren) via a small, node-scoped retrieval plus a
    separate Ollama call (generate_node_children). Depth is bounded by
    real evidence, not an arbitrary number: a node only gets grandchildren
    if its own targeted retrieval turns up enough distinct evidence
    (>=3 chunks) to justify it — thin or nonexistent evidence for a node
    is the actual "until there's nothing left" stopping rule. Also
    bounded by _TERMINAL_NODE_TYPES (types that don't need their own
    sub-breakdown) and a hard cap on how many nodes get this treatment
    per mind map, so worst-case Ollama calls stay predictable. Mutates
    `mind_map` in place; soft-fails per node (generate_node_children's own
    posture) — a single node's expansion failing never breaks the rest of
    the mind map."""
    expansions_done = 0
    for branch in mind_map.get("branches", []):
        if expansions_done >= _MAX_NODE_EXPANSIONS:
            break
        for child in branch.get("children", []):
            if expansions_done >= _MAX_NODE_EXPANSIONS:
                break
            if child.get("type") in _TERMINAL_NODE_TYPES:
                continue
            node_chunks = retrieve_node_context(
                child.get("label", ""), chapter, class_name=class_name, subject=subject
            )
            if len(node_chunks) < 3:
                continue
            child["children"] = tutor.generate_node_children(
                chunks=node_chunks,
                subject=subject,
                chapter=chapter,
                node_label=child.get("label", ""),
                node_type=child.get("type", "concept"),
            )
            expansions_done += 1


_TERMINAL_NODE_TYPES = {"example", "formula", "common_mistake"}
_MAX_NODE_EXPANSIONS = 6


def _retrieve_varied_chapter_context(subject: str, chapter: str, error_log_context: str) -> str:
    """Shared by /api/quiz/generate and /api/flashcards/generate — flattened
    text only, no per-chunk metadata needed for those callers."""
    chunks = _retrieve_varied_chapter_chunks(subject, chapter, error_log_context)
    return "\n\n".join(chunk["text"] for chunk in chunks)



# The old /api/chapters/{chapter}/pre-assessment[/submit], /api/chapters/
# {chapter}/tests[/submit], and /api/practice/next|submit mocks are gone —
# they were hardcoded questions with a hardcoded "correct" string compare,
# never wired to any real frontend. /api/quiz/generate below is their real
# replacement: it generates grounded questions from the actual chapter
# content and hands back correct_answer/explanation so the Node backend
# can store them — this service never grades anything.
#
# Stateless here — nothing persisted in this service. Node owns
# persistence (quiz_attempts); see quiz_service.js's generateQuizService.
# Always async, same reasoning as /api/slide-deck/generate: every attempt
# is a fresh, personalized quiz (not a cached per-chapter resource like
# mind maps' first-variant exception), so there's no synchronous case to
# preserve — a student navigating away mid-generation used to silently
# lose the whole attempt (nothing was ever persisted until the response
# came back); now the "pending" quiz_attempts row Node creates before
# calling this survives regardless, and the worker reports the result
# back via POST /api/quiz/attempts/:attemptId/callback.
@app.post("/api/quiz/generate", dependencies=[Depends(verify_service_key)])
async def generate_quiz(req: QuizGenerateRequest):
    if not req.attempt_id:
        raise HTTPException(status_code=400, detail="attempt_id is required")
    generate_quiz_task.delay(
        req.attempt_id, req.subject, req.chapter, req.num_questions,
        req.board or "CBSE", req.standard or "Standard 9", req.focus, req.source_text,
    )
    return {"status": "processing", "attempt_id": req.attempt_id}


# Stateless here — nothing persisted in this service. Node owns
# persistence (education_flashcard_sets); see flashcards_service.js's
# generateFlashcardsService. Always async, same reasoning as
# /api/quiz/generate: every set is a fresh, personalized generation, not
# a cached per-chapter resource, so there's no synchronous case to
# preserve. A distinct interactive study activity from quizzes: active
# recall via flip-cards rather than multiple-choice testing.
@app.post("/api/flashcards/generate", dependencies=[Depends(verify_service_key)])
async def generate_flashcards(req: FlashcardGenerateRequest):
    if not req.set_id:
        raise HTTPException(status_code=400, detail="set_id is required")
    generate_flashcard_set_task.delay(
        req.set_id, req.subject, req.chapter, req.num_cards,
        req.board or "CBSE", req.standard or "Standard 9", req.source_text,
    )
    return {"status": "processing", "set_id": req.set_id}


# Stateless here — nothing persisted in this service. Node owns
# persistence (education_mind_maps) for the 5 pre-generated variants; see
# mindmap_service.js's get-or-create flow. Two modes:
# - Synchronous (async_mode=False, the default): generates and returns
#   the full mind map inline — used for whichever variant a student is
#   actively waiting on (always "concept_overview" today, the only one
#   generated on the student's first request for a chapter).
# - Async (async_mode=True): hands off to the Celery worker
#   (core/mindmap_tasks.py) and returns an immediate acknowledgement —
#   used for the other 4 background variants, which report their result
#   back to Node via POST /api/mindmap/callback/:mindMapId.
@app.post("/api/mindmap/generate", dependencies=[Depends(verify_service_key)])
async def generate_mindmap(req: MindMapGenerateRequest):
    if req.async_mode:
        if not req.mind_map_id:
            raise HTTPException(status_code=400, detail="mind_map_id is required when async_mode is true")
        generate_mind_map_variant_task.delay(
            req.mind_map_id, req.subject, req.chapter, req.board, req.standard, req.variant
        )
        return {"status": "processing", "mind_map_id": req.mind_map_id}

    chunks = retrieve_varied_chapter_chunks(
        req.subject, req.chapter, "mind map generation", class_name=req.standard
    )

    mind_map = tutor.generate_mind_map(
        chunks=chunks,
        subject=req.subject,
        chapter=req.chapter,
        variant=req.variant,
    )

    if req.variant == "concept_overview":
        _expand_concept_overview_depth(mind_map, req.subject, req.chapter, req.standard)

    attach_branch_images(mind_map, req.subject, req.chapter)

    return mind_map


# AI Learning Deck — Phase 1. Stateless here — nothing persisted in this
# service. Node owns persistence (education_slide_decks); see
# slide_deck_service.js's get-or-create flow. Always async: unlike
# generate_mindmap above (one variant generated synchronously because
# nothing was cached yet for a brand-new chapter), a slide deck has
# exactly one deck per chapter+scope in Phase 1 — there's no "the wait
# everyone already accepts" variant to justify blocking a student's
# request, so every generation hands off to the Celery worker
# (core/slide_deck_tasks.py) and returns an immediate acknowledgement.
# The worker reports its result back to Node via
# POST /api/slide-deck/callback/:slideDeckId.
@app.post("/api/slide-deck/generate", dependencies=[Depends(verify_service_key)])
async def generate_slide_deck(req: SlideDeckGenerateRequest):
    if not req.deck_id:
        raise HTTPException(status_code=400, detail="deck_id is required")
    generate_slide_deck_task.delay(
        req.deck_id, req.subject, req.chapter, req.board or "CBSE", req.standard or "Standard 9"
    )
    return {"status": "processing", "deck_id": req.deck_id}


# Infographic — a single-page, whole-chapter overview. Stateless here,
# same as the slide-deck endpoint above: Node owns persistence
# (education_infographics); see infographic_service.js's get-or-create
# flow. Always async for the identical reason slide decks are — exactly
# one infographic per chapter+scope, so every generation hands off to
# the Celery worker (core/infographic_tasks.py) and returns an immediate
# acknowledgement. The worker reports its result back to Node via
# POST /api/infographic/callback/:infographicId.
@app.post("/api/infographic/generate", dependencies=[Depends(verify_service_key)])
async def generate_infographic(req: InfographicGenerateRequest):
    if not req.infographic_id:
        raise HTTPException(status_code=400, detail="infographic_id is required")
    generate_infographic_task.delay(
        req.infographic_id, req.subject, req.chapter, req.board or "CBSE", req.standard or "Standard 9"
    )
    return {"status": "processing", "infographic_id": req.infographic_id}


class TtsRequest(BaseModel):
    text: str


# Voice — Phase 1 (push-to-talk). Both endpoints are thin wrappers
# around stt_service.py/tts_service.py with ZERO tutor logic of their
# own — Node's voice_service.js is what calls the existing
# /api/tutor/chat (with response_mode="voice") in between these two
# calls, so the actual educational reasoning never duplicates. Both
# stateless here, same "always JSON" response convention as every other
# endpoint in this file (audio-in uses multipart/UploadFile, mirroring
# /api/admin/ingest-chapter's own file-upload pattern below; audio-out
# is base64-in-JSON rather than a raw streaming response, since nothing
# else in this app returns raw binary today).
@app.post("/api/voice/stt", dependencies=[Depends(verify_service_key)])
async def voice_stt(audio: UploadFile = File(...)):
    suffix = os.path.splitext(audio.filename or "")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name
    try:
        return transcribe_audio(tmp_path)
    finally:
        os.remove(tmp_path)


@app.post("/api/voice/tts", dependencies=[Depends(verify_service_key)])
async def voice_tts(req: TtsRequest):
    audio_bytes = synthesize_speech(req.text)
    return {
        "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
        "format": "wav",
    }


# Short, real-numbers-only intro for the Node backend's /api/study-plan —
# the ranked chapter list itself is computed entirely from real DB data on
# the Node side; this only phrases the already-computed aggregate stats
# into 2-3 warm sentences, never inventing a chapter/number of its own.
@app.post("/api/study-plan/intro", dependencies=[Depends(verify_service_key)])
async def study_plan_intro(req: StudyPlanIntroRequest):
    intro = tutor.generate_study_plan_intro(
        overall_mastery=req.overall_mastery,
        total_chapters=req.total_chapters,
        chapters_completed=req.chapters_completed,
        weakest_chapter=req.weakest_chapter,
        weakest_mastery=req.weakest_mastery,
        not_started_count=req.not_started_count,
    )
    return {"intro": intro}


# Short, real-numbers-only review of mock test performance — same posture
# as /api/study-plan/intro.
@app.post("/api/test-review/intro", dependencies=[Depends(verify_service_key)])
async def test_review_intro(req: TestReviewRequest):
    review = tutor.generate_test_review(
        latest_score=req.latest_score,
        average_score=req.average_score,
        tests_taken=req.tests_taken,
        previous_score=req.previous_score,
        weakest_concept=req.weakest_concept,
    )
    return {"review": review}


# =========================================
# CHAPTER READER — serves the real chapter PDF directly
# =========================================
# The reader renders the actual PDF in the browser (react-pdf/pdf.js) so
# math notation and figures are pixel-perfect (it's the real printed
# page, nothing is retyped/transcribed) — this replaced an earlier
# vision-transcribed-markdown approach that was both slow (one vision
# call per page) and had started timing out for real chapters. This
# route just streams the real file bytes for a resolved subject+chapter;
# the browser never calls it directly — Node's own
# GET /chapters/:chapterId/pdf route does the student-facing auth/class-
# scope check first, then proxies this response straight through.

KNOWLEDGE_BASE_ROOT = Path(__file__).resolve().parent / "knowledge_base"


def _resolve_chapter_pdf_path(subject: str, chapter: str):
    for entry in CURRICULUM.get(subject, []):
        if entry["chapter"] == chapter:
            return KNOWLEDGE_BASE_ROOT / subject / entry["file"]
    return None


@app.get("/api/chapters/pdf", dependencies=[Depends(verify_service_key)])
async def get_chapter_pdf(subject: str, chapter: str):
    pdf_path = _resolve_chapter_pdf_path(subject, chapter)
    if pdf_path is None or not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Chapter PDF not found")
    return FileResponse(str(pdf_path), media_type="application/pdf")


# The real, general-purpose counterpart to get_chapter_pdf above — that
# one only ever finds a match for the hand-seeded Math/Science chapters
# listed in config/curriculum.py, a static dict written before the real
# admin-driven ingestion pipeline (Node's POST /chapters/:id/ingest,
# core/local_image_storage.py's LocalImageStorage) existed. Every chapter
# actually ingested through that pipeline — including any newly created
# via Education-Admin — already has its real uploaded PDF sitting in
# local storage at education_book_ingestions.storage_key (see
# _run_chapter_ingestion's own get_local_image_storage().upload_pdf call
# above); this route is the read side of that, so Node can serve ANY
# ingested chapter's book without needing an entry in the static dict at
# all. Node resolves the real storage_key from its own DB before calling
# this — this route only trusts a storage_key it's handed, never a
# subject/chapter string.
@app.get("/api/chapters/pdf-by-key", dependencies=[Depends(verify_service_key)])
async def get_chapter_pdf_by_key(storage_key: str):
    try:
        pdf_bytes = get_local_image_storage().download_object(storage_key)
    except Exception:
        raise HTTPException(status_code=404, detail="Chapter PDF not found")
    return Response(content=pdf_bytes, media_type="application/pdf")


# =========================================
# NCERT SOLUTIONS & NOTES — real per-chapter PDFs, served the same way as
# the textbook itself (see get_chapter_pdf above). Not every chapter has
# these yet (pilot scope: Math Chapter 1 only) — a missing file is a
# normal 404, not an error condition; Node/the frontend treat it as "not
# available for this chapter" rather than surfacing a failure.
# =========================================

NCERT_SOLUTIONS_ROOT = Path(__file__).resolve().parent / "NCERT-Solutions"
NCERT_NOTES_ROOT = Path(__file__).resolve().parent / "NCERT-Notes"


def _resolve_ncert_pdf_path(root: Path, subject: str, chapter: str):
    for entry in CURRICULUM.get(subject, []):
        if entry["chapter"] == chapter:
            return root / subject / entry["file"]
    return None


def _document_context_for(subject: str, chapter: str) -> Optional[DocumentContext]:
    """Same "class 9 only, never inferred" posture as
    scripts/ingest_textbook_images.py's NCERT_CLASS_LEVEL — this content
    doesn't exist for any other class yet, so there's nothing to infer.
    chapter_no comes from CURRICULUM's own 1-based list position, the same
    convention chapter_order uses elsewhere. Returns None for a
    subject/chapter CURRICULUM doesn't know at all (unchanged 404
    behavior — no local storage lookup is even attempted)."""
    for idx, entry in enumerate(CURRICULUM.get(subject, []), start=1):
        if entry["chapter"] == chapter:
            return DocumentContext(
                class_no=9,
                board="cbse",
                publisher="ncert",
                subject=subject,
                chapter_no=idx,
                chapter_name=chapter,
                pdf_name=entry["file"],
            )
    return None


def _serve_ncert_pdf(local_root: Path, storage_key_attr: str, subject: str, chapter: str) -> Response:
    """Keyed-local-storage-first, static-file-fallback — mirrors
    get_chapter_pdf_by_key's own "real storage, static dict is the legacy
    path" posture. Tries LocalImageStorage (core/local_image_storage.py,
    keyed by ChapterWorkspace) only when a DocumentContext can be built
    at all.

    Downloads directly rather than checking object_exists() first, same
    single-round-trip shape the original MinIO-backed version used. A
    failed download (key genuinely missing, or any other local-storage
    error) falls through to the legacy static local file layout rather
    than turning into a 500 — that file is exactly as available as it
    always was."""
    ctx = _document_context_for(subject, chapter)
    if ctx is not None:
        workspace = build_chapter_workspace(ctx.pdf_name, context=ctx)
        key = getattr(workspace, storage_key_attr)()
        try:
            data = get_local_image_storage().download_object(key)
            return Response(content=data, media_type="application/pdf")
        except Exception:
            logger.info("No object at key=%s in local storage (or lookup failed), falling back to legacy local file path", key)

    pdf_path = _resolve_ncert_pdf_path(local_root, subject, chapter)
    if pdf_path is None or not pdf_path.exists():
        raise HTTPException(status_code=404, detail="NCERT PDF not found for this chapter")
    return FileResponse(str(pdf_path), media_type="application/pdf")


@app.get("/api/chapters/ncert-solutions-pdf", dependencies=[Depends(verify_service_key)])
async def get_ncert_solutions_pdf(subject: str, chapter: str):
    return _serve_ncert_pdf(NCERT_SOLUTIONS_ROOT, "ncert_solutions_key", subject, chapter)


@app.get("/api/chapters/ncert-notes-pdf", dependencies=[Depends(verify_service_key)])
async def get_ncert_notes_pdf(subject: str, chapter: str):
    return _serve_ncert_pdf(NCERT_NOTES_ROOT, "ncert_notes_key", subject, chapter)


def _resolve_pdf_readable_path(object_key: Optional[str], local_path: Optional[Path]):
    """Keyed-local-storage-first, static-file-fallback that yields an
    actual filesystem path to open (build_ncert_solutions_index's
    extractors call fitz.open(path), not bytes) — same posture as
    _serve_ncert_pdf, but a downloaded copy has to land somewhere real
    first. Returns (path, is_temp); is_temp tells the caller whether to
    delete it afterward. (None, False) means neither storage location
    had it."""
    if object_key is not None:
        try:
            data = get_local_image_storage().download_object(object_key)
            tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
            tmp.write(data)
            tmp.close()
            return Path(tmp.name), True
        except Exception:
            logger.info("No object at key=%s in local storage (or lookup failed), falling back to legacy local file path", object_key)
    if local_path is not None and local_path.exists():
        return local_path, False
    return None, False


@lru_cache(maxsize=64)
def _cached_ncert_solutions_index(subject: str, chapter: str):
    # Cheap (<1s for a 14-page PDF, confirmed directly) pure-text
    # extraction — a per-process in-memory cache is enough, no DB table
    # needed. Keyed on (subject, chapter) rather than resolved paths: an
    # S3-downloaded copy lands at a fresh temp path every call, which
    # would never repeat and defeat the cache entirely if used as the key
    # instead — the extracted index dict this returns is what's actually
    # cached, so ephemeral temp-file paths inside this call are fine.
    ctx = _document_context_for(subject, chapter)
    textbook_key = solutions_key = None
    if ctx is not None:
        workspace = build_chapter_workspace(ctx.pdf_name, context=ctx)
        textbook_key = workspace.original_pdf_key()
        solutions_key = workspace.ncert_solutions_key()

    textbook_path, textbook_is_temp = _resolve_pdf_readable_path(
        textbook_key, _resolve_chapter_pdf_path(subject, chapter)
    )
    solutions_path, solutions_is_temp = _resolve_pdf_readable_path(
        solutions_key, _resolve_ncert_pdf_path(NCERT_SOLUTIONS_ROOT, subject, chapter)
    )
    try:
        if textbook_path is None or solutions_path is None:
            return None
        return build_ncert_solutions_index(str(textbook_path), str(solutions_path))
    finally:
        if textbook_is_temp and textbook_path is not None:
            textbook_path.unlink(missing_ok=True)
        if solutions_is_temp and solutions_path is not None:
            solutions_path.unlink(missing_ok=True)


@app.get("/api/chapters/ncert-solutions-index", dependencies=[Depends(verify_service_key)])
async def get_ncert_solutions_index(subject: str, chapter: str):
    index = _cached_ncert_solutions_index(subject, chapter)
    if index is None:
        raise HTTPException(status_code=404, detail="NCERT Solutions not available for this chapter")
    if not index:
        raise HTTPException(status_code=404, detail="No exercise sections could be matched for this chapter")
    return index


# Lightweight existence check backing the frontend's "only show the NCERT
# Notes/Solutions cards when there's actually something there" gating —
# not every chapter has these (Math: all 8; Science: 11 of 13 for Notes,
# 9 of 13 for Solutions; English: none yet), so the reader previously
# always rendered both cards and only discovered "not available" after
# the student clicked in and the PDF fetch 404'd. Checks keyed local
# storage first, then the legacy static local file layout — same source
# of truth the real PDF routes use, just without transferring the PDF
# bytes.
@app.get("/api/chapters/ncert-availability", dependencies=[Depends(verify_service_key)])
async def get_ncert_availability(subject: str, chapter: str):
    ctx = _document_context_for(subject, chapter)
    solutions_key = notes_key = None
    if ctx is not None:
        workspace = build_chapter_workspace(ctx.pdf_name, context=ctx)
        solutions_key = workspace.ncert_solutions_key()
        notes_key = workspace.ncert_notes_key()

    # object_exists() is a plain synchronous filesystem call (not asyncio)
    # — calling it directly here with no offload would block this whole
    # service's single event loop for the call's duration on EVERY
    # chapter's request. LearningPath.jsx's chapter list checks every
    # chapter's availability concurrently from Node (Promise.all in
    # curriculum_service.js's getChaptersService), but with the event loop
    # blocked they were forced to run one at a time here regardless — the
    # real cause of Learning Path taking so long to load. run_in_threadpool
    # moves the blocking call off the event loop so concurrent requests
    # (both these two, and every other chapter's request) actually run in
    # parallel, the way the Node side already intended.
    async def _available(object_key: Optional[str], local_path: Optional[Path]) -> bool:
        if object_key is not None:
            try:
                if await run_in_threadpool(get_local_image_storage().object_exists, object_key):
                    return True
            except Exception:
                logger.info("Local storage availability check failed for key=%s, falling back to legacy local file path", object_key)
        return local_path is not None and local_path.exists()

    has_solutions, has_notes = await asyncio.gather(
        _available(solutions_key, _resolve_ncert_pdf_path(NCERT_SOLUTIONS_ROOT, subject, chapter)),
        _available(notes_key, _resolve_ncert_pdf_path(NCERT_NOTES_ROOT, subject, chapter)),
    )
    return {"has_ncert_solutions": has_solutions, "has_ncert_notes": has_notes}


# =========================================
# ADMIN CONTENT INGESTION
# =========================================
# Replaces the manual config/curriculum.py + scripts/ingest_books.py
# workflow — Node's admin ingestion module (ingestion_service.js) forwards
# a chapter PDF here with real Board/Class/Subject/Chapter/academic_year
# metadata (resolved server-side by Node, never trusted from a browser).
#
# _run_chapter_ingestion is a plain `def`, not `async def`, on purpose:
# FastAPI's BackgroundTasks runs sync functions in a worker thread
# automatically. An `async def` background task would run directly on the
# event loop and block every other concurrent request (chat, quiz, etc.)
# for the whole multi-minute chunk/embed/upsert duration.


def _post_ingestion_callback(job_id: str, payload: dict):
    """Reports the job's outcome back to Node, which owns persistence for
    this job (Node's education_book_ingestions table). Best-effort — if
    this fails, the job stays visibly stuck rather than silently vanishing,
    which is at least honest even though it's not self-healing."""
    if not NODE_BACKEND_ORIGIN:
        logger.error("NODE_BACKEND_ORIGIN not configured — cannot report ingestion job %s status", job_id)
        return
    try:
        requests.post(
            f"{NODE_BACKEND_ORIGIN}/api/admin/ingestion/callback/{job_id}",
            json=payload,
            headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
            timeout=10,
        )
    except Exception:
        logger.exception("Failed to POST ingestion callback for job_id=%s", job_id)


def _post_ingestion_progress(job_id: str, current_stage: str):
    """Interim 'what's happening right now' report — same reasoning as
    the identical helper in image_ingestion_tasks.py/
    image_enrichment_tasks.py (best-effort, silent on failure, short
    timeout). Text ingestion is usually fast enough that this is a
    handful of updates over a few seconds, not a long-running progress
    bar, but it still answers "is this stuck or just chunking a big PDF"
    for an admin watching the status view."""
    if not NODE_BACKEND_ORIGIN:
        return
    try:
        requests.post(
            f"{NODE_BACKEND_ORIGIN}/api/admin/ingestion/progress/{job_id}",
            json={"current_stage": current_stage},
            headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
            timeout=5,
        )
    except Exception:
        logger.warning("Failed to POST ingestion progress for job_id=%s (non-fatal)", job_id)


def _run_chapter_ingestion(
    pdf_bytes: bytes,
    original_filename: str,
    job_id: str,
    board: str | None,
    class_name: str | None,
    subject: str | None,
    chapter: str,
    chapter_number: int | None,
    academic_year: str | None,
):
    # Neither load_and_chunk_pdf nor embed_texts handle errors today — an
    # unhandled exception inside a BackgroundTasks job is swallowed with
    # just a server log, leaving the admin's job stuck at "processing"
    # forever with no failure ever surfaced. Wrap the whole thing.
    storage_key = None
    try:
        _post_ingestion_progress(job_id, "Uploading PDF to storage…")
        storage_key = f"chapter-pdfs/{job_id}-{original_filename}"
        # Re-encodes any JPXDecode (JPEG2000) figures as JPEG before this
        # PDF is ever served to a student — pdf.js can't reliably render
        # JPX (confirmed: some figures render as blank space in the
        # reader while everything else on the page renders fine).
        get_local_image_storage().upload_pdf(storage_key, sanitize_pdf_images(pdf_bytes))

        # load_and_chunk_pdf expects a filesystem path, not bytes.
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(pdf_bytes)
                tmp_path = tmp.name

            _post_ingestion_progress(job_id, "Chunking text…")
            chunks = load_and_chunk_pdf(tmp_path)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)

        _post_ingestion_progress(job_id, f"Embedding {len(chunks)} chunk(s)…")
        vectors = embed_texts(chunks)

        ids = [str(uuid.uuid5(uuid.NAMESPACE_URL, f"{storage_key}:{i}")) for i in range(len(chunks))]

        # Node sends the bare class name ("9"), but every retriever that
        # filters on this field (tutor_chat's class_name=req.standard, and
        # req.standard is always "Standard 9"/"Standard 10" — see
        # ChatRequest's default and every ai_service_client.js caller)
        # queries for the "Standard N" form. Storing the bare form here
        # made the class filter never match anything, so every chapter's
        # retrieval silently returned zero chunks regardless of the real
        # vector search — normalize once, at the one place real chapter
        # text actually gets ingested, rather than special-casing every
        # reader.
        normalized_class = (
            class_name
            if not class_name or class_name.strip().lower().startswith("standard")
            else f"Standard {class_name.strip()}"
        )

        payloads = [
            {
                "source": storage_key,
                "subject": subject,
                "chapter": chapter,
                "chapter_number": chapter_number,
                "board": board,
                "class": normalized_class,
                "academic_year": academic_year,
                "book_type": "Admin Upload",
                "text": chunks[i],
            }
            for i in range(len(chunks))
        ]

        _post_ingestion_progress(job_id, "Storing in vector search index…")
        vector_store.upsert(ids, vectors, payloads)

        _post_ingestion_callback(
            job_id,
            {"status": "completed", "chunks_ingested": len(chunks), "storage_key": storage_key},
        )
    except Exception as exc:
        logger.exception("Chapter ingestion failed for job_id=%s", job_id)
        # The PDF is uploaded to local storage as the very first step
        # above, well before the failure-prone chunk/embed/index work —
        # so on any failure after that point the bytes are still there
        # even though the ingestion itself didn't finish. Reporting
        # storage_key back here (previously only sent on success) lets
        # Node's retry fetch the original upload from local storage
        # instead of asking the admin to re-pick the file (see
        # retryIngestionJobService).
        payload = {"status": "failed", "error_message": str(exc)}
        if storage_key:
            payload["storage_key"] = storage_key
        _post_ingestion_callback(job_id, payload)


@app.post("/api/admin/ingest-chapter", dependencies=[Depends(verify_service_key)])
async def ingest_chapter(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    job_id: str = Form(...),
    chapter: str = Form(...),
    board: str | None = Form(default=None),
    class_name: str | None = Form(default=None),
    subject: str | None = Form(default=None),
    chapter_number: str | None = Form(default=None),
    academic_year: str | None = Form(default=None),
):
    pdf_bytes = await file.read()

    background_tasks.add_task(
        _run_chapter_ingestion,
        pdf_bytes,
        file.filename,
        job_id,
        board,
        class_name,
        subject,
        chapter,
        int(chapter_number) if chapter_number else None,
        academic_year,
    )

    return {"job_id": job_id, "status": "processing"}


# Image ingestion and enrichment (scripts/ingest_textbook_images.py,
# scripts/enrich_textbook_images.py) are both routed through the Celery
# worker rather than BackgroundTasks like the text-ingestion route above
# — DocLayout-YOLO + PaddleOCR + a Qwen vision call per page/visual is
# far heavier and longer-running than text chunking, and benefits from
# Celery's retry/ack semantics the same way mind map/slide deck
# generation already do (see core/image_ingestion_tasks.py,
# core/image_enrichment_tasks.py, core/celery_app.py). Both report their
# outcome back to Node via the exact same
# POST /api/admin/ingestion/callback/:jobId chapter-text ingestion
# already uses — Node's education_book_ingestions row for this job_id
# tells it which type of job just finished.
@app.post("/api/admin/ingest-chapter-images", dependencies=[Depends(verify_service_key)])
async def ingest_chapter_images(
    file: UploadFile = File(...),
    job_id: str = Form(...),
    chapter: str = Form(...),
    board: str | None = Form(default=None),
    class_level: str | None = Form(default=None),
    subject: str | None = Form(default=None),
    chapter_number: str | None = Form(default=None),
    # >1 on a resume call (Node's resume route sets it to the paused
    # job's last completed page + 1) — see ingest_chapter_images_task's
    # own docstring for how this loads and continues from that job's
    # on-disk checkpoint instead of starting the document over.
    start_page: str | None = Form(default=None),
):
    pdf_bytes = await file.read()

    ingest_chapter_images_task.delay(
        pdf_bytes,
        file.filename,
        job_id,
        board,
        int(class_level) if class_level else None,
        subject,
        chapter,
        int(chapter_number) if chapter_number else None,
        int(start_page) if start_page else 1,
    )

    return {"job_id": job_id, "status": "processing"}


# Enrichment never takes a PDF — it only set_payloads onto Qdrant points
# and local storage metadata a prior ingest_chapter_images_task call
# already wrote (see image_enrichment_tasks.py's own docstring for why
# it cannot create those). Node's ingestion_service.js only ever calls this once an
# 'images' job for the chapter has actually completed, so that
# precondition is guaranteed by the caller.
@app.post("/api/admin/enrich-chapter-images", dependencies=[Depends(verify_service_key)])
async def enrich_chapter_images(req: EnrichChapterImagesRequest):
    enrich_chapter_images_task.delay(req.job_id, req.subject, req.chapter)
    return {"job_id": req.job_id, "status": "processing"}


# Live CPU/GPU utilization for the admin Ingestion Monitor — "is this box
# actually working right now, and how hard" while a long image/enrich job
# runs. Read-only; see core/system_resources.py.
@app.get("/api/admin/system-resources", dependencies=[Depends(verify_service_key)])
async def get_system_resources_endpoint():
    from core.system_resources import get_system_resources
    return get_system_resources()


# =========================================
# Retrieval comparison (BM25 / FAISS / Hybrid vs. the live Qdrant path)
#
# Additive testing endpoint only — does not change how any existing
# endpoint retrieves context. vector_store.search() (Qdrant) runs exactly
# as it already does elsewhere; BM25/FAISS indices are built in-memory
# per request from a read-only Qdrant scroll. See core/retrieval_compare.py.
# =========================================

@app.get("/api/admin/retrieval-compare", dependencies=[Depends(verify_service_key)])
async def retrieval_compare_endpoint(
    query: str,
    subject: str | None = None,
    chapter: str | None = None,
    top_k: int = 5,
):
    from core.retrieval_compare import compare_retrieval
    return compare_retrieval(
        vector_store=vector_store,
        query=query,
        subject=subject,
        chapter=chapter,
        top_k=top_k,
    )


# =========================================
# Sample Papers — Stage 0 extraction
#
# Same async job/callback shape as chapter ingestion above: acknowledge
# immediately, do the real (multi-minute — one vision call per page of
# both PDFs) work in a background thread, report the outcome back to
# Node's own callback route. See core/sample_paper_extraction.py for why
# this reads rendered page IMAGES via the vision model rather than plain
# PDF text (verified directly: plain extraction scrambles inline math
# notation on these real papers) and why Paper<->Solution matching is a
# plain Python number join, not a second model call.
# =========================================

def _post_sample_paper_extraction_callback(job_id: str, payload: dict):
    if not NODE_BACKEND_ORIGIN:
        logger.error("NODE_BACKEND_ORIGIN not configured — cannot report extraction job %s status", job_id)
        return
    try:
        requests.post(
            f"{NODE_BACKEND_ORIGIN}/api/admin/sample-papers/extraction-callback/{job_id}",
            json=payload,
            headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
            timeout=10,
        )
    except Exception:
        logger.exception("Failed to POST sample paper extraction callback for job_id=%s", job_id)


def _run_sample_paper_extraction(paper_bytes: bytes, solution_bytes: bytes, job_id: str):
    from core.sample_paper_extraction import extract_sample_paper, OllamaPageVisionReader

    try:
        backend = OllamaPageVisionReader()
        questions = extract_sample_paper(paper_bytes, solution_bytes, backend)
        _post_sample_paper_extraction_callback(
            job_id,
            {"status": "completed", "questions": questions},
        )
    except Exception as exc:
        logger.exception("Sample paper extraction failed for job_id=%s", job_id)
        _post_sample_paper_extraction_callback(job_id, {"status": "failed", "error_message": str(exc)})


@app.post("/api/admin/sample-papers/extract", dependencies=[Depends(verify_service_key)])
async def extract_sample_paper_route(
    background_tasks: BackgroundTasks,
    paper_file: UploadFile = File(...),
    solution_file: UploadFile = File(...),
    job_id: str = Form(...),
    subject: str | None = Form(default=None),
    class_name: str | None = Form(default=None),
    paper_type: str | None = Form(default=None),
):
    paper_bytes = await paper_file.read()
    solution_bytes = await solution_file.read()

    background_tasks.add_task(
        _run_sample_paper_extraction,
        paper_bytes,
        solution_bytes,
        job_id,
    )

    return {"job_id": job_id, "status": "processing"}


# =========================================
# Sample Papers — Stage 1/2 grading
#
# The student uploads ONE consolidated answer PDF per attempt (not a photo
# per question — see core/sample_paper_grading.py's module docstring).
# Same async job/callback shape as extraction above: acknowledge
# immediately, do the real (multi-minute — one vision call per PDF page,
# plus one text-grading call per matched question) work in a background
# thread, report the outcome back to Node's own callback route.
# =========================================

def _post_sample_paper_grading_callback(attempt_id: str, payload: dict):
    if not NODE_BACKEND_ORIGIN:
        logger.error("NODE_BACKEND_ORIGIN not configured — cannot report grading result for attempt %s", attempt_id)
        return
    try:
        requests.post(
            f"{NODE_BACKEND_ORIGIN}/api/sample-papers/grading-callback/{attempt_id}",
            json=payload,
            headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
            timeout=10,
        )
    except Exception:
        logger.exception("Failed to POST sample paper grading callback for attempt_id=%s", attempt_id)


def _run_sample_paper_grading(pdf_bytes: bytes, questions: list[dict], attempt_id: str):
    from core.sample_paper_extraction import OllamaPageVisionReader
    from core.sample_paper_grading import grade_sample_paper_pdf

    try:
        vision_backend = OllamaPageVisionReader()
        results = grade_sample_paper_pdf(pdf_bytes, questions, vision_backend, tutor.grade_text_answer)
        _post_sample_paper_grading_callback(
            attempt_id,
            {"status": "completed", "results": results},
        )
    except Exception as exc:
        logger.exception("Sample paper grading failed for attempt_id=%s", attempt_id)
        _post_sample_paper_grading_callback(attempt_id, {"status": "failed", "error_message": str(exc)})


@app.post("/api/sample-papers/grade", dependencies=[Depends(verify_service_key)])
async def grade_sample_paper_route(
    background_tasks: BackgroundTasks,
    answer_pdf: UploadFile = File(...),
    attempt_id: str = Form(...),
    questions: str = Form(...),
):
    pdf_bytes = await answer_pdf.read()
    parsed_questions = json.loads(questions)

    background_tasks.add_task(
        _run_sample_paper_grading,
        pdf_bytes,
        parsed_questions,
        attempt_id,
    )

    return {"attempt_id": attempt_id, "status": "processing"}


class SamplePaperDraftAnswerRequest(BaseModel):
    question_text: str
    max_marks: int
    subject: str


def _retrieve_subject_context(subject: str, question_text: str) -> str:
    """Same retrieval mechanism as _retrieve_varied_chapter_context above,
    but subject-only (no chapter filter) — a Sample Papers question being
    drafted via this fallback has no chapter assigned yet (that's an
    admin-set field), and VectorDB.search's chapter param is optional."""
    try:
        query_vec = embed_texts([question_text])[0]
        found = vector_store.search(query_vector=query_vec, subject=subject, top_k=10)
        contexts = [c.strip() for c in found["contexts"] if isinstance(c, str) and c.strip()]
    except Exception:
        logger.exception("Vector search failed for sample paper answer draft")
        contexts = []

    selected, chars = [], 0
    for item in contexts:
        remaining = MAX_CONTEXT_CHARS - chars
        if remaining <= 0:
            break
        piece = item[:remaining]
        selected.append(piece)
        chars += len(piece)
    return "\n\n".join(selected)


# Sample Papers Stage 0 fallback only — used when extraction couldn't
# match a question to its real Solution entry. Synchronous (unlike the
# extraction route above): drafting one answer is a single fast model
# call, not a multi-minute multi-page job, so no background task/callback
# needed here — same shape as /api/quiz/generate.
@app.post("/api/admin/sample-papers/draft-answer", dependencies=[Depends(verify_service_key)])
async def draft_sample_paper_answer_route(req: SamplePaperDraftAnswerRequest):
    context_text = _retrieve_subject_context(req.subject, req.question_text)
    draft = tutor.draft_sample_paper_answer(
        question_text=req.question_text,
        max_marks=req.max_marks,
        context=context_text,
    )
    return draft


class ProfileUpdateRequest(BaseModel):
    name: str
    email: str
    language: str
    role: str

@app.post("/api/user/profile/update")
async def update_profile(req: ProfileUpdateRequest):
    return {
        "success": True,
        "name": req.name,
        "email": req.email,
        "language": req.language,
        "role": req.role,
        "message": "Profile updated successfully!"
    }

@app.get("/api/notifications")
async def get_notifications():
    return [
        {"id": 1, "title": "Homework Assignment 3 Due", "description": "Geometry homework on Heron's Formula is due tomorrow at 8:00 AM.", "time": "2 hours ago", "unread": True},
        {"id": 2, "title": "Class Average Streak reached 12 days", "description": "Excellent consistency! The team average streak has reached a new record.", "time": "5 hours ago", "unread": True},
        {"id": 3, "title": "Calibration assessment completed", "description": "You scored high on Polynomial division theorems.", "time": "1 day ago", "unread": False}
    ]

@app.get("/api/search")
async def global_search(q: str = ""):
    results = []
    q_lower = q.lower()
    items = [
        {"title": "Heron's Formula", "type": "Lesson", "path": "/lesson-heron", "desc": "Calculate triangle area using semi-perimeter."},
        {"title": "3D Cylinders Geometry", "type": "Lesson", "path": "/lesson-3d", "desc": "Interactive Radius & Height total surface area calculator."},
        {"title": "Mastery Analytics", "type": "Dashboard", "path": "/mastery-analytics", "desc": "Overview of subject competencies."},
        {"title": "Polynomial Division", "type": "Concept", "path": "/practice", "desc": "Mastering the factor and remainder theorems."}
    ]
    for item in items:
        if q_lower in item["title"].lower() or q_lower in item["desc"].lower():
            results.append(item)
    return results


# =========================================
# INNGEST ENDPOINT
# =========================================

inngest.fast_api.serve(
    app,
    inngest_client,
    [
        rag_ingest_pdf,
        rag_query_pdf,
    ],
)