"""
core/image_chat.py

Turns a student's AI Tutor chat image attachment into a text description.
First attempts fast, high-accuracy vision inference via Google Gemini Vision
(using active provider keys from core/llm_provider.py), falling back to the
local Ollama vision backend (OllamaPageVisionReader) if Gemini is unavailable
or fails.

Ensures vision descriptions (including math notation, printed text, and diagrams)
are never dropped even if non-JSON format is returned.
"""

from __future__ import annotations

import io
import json
import logging
import re
from PIL import Image

from core.sample_paper_extraction import OllamaPageVisionReader, VisionReadBackend
import core.llm_provider as llm_provider

logger = logging.getLogger(__name__)

_DESCRIBE_IMAGE_PROMPT = (
    "You are an expert AI tutor looking at an image of a question paper or textbook page attached by a student.\n"
    "Transcribe and describe everything on the page clearly and thoroughly:\n"
    "1. Transcribe all questions, printed/handwritten text, mathematical formulas, equations, numbers, and multiple choice options (a, b, c, d) exactly as written.\n"
    "2. Describe any diagrams, graphs, figures, or geometric shapes in detail.\n"
    "Respond with ONLY a JSON object of the exact shape: {\"description\": \"<your detailed text and math transcription>\"}, no other text."
)


def _describe_with_gemini(image: Image.Image, prompt: str) -> str | None:
    """Fast, high-accuracy cloud vision read using Google Gemini Vision."""
    try:
        provider, candidates = llm_provider._get_candidates()
        if provider not in ("gemini", "google") or not candidates:
            return None

        from google import genai
        from google.genai import types as genai_types

        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="JPEG")
        image_bytes = buffer.getvalue()

        for key in candidates:
            api_key = key.get("api_key")
            if not api_key:
                continue
            try:
                client = genai.Client(api_key=api_key)
                model_name = key.get("model") or "gemini-2.5-flash"
                res = client.models.generate_content(
                    model=model_name,
                    contents=[
                        genai_types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                        prompt,
                    ],
                )
                if res and res.text:
                    logger.info("Successfully described chat image using Gemini Vision model %s", model_name)
                    return res.text
            except Exception as e:
                logger.warning("Gemini vision attempt failed on key %s: %s", key.get("id"), e)
                continue
    except Exception as e:
        logger.debug("Gemini vision fallback unavailable: %s", e)
    return None


def describe_attached_image(image: Image.Image, *, backend: VisionReadBackend | None = None) -> str:
    """Never raises — turns an attached question paper image into detailed text/math transcription."""
    raw: str | None = None

    # 1. Try Gemini Vision first if active (fast ~1.5s & highly accurate on math & question paper images)
    try:
        raw = _describe_with_gemini(image, _DESCRIBE_IMAGE_PROMPT)
    except Exception:
        raw = None

    # 2. Fallback to local Ollama vision backend if Gemini was not available or failed
    if not raw:
        backend = backend or OllamaPageVisionReader()
        try:
            raw = backend(image, _DESCRIBE_IMAGE_PROMPT)
        except Exception:
            logger.exception("Vision backend call failed describing a chat image")
            return ""

    if not raw or not isinstance(raw, str):
        return ""

    # Clean markdown json blocks if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()

    try:
        data = json.loads(cleaned)
        description = data.get("description") or raw
    except json.JSONDecodeError:
        # Fallback to raw text when JSON parse fails — do NOT drop valid vision output!
        description = raw

    return description.strip() if isinstance(description, str) else ""

