FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y \
        --no-install-recommends \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt

RUN python -m pip install --upgrade pip \
    && pip install -r /app/requirements.txt

COPY . /app

RUN mkdir -p \
    /app/uploads \
    /app/data

# voice_models/*.onnx is gitignored (a large ML weight file, correctly
# kept out of git) — so a real CI build (checkout scm, not this machine's
# local filesystem) never has it via COPY above. Fetched here instead,
# from the exact same rhasspy/piper-voices source used to originally
# provision it, so the image is self-sufficient regardless of how/where
# it's built. Guarded on the file not already existing so a local test
# build (which DOES have it on disk) doesn't redundantly re-download it.
# --retry/--retry-all-errors: the Jenkins build host's DNS/network to
# huggingface.co has proven intermittently flaky (observed failing at
# checkout, at container runtime, and at docker-build time across
# separate builds) — retry a handful of times instead of failing the
# whole image build on one transient blip.
RUN mkdir -p /app/voice_models/piper \
    && [ -f /app/voice_models/piper/en_US-lessac-medium.onnx ] || curl -fL \
        --retry 5 --retry-delay 5 --retry-all-errors \
        -o /app/voice_models/piper/en_US-lessac-medium.onnx \
        https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx \
    && [ -f /app/voice_models/piper/en_US-lessac-medium.onnx.json ] || curl -fL \
        --retry 5 --retry-delay 5 --retry-all-errors \
        -o /app/voice_models/piper/en_US-lessac-medium.onnx.json \
        https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json

# core/stt_service.py loads faster-whisper's model at IMPORT time (module
# level, not lazily), so without this the whole FastAPI app fails to even
# start on any transient network/DNS hiccup reaching huggingface.co at
# container startup — verified live: exactly this happened in production
# (huggingface_hub.errors.LocalEntryNotFoundError, "Temporary failure in
# name resolution"), taking the entire service down over a voice-feature
# dependency. Pre-download the same "base" model this env defaults to
# (WHISPER_MODEL_SIZE, stt_service.py) into the image at build time —
# same "bake it in, no runtime internet needed" fix already used for the
# Piper TTS voice model above — then HF_HUB_OFFLINE=1 guarantees
# faster-whisper/huggingface_hub never attempts a network call at
# runtime at all, even to check for updates.
#
# Retry loop: this exact download hit the same intermittent
# huggingface.co DNS/network flakiness at build time (not just at
# runtime, before this fix existed) — a single failed attempt shouldn't
# fail the whole image build, so retry a few times with a short pause
# before giving up for real.
ENV HF_HOME=/app/.cache/huggingface
RUN n=0; \
    until [ "$n" -ge 5 ]; do \
        python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')" && break; \
        n=$((n + 1)); \
        echo "Whisper model download failed (attempt $n/5), retrying in 10s..."; \
        sleep 10; \
    done; \
    if [ "$n" -ge 5 ]; then \
        echo "Whisper model download failed after 5 attempts"; \
        exit 1; \
    fi
ENV HF_HUB_OFFLINE=1

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
