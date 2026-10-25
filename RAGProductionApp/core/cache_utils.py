"""
Sprint E — Lightweight in-process caching.

A tiny, dependency-free TTL+LRU cache used to cut down on repeated
embedding calls, vector searches, and local storage URL resolution.

Deliberately simple:
- Thread-safe (single lock per cache instance).
- Bounded size (oldest entry evicted when full).
- Per-entry TTL (stale entries are treated as misses and dropped).

This is process-local caching, not a distributed cache. That's a
reasonable tradeoff here because the app runs as a small number of
backend workers and the goal is simply to avoid redundant Qdrant /
Ollama / local storage round-trips for repeated or near-repeated
requests within a short window (e.g. a student re-rendering the same
chat turn, or asking a lightly-reworded follow-up).
"""

import threading
import time
from typing import Any


class TTLCache:
    """A small thread-safe cache with a max size and a time-to-live."""

    def __init__(self, maxsize: int = 256, ttl: float = 300.0):
        self.maxsize = max(1, maxsize)
        self.ttl = max(0.0, ttl)
        self._store: dict[Any, tuple[float, Any]] = {}
        self._lock = threading.Lock()

        # Basic hit/miss counters for observability — cheap enough
        # to keep on always, useful when tuning cache sizes/TTLs.
        self.hits = 0
        self.misses = 0

    def get(self, key: Any) -> tuple[Any, bool]:
        """Returns (value, hit). `value` is None when hit is False."""

        with self._lock:
            entry = self._store.get(key)

            if entry is None:
                self.misses += 1
                return None, False

            expires_at, value = entry

            if expires_at < time.time():
                # Expired — treat as a miss and drop it.
                del self._store[key]
                self.misses += 1
                return None, False

            self.hits += 1
            return value, True

    def set(self, key: Any, value: Any) -> None:
        with self._lock:
            if (
                key not in self._store
                and len(self._store) >= self.maxsize
            ):
                # Evict the entry closest to expiring rather than a
                # true LRU — good enough for our access patterns and
                # avoids tracking access order on every read.
                oldest_key = min(
                    self._store,
                    key=lambda existing: self._store[existing][0],
                )
                del self._store[oldest_key]

            self._store[key] = (time.time() + self.ttl, value)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {
                "size": len(self._store),
                "maxsize": self.maxsize,
                "ttl": self.ttl,
                "hits": self.hits,
                "misses": self.misses,
            }