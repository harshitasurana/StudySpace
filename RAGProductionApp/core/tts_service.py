import io
import os
import re
import wave

from piper import PiperVoice

# One downloaded voice for Phase 1 — no per-student/per-language choice
# yet (see the deferred sections of the voice plan). Model files are
# checked into voice_models/piper/ (a one-time ~60MB download from the
# rhasspy/piper-voices repo, not pip-installable), path overridable via
# env var so a different local voice can be swapped in without a code
# change.
PIPER_VOICE_MODEL_PATH = os.getenv(
    "PIPER_VOICE_MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "..", "voice_models", "piper", "en_US-lessac-medium.onnx"),
)

# Loaded once at import time — same reasoning as stt_service.py's
# module-level WhisperModel singleton.
_voice = PiperVoice.load(PIPER_VOICE_MODEL_PATH)


def _strip_markdown_for_speech(text: str) -> str:
    """Defensive cleanup, not the primary defense — VOICE_RESPONSE_INSTRUCTIONS
    (core/prompts.py) already tells the model not to use markdown for a
    voice response, and testing showed that mostly works (no more "##"
    headers, no invented image links), but a local model doesn't follow
    it perfectly every time (an occasional stray "*" bullet still slips
    through). Rather than keep tightening the prompt indefinitely, strip
    whatever markdown syntax survives before it ever reaches Piper —
    Piper would otherwise read the literal symbol aloud (e.g. "asterisk
    The first quadrant..."), which sounds broken regardless of how good
    the prompt gets."""
    # Markdown images/links: ![alt](url) or [text](url) -> just the alt/
    # link text, since that's the only part meant to be heard.
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", text)
    # Heading markers ("## Definition" -> "Definition").
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    # List bullets at the start of a line ("* ", "- ", "• ") — stripped
    # BEFORE the bold/italic pass below, so a bullet's leading "*" can
    # never be mistaken for the opening half of a "*italic*" pair with
    # some later "*" on the same line.
    text = re.sub(r"^\s*[*\-•]\s+", "", text, flags=re.MULTILINE)
    # Bold/italic markers ("**word**"/"*word*"/"_word_" -> "word").
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"[*_]([^*_]+)[*_]", r"\1", text)
    # Any markdown symbols that are still standalone after the above.
    text = re.sub(r"[#*_`]", "", text)
    # Collapse the blank lines/extra whitespace list-stripping tends to
    # leave behind into normal sentence spacing.
    text = re.sub(r"\n{2,}", ". ", text)
    text = re.sub(r"\s+", " ", text).strip()
    # A stripped heading/list line often already ended in its own
    # period right before this pass added another one ("+, +).. Figure").
    text = re.sub(r"\.\s*\.", ".", text)
    return text


def synthesize_speech(text: str) -> bytes:
    """Synthesizes text into WAV audio bytes, entirely in memory (no
    temp file — Piper's own synthesize_wav writes into any wave.Wave_write
    target, and a BytesIO-backed one never touches disk). Raises on
    failure; the Node voice_service.js caller already treats generation
    failures as real errors (same posture as every other AI-service call
    in this app), not something to silently swallow into empty audio."""
    clean_text = _strip_markdown_for_speech(text)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        _voice.synthesize_wav(clean_text, wav_file)
    return buffer.getvalue()
