"""image_service.py — AI Tutor Image Retrieval Service (rebuild).

============================================================
PROJECT
============================================================
Rebuilds the image retrieval service that sits behind the AI Tutor:
given a student/tutor query (or an explicit figure reference), it
finds the most relevant textbook visuals and resolves them to
something the tutor can actually show — a locally-stored image URL
(core/local_image_storage.py) plus the educational metadata
`enrich_textbook_images.py` (see that file's own module docstring,
Sprints 15-16) already wrote into each visual's Qdrant point.

This is a *retrieval* service, not an ingestion or enrichment
pipeline — it never writes to Qdrant or local image storage, only
reads from them, against the exact schema those two pipelines
produce:

    Qdrant point (per visual, collection=IMAGE_COLLECTION):
        id      -> uuid5(NAMESPACE_URL, visual_id)  (deterministic)
        vector  -> the pass-1 search-text embedding (EMBEDDING_MODEL,
                   QDRANT_VECTOR_DIM-dimensional)
        payload -> {
            "metadata":              raw ingestion metadata (subject,
                                      chapter, page, storage, ocr,
                                      visual type/subtype/figure_number/
                                      table_number/caption, id, ...)
            "image":                 local crop_path from ingestion
                                      (rarely useful post-ingestion —
                                      "storage_key" is the live path)
            "search_text":           the pass-1 text that was embedded
            "storage_key":           local image storage object key
                                      for the crop
            "public_url":            local image storage public URL,
                                      if any
            "education_metadata":    {education, retrieval,
                                      visual_analysis, assessment} —
                                      Sprint 15.9's normalized_metadata_
                                      to_dict() output, written by
                                      enrichment
            "pass2_retrieval_text":  enrichment's expanded search text
                                      (payload-only — the vector itself
                                      is never re-embedded from it)
            "grounding_confidence":  float, promoted to top level for
                                      direct filtering
            "enrichment_timestamp" / "pipeline_version"
        }

A visual that was only ingested, never enriched, still has a valid
point — just without "education_metadata"/"pass2_retrieval_text"/
"grounding_confidence". Every retrieval stage in this rebuild must
degrade gracefully for those visuals rather than assume enrichment
always ran.

============================================================
SPRINT 1 — FOUNDATION & ARCHITECTURE (this file, today)
============================================================
Goal: a clean service architecture with single-responsibility
methods, wired together but not yet doing any retrieval. Concretely:

    - ImageServiceConfig   — configuration loading. One env-driven
      dataclass, same variable names as ingest_textbook_images.py /
      enrich_textbook_images.py (QDRANT_URL, IMAGE_COLLECTION,
      QDRANT_VECTOR_DIM, OLLAMA_HOST, EMBEDDING_MODEL, LOG_LEVEL, ...)
      so a .env already set up for ingestion/enrichment needs nothing
      extra for this service to point at the same Qdrant/Ollama
      deployment (local image storage needs no endpoint configuration
      of its own — see core/local_image_storage.py).
    - init_qdrant_client() — Qdrant client initialization. Best-effort:
      a reachability probe at startup, logged either way, but a
      down Qdrant never prevents the service object from existing —
      see "degraded mode" below.
    - get_local_image_storage() — this service's only image/PDF
      storage backend (local-only deployment). Always constructible,
      no external connection to fail, so unlike Qdrant it's never in
      degraded mode.
    - init_embedding_backend() — embedding model initialization.
      Constructs an EmbeddingBackend (OllamaEmbeddingBackend by
      default) against the same Ollama instance and EMBEDDING_MODEL
      ingestion used, so query embeddings land in the same vector
      space as the stored ones. No network call at construction time
      (embedding calls are per-query and comparatively slow) — its
      reachability is checked on demand via health_check().
    - RetrievalCache        — retrieval cache. A small thread-safe
      LRU+TTL cache, keyed by a stable hash of a retrieval call's
      normalized arguments. Nothing populates it yet (there's no
      retrieval to cache), but ImageService.retrieve() below already
      wires a cache lookup into its call path so later sprints only
      need to add "populate on miss", not build caching from scratch.
    - init_logging()        — logging utilities. Same convention as
      both upstream pipelines: one basicConfig call, LOG_LEVEL-driven,
      idempotent (safe to call more than once).

Public API (per this sprint's brief):

    class ImageService:
        def retrieve(...) -> ...

Sprint 1 explicitly stops here: `retrieve()` validates and normalizes
its arguments, computes a cache key, and checks the cache — then
raises NotImplementedError, since there is no search, figure lookup,
grouping, ranking, or local storage resolution logic yet. Everything above
initializes correctly and health_check() reports real subsystem
status; nothing above answers a query.

============================================================
SPRINT 2 — QUERY EMBEDDING (this file, today)
============================================================
Goal: convert a student's question into a vector in the same space as
what's stored in Qdrant.

    - ImageService._embed_query() — cleans the question
      (_clean_query_text), calls the embedding backend Sprint 1
      already wired up, validates the returned vector (non-empty,
      right dimensionality for config.vector_dim), and raises
      QueryEmbeddingError — never lets a raw requests/network
      exception escape — on any failure along the way. Still not
      called from retrieve(): this sprint delivers the method and its
      own correctness, not orchestration.

============================================================
SPRINT 3 — CANDIDATE RETRIEVAL (this file, today)
============================================================
Goal: given a query vector, retrieve candidate visuals from Qdrant.

    - ImageService._search_qdrant() — runs a Qdrant vector search
      (collection=config.collection_name), Top N = config.
      candidate_limit (default 20), with an optional metadata filter
      (see _build_metadata_filter — subject/chapter/figure_number/
      table_number/arbitrary payload-key equality, AND-combined), and
      returns each hit's *raw* payload untouched, wrapped in a
      RawCandidate(id, score, payload). No reranking, grouping, or
      deduplication happens here — "no reranking yet" is this sprint's
      explicit scope boundary, same reason _embed_query() above isn't
      wired into retrieve() yet: reranking (Sprint 5, per Sprint 1's
      original roadmap sketch) needs these raw candidates to exist
      first.

============================================================
SPRINT 4 — CANDIDATE NORMALIZATION (this file, today)
============================================================
Goal: normalize every Qdrant payload _search_qdrant returns into one
consistent internal format, regardless of which metadata shape (the
legacy flat NCERTMetadata shape vs. the current nested VisualMetadata
shape — both documented where this file's own extraction helpers are
defined) or enrichment state the underlying point happens to be in.

    - ImageService._normalize_candidates() — maps each RawCandidate to
      a Candidate with exactly the fields the brief calls for:
      reference_label, page_number, caption, search_text,
      education_metadata, image, score, metadata (plus `id`, carried
      forward for identity). Built on module-level extraction helpers
      (_extract_page_number, _extract_visual_type,
      _extract_reference_label, _extract_caption, _extract_source,
      _extract_search_text, _extract_image) that each read defensively
      across both metadata shapes, so every Candidate has the same
      schema no matter how old or new its source point is. Not called
      from retrieve() yet.

============================================================
SPRINT 5 — METADATA FILTERING (this file, today)
============================================================
Goal: filter an already-normalized candidate list using textbook
metadata — no ranking yet.

    - ImageService._apply_filters() — narrows a list[Candidate] by
      subject, chapter, source, and (optional) visual_type, each
      independently optional and AND-combined when more than one is
      given. Comparison goes through _values_match (case-/whitespace-
      insensitive; an unset field never matches). Filtering only,
      still no scoring/reordering of what passes. Not called from
      retrieve() yet.

============================================================
SPRINT 6 — EXACT FIGURE RETRIEVAL (this file, today)
============================================================
Goal: support explicit textbook figure/table requests ("Figure 1.3",
"Fig 2.7", "Diagram 3.2", "Table 1.1") without going through semantic
search at all.

    - ImageService._exact_reference_match() — parses a reference
      number and kind (figure-like vs. table) out of free text via
      _extract_reference_query, builds a query_filter with
      _build_metadata_filter (figure_number= or table_number=,
      Sprint 3), and resolves it with Qdrant's filter-only scroll —
      not client.search() — since an exact reference lookup needs no
      embedding call at all (Sprint 1's own ROADMAP sketch flagged
      this path; it's implemented now). Raw hits are normalized
      through _normalize_candidates (Sprint 4) and returned as-is: no
      reranking, no score computed beyond a fixed 1.0 (an exact
      reference match isn't "how similar", it's "is this the page
      asked for"). Returns [] (not an error) when the parsed
      figure/table simply doesn't exist in the collection — "return
      immediately" applies to found matches; a caller decides whether
      an empty result should fall back to semantic search. Not called
      from retrieve() yet.

============================================================
SPRINT 7 — EDUCATIONAL RERANKER (this file, today)
============================================================
Goal: rank an already-filtered candidate list for semantic educational
queries ("Explain coordinates", "Show graph", "Show x-axis",
"Cartesian plane") using more than raw vector similarity.

    - ImageService._educational_rerank() — recomputes each
      Candidate.score from several signals read off
      Candidate.education_metadata's documented shape ({education,
      retrieval, visual_analysis, assessment} — see this file's module
      docstring above): vector similarity (the incoming score itself),
      retrieval keywords, curriculum topics, learning objectives,
      student search examples, answerable-query phrasing, and an
      overall educational-confidence value, each read defensively
      (multiple plausible key names, never a KeyError) since this
      rebuild doesn't have enrich_textbook_images.py's exact field
      names to hand-verify against the way Sprint 4's metadata-shape
      helpers could. A candidate with no education_metadata at all
      (never enriched) degrades to its vector-similarity score,
      unchanged — reranking never *penalizes* an unenriched candidate
      for lacking signals it was never given the chance to have.
      Returns a new, score-sorted list[Candidate]; input order/objects
      are untouched (Candidate is frozen — reranked candidates are
      built via dataclasses.replace). Not called from retrieve() yet.

============================================================
SPRINT 8 — VISUAL GROUPING (this file, today)
============================================================
Goal: "One Figure -> Many Crops" — collapse Candidates that are
really the same textbook figure (multi-part panels, related visuals
sharing a page) back into one group each.

    - ImageService._group_candidates() — buckets candidates by
      _candidate_group_key (figure_number > table_number > panel_label
      +page_number > singleton, each scoped to `source` so the same
      number in two different textbooks never merges) into
      CandidateGroup instances, members pre-sorted best-score-first.
      Not called from retrieve() yet.

============================================================
SPRINT 9 — GROUP RANKING & SELECTION (this file, today)
============================================================
Goal: order groups meaningfully and decide which ones a query actually
gets back.

    - ImageService._rank_groups() — deduplicates groups Sprint 8's key
      priority didn't already merge but that share a
      (source, reference_label, page_number) identity
      (_dedupe_groups/_group_identity), then sorts by
      _group_rank_score (best member's score plus a small capped
      multi-crop corroboration bonus).
    - ImageService._select_groups() — applies Top-K plus an absolute
      and an adaptive-relative score threshold, except a group
      _group_is_exact_match recognizes (Sprint 6's fixed
      EXACT_MATCH_SCORE) always survives regardless of either
      threshold. Neither method is called from retrieve() yet.

============================================================
SPRINT 10 — LOCAL STORAGE RESOLUTION (this file, today)
============================================================
Goal: turn a Candidate's `image` dict (storage_key/public_url/
crop_path — see _extract_image) into a URL the tutor/frontend can
actually load.

    - ImageService._resolve_image_url() — resolves storage_key
      through self.local_storage (core/local_image_storage.py),
      checked for a real file on disk before it's trusted; falls back
      to an already-stored public_url, then last to the
      ingestion-time-only local crop_path. Not called from retrieve()
      yet.

============================================================
SPRINT 11 — FIGURE OBJECT BUILDER (this file, today)
============================================================
Goal: the one clean response shape this service ever hands to the
Tutor Engine or the Streamlit frontend — neither is allowed to depend
on a Candidate, a CandidateGroup, or a raw Qdrant payload.

    - ImageService._build_figure_objects() — converts a selected
      list[CandidateGroup] (Sprint 9's output) into list[dict], one
      dict per group. Originally scoped to eight minimal fields
      (figure_id/reference_label/page_number/caption/image_url/
      grounded_description/student_explanation/score); widened during
      Sprint 12 integration (see below) once it became clear the
      existing tutor_engine.py/streamlit_app.py consumers this
      service already had needed more than that minimal set to keep
      working — the widened shape is a strict superset, every one of
      the original eight fields is still present and computed the
      same way:

          {
              "figure_id": ...,
              "reference_label": ...,
              "page_number": ...,
              "caption": ...,
              "image_url": ...,
              "grounded_description": ...,
              "student_explanation": ...,
              "score": ...,
              "subject": ...,
              "chapter": ...,
              "visual_type": ...,
              "visual_subtype": ...,
              "teaches": [...],
              "curriculum_topics": [...],
              "learning_objectives": [...],
              "visible_entities": [...],
              "concept_relationships": [...],
              "pedagogical_value": ...,
              "images": [{"image_path": ..., "caption": ...}, ...],
              "group_size": ...,
          }

      Every scalar field comes from the group's *best* candidate
      (image_url via Sprint 10's _resolve_image_url;
      grounded_description/student_explanation/teaches/
      curriculum_topics/learning_objectives/visible_entities/
      concept_relationships/pedagogical_value via new extractors read
      defensively off education_metadata the same way Sprint 7's
      signal extractors are) except `score` (_group_rank_score — the
      value Sprint 9 actually ranked/thresholded on, not the raw
      best-candidate score CandidateGroup.score exposes) and
      `images`/`group_size` (_resolve_group_images — every candidate
      in the group, deduplicated by resolved image, not just the
      best one; streamlit_app.py's multi-crop gallery needs all of
      them). `figure_id` is a short stable hash of the group's dedupe
      identity (_group_identity) when it has one, or of its best
      candidate's id otherwise, so the same textbook figure gets the
      same figure_id across repeated retrievals. Not called from
      retrieve() yet.

============================================================
SPRINT 12 — INTEGRATION & WIRING (this file, today)
============================================================
Goal: replace retrieve()'s NotImplementedError with the real
end-to-end pipeline every earlier sprint built a piece of, matching
this file's own module-level architecture:

    Query Embedding -> Qdrant Search -> Candidate Normalization ->
    Metadata Filtering -> Explicit Figure Match?
        Yes -> Return Figure
        No  -> Educational Reranker
    (both branches converge) -> Visual Grouping -> Group Ranking ->
    Group Selection -> Local Storage Resolution -> Figure Object
    Builder -> Tutor Engine / Streamlit

    - ImageService._find_by_reference_number() — the shared
      scroll-and-normalize body _exact_reference_match (Sprint 6) was
      already built on, factored out so retrieve() can also look up a
      caller-supplied figure_number/table_number directly (not just
      one parsed out of free-text `query`).
    - ImageService.retrieve() — routes each call: an explicit
      figure_number/table_number, or one parsed out of `query`, is
      tried first; if that exact lookup comes back empty (or a
      subject/chapter filter empties it — "Figure 99.9" doesn't
      exist, or "Figure 1.3" doesn't belong to the requested chapter)
      retrieve() falls back to the full semantic path (embed -> search
      -> normalize -> filter -> rerank) using the same `query` text,
      exactly the "no exact match -> fallback to semantic retrieval"
      contract this project's own test scenarios describe. Either way
      the result then always passes through grouping -> ranking ->
      selection -> local storage resolution -> the figure object builder, so
      every caller — explicit or semantic — gets back the same
      list[dict] shape. Results are cached under request.cache_key
      when request.use_cache is True.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field, replace
from typing import Any, Optional, Protocol

from dotenv import load_dotenv

from core.local_image_storage import LocalImageStorage, get_local_image_storage

logger = logging.getLogger(__name__)

load_dotenv()


# ============================================================
# CONFIGURATION (Sprint 1 — Configuration Loading)
#
# Same env var names, same defaults, as ingest_textbook_images.py /
# enrich_textbook_images.py — see that file's own "SERVICES" /
# "CONFIGURATION" section. Deliberately not importing those modules
# just to reuse their constants: this service must be deployable
# independently of the ingestion/enrichment codebase, so its
# configuration is self-contained and only *conventionally*
# consistent with theirs, not coupled to them.
# ============================================================

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

OLLAMA_URL = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "bge-m3")
EMBEDDING_TIMEOUT_SECONDS = float(os.getenv("EMBEDDING_TIMEOUT_SECONDS", "30"))

QDRANT_URL = os.getenv("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY") or None
IMAGE_COLLECTION = os.getenv("IMAGE_COLLECTION", "textbook_images")
QDRANT_VECTOR_DIM = int(os.getenv("QDRANT_VECTOR_DIM", "1024"))
QDRANT_TIMEOUT_SECONDS = float(os.getenv("QDRANT_TIMEOUT_SECONDS", "10"))

# Retrieval-service-specific knobs — nothing upstream needs these.
RETRIEVAL_TOP_K_DEFAULT = int(os.getenv("RETRIEVAL_TOP_K_DEFAULT", "5"))
RETRIEVAL_TOP_K_MAX = int(os.getenv("RETRIEVAL_TOP_K_MAX", "50"))
RETRIEVAL_CACHE_MAX_SIZE = int(os.getenv("RETRIEVAL_CACHE_MAX_SIZE", "512"))
RETRIEVAL_CACHE_TTL_SECONDS = float(os.getenv("RETRIEVAL_CACHE_TTL_SECONDS", "300"))

# Sprint 3 — how many raw candidates _search_qdrant pulls back per
# query before any reranking exists to narrow them down.
RETRIEVAL_CANDIDATE_LIMIT_DEFAULT = int(os.getenv("RETRIEVAL_CANDIDATE_LIMIT_DEFAULT", "20"))
RETRIEVAL_CANDIDATE_LIMIT_MAX = int(os.getenv("RETRIEVAL_CANDIDATE_LIMIT_MAX", "100"))

# Sprint 9 — Group Ranking & Selection: _select_groups' thresholds.
# Calibrated to the 0.0-1.0 scale _educational_rerank actually
# produces (vector-similarity floor + an additive, confidence-damped
# boost, capped at 1.0 — see that method's own docstring), *not* to
# raw Qdrant cosine-similarity scores, which this same collection's
# unreranked candidates would otherwise sit at. A threshold tuned for
# one scale silently over- or under-filters on the other; these two
# knobs are the reranked scale's own.
#   - GROUP_SCORE_THRESHOLD_DEFAULT: an absolute floor — a group
#     scoring below this is dropped regardless of how it compares to
#     the best group, since even "the best available" can be a bad
#     match when nothing in the collection is actually relevant.
#   - GROUP_RELATIVE_THRESHOLD_DEFAULT: an *adaptive* floor relative
#     to the top-ranked group's own score (top_score * this fraction)
#     — the same top score means something different for an
#     easy/exact-ish query (a cluster of high, close scores) than a
#     hard/vague one (one decent score, then a long tail), so a
#     fixed absolute cutoff alone either keeps too much of the tail
#     on easy queries or too little of it on hard ones.
# Neither threshold is ever applied to a group containing an exact
# figure/table match (see EXACT_MATCH_SCORE / _group_is_exact_match
# below) — Sprint 6's "if it exists" guarantee would otherwise be
# silently broken by Sprint 9's own filtering.
RETRIEVAL_GROUP_SCORE_THRESHOLD_DEFAULT = float(
    os.getenv("RETRIEVAL_GROUP_SCORE_THRESHOLD_DEFAULT", "0.12")
)
RETRIEVAL_GROUP_RELATIVE_THRESHOLD_DEFAULT = float(
    os.getenv("RETRIEVAL_GROUP_RELATIVE_THRESHOLD_DEFAULT", "0.5")
)


@dataclass(frozen=True)
class ImageServiceConfig:
    """Sprint 1 — Configuration Loading. One frozen, env-driven
    snapshot of everything ImageService needs to reach its dependencies
    (Qdrant, local image storage, the embedding model) plus its own
    retrieval-cache and logging knobs. Frozen because a running
    service's configuration should never be mutated out from under
    it — build a new ImageServiceConfig (and, ordinarily, a new
    ImageService) to pick up changed settings instead.

    Every field defaults to this module's own env-driven constant
    (mirroring EnrichmentConfig's pattern in enrich_textbook_images.py)
    so `ImageServiceConfig()` with no arguments is already a complete,
    correct configuration for whatever the process environment says —
    explicit keyword arguments exist for callers (tests, multi-tenant
    deployments) that need to override specific values without
    touching the environment."""

    # Qdrant
    qdrant_url: str = QDRANT_URL
    qdrant_api_key: Optional[str] = QDRANT_API_KEY
    collection_name: str = IMAGE_COLLECTION
    vector_dim: int = QDRANT_VECTOR_DIM
    qdrant_timeout_seconds: float = QDRANT_TIMEOUT_SECONDS

    # Embedding model
    ollama_url: str = OLLAMA_URL
    embedding_model: str = EMBEDDING_MODEL
    embedding_timeout_seconds: float = EMBEDDING_TIMEOUT_SECONDS

    # Retrieval cache
    cache_max_size: int = RETRIEVAL_CACHE_MAX_SIZE
    cache_ttl_seconds: float = RETRIEVAL_CACHE_TTL_SECONDS

    # Retrieval defaults (unused until later sprints; declared now so
    # retrieve()'s signature and validation can already be final)
    default_top_k: int = RETRIEVAL_TOP_K_DEFAULT
    max_top_k: int = RETRIEVAL_TOP_K_MAX

    # Sprint 3 — Candidate Retrieval: how many raw hits _search_qdrant
    # pulls per query (Top N), and the hard ceiling a caller may push
    # it to.
    candidate_limit: int = RETRIEVAL_CANDIDATE_LIMIT_DEFAULT
    max_candidate_limit: int = RETRIEVAL_CANDIDATE_LIMIT_MAX

    # Sprint 9 — Group Ranking & Selection: _select_groups' absolute
    # and adaptive-relative score floors, on the 0-1 reranked scale
    # (see RETRIEVAL_GROUP_SCORE_THRESHOLD_DEFAULT's own comment).
    group_score_threshold: float = RETRIEVAL_GROUP_SCORE_THRESHOLD_DEFAULT
    group_relative_threshold: float = RETRIEVAL_GROUP_RELATIVE_THRESHOLD_DEFAULT

    # Logging
    log_level: str = LOG_LEVEL

    def redacted(self) -> dict:
        """A dict safe to log or return from a status endpoint —
        every other field is already non-secret, but qdrant_api_key
        is masked rather than omitted, so its *presence* is still
        visible without leaking the value itself."""
        payload = {
            "qdrant_url": self.qdrant_url,
            "qdrant_api_key": "***" if self.qdrant_api_key else None,
            "collection_name": self.collection_name,
            "vector_dim": self.vector_dim,
            "qdrant_timeout_seconds": self.qdrant_timeout_seconds,
            "ollama_url": self.ollama_url,
            "embedding_model": self.embedding_model,
            "embedding_timeout_seconds": self.embedding_timeout_seconds,
            "cache_max_size": self.cache_max_size,
            "cache_ttl_seconds": self.cache_ttl_seconds,
            "default_top_k": self.default_top_k,
            "max_top_k": self.max_top_k,
            "candidate_limit": self.candidate_limit,
            "max_candidate_limit": self.max_candidate_limit,
            "group_score_threshold": self.group_score_threshold,
            "group_relative_threshold": self.group_relative_threshold,
            "log_level": self.log_level,
        }
        return payload


def load_config(**overrides: Any) -> ImageServiceConfig:
    """The module's single entry point for building a config —
    ImageService's own default when none is passed in. `overrides`
    lets a caller override specific fields (e.g.
    `load_config(collection_name="textbook_images_staging")`) without
    hand-building an ImageServiceConfig or touching the environment.
    Kept as a thin function (rather than relying solely on the
    dataclass constructor) so config loading has one obvious place to
    grow validation or multi-source merging later without changing
    every call site."""
    return ImageServiceConfig(**overrides)


# ============================================================
# LOGGING UTILITIES (Sprint 1 — Logging Utilities)
# ============================================================

_logging_initialized = False
_logging_lock = threading.Lock()


def init_logging(level: str = LOG_LEVEL) -> None:
    """Configures the root logger once, the same convention as
    ingest_textbook_images.py / enrich_textbook_images.py
    (LOG_LEVEL-driven, "%(asctime)s %(levelname)s %(name)s: %(message)s").
    Idempotent and thread-safe: a service embedding this module
    alongside other components may end up calling this more than
    once (once per ImageService instance, plus whatever the host
    application does), and repeated logging.basicConfig calls would
    otherwise silently do nothing on the second call anyway — this
    just makes that guarantee explicit rather than relying on
    logging's own no-op-after-first-call behavior."""
    global _logging_initialized
    with _logging_lock:
        if _logging_initialized:
            return
        logging.basicConfig(
            level=getattr(logging, level.upper(), logging.INFO),
            format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        )
        _logging_initialized = True


class timed:
    """Context manager / decorator-free timing utility: `with
    timed("qdrant search"):` logs how long its block took, at DEBUG
    by default. Exists now, ahead of any retrieval logic, because
    every future retrieval stage (embedding, vector search, local
    storage resolution) will want the same "log this step's latency" pattern
    Sprint 5's ranking work will eventually need to reason about — one
    small utility here avoids five near-identical ad hoc timers
    later."""

    def __init__(self, label: str, *, level: int = logging.DEBUG) -> None:
        self.label = label
        self.level = level
        self._start: float = 0.0

    def __enter__(self) -> "timed":
        self._start = time.monotonic()
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        elapsed_ms = (time.monotonic() - self._start) * 1000
        if exc_type is None:
            logger.log(self.level, "%s took %.1fms", self.label, elapsed_ms)
        else:
            logger.log(self.level, "%s failed after %.1fms (%s)", self.label, elapsed_ms, exc)


# ============================================================
# EXCEPTIONS
#
# ImageService is a long-lived object embedded in another process
# (the AI Tutor backend), not a CLI pipeline — it must never call
# sys.exit()/SystemExit the way ingest_textbook_images.py's/
# enrich_textbook_images.py's fail-fast init routines do. Anything
# unrecoverable at construction time is raised as one of these
# instead, for the host application to catch and handle.
# ============================================================

class ImageServiceError(Exception):
    """Base class for every exception this module raises on purpose."""


class ImageServiceConfigError(ImageServiceError):
    """Raised for configuration that is wrong in a way no amount of
    retrying will fix — as opposed to a dependency being transiently
    unreachable, which is handled as degraded mode instead (see
    init_qdrant_client below). Local image storage has no such
    genuine-misconfiguration case of its own (LocalImageStorage is
    always constructible), so nothing in this module raises this today;
    kept for the host application and any future subsystem that does
    need to distinguish "broken config" from "temporarily down"."""


class ImageServiceUnavailableError(ImageServiceError):
    """Raised by a retrieval call (in later sprints) that strictly
    requires a subsystem currently in degraded mode — e.g. a semantic
    query when the embedding backend or Qdrant is unreachable. Not
    raised by initialization itself, which tolerates degraded
    subsystems; see health_check()."""


class QueryEmbeddingError(ImageServiceError):
    """Sprint 2 — raised by _embed_query() for anything that stops a
    question from becoming a usable vector: an empty/whitespace-only
    query, the embedding backend failing outright (network error,
    timeout, missing `requests`, Ollama returning no vector), or a
    vector whose dimensionality doesn't match config.vector_dim. Its
    whole purpose is "handle failures gracefully" — _embed_query()
    never lets an underlying requests/network exception escape
    unwrapped; every failure path is caught and re-raised as this,
    with the original exception chained via `raise ... from exc`."""


class QdrantSearchError(ImageServiceError):
    """Sprint 3 — raised by _search_qdrant() when the search call
    itself fails (Qdrant unreachable mid-call, a malformed filter,
    the collection not existing, ...). Distinct from
    ImageServiceUnavailableError, which _search_qdrant raises instead
    when there's no Qdrant client at all (degraded mode from
    construction) — that's a known, already-logged condition, whereas
    this is an unexpected failure during a call that should have
    worked."""


# ============================================================
# QDRANT INITIALIZATION (Sprint 1 — Qdrant Client Initialization)
#
# Best-effort, same posture as enrich_textbook_images.py's
# init_qdrant_client(): a reachability probe at startup, logged either
# way, but a down Qdrant never prevents the ImageService object from
# existing. Unlike that pipeline's one-shot batch run, this service is
# long-lived — Qdrant may recover between construction and the first
# request, so failing the whole service at import/startup time over a
# transient outage would be strictly worse than starting in degraded
# mode and reporting it via health_check().
# ============================================================

def init_qdrant_client(config: ImageServiceConfig) -> Optional[Any]:
    """Builds and reachability-probes a QdrantClient. Returns None
    (never raises) if qdrant_client isn't installed or the server
    isn't reachable — both are logged, and both leave the resulting
    ImageService in degraded mode for anything that needs Qdrant,
    rather than failing construction outright."""
    try:
        from qdrant_client import QdrantClient
    except ImportError:
        logger.warning(
            "qdrant_client is not installed (`pip install qdrant-client`) — "
            "this ImageService will start in degraded mode (no vector search)."
        )
        return None

    try:
        client = QdrantClient(
            url=config.qdrant_url,
            api_key=config.qdrant_api_key,
            timeout=config.qdrant_timeout_seconds,
        )
        client.get_collections()  # cheap reachability probe
    except Exception as exc:
        logger.warning(
            "Qdrant is not reachable at %s (%s) — this ImageService will "
            "start in degraded mode (no vector search) until it recovers.",
            config.qdrant_url, exc,
        )
        return None

    logger.info(
        "Qdrant reachable at %s (collection=%s, vector_dim=%d)",
        config.qdrant_url, config.collection_name, config.vector_dim,
    )
    return client


# ============================================================
# EMBEDDING MODEL INITIALIZATION (Sprint 1 — Embedding Model
# Initialization)
#
# Mirrors ingest_textbook_images.py's EmbeddingBackend Protocol /
# OllamaEmbeddingBackend so a query embedded here lands in the exact
# same vector space as what ingestion stored — same Ollama instance,
# same EMBEDDING_MODEL, same /api/embeddings call shape. No network
# call happens at construction time (unlike Qdrant above): an
# embedding call is a per-query cost this service will pay constantly
# once Sprint 3 lands, so probing it eagerly on every ImageService
# construction would only slow startup without meaningfully improving
# on health_check()'s on-demand probe (see below).
# ============================================================

class EmbeddingBackend(Protocol):
    """The raw call ImageService wraps for turning a query into a
    vector — Ollama's /api/embeddings, or a fake in tests. Returns the
    embedding vector for one piece of text."""
    def __call__(self, text: str) -> list[float]: ...


class OllamaEmbeddingBackend:
    """Default EmbeddingBackend. Talks to the same Ollama instance
    (OLLAMA_URL/OLLAMA_HOST) and EMBEDDING_MODEL ingestion already
    used, so this service's query embeddings are directly comparable
    to the vectors already stored in Qdrant. `requests` is imported
    lazily, inside __call__, so importing this module never requires
    it to already be installed — tests inject a fake EmbeddingBackend
    instead."""

    def __init__(
        self,
        *,
        base_url: str = OLLAMA_URL,
        model: str = EMBEDDING_MODEL,
        timeout: float = EMBEDDING_TIMEOUT_SECONDS,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def __call__(self, text: str) -> list[float]:
        try:
            import requests
        except ImportError as exc:
            raise RuntimeError(
                "requests is not installed (`pip install requests`). "
                "Either install it, or inject an embedding_backend= for "
                "testing."
            ) from exc

        response = requests.post(
            f"{self.base_url}/api/embeddings",
            json={"model": self.model, "prompt": text},
            timeout=self.timeout,
        )
        response.raise_for_status()
        embedding = response.json().get("embedding")
        if not embedding:
            raise RuntimeError(f"Ollama returned no embedding for model={self.model!r}")
        return embedding

    def is_reachable(self) -> bool:
        """A cheap, on-demand reachability probe for health_check() —
        embeds a one-word string rather than pinging some unrelated
        endpoint, so a True result actually means "this service could
        embed a query right now", not just "Ollama's HTTP port is
        open"."""
        try:
            self("ping")
            return True
        except Exception as exc:
            logger.debug("Embedding backend reachability probe failed: %s", exc)
            return False


def init_embedding_backend(config: ImageServiceConfig) -> EmbeddingBackend:
    """Builds this service's EmbeddingBackend. Always succeeds
    (construction alone never touches the network) — reachability is
    reported separately, on demand, via health_check() /
    OllamaEmbeddingBackend.is_reachable()."""
    return OllamaEmbeddingBackend(
        base_url=config.ollama_url,
        model=config.embedding_model,
        timeout=config.embedding_timeout_seconds,
    )


# ============================================================
# RETRIEVAL CACHE (Sprint 1 — Retrieval Cache)
#
# A small, thread-safe LRU+TTL cache keyed by a stable hash of a
# retrieve() call's normalized arguments. Nothing populates it yet —
# there's no retrieval to cache in this sprint — but retrieve() below
# already wires a lookup into its call path (cache hit/miss is logged
# and, on a hit, would short-circuit the rest of the call) so later
# sprints only add "compute the result and cache.set(...) it",
# without changing retrieve()'s cache-handling shape.
# ============================================================

def build_cache_key(**kwargs: Any) -> str:
    """Turns a retrieval call's keyword arguments into one stable,
    order-independent cache key. json.dumps(..., sort_keys=True) makes
    the key independent of argument order; sha256 keeps the key itself
    short and fixed-length regardless of how large `filters` or a
    query string gets. Values must be JSON-serializable — callers pass
    already-normalized primitives (str/int/float/bool/None/list/dict),
    never arbitrary objects."""
    normalized = json.dumps(kwargs, sort_keys=True, default=str)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


@dataclass
class _CacheEntry:
    value: Any
    expires_at: float


@dataclass
class CacheStats:
    """Point-in-time counters for RetrievalCache — returned by
    RetrievalCache.stats() and surfaced through
    ImageService.health_check() so cache effectiveness is observable
    without reaching into the cache's internals."""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    expirations: int = 0
    size: int = 0
    max_size: int = 0
    ttl_seconds: float = 0.0

    def as_dict(self) -> dict:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
            "expirations": self.expirations,
            "size": self.size,
            "max_size": self.max_size,
            "ttl_seconds": self.ttl_seconds,
            "hit_rate": (
                round(self.hits / (self.hits + self.misses), 4)
                if (self.hits + self.misses) else None
            ),
        }


class RetrievalCache:
    """Thread-safe, in-process LRU+TTL cache for retrieve() results.

    LRU (via OrderedDict.move_to_end/popitem(last=False)) bounds
    memory under `max_size`; TTL (checked lazily, on access, against
    time.monotonic()) bounds staleness so an update to a visual's
    Qdrant payload (enrichment re-running, e.g.) is reflected within
    `ttl_seconds` rather than cached forever. Deliberately in-process
    rather than e.g. Redis-backed: Sprint 1 is architecture, not a
    deployment decision — a distributed cache is a drop-in swap for
    this same interface later if this service ever runs as more than
    one process, without changing anything that calls it.
    """

    def __init__(
        self,
        *,
        max_size: int = RETRIEVAL_CACHE_MAX_SIZE,
        ttl_seconds: float = RETRIEVAL_CACHE_TTL_SECONDS,
    ) -> None:
        if max_size < 0:
            raise ValueError(f"max_size must be >= 0, got {max_size}")
        if ttl_seconds < 0:
            raise ValueError(f"ttl_seconds must be >= 0, got {ttl_seconds}")
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._entries: "OrderedDict[str, _CacheEntry]" = OrderedDict()
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0
        self._evictions = 0
        self._expirations = 0

    def get(self, key: str) -> Optional[Any]:
        """Returns the cached value for `key`, or None on a miss —
        including a miss caused by expiry, which is indistinguishable
        from an absent key to the caller (both simply mean "go compute
        it"). A max_size of 0 disables the cache outright: every call
        is a miss, nothing is ever stored."""
        if self.max_size == 0:
            with self._lock:
                self._misses += 1
            return None
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                self._misses += 1
                return None
            if entry.expires_at <= time.monotonic():
                del self._entries[key]
                self._misses += 1
                self._expirations += 1
                return None
            self._entries.move_to_end(key)
            self._hits += 1
            return entry.value

    def set(self, key: str, value: Any) -> None:
        """Stores `value` under `key`, evicting the least-recently-used
        entry first if `max_size` would otherwise be exceeded. A
        max_size of 0 makes this a no-op, consistent with get()
        always missing in that configuration."""
        if self.max_size == 0:
            return
        with self._lock:
            if key in self._entries:
                del self._entries[key]
            elif len(self._entries) >= self.max_size:
                self._entries.popitem(last=False)
                self._evictions += 1
            self._entries[key] = _CacheEntry(
                value=value, expires_at=time.monotonic() + self.ttl_seconds,
            )

    def invalidate(self, key: str) -> bool:
        """Removes one entry ahead of its TTL, e.g. when a visual is
        known to have just changed. Returns whether `key` was present."""
        with self._lock:
            return self._entries.pop(key, None) is not None

    def clear(self) -> None:
        """Drops every cached entry without resetting hit/miss
        counters — clear() is an operational action (e.g. "the
        collection was just re-enriched"), not a stats reset."""
        with self._lock:
            self._entries.clear()

    def stats(self) -> CacheStats:
        with self._lock:
            return CacheStats(
                hits=self._hits,
                misses=self._misses,
                evictions=self._evictions,
                expirations=self._expirations,
                size=len(self._entries),
                max_size=self.max_size,
                ttl_seconds=self.ttl_seconds,
            )

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)


# ============================================================
# QUERY CLEANING (Sprint 2 — Query Embedding)
# ============================================================

def _clean_query_text(text: str) -> str:
    """Sprint 2's "clean question" responsibility. Collapses any run
    of whitespace (spaces, tabs, newlines — a query pasted from
    somewhere else is exactly where these show up) into single spaces
    and trims the ends. Deliberately does *not* strip punctuation,
    lowercase, or otherwise reshape the text: a trailing "?" or a
    figure reference like "Figure 1.3" is meaningful to both the
    embedding model and (for exact lookups) a later sprint's routing,
    so this stays a minimal, lossless normalization rather than a
    heavier NLP cleanup."""
    return " ".join(text.split())


# ============================================================
# CANDIDATE RETRIEVAL (Sprint 3 — raw Qdrant search hits and the
# metadata filter _search_qdrant accepts)
# ============================================================

@dataclass(frozen=True)
class RawCandidate:
    """One untouched Qdrant search hit. Sprint 3's explicit scope
    boundary — "no reranking yet" — means this carries exactly what
    Qdrant returned (`id`, `score`, and `payload` in the schema this
    file's own module docstring documents) and nothing this file
    computed itself. Later sprints rerank/group/resolve a list of
    these; this sprint only produces the list."""
    id: Any
    score: float
    payload: dict


def _build_metadata_filter(
    *,
    subject: Optional[str] = None,
    chapter: Optional[str] = None,
    chapter_number: Optional[int] = None,
    figure_number: Optional[str] = None,
    table_number: Optional[str] = None,
    extra: Optional[dict] = None,
) -> Optional[Any]:
    """Sprint 3's "support metadata filter" responsibility. Builds a
    qdrant_client Filter that AND-combines an equality condition per
    non-None argument, against the payload paths this project's real
    ingested data actually uses.

    Confirmed against a live scroll of the `textbook_images`
    collection (pipeline_version "v2"): every point's payload is
    `{"metadata": {...flat fields...}, "image": ..., "search_text":
    ...}` — there is no `metadata.visual` sub-object in production
    data, despite some of this file's other docstrings describing a
    "current nested" schema as if it were live. `metadata.subject`
    is flat and matches a bare string ("Mathematics") as expected.
    `metadata.figure_number` is also flat, but — unlike `subject` —
    its value is already a formatted label ("Figure 2.12"), not the
    bare number ("2.12") a caller/regex-parsed reference passes in
    here. `metadata.chapter` is present as a key but is always None
    in real data; the chapter is only ever recorded as an int under
    `metadata.chapter_number` — pass `chapter_number=` (not `chapter=`)
    to actually filter by chapter against real data; `chapter=` is
    kept only for a collection that does populate the name field, and
    the two are AND-combined if both are given, so don't pass a
    `chapter` title alongside `chapter_number` unless you know this
    particular collection's `metadata.chapter` is actually populated
    — otherwise the always-None field will zero out every result.

    For figure_number/table_number specifically, this builds a
    `should` (OR) sub-filter across two possibilities so a caller
    doesn't need to know which shape a given point actually used:
      1. `metadata.figure_number` == "Figure {number}" (confirmed
         real-data shape — the flat field already carries the label).
      2. `metadata.visual.figure_number` == "{number}" (the nested,
         bare-number shape this file's other helpers were written to
         also support — unverified against real data, kept as a
         defensive fallback in case some ingested batch does use it).
    Same treatment for table_number, though no real table_number
    sample was available to confirm either shape/format — treat that
    branch as a best-effort assumption pending verification.

    `extra` lets a caller add arbitrary payload-key equality
    conditions without this function needing to know every filterable
    field in advance. Returns None (no filter — Qdrant treats this as
    "match everything") when nothing was given, so callers can always
    pass the result straight through to query_filter= without a
    None-check of their own."""
    from qdrant_client.models import FieldCondition, Filter, MatchValue

    conditions: list[Any] = []

    if subject is not None:
        conditions.append(
            FieldCondition(key="metadata.subject", match=MatchValue(value=subject))
        )

    if chapter is not None:
        conditions.append(
            FieldCondition(key="metadata.chapter", match=MatchValue(value=chapter))
        )

    if chapter_number is not None:
        conditions.append(
            FieldCondition(
                key="metadata.chapter_number",
                match=MatchValue(value=chapter_number),
            )
        )

    if figure_number is not None:
        conditions.append(
            Filter(
                should=[
                    FieldCondition(
                        key="metadata.figure_number",
                        match=MatchValue(value=f"Figure {figure_number}"),
                    ),
                    FieldCondition(
                        key="metadata.visual.figure_number",
                        match=MatchValue(value=figure_number),
                    ),
                ]
            )
        )

    if table_number is not None:
        conditions.append(
            Filter(
                should=[
                    FieldCondition(
                        key="metadata.table_number",
                        match=MatchValue(value=f"Table {table_number}"),
                    ),
                    FieldCondition(
                        key="metadata.visual.table_number",
                        match=MatchValue(value=table_number),
                    ),
                ]
            )
        )

    if extra:
        for key, value in extra.items():
            conditions.append(FieldCondition(key=key, match=MatchValue(value=value)))

    if not conditions:
        return None

    return Filter(must=conditions)


# ============================================================
# EXACT REFERENCE EXTRACTION (Sprint 6 — Exact Figure Retrieval)
# ============================================================

# The fixed score _exact_reference_match gives every hit it returns
# (see that method's own docstring for why: an exact reference match
# isn't a similarity ranking). Sprint 9's _select_groups reads this
# same constant back to recognize — and always keep — a group built
# from an exact match, regardless of whatever score/relative
# thresholds it's applying to everything else; see
# _group_is_exact_match below.
EXACT_MATCH_SCORE = 1.0


def _is_exact_match_score(score: float) -> bool:
    """True for a score that came from (or was derived from a group
    containing) an exact figure/table match. A small epsilon guards
    against float drift from _rank_groups' corroboration bonus, which
    is capped at 1.0 but could in principle land a hair under it due
    to floating-point rounding rather than a genuine non-exact
    score."""
    return score >= EXACT_MATCH_SCORE - 1e-9

# Matches a leading reference-kind word (figure-like or table),
# optionally abbreviated/plural/punctuated ("Fig.", "figs", "Diagram"),
# followed by a dotted textbook-style number ("1.3", "2.7", "10.12").
# Deliberately permissive on the *kind* word — "diagram"/"chart"/
# "graph"/"illustration"/"image"/"photo" all resolve to a figure_number
# lookup, matching how this file's own module docstring describes
# "visual.type" (diagram/graph/chart/...) as independent of whether
# the visual is numbered as a figure — only "table" gets its own
# table_number lookup, since ingestion/enrichment track those as a
# genuinely separate numbering sequence.
_REFERENCE_PATTERN = re.compile(
    r"\b(fig(?:ure)?s?|diagrams?|charts?|graphs?|illustrations?|images?|"
    r"photos?|tables?)\.?\s*[:#-]?\s*(\d+(?:\.\d+)*)\b",
    re.IGNORECASE,
)

_TABLE_KIND_PREFIXES = ("table",)


def _extract_reference_query(text: str) -> Optional[tuple[str, str]]:
    """Sprint 6's "Extract Figure ID" step. Scans free text for the
    first "<kind> <number>" reference (see _REFERENCE_PATTERN) and
    returns (`"table"` or `"figure"`, number) — e.g. "show fig 1.3"
    -> `("figure", "1.3")`, "what's in Table 1.1?" -> `("table",
    "1.1")`. Returns None when the text has no such reference at all
    (a purely semantic question like "explain coordinates" never
    matches), so callers can use the return value directly as a
    routing signal: None means "this isn't an exact-reference query,
    try semantic search instead".

    Only ever inspects the *first* match — a query naming two figures
    ("compare Figure 1.3 and 1.4") is rare enough, and ambiguous
    enough about which one the caller actually wants first, that
    Sprint 6's "return immediately" scope doesn't try to disambiguate
    it; it resolves the first reference and stops there."""
    if not text:
        return None

    match = _REFERENCE_PATTERN.search(text)
    if match is None:
        return None

    kind_word = match.group(1).lower()
    number = match.group(2)
    kind = "table" if kind_word.startswith(_TABLE_KIND_PREFIXES) else "figure"
    return kind, number


# ============================================================
# CANDIDATE NORMALIZATION (Sprint 4)
#
# _search_qdrant (Sprint 3) returns RawCandidates whose `.payload` is
# whatever Qdrant actually stored, untouched — and that shape isn't
# uniform. Two things vary across this project's own history, both
# confirmed against the real ingestion/enrichment code, not assumed:
#
#   1. payload["metadata"] itself has taken two different shapes
#      across this codebase's own sprints — an earlier flat one
#      (ingest_textbook_images.py's NCERTMetadata.as_dict(): "page" is
#      a bare int, "figure_number"/"visual_type"/"source_pdf" are
#      top-level keys) and the current nested one
#      (enrich_textbook_images.py's VisualMetadata: "page" is
#      {"pdf": ..., "textbook": ...}, "visual" is
#      {"type", "figure_number", "table_number", "caption", ...}).
#      A point ingested before a schema change keeps its old shape
#      forever unless re-ingested — Qdrant never migrates payloads on
#      its own.
#   2. payload["education_metadata"]/["pass2_retrieval_text"] exist
#      only for visuals enrichment actually reached (see this file's
#      own module docstring) — absent, not merely empty, for anything
#      only ever ingested.
#
# The extraction helpers below read defensively across both metadata
# shapes so _normalize_candidates can guarantee every Candidate it
# produces has the exact same fields regardless of which schema (or
# enrichment state) its source point happens to be in — that
# consistency is this sprint's entire point.
# ============================================================

def _extract_page_number(metadata: dict) -> Optional[int]:
    """`page` is a bare int in the legacy flat metadata shape, or a
    {"pdf": ..., "textbook": ...} dict in the current nested shape —
    "pdf" (the page actually rendered/cropped from) is preferred over
    "textbook" (a printed page number that may not even be set; see
    this file's own synthetic-object testing, which leaves it None)."""
    page = metadata.get("page")
    if isinstance(page, dict):
        pdf_page = page.get("pdf")
        return pdf_page if pdf_page is not None else page.get("textbook")
    if isinstance(page, int):
        return page
    return None


def _extract_visual_type(metadata: dict) -> Optional[str]:
    """"visual_type" (legacy flat shape, top-level) vs
    visual.type (current nested shape)."""
    visual = metadata.get("visual")
    if isinstance(visual, dict):
        return visual.get("type")
    return metadata.get("visual_type")


def _extract_reference_label(metadata: dict) -> Optional[str]:
    """A human-readable label for the tutor to show/say — "Figure
    1.3"/"Table 2.1" when a figure_number/table_number exists (either
    metadata shape has these, just at different nesting), falling back
    to a title-cased visual type ("Diagram", "Graph") when neither
    does, so a candidate is never labeled with nothing at all.

    Confirmed against real ingested data: the flat shape's
    metadata["figure_number"] is already a formatted label
    ("Figure 2.12"), not a bare number — prefixing it again produced
    "Figure Figure 2.12". The nested visual.figure_number shape (per
    this file's other helpers) is assumed to still hold a bare
    number, so only that branch gets the "Figure "/"Table " prefix
    added here."""
    visual = metadata.get("visual")
    if isinstance(visual, dict):
        figure_number = visual.get("figure_number")
        table_number = visual.get("table_number")
        if figure_number:
            return f"Figure {figure_number}"
        if table_number:
            return f"Table {table_number}"
    else:
        figure_number = metadata.get("figure_number")
        table_number = metadata.get("table_number")
        if figure_number:
            figure_number = str(figure_number)
            return (
                figure_number
                if figure_number.lower().startswith("figure")
                else f"Figure {figure_number}"
            )
        if table_number:
            table_number = str(table_number)
            return (
                table_number
                if table_number.lower().startswith("table")
                else f"Table {table_number}"
            )

    visual_type = _extract_visual_type(metadata)
    return visual_type.replace("_", " ").title() if visual_type else None


def _extract_caption(metadata: dict) -> Optional[str]:
    """visual.caption, falling back to visual.title, in whichever
    metadata shape is present — a title is better than nothing when a
    visual genuinely has no caption of its own."""
    visual = metadata.get("visual")
    if isinstance(visual, dict):
        return visual.get("caption") or visual.get("title")
    return metadata.get("caption") or metadata.get("title")


def _extract_source(metadata: dict) -> Optional[str]:
    """Sprint 5 needs a "source" to filter on — the document a visual
    came from. "source_pdf" (legacy flat shape) is the direct match;
    "source"/"pdf_name"/"book" cover other names this project's own
    history has used for the same concept. storage.object_key is a
    last resort (unique per visual, not per document, but still
    identifies *where* it came from when nothing else is set)."""
    for key in ("source_pdf", "source", "pdf_name", "book"):
        value = metadata.get(key)
        if value:
            return value
    storage = metadata.get("storage")
    if isinstance(storage, dict):
        return storage.get("object_key") or storage.get("bucket")
    return None


def _extract_search_text(payload: dict, metadata: dict) -> str:
    """Prefers enrichment's pass2_retrieval_text (Sprint 15.12's
    expanded, keyword-rich text) when present, then ingestion's own
    pass-1 search_text, then — for the legacy flat metadata shape,
    which stored search_text *inside* metadata rather than as its own
    payload key — metadata["search_text"]. Never None: an
    unenriched, oddly-shaped point still gets "" rather than breaking
    Candidate's schema."""
    return (
        payload.get("pass2_retrieval_text")
        or payload.get("search_text")
        or metadata.get("search_text")
        or ""
    )


def _extract_image(payload: dict) -> dict:
    """Every possible way of locating the actual image, gathered into
    one small dict rather than three separate Candidate fields —
    _resolve_image_url (Sprint 10) is what decides which of these to
    actually use (storage_key/public_url over the ingestion-time-only
    local crop_path), so this just carries all three forward,
    consistently, regardless of which are populated for a given
    visual."""
    return {
        "storage_key": payload.get("storage_key"),
        "public_url": payload.get("public_url"),
        "crop_path": payload.get("image") or None,
    }


@dataclass(frozen=True)
class Candidate:
    """Sprint 4's output shape — one consistent schema every
    RawCandidate becomes, regardless of which metadata shape or
    enrichment state its source point happens to be in.

    Fields, per this sprint's brief: reference_label, page_number,
    caption, search_text, education_metadata, image, score, metadata.
    `id` is carried forward too (RawCandidate always had one, and
    later sprints — grouping and deduplication in particular — need a
    stable identity per candidate); nothing in the brief's list is
    dropped or renamed to make room for it."""
    id: Any
    reference_label: Optional[str]
    page_number: Optional[int]
    caption: Optional[str]
    search_text: str
    education_metadata: dict
    image: dict
    score: float
    metadata: dict


def _values_match(actual: Optional[Any], expected: str) -> bool:
    """Sprint 5's equality rule for every filter below: case- and
    whitespace-insensitive string comparison ("Mathematics" ==
    "mathematics " == "MATHEMATICS"), since subject/chapter/source/
    visual-type values reach this function from several different
    upstream sources (folder names, OCR'd captions, a caller's own
    filter argument) that are unlikely to agree on casing even when
    they mean the same thing. `actual=None` (the field simply isn't
    set on this candidate) never matches any requested value —
    filtering is opt-in specificity, not "unset passes everything"."""
    if actual is None:
        return False
    return str(actual).strip().casefold() == str(expected).strip().casefold()


# ============================================================
# EDUCATIONAL SIGNAL EXTRACTION (Sprint 7 — Educational Reranker)
#
# education_metadata's shape is {education, retrieval, visual_analysis,
# assessment} (this file's own module docstring, describing
# enrich_textbook_images.py's Sprint 15.9 output) — but this rebuild
# doesn't carry that pipeline's exact sub-field names, unlike Sprint
# 4's metadata-shape helpers above (which were checked directly
# against ingest_textbook_images.py / enrich_textbook_images.py). Each
# helper below is deliberately permissive — it tries several plausible
# key names for the same concept and falls back to an empty
# list/None — so an enrichment payload that uses slightly different
# naming than guessed here still contributes *something* rather than
# silently scoring zero, and a payload with none of these keys at all
# (never enriched) always degrades cleanly to "no signal" rather than
# raising.
# ============================================================

def _as_text_list(value: Any) -> list[str]:
    """Coerces `value` into a flat list of non-empty strings — a
    single string becomes a one-item list, a list/tuple of strings
    passes through (empty/non-string entries dropped), and anything
    else (missing key, None, an unexpected type) becomes []. Every
    signal extractor below routes through this so a caller can't
    crash this file just because one enrichment payload stored
    "keywords": "a, b, c" as a string instead of a list."""
    if not value:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value if isinstance(item, str) and item.strip()]
    return []


def _extract_retrieval_keywords(education_metadata: dict) -> list[str]:
    """education_metadata["retrieval"]["keywords"], tolerating a few
    plausible alternate names enrichment might have used."""
    retrieval = education_metadata.get("retrieval")
    if not isinstance(retrieval, dict):
        return []
    for key in ("keywords", "retrieval_keywords", "search_keywords"):
        found = _as_text_list(retrieval.get(key))
        if found:
            return found
    return []


def _extract_curriculum_topics(education_metadata: dict) -> list[str]:
    """education_metadata["education"]["topics"]/["curriculum_topics"]
    — the syllabus-level topics this visual supports."""
    education = education_metadata.get("education")
    if not isinstance(education, dict):
        return []
    for key in ("topics", "curriculum_topics", "curriculum"):
        found = _as_text_list(education.get(key))
        if found:
            return found
    return []


def _extract_learning_objectives(education_metadata: dict) -> list[str]:
    """education_metadata["education"]["learning_objectives"]."""
    education = education_metadata.get("education")
    if not isinstance(education, dict):
        return []
    for key in ("learning_objectives", "objectives"):
        found = _as_text_list(education.get(key))
        if found:
            return found
    return []


def _extract_search_examples(education_metadata: dict) -> list[str]:
    """education_metadata["retrieval"]["student_search_examples"] —
    example phrasings a student might actually type, which is exactly
    the kind of text a raw query should be compared against directly
    rather than via keyword overlap alone."""
    retrieval = education_metadata.get("retrieval")
    if not isinstance(retrieval, dict):
        return []
    for key in ("student_search_examples", "search_examples", "example_queries"):
        found = _as_text_list(retrieval.get(key))
        if found:
            return found
    return []


def _extract_answerable_queries(education_metadata: dict) -> list[str]:
    """education_metadata["assessment"]["answerable_queries"] —
    questions this visual is judged able to actually answer, as
    opposed to merely being topically related to."""
    assessment = education_metadata.get("assessment")
    if not isinstance(assessment, dict):
        return []
    for key in ("answerable_queries", "answerable_questions"):
        found = _as_text_list(assessment.get(key))
        if found:
            return found
    return []


def _extract_educational_confidence(education_metadata: dict) -> Optional[float]:
    """An overall educational-confidence figure for this visual, if
    enrichment recorded one, checked at both the top of
    education_metadata and inside its "education" sub-dict, under a
    few plausible names. Clamped to [0, 1] — a stray out-of-range
    value (e.g. a 0-100 scale) is far more likely than a genuinely
    negative or >1 confidence, so this treats it as the same
    fraction-of-1 convention grounding_confidence already uses
    elsewhere in this file rather than rejecting it outright. Returns
    None (not 0.0) when nothing is present, so callers can distinguish
    "no signal, don't adjust anything" from "signal says zero
    confidence"."""
    candidates: list[Any] = [education_metadata.get("confidence")]
    education = education_metadata.get("education")
    if isinstance(education, dict):
        candidates.append(education.get("confidence"))
        candidates.append(education.get("educational_confidence"))

    for value in candidates:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return max(0.0, min(1.0, float(value)))
    return None


def _extract_grounded_description(education_metadata: dict) -> Optional[str]:
    """Sprint 11 signal: a model-grounded description of what the
    visual actually shows, checked in education_metadata["visual_
    analysis"] under a few plausible key names — mirrors every other
    Sprint 7/11 extractor's "read defensively, never KeyError" posture
    since this rebuild doesn't have enrich_textbook_images.py's exact
    field names to hand-verify against."""
    visual_analysis = education_metadata.get("visual_analysis")
    if not isinstance(visual_analysis, dict):
        return None
    for key in ("grounded_description", "description", "visual_description"):
        value = visual_analysis.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _extract_student_explanation(education_metadata: dict) -> Optional[str]:
    """Sprint 11 signal: a student-facing, simplified explanation of
    the visual, checked in education_metadata["education"] first (the
    same sub-dict _extract_curriculum_topics/_extract_learning_
    objectives already read), then at education_metadata's own top
    level, under a few plausible key names."""
    education = education_metadata.get("education")
    if isinstance(education, dict):
        for key in ("student_explanation", "explanation", "simplified_explanation"):
            value = education.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    for key in ("student_explanation", "explanation"):
        value = education_metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _extract_visual_subtype(metadata: dict) -> Optional[str]:
    """A finer-grained visual classification than _extract_visual_type
    ("bar_chart" under a "chart" type, say) — checked in
    visual.subtype (current nested shape) first, then a couple of
    plausible top-level key names, the same shape-tolerant pattern
    _extract_visual_type itself uses."""
    visual = metadata.get("visual")
    if isinstance(visual, dict):
        for key in ("subtype", "sub_type", "visual_subtype"):
            value = visual.get(key)
            if value:
                return str(value)
    value = metadata.get("visual_subtype")
    return str(value) if value else None


def _as_any_list(value: Any) -> list[Any]:
    """Like _as_text_list, but keeps non-string entries as-is (dicts,
    for instance) rather than dropping them — used for signals like
    visible_entities/concept_relationships where enrichment may have
    stored structured items rather than plain strings, and the
    downstream consumer (tutor_engine.py's _build_figure_context)
    already stringifies each entry itself rather than assuming str."""
    if not value:
        return []
    if isinstance(value, (list, tuple)):
        return [item for item in value if item]
    return [value]


def _extract_teaches(education_metadata: dict) -> list[str]:
    """education_metadata["education"]["teaches"] — the concepts this
    visual is meant to teach, distinct from the syllabus-level
    _extract_curriculum_topics."""
    education = education_metadata.get("education")
    if not isinstance(education, dict):
        return []
    for key in ("teaches", "concepts_taught", "concepts"):
        found = _as_text_list(education.get(key))
        if found:
            return found
    return []


def _extract_visible_entities(education_metadata: dict) -> list[Any]:
    """education_metadata["visual_analysis"]["visible_entities"] —
    the labeled/detected entities enrichment found in the crop
    itself (axis labels, plotted points, ...)."""
    visual_analysis = education_metadata.get("visual_analysis")
    if not isinstance(visual_analysis, dict):
        return []
    for key in ("visible_entities", "entities"):
        found = _as_any_list(visual_analysis.get(key))
        if found:
            return found
    return []


def _extract_concept_relationships(education_metadata: dict) -> list[Any]:
    """education_metadata["visual_analysis"]["concept_relationships"]
    — how the visible entities above relate to one another."""
    visual_analysis = education_metadata.get("visual_analysis")
    if not isinstance(visual_analysis, dict):
        return []
    for key in ("concept_relationships", "relationships"):
        found = _as_any_list(visual_analysis.get(key))
        if found:
            return found
    return []


def _extract_pedagogical_value(education_metadata: dict) -> Optional[str]:
    """A short note on why this visual is educationally useful,
    checked in education_metadata["assessment"] first (alongside
    _extract_answerable_queries), then ["education"], under a couple
    of plausible key names."""
    for section_key in ("assessment", "education"):
        section = education_metadata.get(section_key)
        if not isinstance(section, dict):
            continue
        for key in ("pedagogical_value", "value"):
            value = section.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def _tokenize(text: str) -> set[str]:
    """Lowercases and splits `text` into a set of alphanumeric tokens
    — good enough for the coarse keyword/topic/objective overlap
    _educational_rerank uses; not a stemmer or a real NLP tokenizer,
    deliberately, since the signals it's comparing against (short
    keyword lists, topic names) don't need one."""
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _text_overlap_score(query_tokens: set[str], phrases: list[str]) -> float:
    """Fraction of `phrases` that share at least one token with
    `query_tokens` — e.g. query "explain coordinates" against
    phrases=["coordinate geometry", "cartesian plane"] scores 0.5 (one
    of the two phrases overlaps). Returns 0.0 for an empty `phrases`
    list rather than dividing by zero, which _educational_rerank
    relies on to mean "no signal here" the same way
    _extract_educational_confidence's None does for confidence."""
    if not phrases or not query_tokens:
        return 0.0
    hits = sum(1 for phrase in phrases if _tokenize(phrase) & query_tokens)
    return hits / len(phrases)


# ============================================================
# VISUAL GROUPING (Sprint 8 — Visual Grouping)
#
# Ingestion crops a textbook page into individual visuals — a single
# printed figure that spans multiple panels ("Figure 1.3a", "Figure
# 1.3b", ...), or a series of related visuals on one page, can end up
# as several separate Qdrant points/Candidates rather than one. This
# section's job is "One Figure -> Many Crops": collapse those back
# into groups the tutor can present as a single figure with (when
# there's more than one) multiple crops attached, instead of showing
# near-duplicate results for what a student experiences as one image.
# ============================================================

def _extract_panel_label(metadata: dict) -> Optional[str]:
    """A sub-figure/panel label ("a", "b", "(i)", ...) distinguishing
    one crop of a multi-part visual from its siblings — checked in
    visual.panel_label (current nested shape) first, then the same
    key names at the top level of `metadata` (in case a differently-
    shaped payload stored it there instead), mirroring how every other
    Sprint 4 extractor in this file reads across shape variants rather
    than assuming one."""
    visual = metadata.get("visual")
    if isinstance(visual, dict):
        for key in ("panel_label", "panel", "part", "sub_label"):
            value = visual.get(key)
            if value:
                return str(value)
    for key in ("panel_label", "panel", "part"):
        value = metadata.get(key)
        if value:
            return str(value)
    return None


def _candidate_group_key(candidate: "Candidate") -> tuple:
    """Sprint 8's "Group By" list — figure number, page number, panel
    label, source PDF — collapsed into one grouping key per candidate,
    in priority order:

        1. (figure, source, figure_number) when a figure_number is
           set — the strongest possible identity: two crops with the
           same figure_number in the same source document are, by
           definition, the same textbook figure.
        2. (table, source, table_number), the same idea for tables —
           kept as its own bucket rather than folded into (1) so a
           figure and a table that happened to share a raw number
           string never collide.
        3. (panel, source, page_number, panel_label) when there's no
           figure/table number but there IS a panel label — the
           "series of related visuals on the same page" case this
           file's own ROADMAP entry (now implemented) described:
           same page, same panel series, same document.
        4. (singleton, candidate.id) otherwise — nothing ties this
           crop to any other one, so it gets its own one-member group
           rather than being merged into an unrelated visual just for
           sharing a page number with it.

        `source` is part of every non-singleton key so the same
        figure_number in two different textbooks never merges.
        Comparisons are case-/whitespace-normalized the same way
        _values_match already does elsewhere in this file, since these
        values come from the same inconsistent upstream sources."""
    metadata = candidate.metadata or {}
    source = (_extract_source(metadata) or "").strip().casefold()

    visual = metadata.get("visual")
    visual = visual if isinstance(visual, dict) else {}
    figure_number = visual.get("figure_number") or metadata.get("figure_number")
    table_number = visual.get("table_number") or metadata.get("table_number")

    if figure_number:
        return ("figure", source, str(figure_number).strip().casefold())
    if table_number:
        return ("table", source, str(table_number).strip().casefold())

    panel_label = _extract_panel_label(metadata)
    if panel_label:
        return ("panel", source, candidate.page_number, panel_label.strip().casefold())

    return ("singleton", candidate.id)


@dataclass(frozen=True)
class CandidateGroup:
    """Sprint 8's output shape — "One Figure -> Many Crops". `key` is
    whatever _candidate_group_key produced (kept for debugging/tests,
    not meant to be interpreted by callers); `candidates` holds every
    Candidate that shares it, pre-sorted by score descending so the
    first entry is always the group's best crop without callers
    needing to re-sort. A group's own convenience fields
    (reference_label/page_number/score) are properties derived from
    that best candidate rather than separate stored fields, so they
    can never drift out of sync with `candidates` itself."""
    key: tuple
    candidates: tuple["Candidate", ...]

    @property
    def best(self) -> "Candidate":
        """The group's highest-scoring member — `candidates[0]`,
        relying on the sort _group_candidates already performed at
        construction time."""
        return self.candidates[0]

    @property
    def score(self) -> float:
        return self.best.score

    @property
    def reference_label(self) -> Optional[str]:
        return self.best.reference_label

    @property
    def page_number(self) -> Optional[int]:
        return self.best.page_number

    @property
    def caption(self) -> Optional[str]:
        """The first non-empty caption across the group's members —
        the best crop's own caption if it has one, otherwise whatever
        a sibling crop of the same figure recorded."""
        for candidate in self.candidates:
            if candidate.caption:
                return candidate.caption
        return None

    @property
    def crop_count(self) -> int:
        return len(self.candidates)


def _group_rank_score(group: CandidateGroup) -> float:
    """Sprint 9's "Group score" responsibility: the ranking score for
    one group, used by _rank_groups to order groups (and, indirectly,
    by _select_groups' thresholding). Starts from the group's best
    member's own score (already whatever _search_qdrant/
    _apply_filters/_educational_rerank most recently computed for it)
    and adds a small corroboration bonus for having more than one crop
    — several independently-retrieved crops agreeing this is the same
    figure is itself a (weak) positive signal, distinct from any one
    crop's own vector/educational score. Capped at 1.0 (the same
    ceiling _educational_rerank's own scores are capped at — see
    EXACT_MATCH_SCORE) so this bonus can't let a merely-decent, many
    -crop group outrank a genuinely strong single-crop or exact-match
    one."""
    bonus = min(0.03 * (group.crop_count - 1), 0.09)
    return min(1.0, group.score + bonus)


def _group_identity(group: CandidateGroup) -> Optional[tuple]:
    """Sprint 9's "Duplicate removal" identity key: two groups with
    the same (source, reference_label, page_number) are almost
    certainly the same textbook figure that _candidate_group_key
    (Sprint 8) failed to merge — e.g. one crop had a figure_number set
    and another sibling crop of the same figure didn't, landing it in
    a `singleton`/`panel` bucket instead of the `figure` one. Returns
    None for a group with no reference_label at all (an unlabeled
    singleton/panel group) — without a label there's no reliable
    identity to dedupe on, so those groups are left alone rather than
    risking merging two genuinely unrelated visuals that happen to
    share a page number."""
    label = group.reference_label
    if not label:
        return None
    source = (_extract_source(group.best.metadata) or "").strip().casefold()
    return (source, label.strip().casefold(), group.page_number)


def _dedupe_groups(groups: list[CandidateGroup]) -> list[CandidateGroup]:
    """Sprint 9's "Duplicate removal" step. Merges groups that share
    an _group_identity (see above) into one — combining their members
    (deduped by Candidate.id, so a crop present in both isn't
    double-counted), re-sorted by score — while leaving every
    unlabeled group (identity None) untouched and in place. Preserves
    first-seen order for the merged/untouched result list."""
    merged: dict[Any, CandidateGroup] = {}
    order: list[Any] = []

    for group in groups:
        identity = _group_identity(group)
        dedupe_key = identity if identity is not None else ("__unmerged__", id(group))

        if dedupe_key not in merged:
            merged[dedupe_key] = group
            order.append(dedupe_key)
            continue

        existing = merged[dedupe_key]
        existing_ids = {c.id for c in existing.candidates}
        extra = tuple(c for c in group.candidates if c.id not in existing_ids)
        if extra:
            combined = tuple(
                sorted(existing.candidates + extra, key=lambda c: c.score, reverse=True)
            )
            merged[dedupe_key] = CandidateGroup(key=existing.key, candidates=combined)

    return [merged[key] for key in order]


def _group_is_exact_match(group: CandidateGroup) -> bool:
    """True when `group` was built from (or now contains, after
    deduping) an exact figure/table match — i.e. its best member's
    score is EXACT_MATCH_SCORE (Sprint 6). _select_groups always keeps
    a group this returns True for, bypassing both its absolute and
    adaptive-relative thresholds — see this file's module docstring,
    Sprint 9, for why."""
    return _is_exact_match_score(group.score)


def _build_figure_id(group: CandidateGroup) -> str:
    """Sprint 11's `figure_id`: a short, stable identifier for a
    group, built off the same identity _rank_groups' own deduping
    already uses (_group_identity — (source, reference_label,
    page_number)) when the group has one, so the same textbook figure
    hashes to the same figure_id across repeated retrievals rather
    than one tied to whichever crop happened to score best this time.
    Falls back to the group's best candidate's own id for an
    unlabeled singleton/panel group, where no such shared identity
    exists. Hashed (sha1, truncated) rather than used raw so this
    never leaks a raw Qdrant point id or metadata value directly into
    the API response."""
    identity = _group_identity(group)
    raw = "|".join(str(part) for part in identity) if identity is not None else f"singleton:{group.best.id}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


# ============================================================
# RETRIEVAL REQUEST (validated/normalized input shape for retrieve())
#
# Defined now so retrieve()'s signature, validation, and cache-key
# construction are already final — later sprints fill in what happens
# *after* a RetrievalRequest is built, not how it's built.
# ============================================================

@dataclass(frozen=True)
class RetrievalRequest:
    """One normalized, validated retrieve() call. Building this is
    the extent of Sprint 1's contribution to retrieve() itself —
    everything past `cache_key` (search, grouping, ranking, local
    storage resolution) belongs to later sprints, some of which
    (_embed_query, _search_qdrant) now exist but aren't wired into
    retrieve() itself yet — see this file's module docstring."""
    query: Optional[str]
    top_k: int
    figure_number: Optional[str]
    table_number: Optional[str]
    subject: Optional[str]
    chapter: Optional[str]
    chapter_number: Optional[int] = None
    filters: dict = field(default_factory=dict)
    use_cache: bool = True

    @property
    def cache_key(self) -> str:
        return build_cache_key(
            query=self.query,
            top_k=self.top_k,
            figure_number=self.figure_number,
            table_number=self.table_number,
            subject=self.subject,
            chapter=self.chapter,
            chapter_number=self.chapter_number,
            filters=self.filters,
        )


# ============================================================
# IMAGE SERVICE
# ============================================================

class ImageService:
    """The AI Tutor's image retrieval service.

    Sprint 1: initializes its three dependencies (Qdrant, the embedding
    model, the retrieval cache) plus local image storage, and nothing
    more. Every dependency except configuration itself is injectable —
    tests (and later sprints' own tests) construct an ImageService
    against fakes without a real Qdrant/Ollama deployment, exactly the
    pattern ingest_textbook_images.py's stages already use throughout
    (`client=`/`backend=`/`storage=` injection points).

    Construction never raises for a subsystem that is merely
    unreachable — see init_qdrant_client above — so `ImageService()`
    always succeeds against a fully-down environment and reports what's
    actually available via health_check(). Local image storage
    (core/local_image_storage.py) is always constructible — no external
    connection to fail — so it's never in degraded mode the way Qdrant
    can be.
    """

    def __init__(
        self,
        config: Optional[ImageServiceConfig] = None,
        *,
        qdrant_client: Optional[Any] = None,
        local_storage: Optional[LocalImageStorage] = None,
        embedding_backend: Optional[EmbeddingBackend] = None,
        cache: Optional[RetrievalCache] = None,
    ) -> None:
        self.config = config or load_config()
        init_logging(self.config.log_level)

        self.qdrant_client = (
            qdrant_client if qdrant_client is not None
            else init_qdrant_client(self.config)
        )
        # This service's only image/PDF storage backend (local-only
        # deployment — see core/local_image_storage.py). Always
        # constructible, no external connection to fail, so
        # _resolve_image_url() below has no "storage is down" branch
        # to fall back from.
        self.local_storage = local_storage if local_storage is not None else get_local_image_storage()
        self.embedding_backend: EmbeddingBackend = (
            embedding_backend if embedding_backend is not None
            else init_embedding_backend(self.config)
        )
        self.cache = cache if cache is not None else RetrievalCache(
            max_size=self.config.cache_max_size,
            ttl_seconds=self.config.cache_ttl_seconds,
        )

        logger.info(
            "ImageService initialized (qdrant=%s, local_storage=ok, collection=%s)",
            "connected" if self.qdrant_client is not None else "degraded",
            self.config.collection_name,
        )

    # --------------------------------------------------------
    # Observability
    # --------------------------------------------------------

    def health_check(self, *, probe_embedding: bool = False) -> dict:
        """Reports the live status of every subsystem. Qdrant is
        re-probed here (a cheap call) rather than trusting the snapshot
        from __init__, since it may have recovered or failed since
        construction. Local image storage has no equivalent
        reachability probe — it's a local disk, always available — so
        it's reported as a fixed "ok" rather than re-checked. The
        embedding backend is only probed when `probe_embedding=True` —
        unlike Qdrant it has no free "list collections"-style call, so
        checking it costs one real embedding call; callers that hit
        this frequently (e.g. a load balancer health check) should
        leave it False and rely on retrieve() itself to surface
        embedding failures."""
        qdrant_status = "unavailable"
        if self.qdrant_client is not None:
            try:
                self.qdrant_client.get_collections()
                qdrant_status = "ok"
            except Exception as exc:
                logger.warning("Qdrant health check failed: %s", exc)
                qdrant_status = "unreachable"

        embedding_status = "unknown"
        if probe_embedding:
            embedding_status = (
                "ok" if self.embedding_backend.is_reachable() else "unreachable"  # type: ignore[union-attr]
                if hasattr(self.embedding_backend, "is_reachable")
                else "unknown"
            )

        return {
            "qdrant": qdrant_status,
            "local_storage": "ok",
            "embedding_model": embedding_status,
            "cache": self.cache.stats().as_dict(),
            "collection": self.config.collection_name,
        }

    def clear_cache(self) -> None:
        """Drops every cached retrieval result — e.g. call this after
        a re-enrichment run so newly-updated payloads aren't masked by
        a stale cache entry for up to `cache_ttl_seconds`."""
        self.cache.clear()

    # --------------------------------------------------------
    # Lifecycle
    # --------------------------------------------------------

    def close(self) -> None:
        """Releases whatever's releasable. qdrant_client exposes its
        own .close(); LocalImageStorage/the embedding backend have
        nothing persistent to release (local storage is plain disk
        I/O, not a network client), so this is
        mostly future-proofing plus a single, obvious place to add
        real teardown if a later sprint's dependency needs it."""
        if self.qdrant_client is not None and hasattr(self.qdrant_client, "close"):
            try:
                self.qdrant_client.close()
            except Exception as exc:
                logger.debug("Error closing Qdrant client: %s", exc)

    def __enter__(self) -> "ImageService":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        self.close()

    # --------------------------------------------------------
    # Internal retrieval building blocks (Sprints 2-7)
    #
    # None of the methods below is called from retrieve() yet — see
    # this file's module docstring's Sprint 2-7 sections and ROADMAP.
    # All are private (leading underscore) because retrieve() is still
    # this service's only public retrieval surface; once orchestration
    # lands, these remain implementation details of it rather than
    # something a caller reaches for directly. Tests reach them
    # directly regardless — that's expected and is exactly why each is
    # independently correct and independently testable now, ahead of
    # that orchestration existing.
    # --------------------------------------------------------

    def _embed_query(self, query: str) -> list[float]:
        """Sprint 2 — Query Embedding. Converts a student's question
        into a vector in the same space as what's stored in Qdrant.

        Responsibilities, in order:
            1. Clean question    — _clean_query_text (whitespace
               normalization only; see its own docstring for why
               nothing heavier happens here).
            2. Generate embedding — self.embedding_backend(cleaned),
               the same OllamaEmbeddingBackend (or injected fake)
               Sprint 1 already constructed against config.
               embedding_model/config.ollama_url.
            3. Validate vector length — rejects an empty vector, and
               (when config.vector_dim is set) rejects one whose
               dimensionality doesn't match it. A silent dimension
               mismatch is exactly the kind of failure that would
               otherwise surface much later, as a confusing Qdrant
               error or — worse — a search that "succeeds" against
               the wrong dimensionality.
            4. Handle failures gracefully — every failure path above
               (empty query, backend exception, empty vector, wrong
               dimension) raises QueryEmbeddingError with a specific
               message, chained via `raise ... from exc` where there
               is an underlying exception. Nothing here lets a raw
               requests/network exception propagate to the caller
               unwrapped.

        Raises QueryEmbeddingError on any failure. Never returns an
        empty or wrong-length vector."""
        cleaned = _clean_query_text(query or "")
        if not cleaned:
            raise QueryEmbeddingError("Cannot embed an empty or whitespace-only query.")

        with timed(f"embed_query(len={len(cleaned)})"):
            try:
                vector = self.embedding_backend(cleaned)
            except QueryEmbeddingError:
                raise
            except Exception as exc:
                logger.warning("Query embedding failed for %r: %s", cleaned, exc)
                raise QueryEmbeddingError(
                    f"Failed to generate an embedding for the query ({exc})."
                ) from exc

        if not vector:
            raise QueryEmbeddingError(
                "Embedding backend returned an empty vector for the query."
            )

        if self.config.vector_dim and len(vector) != self.config.vector_dim:
            raise QueryEmbeddingError(
                f"Query embedding has {len(vector)} dimensions, expected "
                f"{self.config.vector_dim} (embedding_model="
                f"{self.config.embedding_model!r}). Check that "
                f"QDRANT_VECTOR_DIM/EMBEDDING_MODEL match what the "
                f"collection was built with."
            )

        logger.debug("Embedded query (chars=%d, dims=%d)", len(cleaned), len(vector))
        return vector

    def _search_qdrant(
        self,
        vector: list[float],
        *,
        limit: Optional[int] = None,
        query_filter: Optional[Any] = None,
        score_threshold: Optional[float] = None,
    ) -> list[RawCandidate]:
        """Sprint 3 — Candidate Retrieval. Runs one vector search
        against config.collection_name and returns each hit's raw
        payload, untouched.

        Responsibilities:
            - Vector search  — client.query_points(query=vector, ...)
              against the collection Sprint 1's config points at.
              (Older qdrant-client releases exposed this as
              client.search(); the installed client only has
              query_points(), whose response wraps hits in a
              `.points` list rather than returning them directly.)
            - Retrieve Top N — `limit`, defaulting to config.
              candidate_limit (20), clamped to
              [1, config.max_candidate_limit] the same way retrieve()
              already clamps top_k, so a bad caller-supplied limit
              raises ValueError rather than silently becoming 0 or an
              unbounded request.
            - Support metadata filter — `query_filter`, an already-
              built qdrant_client Filter (see _build_metadata_filter,
              or a caller may build its own and pass it directly).
              None means "no filter", matching every point in the
              collection.
            - Return raw payloads — each hit becomes a RawCandidate
              (id, score, payload) with payload copied verbatim from
              Qdrant. No reranking, deduplication, grouping, or field
              extraction happens here; that is explicitly out of
              scope for this sprint.

        Raises ImageServiceUnavailableError if there is no Qdrant
        client at all (construction-time degraded mode — see
        init_qdrant_client). Raises QdrantSearchError if a client
        exists but the search call itself fails. Raises ValueError for
        an invalid `vector` or `limit` before any network call is
        made."""
        if not vector:
            raise ValueError("_search_qdrant requires a non-empty query vector.")

        resolved_limit = limit if limit is not None else self.config.candidate_limit
        if not (1 <= resolved_limit <= self.config.max_candidate_limit):
            raise ValueError(
                f"limit must be between 1 and {self.config.max_candidate_limit}, "
                f"got {resolved_limit}."
            )

        if self.qdrant_client is None:
            raise ImageServiceUnavailableError(
                "Qdrant is unavailable — this ImageService is in degraded "
                "mode (see health_check()). Candidate retrieval requires a "
                "reachable Qdrant."
            )

        with timed(f"search_qdrant(limit={resolved_limit})"):
            try:
                response = self.qdrant_client.query_points(
                    collection_name=self.config.collection_name,
                    query=vector,
                    limit=resolved_limit,
                    query_filter=query_filter,
                    score_threshold=score_threshold,
                    with_payload=True,
                    with_vectors=False,
                )
            except Exception as exc:
                raise QdrantSearchError(
                    f"Qdrant search against collection={self.config.collection_name!r} "
                    f"failed: {exc}"
                ) from exc

        hits = response.points

        candidates = [
            RawCandidate(id=hit.id, score=hit.score, payload=dict(hit.payload or {}))
            for hit in hits
        ]
        logger.info(
            "Qdrant search returned %d point(s) (collection=%s, limit=%d, "
            "filtered=%s)",
            len(candidates), self.config.collection_name, resolved_limit,
            query_filter is not None,
        )
        return candidates

    def _normalize_candidates(
        self, raw_candidates: list[RawCandidate]
    ) -> list[Candidate]:
        """Sprint 4 — Candidate Normalization. Turns whatever
        _search_qdrant returned into one consistent schema, regardless
        of which metadata shape (legacy flat vs. current nested) or
        enrichment state each source point happens to be in — see this
        file's "CANDIDATE NORMALIZATION (Sprint 4)" section above for
        the two concrete ways that shape actually varies, confirmed
        against the real ingestion/enrichment code, and the
        module-level extraction helpers (_extract_page_number,
        _extract_visual_type, _extract_reference_label,
        _extract_caption, _extract_source, _extract_search_text,
        _extract_image) that each read defensively across both shapes.

        Every output Candidate has every field in the Sprint 4 brief
        (reference_label, page_number, caption, search_text,
        education_metadata, image, score, metadata) set to *something*
        — None/""/{} where a source point genuinely lacks the
        underlying data, never a missing attribute or a KeyError.
        `metadata` on the Candidate is payload["metadata"] itself
        (whichever shape it's in), not a re-normalized copy — later
        stages (Sprint 5's filtering in particular) read raw metadata
        fields like "subject"/"chapter" directly off it, the same way
        _build_metadata_filter already does.

        Does not drop, dedupe, or reorder candidates: one Candidate
        per RawCandidate, same order in, same order out. A malformed
        point (payload missing entirely, or `metadata` not a dict)
        degrades to a mostly-empty Candidate rather than raising —
        normalization's whole point is to make downstream code never
        have to special-case a bad point itself."""
        candidates: list[Candidate] = []

        for raw in raw_candidates:
            payload = raw.payload or {}
            metadata = payload.get("metadata")
            if not isinstance(metadata, dict):
                metadata = {}

            candidates.append(
                Candidate(
                    id=raw.id,
                    reference_label=_extract_reference_label(metadata),
                    page_number=_extract_page_number(metadata),
                    caption=_extract_caption(metadata),
                    search_text=_extract_search_text(payload, metadata),
                    education_metadata=payload.get("education_metadata") or {},
                    image=_extract_image(payload),
                    score=raw.score,
                    metadata=metadata,
                )
            )

        logger.info(
            "Normalized %d raw candidate(s) into %d Candidate(s)",
            len(raw_candidates), len(candidates),
        )
        return candidates

    def _apply_filters(
        self,
        candidates: list[Candidate],
        *,
        subject: Optional[str] = None,
        chapter: Optional[str] = None,
        chapter_number: Optional[int] = None,
        source: Optional[str] = None,
        visual_type: Optional[str] = None,
    ) -> list[Candidate]:
        """Sprint 5 — Metadata Filtering. Narrows an already-normalized
        candidate list using textbook metadata — subject, chapter,
        source, and (optional) visual type — with no ranking or
        reordering: candidates that pass keep their existing order and
        score untouched. This runs *after* _normalize_candidates, on
        Candidate.metadata (the raw payload metadata dict each
        Candidate still carries), not on the normalized convenience
        fields — "source" and "visual type" in particular have no
        direct Candidate field of their own, so they're re-derived
        per-candidate via the same _extract_source/_extract_visual_type
        helpers Sprint 4 uses, keeping exactly one place that knows how
        to read those fields across both metadata shapes.

        Every argument is optional and independent: only the filters a
        caller actually passes (non-None) are applied, AND-combined —
        the same "no filter given -> nothing is excluded" posture
        _build_metadata_filter already uses on the Qdrant side.
        Comparison is case-/whitespace-insensitive via _values_match;
        a candidate with the relevant field simply unset never matches
        a given filter value (unset is not treated as "matches
        anything").

        Passing no filters at all returns `candidates` (a new list,
        same items, same order) rather than special-casing "no-op" —
        callers don't need to check whether any filter was actually
        requested before calling this."""
        if (
            subject is None
            and chapter is None
            and chapter_number is None
            and source is None
            and visual_type is None
        ):
            return list(candidates)

        filtered: list[Candidate] = []
        for candidate in candidates:
            metadata = candidate.metadata or {}

            if subject is not None and not _values_match(metadata.get("subject"), subject):
                continue
            if chapter is not None and not _values_match(metadata.get("chapter"), chapter):
                continue
            if chapter_number is not None and metadata.get("chapter_number") != chapter_number:
                continue
            if source is not None and not _values_match(_extract_source(metadata), source):
                continue
            if visual_type is not None and not _values_match(
                _extract_visual_type(metadata), visual_type
            ):
                continue

            filtered.append(candidate)

        logger.info(
            "Applied filters (subject=%r, chapter=%r, chapter_number=%r, source=%r, "
            "visual_type=%r): %d candidate(s) -> %d",
            subject, chapter, chapter_number, source, visual_type,
            len(candidates), len(filtered),
        )
        return filtered

    def _find_by_reference_number(
        self,
        *,
        figure_number: Optional[str] = None,
        table_number: Optional[str] = None,
    ) -> list[Candidate]:
        """Sprint 6/12 — the shared scroll-and-normalize body behind
        an exact figure/table lookup, used both by
        _exact_reference_match (Sprint 6, given a number parsed out of
        free-text `query`) and directly by retrieve() (Sprint 12, when
        a caller already knows the figure_number/table_number it wants
        rather than typing it into a query string).

        Builds a query_filter via _build_metadata_filter(figure_number
        =...)/(table_number=...) and resolves it with a filter-only
        Qdrant scroll — not client.search() — since matching an exact
        figure/table number needs no query vector and therefore no
        embedding call at all. Every matching point (normally zero or
        one, but a collection could contain more than one visual
        sharing a figure number across chapters) is normalized via
        _normalize_candidates and returned as-is, with score fixed at
        EXACT_MATCH_SCORE rather than computed: an exact reference
        match isn't a similarity ranking, it's "this is the figure
        that was asked for".

        Returns [] immediately, with no Qdrant call, if neither
        figure_number nor table_number is given. Raises
        ImageServiceUnavailableError if there is no Qdrant client at
        all (construction-time degraded mode). Raises
        QdrantSearchError if a client exists but the scroll call
        itself fails. Returns [] — not an error — when no matching
        point exists in the collection; "if it exists" in Sprint 6's
        own goal statement means a nonexistent figure is a normal
        empty result, not a failure."""
        if not figure_number and not table_number:
            return []

        query_filter = _build_metadata_filter(
            figure_number=figure_number, table_number=table_number
        )

        if self.qdrant_client is None:
            raise ImageServiceUnavailableError(
                "Qdrant is unavailable — this ImageService is in degraded "
                "mode (see health_check()). Exact reference lookup requires "
                "a reachable Qdrant."
            )

        with timed(
            f"find_by_reference_number(figure_number={figure_number!r}, "
            f"table_number={table_number!r})"
        ):
            try:
                points, _next_offset = self.qdrant_client.scroll(
                    collection_name=self.config.collection_name,
                    scroll_filter=query_filter,
                    limit=self.config.max_candidate_limit,
                    with_payload=True,
                    with_vectors=False,
                )
            except Exception as exc:
                raise QdrantSearchError(
                    f"Qdrant scroll (exact reference lookup, figure_number="
                    f"{figure_number!r}, table_number={table_number!r}) "
                    f"against collection={self.config.collection_name!r} "
                    f"failed: {exc}"
                ) from exc

        raw_candidates = [
            RawCandidate(id=point.id, score=EXACT_MATCH_SCORE, payload=dict(point.payload or {}))
            for point in points
        ]

        logger.info(
            "Exact reference lookup (figure_number=%s, table_number=%s) "
            "matched %d point(s)",
            figure_number, table_number, len(raw_candidates),
        )
        return self._normalize_candidates(raw_candidates)

    def _exact_reference_match(self, query: str) -> list[Candidate]:
        """Sprint 6 — Exact Figure Retrieval.

        Logic, per this sprint's brief:
            Question -> Extract Figure ID -> Find exact match ->
            Return immediately

        Concretely:
            1. Extract Figure ID  — _extract_reference_query parses
               `query` for a "<kind> <number>" reference ("Figure
               1.3", "Fig 2.7", "Diagram 3.2", "Table 1.1"). Returns
               [] immediately if the text has no such reference at
               all — this method is only for exact-reference requests,
               not a fallback for ordinary semantic queries.
            2. Find exact match, return immediately — delegates to
               _find_by_reference_number (Sprint 12), passing the
               parsed number as a figure_number or table_number
               depending on `kind`. See that method's own docstring
               for the scroll/normalize/EXACT_MATCH_SCORE details.

        Returns [] — not an error — when the query has no parseable
        reference. See _find_by_reference_number for the remaining
        error/empty-result behavior."""
        parsed = _extract_reference_query(query or "")
        if parsed is None:
            logger.debug("No exact figure/table reference found in query=%r", query)
            return []

        kind, number = parsed
        if kind == "table":
            return self._find_by_reference_number(table_number=number)
        return self._find_by_reference_number(figure_number=number)

    def _educational_rerank(
        self, query: str, candidates: list[Candidate]
    ) -> list[Candidate]:
        """Sprint 7 — Educational Reranker. Recomputes
        Candidate.score for semantic educational queries ("Explain
        coordinates", "Show graph", "Show x-axis", "Cartesian plane")
        by combining vector similarity with the education_metadata
        signals enrichment attached — see this file's "EDUCATIONAL
        SIGNAL EXTRACTION (Sprint 7)" section above for exactly which
        keys each signal reads and why each is looked up permissively.

        Scoring model: vector similarity is a *floor*, not one term
        blended in among equals — every other signal below only ever
        adds a non-negative boost on top of it (see the loop), capped
        so the final score never exceeds 1.0. This is what makes the
        "never penalized for lacking enrichment" guarantee below
        actually hold, rather than just being a description of
        typical behavior.

        Signals, per this sprint's brief, each contributing a
        0.0-1.0 sub-score before weighting:
            - Vector similarity      — the candidate's incoming score,
              i.e. what _search_qdrant/_apply_filters already computed,
              clamped into [0, 1] (a safety net — this collection's
              COSINE distance already yields 0-1 similarity for
              non-negative embeddings, per this file's module
              docstring). Used as the floor described above, not
              multiplied down by a weight.
            - Retrieval keywords      — token-overlap between `query`
              and _extract_retrieval_keywords.
            - Curriculum topics       — token-overlap with
              _extract_curriculum_topics.
            - Learning objectives     — token-overlap with
              _extract_learning_objectives.
            - Student search examples — token-overlap with
              _extract_search_examples (these are *already* phrased
              like a student query, so this signal tends to be the
              most direct one when it's present).
            - Answerable queries      — token-overlap with
              _extract_answerable_queries.
            - Educational confidence  — _extract_educational_confidence,
              applied as a multiplier on the *boost* only (not on the
              vector-similarity floor), so a low-confidence enrichment
              damps how far its own signals can lift a candidate
              without ever dragging it below its vector similarity.

        A candidate with no education_metadata at all contributes 0.0
        boost from every keyword/topic/objective/example/answerable
        signal and None for confidence — its final score is then
        exactly its (clamped) vector similarity, unchanged: an
        unenriched candidate is never scored below what its vector
        similarity alone already says. Output Candidate.score values
        are not otherwise normalized against each other (e.g. not
        softmaxed) — only the ranking (the sort this method performs)
        is guaranteed meaningful, not the absolute score magnitude.

        Returns a new list, sorted by descending score; ties keep
        their relative input order (Python's sort is stable). Does not
        mutate `candidates` or any Candidate in it — Candidate is
        frozen, so reranked entries are built via
        dataclasses.replace(candidate, score=...). An empty
        `candidates` list returns []; a blank `query` degrades every
        text-overlap signal to 0.0 (there are no tokens to overlap),
        leaving vector similarity as the only surviving signal, same
        as an unenriched candidate."""
        if not candidates:
            return []

        query_tokens = _tokenize(query or "")

        # `vector_signal` is a floor, not one term among equals: every
        # other signal below only ever *adds* to it (see the loop),
        # so a candidate can't end up scoring below its own vector
        # similarity just for lacking enrichment data. `boost_weights`
        # sums to 0.60 — the maximum a perfectly-matching, fully-
        # confident enrichment can add on top of that floor.
        boost_weights = {
            "keywords": 0.15,
            "topics": 0.15,
            "objectives": 0.10,
            "search_examples": 0.15,
            "answerable": 0.05,
        }

        reranked: list[Candidate] = []
        for candidate in candidates:
            education_metadata = candidate.education_metadata or {}

            vector_signal = max(0.0, min(1.0, candidate.score))
            keyword_signal = _text_overlap_score(
                query_tokens, _extract_retrieval_keywords(education_metadata)
            )
            topic_signal = _text_overlap_score(
                query_tokens, _extract_curriculum_topics(education_metadata)
            )
            objective_signal = _text_overlap_score(
                query_tokens, _extract_learning_objectives(education_metadata)
            )
            search_example_signal = _text_overlap_score(
                query_tokens, _extract_search_examples(education_metadata)
            )
            answerable_signal = _text_overlap_score(
                query_tokens, _extract_answerable_queries(education_metadata)
            )

            boost = (
                boost_weights["keywords"] * keyword_signal
                + boost_weights["topics"] * topic_signal
                + boost_weights["objectives"] * objective_signal
                + boost_weights["search_examples"] * search_example_signal
                + boost_weights["answerable"] * answerable_signal
            )

            confidence = _extract_educational_confidence(education_metadata)
            if confidence is not None:
                # Confidence damps the boost only — an unconfident
                # enrichment shouldn't be able to lift a candidate as
                # far as a confident one making the same claims, but
                # it never drags the vector-similarity floor down.
                boost *= 0.5 + 0.5 * confidence  # multiplier in [0.5, 1.0]

            combined = min(1.0, vector_signal + boost)

            reranked.append(replace(candidate, score=combined))

        reranked.sort(key=lambda c: c.score, reverse=True)

        logger.info(
            "Educational rerank complete (query=%r, candidates=%d)",
            query, len(reranked),
        )
        return reranked

    def _group_candidates(self, candidates: list[Candidate]) -> list[CandidateGroup]:
        """Sprint 8 — Visual Grouping. Merges Candidates that belong
        to the same textbook figure into one CandidateGroup each —
        "One Figure -> Many Crops" — using _candidate_group_key's
        figure_number/table_number/panel_label+page_number/source_pdf
        priority (see that function's own docstring for the full
        rule).

        Returns one CandidateGroup per distinct key, in first-seen
        order (the order `candidates` itself was in — this method
        does no scoring or reordering of its own; that's Sprint 9's
        _rank_groups). Within each group, members are sorted by score
        descending so CandidateGroup.best is always correct without
        the group needing to re-sort itself later. A candidate with
        nothing tying it to any other (_candidate_group_key's
        `singleton` case) still becomes its own one-member group —
        every input Candidate ends up in exactly one output group,
        none dropped."""
        buckets: dict[tuple, list[Candidate]] = {}
        order: list[tuple] = []

        for candidate in candidates:
            key = _candidate_group_key(candidate)
            if key not in buckets:
                buckets[key] = []
                order.append(key)
            buckets[key].append(candidate)

        groups = [
            CandidateGroup(
                key=key,
                candidates=tuple(
                    sorted(buckets[key], key=lambda c: c.score, reverse=True)
                ),
            )
            for key in order
        ]

        logger.info(
            "Grouped %d candidate(s) into %d group(s)",
            len(candidates), len(groups),
        )
        return groups

    def _rank_groups(self, groups: list[CandidateGroup]) -> list[CandidateGroup]:
        """Sprint 9 — Group Ranking & Selection (ranking half).

        Responsibilities:
            - Group score      — _group_rank_score per group (best
              member's score plus a small multi-crop corroboration
              bonus, capped at 1.0).
            - Duplicate removal — _dedupe_groups, merging any groups
              Sprint 8's key priority didn't already collapse into
              one but that share the same (source, reference_label,
              page_number) identity.

        Not responsible for Top-K selection or thresholding — that's
        _select_groups, deliberately kept separate so a caller can
        rank without immediately committing to a top_k/threshold, or
        re-select at a different top_k from an already-ranked list
        without re-ranking.

        Returns a new list, sorted by _group_rank_score descending;
        ties keep their relative order from `groups` (stable sort).
        Does not mutate `groups` or any CandidateGroup in it
        (CandidateGroup is frozen; _dedupe_groups already returns new
        CandidateGroup instances for anything it merges)."""
        deduped = _dedupe_groups(groups)
        ranked = sorted(deduped, key=_group_rank_score, reverse=True)

        logger.info(
            "Ranked %d group(s) (deduped from %d)",
            len(ranked), len(groups),
        )
        return ranked

    def _select_groups(
        self,
        groups: list[CandidateGroup],
        *,
        top_k: Optional[int] = None,
        score_threshold: Optional[float] = None,
        relative_threshold: Optional[float] = None,
    ) -> list[CandidateGroup]:
        """Sprint 9 — Group Ranking & Selection (selection half).

        Responsibilities:
            - Top-K selection      — at most `top_k` groups (default
              config.default_top_k, same knob retrieve()'s own top_k
              argument already validates against config.max_top_k) —
              applied *after* thresholding, so a caller never gets
              padded out to top_k with groups that failed the score
              floor just to fill the count.
            - Adaptive thresholding — a group survives only if its
              score clears *both* an absolute floor
              (config.group_score_threshold) and an adaptive floor
              relative to the best group's own score
              (config.group_relative_threshold * groups[0].score) —
              see RETRIEVAL_GROUP_SCORE_THRESHOLD_DEFAULT's own
              comment (this file, CONFIGURATION section) for why both
              exist and why they're calibrated to _educational_rerank's
              0-1 scale specifically, not raw Qdrant cosine scores.

        `groups` is assumed already ranked (score descending) — call
        _rank_groups first; this method does not re-sort, only
        filters and truncates, so its own output stays in whatever
        order `groups` arrived in.

        Exact-match safety net: a group _group_is_exact_match
        recognizes (Sprint 6 — its best member's score is exactly
        EXACT_MATCH_SCORE) always survives both threshold checks,
        regardless of where it sits relative to everything else. This
        is the fix for the failure mode a threshold-based selector
        would otherwise have: Sprint 6's whole contract is "a request
        for a figure that exists always returns it", and a relative
        threshold keyed off the *other* groups' scores could otherwise
        reject an exact match sitting in an otherwise weak result set
        purely because nothing else scored comparably. An exact match
        never needs "comparably" — it's not competing on similarity.

        Returns []  for an empty `groups`, without touching
        `top_k`/thresholds at all."""
        if not groups:
            return []

        resolved_top_k = top_k if top_k is not None else self.config.default_top_k
        resolved_score_threshold = (
            score_threshold if score_threshold is not None
            else self.config.group_score_threshold
        )
        resolved_relative_threshold = (
            relative_threshold if relative_threshold is not None
            else self.config.group_relative_threshold
        )

        top_score = groups[0].score
        adaptive_floor = top_score * resolved_relative_threshold

        selected: list[CandidateGroup] = []
        for group in groups:
            if _group_is_exact_match(group):
                selected.append(group)
                continue
            if group.score < resolved_score_threshold:
                continue
            if group.score < adaptive_floor:
                continue
            selected.append(group)

        truncated = selected[:resolved_top_k]

        logger.info(
            "Selected %d group(s) from %d (top_k=%d, score_threshold=%.3f, "
            "relative_threshold=%.3f, adaptive_floor=%.3f)",
            len(truncated), len(groups), resolved_top_k,
            resolved_score_threshold, resolved_relative_threshold, adaptive_floor,
        )
        return truncated

    def _resolve_image_url(self, image: dict) -> Optional[str]:
        """Sprint 10 — Local Storage Resolution. Turns a Candidate's
        `image` dict (storage_key/public_url/crop_path — see
        _extract_image) into a URL the tutor/frontend can actually
        load, always resolving through LocalImageStorage
        (core/local_image_storage.py) — the only storage backend this
        deployment has.

        Preference order:
            1. `storage_key`, resolved against LocalImageStorage —
               checked for a real file on disk (not just "a URL string
               was built") before it's trusted.
            2. `public_url` already sitting in the payload — kept for
               older records whose storage_key no longer resolves
               (e.g. re-ingested under a different key since).
            3. `crop_path`, the ingestion-time-only local path, as a
               last resort.

        LocalImageStorage.generate_signed_url()/public_url() return a
        plain, non-expiring URL (see that method's own docstring —
        there's no real signing on local disk, and this codebase's
        static `/local-media` mount has no access control of its own),
        so callers must not treat the result as cryptographically
        signed or time-limited the way an object-storage presigned URL
        would be.

        Returns None if `image` is empty/falsy or none of the above
        yields anything usable."""
        if not image:
            return None

        storage_key = image.get("storage_key")

        if storage_key:
            try:
                if self.local_storage.object_exists(storage_key):
                    return self.local_storage.public_url(storage_key)
            except Exception:
                logger.exception("Local storage lookup failed for storage_key=%r", storage_key)

        public_url = image.get("public_url")
        if public_url:
            return public_url.split("?")[0]

        return image.get("crop_path")

    def _resolve_group_images(self, group: CandidateGroup) -> list[dict]:
        """Sprint 12 (widened schema) — the frontend's multi-crop
        gallery for one figure. Resolves *every* candidate in the
        group (not just group.best) through _resolve_image_url,
        deduplicating by resolved URL/path so a candidate that
        happens to share its image with a sibling crop isn't shown
        twice — mirrors streamlit_app.py's own seen_image_paths
        dedup, just done once here instead of on every render. Each
        entry is `{"image_path": <url-or-path>, "caption": ...}` —
        the key is named `image_path` (not `image_url`) to match the
        key streamlit_app.py's render_chat_figures already reads;
        callers should treat the value as opaque (it may be a local
        storage URL, not a filesystem path — see _resolve_image_url). A
        candidate whose image can't be resolved at all is skipped
        rather than included with a None path."""
        images: list[dict] = []
        seen: set[str] = set()
        for candidate in group.candidates:
            resolved = self._resolve_image_url(candidate.image)
            logger.info(
                "Resolved image for reference_label=%r: %r (from image=%r)",
                group.reference_label, resolved, candidate.image,
            )
            if not resolved or resolved in seen:
                continue
            seen.add(resolved)
            images.append(
                {
                    "image_path": resolved,
                    "caption": candidate.caption or group.reference_label,
                }
            )
        return images

    def _build_figure_objects(
        self, groups: list[CandidateGroup]
    ) -> list[dict]:
        """Sprint 11 — Figure Object Builder. Converts a *selected*
        list[CandidateGroup] (Sprint 9's _select_groups output) into
        the response shape this service exposes to everything
        downstream. This is the only structure the Tutor Engine or
        the Streamlit frontend is meant to depend on; neither should
        ever see a Candidate, a CandidateGroup, or a raw Qdrant
        payload.

        Widened (Sprint 12 integration) beyond Sprint 11's original
        minimal brief to also carry what the existing consumers
        actually read — tutor_engine.py's _build_figure_context()
        (subject/chapter/visual_type/visual_subtype/teaches/
        curriculum_topics/learning_objectives/visible_entities/
        concept_relationships/pedagogical_value, used to build the
        LLM's prompt context) and streamlit_app.py's
        render_chat_figures() (images/group_size, used to render a
        multi-crop gallery per figure). The original minimal fields
        (figure_id/reference_label/page_number/caption/image_url/
        grounded_description/student_explanation/score) are all still
        present and unchanged — this is a superset, not a
        replacement.

        Every scalar field is derived from the group's *best*
        candidate (`group.best`) except:
            - `score`, which uses _group_rank_score (the value
              Sprint 9 actually ranked and thresholded groups on) so
              the number in the response matches the number that
              decided whether this figure was included at all, rather
              than the raw single-crop score CandidateGroup.score
              exposes.
            - `images`/`group_size`, which cover every candidate in
              the group (_resolve_group_images), not just the best
              one — that's the whole point of the multi-crop gallery.

        Returns [] for an empty `groups`. One dict per group, in the
        same order `groups` arrived in — this method does no ranking
        or filtering of its own, that's already done by the time a
        caller reaches this stage."""
        if not groups:
            return []

        figures: list[dict] = []
        for group in groups:
            best = group.best
            metadata = best.metadata or {}
            education_metadata = best.education_metadata or {}
            images = self._resolve_group_images(group)

            figures.append(
                {
                    # --- Sprint 11 core fields ---
                    "figure_id": _build_figure_id(group),
                    "reference_label": group.reference_label,
                    "page_number": group.page_number,
                    "caption": group.caption,
                    "image_url": self._resolve_image_url(best.image),
                    "grounded_description": _extract_grounded_description(
                        education_metadata
                    ),
                    "student_explanation": _extract_student_explanation(
                        education_metadata
                    ),
                    "score": round(_group_rank_score(group), 4),
                    # --- widened for tutor_engine.py's prompt context ---
                    "subject": metadata.get("subject"),
                    "chapter": metadata.get("chapter"),
                    "visual_type": _extract_visual_type(metadata),
                    "visual_subtype": _extract_visual_subtype(metadata),
                    "teaches": _extract_teaches(education_metadata),
                    "curriculum_topics": _extract_curriculum_topics(
                        education_metadata
                    ),
                    "learning_objectives": _extract_learning_objectives(
                        education_metadata
                    ),
                    "visible_entities": _extract_visible_entities(
                        education_metadata
                    ),
                    "concept_relationships": _extract_concept_relationships(
                        education_metadata
                    ),
                    "pedagogical_value": _extract_pedagogical_value(
                        education_metadata
                    ),
                    # --- widened for streamlit_app.py's gallery UI ---
                    "images": images,
                    "group_size": len(images),
                }
            )

        logger.info(
            "Built %d figure object(s) from %d selected group(s)",
            len(figures), len(groups),
        )
        return figures

    # --------------------------------------------------------
    # Public API
    # --------------------------------------------------------

    def retrieve(
        self,
        query: Optional[str] = None,
        *,
        top_k: Optional[int] = None,
        figure_number: Optional[str] = None,
        table_number: Optional[str] = None,
        subject: Optional[str] = None,
        chapter: Optional[str] = None,
        chapter_number: Optional[int] = None,
        filters: Optional[dict] = None,
        use_cache: bool = True,
    ) -> list[dict]:
        """Retrieves the most relevant textbook visual(s), as a
        list[dict] in the Sprint 11 figure-object shape — the only
        structure this service ever hands back (see this file's
        module docstring, Sprint 11, for the exact fields).

        Orchestration (Sprint 12), per this file's own module-level
        architecture diagram:

            1. Explicit figure match — an explicit figure_number/
               table_number, or one parsed out of `query`
               (_exact_reference_match, Sprint 6), is tried first via
               _find_by_reference_number. A subject/chapter filter is
               applied to whatever it finds (_apply_filters, Sprint
               5).
            2. Fallback to semantic retrieval — if step 1 found
               nothing (no reference in `query`, no matching point, or
               a subject/chapter filter emptied the match) and a
               `query` was given, retrieve() falls back to the full
               semantic path: _embed_query (Sprint 2) -> _search_qdrant
               with a Qdrant-side subject/chapter/extra-filters filter
               (Sprint 3) -> _normalize_candidates (Sprint 4) ->
               _apply_filters again, defense-in-depth against a
               payload the Qdrant-side filter didn't catch (Sprint 5)
               -> _educational_rerank (Sprint 7).
            3. Visual grouping & selection — whichever candidates step
               1 or 2 produced go through _group_candidates (Sprint
               8), _rank_groups (Sprint 9), and _select_groups (Sprint
               9), which applies `top_k` and score thresholding — the
               latter never rejects an exact match (Sprint 6's
               guarantee).
            4. Figure objects — _build_figure_objects (Sprint 11)
               resolves each selected group's image through local
               storage (Sprint 10, inside that method) and returns the
               final list[dict].

        Raises ValueError for invalid arguments (neither `query` nor
        `figure_number`/`table_number` given, or `top_k` out of
        range). Propagates ImageServiceUnavailableError/
        QdrantSearchError/QueryEmbeddingError from whichever stage
        above hits a real failure — retrieve() itself does not
        swallow those; a caller that wants a soft-fail (e.g. main.py
        falling back to text-only generation) catches them at the
        call site.

        Successful results are cached under request.cache_key when
        `use_cache` is True (the default); an empty result — a
        genuinely unmatched query — is cached too, so a repeated
        miss doesn't re-run the whole pipeline within the cache's
        TTL."""
        if not query and not figure_number and not table_number:
            raise ValueError(
                "retrieve() needs at least one of: query, figure_number, "
                "table_number."
            )

        resolved_top_k = top_k if top_k is not None else self.config.default_top_k
        if not (1 <= resolved_top_k <= self.config.max_top_k):
            raise ValueError(
                f"top_k must be between 1 and {self.config.max_top_k}, "
                f"got {resolved_top_k}."
            )

        request = RetrievalRequest(
            query=query.strip() if query else None,
            top_k=resolved_top_k,
            figure_number=figure_number,
            table_number=table_number,
            subject=subject,
            chapter=chapter,
            chapter_number=chapter_number,
            filters=dict(filters or {}),
            use_cache=use_cache,
        )

        logger.info(
            "retrieve() called (query=%r, figure_number=%r, table_number=%r, "
            "subject=%r, chapter=%r, chapter_number=%r, top_k=%d, use_cache=%s)",
            request.query, request.figure_number, request.table_number,
            request.subject, request.chapter, request.chapter_number,
            request.top_k, request.use_cache,
        )

        if request.use_cache:
            cached = self.cache.get(request.cache_key)
            if cached is not None:
                logger.debug("Retrieval cache hit (key=%s)", request.cache_key)
                return cached
            logger.debug("Retrieval cache miss (key=%s)", request.cache_key)

        # --- Step 1: explicit figure match -----------------------
        candidates: list[Candidate] = []
        if request.figure_number or request.table_number:
            candidates = self._find_by_reference_number(
                figure_number=request.figure_number,
                table_number=request.table_number,
            )
        elif request.query:
            candidates = self._exact_reference_match(request.query)

        if candidates:
            candidates = self._apply_filters(
                candidates,
                subject=request.subject,
                chapter=request.chapter,
                chapter_number=request.chapter_number,
            )

        # --- Step 2: fallback to semantic retrieval ---------------
        if not candidates and request.query:
            vector = self._embed_query(request.query)
            query_filter = _build_metadata_filter(
                subject=request.subject,
                chapter=request.chapter,
                chapter_number=request.chapter_number,
                extra=request.filters or None,
            )
            raw_candidates = self._search_qdrant(vector, query_filter=query_filter)
            candidates = self._normalize_candidates(raw_candidates)
            candidates = self._apply_filters(
                candidates,
                subject=request.subject,
                chapter=request.chapter,
                chapter_number=request.chapter_number,
            )
            candidates = self._educational_rerank(request.query, candidates)

        # --- Step 3: visual grouping, ranking, selection ----------
        groups = self._group_candidates(candidates)
        ranked_groups = self._rank_groups(groups)
        selected_groups = self._select_groups(ranked_groups, top_k=request.top_k)

        # --- Step 4: Local storage resolution + figure object builder ---
        figures = self._build_figure_objects(selected_groups)

        if request.use_cache:
            self.cache.set(request.cache_key, figures)

        logger.info(
            "retrieve() returning %d figure(s) (query=%r, figure_number=%r, "
            "table_number=%r)",
            len(figures), request.query, request.figure_number,
            request.table_number,
        )
        return figures


__all__ = [
    "ImageService",
    "ImageServiceConfig",
    "load_config",
    "ImageServiceError",
    "ImageServiceConfigError",
    "ImageServiceUnavailableError",
    "QueryEmbeddingError",
    "QdrantSearchError",
    "init_logging",
    "timed",
    "init_qdrant_client",
    "EmbeddingBackend",
    "OllamaEmbeddingBackend",
    "init_embedding_backend",
    "RetrievalCache",
    "CacheStats",
    "build_cache_key",
    "RetrievalRequest",
    "RawCandidate",
    "Candidate",
    "_clean_query_text",
    "_build_metadata_filter",
    "_values_match",
    "_extract_reference_query",
    "QDRANT_URL",
    "IMAGE_COLLECTION",
    "QDRANT_VECTOR_DIM",
    "OLLAMA_URL",
    "EMBEDDING_MODEL",
    "RETRIEVAL_TOP_K_DEFAULT",
    "RETRIEVAL_TOP_K_MAX",
    "RETRIEVAL_CACHE_MAX_SIZE",
    "RETRIEVAL_CACHE_TTL_SECONDS",
    "RETRIEVAL_CANDIDATE_LIMIT_DEFAULT",
    "RETRIEVAL_CANDIDATE_LIMIT_MAX",
]


if __name__ == "__main__":
    # Sprint 1 smoke test: construct the service against whatever the
    # environment actually points at, and print what initialized —
    # nothing here performs retrieval (see retrieve()'s docstring).
    init_logging()
    service = ImageService()
    print(json.dumps(service.config.redacted(), indent=2))
    print(json.dumps(service.health_check(), indent=2))