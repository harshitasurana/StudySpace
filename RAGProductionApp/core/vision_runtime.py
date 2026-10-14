"""
core/vision_runtime.py

Sprint 16 — Vision Runtime Abstraction.

Small, reusable infrastructure component that sits between any vision
model caller (Qwen validation today; quiz generation, diagram
explanation, image-based Q&A, etc. tomorrow) and whatever backend
actually serves the model — Ollama today, potentially LM Studio, vLLM,
or a hosted API later.

It owns exactly one concern: deciding whether a vision model call
should run on CPU or GPU (or be left to the backend's own default),
and exposing that decision plus which host/model to talk to. It does
NOT talk to any backend itself, parse model output, or know anything
about validation, OCR, or the rest of the ingestion pipeline — callers
still own their own HTTP call; this module only tells them *how* and
*where* to shape it. Nothing in its public API is Ollama-specific, so
swapping backends later doesn't mean redesigning this module.

    Visual Candidate
          |
          v
    Vision Runtime   <-- this module (mode resolution + diagnostics)
          |
          v
       backend (Ollama, ...)
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# ============================================================
# Supported modes
# ============================================================

SUPPORTED_MODES = ("cpu", "gpu", "auto")
DEFAULT_MODE = "gpu"

DEFAULT_HOST = "http://192.168.0.192:11434"
DEFAULT_MODEL = ""  # deliberately no hardcoded model name — see VisionRuntime.model


def _resolve_mode(requested: str) -> tuple[str, str]:
    """Turn the requested mode into the effective mode plus a
    human-readable reason for the log line. Never raises: an
    unrecognized value falls back to DEFAULT_MODE rather than taking
    down pipeline startup over a typo in `.env`.

    No hardware probing happens here, deliberately:
      - cpu  -> force CPU
      - gpu  -> allow GPU (no override)
      - auto -> send no override at all and let the backend apply its
                own default device selection. This intentionally does
                NOT try to detect a GPU itself (e.g. via torch) —
                what a Python-level library reports and what the
                serving backend (Ollama, etc.) actually decides to
                use are two different, sometimes contradictory,
                things. "auto" trusts the backend, not a guess.
    """
    normalized = (requested or "").strip().lower()

    if normalized not in SUPPORTED_MODES:
        logger.warning(
            "VISION_RUNTIME=%r is not one of %s — falling back to %r",
            requested, SUPPORTED_MODES, DEFAULT_MODE,
        )
        return DEFAULT_MODE, f"invalid value {requested!r}, defaulted to {DEFAULT_MODE}"

    if normalized == "auto":
        return "auto", "no override — backend's own default device selection"

    return normalized, "explicit configuration"


# ============================================================
# Backend request options per mode
#
# Ollama's /api/chat and /api/generate accept an "options" object on
# every request. num_gpu is the documented knob for how many layers
# Ollama offloads to GPU — 0 forces a pure-CPU run regardless of what
# hardware Ollama can see, which is exactly the "GPU vision inference
# fails, CPU works" situation this sprint exists for. gpu/auto pass no
# override, so the backend's own default device selection applies.
#
# If a future backend besides Ollama is wired in, this is the one map
# that needs a backend-specific variant — request_options() itself
# stays the same shape (a dict to merge into the request).
# ============================================================

_MODE_REQUEST_OPTIONS: dict[str, dict] = {
    "cpu": {"num_gpu": 0},
    "gpu": {},
    "auto": {},
}


@dataclass
class VisionRuntime:
    """Runtime-selection abstraction layer between a vision validator
    (or any future vision-model caller) and the backend serving the
    model.

    Usage:
        runtime = VisionRuntime()                     # reads VISION_RUNTIME/OLLAMA_HOST/VISION_MODEL from env
        runtime = VisionRuntime(requested_mode="cpu")  # explicit override

        runtime.mode              -> "cpu" | "gpu" | "auto"
        runtime.host              -> backend URL (e.g. Ollama host)
        runtime.model             -> vision model name
        runtime.request_options() -> dict to merge into the backend request body
        runtime.describe()        -> dict, for startup / diagnostics logging
        runtime.log_startup()     -> prints + logs the selected runtime once
    """

    requested_mode: str = field(default_factory=lambda: os.getenv("VISION_RUNTIME", DEFAULT_MODE))
    host: str = field(default_factory=lambda: os.getenv("OLLAMA_HOST", DEFAULT_HOST))
    model: str = field(default_factory=lambda: os.getenv("VISION_MODEL", DEFAULT_MODEL))
    mode: str = field(init=False)
    reason: str = field(init=False)

    def __post_init__(self) -> None:
        self.mode, self.reason = _resolve_mode(self.requested_mode)

    # --------------------------------------------------------
    # What the validator/backend actually consumes
    # --------------------------------------------------------
    def request_options(self) -> dict:
        """Options dict to merge into the backend request body (e.g.
        Ollama's /api/chat "options" field). Returns a copy so callers
        can safely mutate it (e.g. add their own temperature/seed)
        without affecting this runtime's own state.
        """
        return dict(_MODE_REQUEST_OPTIONS.get(self.mode, {}))

    @property
    def is_cpu(self) -> bool:
        return self.mode == "cpu"

    @property
    def is_gpu(self) -> bool:
        return self.mode == "gpu"

    @property
    def is_auto(self) -> bool:
        return self.mode == "auto"

    # --------------------------------------------------------
    # Diagnostics
    # --------------------------------------------------------
    def describe(self) -> dict:
        return {
            "requested": self.requested_mode,
            "resolved": self.mode,
            "reason": self.reason,
            "host": self.host,
            "model": self.model,
            "request_options": self.request_options(),
        }

    def log_startup(self) -> None:
        """Print + log the selected runtime once, at pipeline startup,
        so it's obvious from the console which mode/model/host a run
        used without having to inspect `.env` or step through the
        debugger — useful to glance at during a long ingestion run."""
        info = self.describe()
        logger.info(
            "Vision Runtime: mode=%s model=%s host=%s (requested=%s, %s), request_options=%s",
            info["resolved"], info["model"], info["host"],
            info["requested"], info["reason"], info["request_options"],
        )

        bar = "=" * 38
        print(bar)
        print("Vision Runtime")
        print(bar)
        print()
        print(f"Runtime  : {info['resolved'].upper()}")
        print(f"Model    : {info['model'] or '(not set)'}")
        print(f"Host     : {info['host']}")
        print(f"Reason   : {info['reason'].capitalize()}")
        print()
        print(bar)


def get_vision_runtime(
    mode: Optional[str] = None,
    *,
    host: Optional[str] = None,
    model: Optional[str] = None,
) -> VisionRuntime:
    """Convenience factory. Any argument left as None reads its value
    from the environment (via VisionRuntime's own default_factory);
    pass explicit values to override — e.g. from an already-loaded
    PipelineConfig, so env vars are only ever read once and the
    runtime always agrees with the rest of the pipeline's config."""
    kwargs = {}
    if mode is not None:
        kwargs["requested_mode"] = mode
    if host is not None:
        kwargs["host"] = host
    if model is not None:
        kwargs["model"] = model
    return VisionRuntime(**kwargs)


__all__ = [
    "SUPPORTED_MODES",
    "DEFAULT_MODE",
    "VisionRuntime",
    "get_vision_runtime",
]