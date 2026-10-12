"""
Shared LLM provider abstraction: routes text-chat completions through
whichever cloud/local provider the Admin UI has set as "active" (Google
Gemini, OpenAI, Anthropic, Mistral, Groq, Together AI, DeepSeek,
OpenRouter, Ollama, LM Studio, vLLM), falling back to the existing local
Ollama call at every call site when no keys are active for that provider
or every configured key fails.

Deliberately has ZERO import-time side effects (no HTTP call, no client
construction at module load) — several Celery task modules
(mindmap_tasks.py, slide_deck_tasks.py, infographic_tasks.py) instantiate
TutorEngine() at module import time, and those modules get re-imported on
every Celery worker fork. Anything eager here would run on every fork too.
"""

import logging
import os
import threading
import time

import requests

logger = logging.getLogger(__name__)

NODE_BACKEND_ORIGIN = os.getenv("NODE_BACKEND_ORIGIN")
AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY")

# Fallback model when a key row's own `model` field is blank — matches
# this provider's pre-multi-provider default so existing Gemini keys
# saved before the model column existed keep working unchanged.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
PROVIDER_KEYS_CACHE_TTL_SECONDS = int(os.getenv("GEMINI_KEYS_CACHE_TTL_SECONDS", "60"))
PROVIDER_KEY_COOLDOWN_SECONDS = int(os.getenv("GEMINI_KEY_COOLDOWN_SECONDS", "120"))

# Well-known default base_url per OpenAI-compatible provider — used only
# when the admin left a key's own base_url blank. Must mirror
# ai_provider_catalog.js's defaultBaseUrl exactly (kept in sync by hand).
DEFAULT_BASE_URLS = {
    "openai": None,  # None -> openai SDK's own default (api.openai.com)
    "mistral": "https://api.mistral.ai/v1",
    "groq": "https://api.groq.com/openai/v1",
    "together": "https://api.together.xyz/v1",
    "deepseek": "https://api.deepseek.com",
    "openrouter": "https://openrouter.ai/api/v1",
    "ollama": "http://localhost:11434/v1",
    "lm_studio": "http://localhost:1234/v1",
    "vllm": None,  # no sane default — admin must set one
}

# Providers with their own SDK/wire format, dispatched separately below.
# Every other provider code goes through the single OpenAI-compatible
# client path (openai, mistral, groq, together, deepseek, openrouter,
# ollama, lm_studio, vllm, and anything else added to the catalog later).
_GEMINI_PROVIDERS = {"gemini", "google"}
_ANTHROPIC_PROVIDERS = {"anthropic"}


class LLMUnavailable(Exception):
    """Raised when the active cloud/local provider should not be used
    right now (no active keys configured for it, or every active key just
    failed) — callers catch this specifically and fall through to their
    existing Ollama call, unchanged."""


_cache_lock = threading.Lock()
_cached_provider = "gemini"
_cached_keys: list[dict] = []
_cache_fetched_at = 0.0
_cooldowns: dict[int, float] = {}
_last_used_provider: str | None = None  # exposed via current_provider_name() for logging only


def _fetch_active_provider() -> str:
    if not NODE_BACKEND_ORIGIN:
        return "gemini"
    try:
        response = requests.get(
            f"{NODE_BACKEND_ORIGIN}/api/admin/ai-provider-keys/internal/active-provider",
            headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
            timeout=5,
        )
        response.raise_for_status()
        return response.json().get("data", {}).get("active_provider") or "gemini"
    except Exception:
        logger.warning("Failed to fetch active AI provider from Node", exc_info=True)
        return "gemini"


def _fetch_active_keys(provider: str) -> list[dict]:
    if not NODE_BACKEND_ORIGIN:
        return []
    try:
        response = requests.get(
            f"{NODE_BACKEND_ORIGIN}/api/admin/ai-provider-keys/internal/active",
            params={"provider": provider},
            headers={"X-Service-Key": AI_SERVICE_KEY} if AI_SERVICE_KEY else {},
            timeout=5,
        )
        response.raise_for_status()
        return response.json().get("data", []) or []
    except Exception:
        logger.warning("Failed to fetch active %s keys from Node", provider, exc_info=True)
        return []


def _get_candidates() -> tuple[str, list[dict]]:
    """Returns (active_provider, usable_key_rows) — cache refreshed at
    most once per TTL, cooldowns filtered on every call regardless."""
    global _cached_provider, _cached_keys, _cache_fetched_at
    now = time.time()
    with _cache_lock:
        if now - _cache_fetched_at > PROVIDER_KEYS_CACHE_TTL_SECONDS:
            provider = _fetch_active_provider()
            keys = _fetch_active_keys(provider)
            # Only replace the cache on a successful (even if empty)
            # response distinguishable from a transient fetch failure — a
            # momentary Node blip must not blank out a working key list.
            if keys or _cache_fetched_at == 0.0:
                _cached_provider = provider
                _cached_keys = keys
            _cache_fetched_at = now
        provider, keys = _cached_provider, list(_cached_keys)

    now2 = time.time()
    return provider, [k for k in keys if _cooldowns.get(k["id"], 0) <= now2]


def _mark_cooldown(key_id) -> None:
    _cooldowns[key_id] = time.time() + PROVIDER_KEY_COOLDOWN_SECONDS


def gemini_available() -> bool:
    """Kept for backward compatibility with any external check of the old
    name — now really means "is the currently active provider usable"."""
    _, candidates = _get_candidates()
    return len(candidates) > 0


def current_provider_name() -> str | None:
    """The provider that actually served the most recent generate() call,
    for log messages — None until the first successful call."""
    return _last_used_provider


def _is_rate_limited(exc: Exception) -> bool:
    status_code = getattr(getattr(exc, "response", None), "status_code", None)
    if status_code == 429:
        return True
    return "RESOURCE_EXHAUSTED" in str(exc) or "rate_limit" in str(exc).lower()


def _generate_gemini(key: dict, messages: list[dict], schema, temperature, num_predict, seed) -> str:
    # Imported lazily (not at module top) so a missing/broken google-genai
    # install never breaks importing this module — only breaks this one
    # provider's path, which already has an Ollama fallback.
    from google import genai
    from google.genai import types as genai_types

    system_instruction = "\n\n".join(m["content"] for m in messages if m["role"] == "system") or None
    contents = [
        genai_types.Content(
            role=("model" if m["role"] == "assistant" else "user"),
            parts=[genai_types.Part(text=m["content"])],
        )
        for m in messages
        if m["role"] != "system"
    ]

    config_kwargs: dict = {"temperature": temperature}
    if num_predict:
        config_kwargs["max_output_tokens"] = num_predict
    if seed is not None:
        config_kwargs["seed"] = seed
    if system_instruction:
        config_kwargs["system_instruction"] = system_instruction
    if schema is not None:
        config_kwargs["response_mime_type"] = "application/json"
        config_kwargs["response_schema"] = schema

    client = genai.Client(api_key=key["api_key"])
    response = client.models.generate_content(
        model=key.get("model") or GEMINI_MODEL,
        contents=contents,
        config=genai_types.GenerateContentConfig(**config_kwargs),
    )
    return (response.text or "").strip()


def _generate_anthropic(key: dict, messages: list[dict], schema, temperature, num_predict, seed) -> str:  # noqa: ARG001 — seed unsupported by Anthropic
    system_text = "\n\n".join(m["content"] for m in messages if m["role"] == "system") or None
    chat_messages = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "system"]
    if schema is not None:
        # Anthropic has no first-class JSON-schema response mode — ask for
        # strict JSON via the system prompt instead, same effective
        # contract the caller relies on (a JSON string it json.loads()).
        schema_instruction = f"Respond with ONLY valid JSON matching this schema, no other text: {schema}"
        system_text = f"{system_text}\n\n{schema_instruction}" if system_text else schema_instruction

    body = {
        "model": key.get("model") or "claude-3-5-sonnet-20240620",
        "max_tokens": num_predict or 4096,
        "temperature": temperature,
        "messages": chat_messages,
    }
    if system_text:
        body["system"] = system_text

    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": key["api_key"],
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json=body,
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return "".join(block.get("text", "") for block in data.get("content", [])).strip()


def _generate_openai_compatible(
    provider: str, key: dict, messages: list[dict], schema, temperature, num_predict, seed
) -> str:
    # Imported lazily, same reasoning as the Gemini SDK import above.
    from openai import OpenAI

    base_url = key.get("base_url") or DEFAULT_BASE_URLS.get(provider)
    # Local providers (ollama/lm_studio/vllm) have no real API key — the
    # SDK still requires a non-empty string.
    client = OpenAI(api_key=key.get("api_key") or "not-needed", base_url=base_url)

    kwargs: dict = {
        "model": key.get("model") or provider,
        "messages": messages,
        "temperature": temperature,
    }
    if num_predict:
        kwargs["max_tokens"] = num_predict
    if seed is not None:
        kwargs["seed"] = seed
    if schema is not None:
        # Widely supported by OpenAI-compatible servers; ones that don't
        # understand it (some local runners) just ignore an unknown field
        # rather than erroring, and the prompt itself should already be
        # asking for JSON.
        kwargs["response_format"] = {"type": "json_object"}

    response = client.chat.completions.create(**kwargs)
    return (response.choices[0].message.content or "").strip()


def generate(
    *,
    messages: list[dict],
    schema: dict | None = None,
    temperature: float = 0.7,
    num_predict: int | None = None,
    num_ctx: int | None = None,  # noqa: ARG001 — accepted for call-site symmetry, no provider here has a direct equivalent
    seed: int | None = None,
    
) -> str:
    """
    Normalized signature every call site swaps in for
    self.client.chat(...)/ollama_client.chat(...). Returns the raw text
    content — same contract as response["message"]["content"] today
    (schema calls still return a JSON string for the caller's existing
    json.loads(), unchanged).

    Raises LLMUnavailable if there are no active keys for the currently
    active provider, or every active key failed — the caller is expected
    to catch this specific exception and run its existing Ollama path
    unchanged.
    """
    global _last_used_provider

    provider, candidates = _get_candidates()
    if not candidates:
        raise LLMUnavailable(f"no active keys configured for provider '{provider}'")

    last_error: Exception | None = None
    for key in candidates:
        try:
            if provider in _GEMINI_PROVIDERS:
                text = _generate_gemini(key, messages, schema, temperature, num_predict, seed)
            elif provider in _ANTHROPIC_PROVIDERS:
                text = _generate_anthropic(key, messages, schema, temperature, num_predict, seed)
            else:
                text = _generate_openai_compatible(provider, key, messages, schema, temperature, num_predict, seed)
            _last_used_provider = provider
            return text
        except Exception as exc:
            last_error = exc
            if _is_rate_limited(exc):
                logger.warning(
                    "%s key id=%s (%s) rate-limited, cooling down %ss",
                    provider, key["id"], key.get("label"), PROVIDER_KEY_COOLDOWN_SECONDS,
                )
                _mark_cooldown(key["id"])
            else:
                logger.warning("%s key id=%s (%s) failed: %s", provider, key["id"], key.get("label"), exc)
            continue

    raise LLMUnavailable(f"all {provider} keys failed: {last_error}")
