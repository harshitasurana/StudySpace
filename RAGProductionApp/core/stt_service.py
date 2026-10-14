import logging
import math
import os

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

# CPU by default — this machine's GPU is already shared with Ollama for
# the actual tutor generation call, and Phase 1 (push-to-talk, one
# utterance at a time, no live streaming) has no latency requirement
# tight enough to justify contending for that VRAM. "base" is the
# smallest model that still gives reliable English transcription;
# revisit both choices together if voice latency ever becomes the
# bottleneck. Both are real env vars (not hardcoded) so this can be
# tuned without a code change once real usage data exists.
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

# Loaded once at import time, not per-request — the model itself is the
# expensive part to initialize; the Celery worker process never imports
# this module (STT is FastAPI-only, no background task), so there's no
# multi-process duplication to worry about here the way slide_deck_images
# / mindmap_images's own module-level singletons already had to reason
# about for ImageService.
_model = WhisperModel(WHISPER_MODEL_SIZE, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE_TYPE)


def transcribe_audio(file_path: str) -> dict:
    """Transcribes one recorded utterance (a short push-to-talk audio
    file, already written to disk by the caller) into text. Returns
    {"text", "language", "confidence"} — confidence is faster-whisper's
    own average log-probability across segments, converted from log-
    space to a rough 0-1 scale (exp), not a calibrated probability;
    good enough to flag a clearly bad transcription, not precise beyond
    that. An empty/silent recording legitimately produces an empty
    "text" — the caller (voice_service.js on the Node side) is what
    decides that's not worth sending to the tutor, not this function."""
    segments, info = _model.transcribe(file_path, beam_size=5)
    segments = list(segments)

    text = " ".join(seg.text.strip() for seg in segments).strip()

    if segments:
        avg_logprob = sum(seg.avg_logprob for seg in segments) / len(segments)
        confidence = round(min(1.0, max(0.0, math.exp(avg_logprob))), 2)
    else:
        confidence = 0.0

    return {
        "text": text,
        "language": info.language,
        "confidence": confidence,
    }
