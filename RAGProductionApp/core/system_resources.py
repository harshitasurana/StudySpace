"""Live CPU/GPU utilization for the Ingestion Monitor — answers "is this
box actually working right now, and how hard" for admins watching a long
image-extraction/enrichment job. Read-only, no side effects; safe to poll
frequently.

GPU stats come from `nvidia-smi` via subprocess rather than a Python NVML
binding (pynvml isn't installed and this avoids adding a new dependency
just for a monitoring panel) — gracefully returns gpu: null on a machine
with no NVIDIA GPU or no nvidia-smi on PATH, rather than erroring the
whole monitor.
"""

import logging
import subprocess

import psutil

from core.vision_runtime import VisionRuntime

logger = logging.getLogger(__name__)


def _get_gpu_stats() -> dict | None:
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return None
        # Multi-GPU machines get one line each — report every GPU found.
        gpus = []
        for line in result.stdout.strip().splitlines():
            name, gpu_util, mem_util, mem_used, mem_total, temp_c = [p.strip() for p in line.split(",")]
            gpus.append(
                {
                    "name": name,
                    "gpu_utilization_percent": float(gpu_util),
                    "memory_utilization_percent": float(mem_util),
                    "memory_used_mb": float(mem_used),
                    "memory_total_mb": float(mem_total),
                    "temperature_c": float(temp_c),
                }
            )
        return gpus
    except (FileNotFoundError, subprocess.TimeoutExpired, ValueError):
        return None
    except Exception:
        logger.warning("Failed to read GPU stats via nvidia-smi", exc_info=True)
        return None


def get_system_resources() -> dict:
    cpu_percent = psutil.cpu_percent(interval=0.3)
    mem = psutil.virtual_memory()
    runtime = VisionRuntime()

    return {
        "cpu": {
            "utilization_percent": cpu_percent,
            "core_count": psutil.cpu_count(logical=True),
        },
        "memory": {
            "used_gb": round(mem.used / (1024**3), 2),
            "total_gb": round(mem.total / (1024**3), 2),
            "utilization_percent": mem.percent,
        },
        "gpus": _get_gpu_stats(),
        "vision_runtime": {
            "mode": runtime.mode,
            "model": runtime.model,
            "host": runtime.host,
        },
    }
