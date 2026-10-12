"""
core/local_image_storage.py

The storage backend for this deployment (local-only — no MinIO/S3 or any
other remote object store). Everything is written to and read from disk
under LOCAL_MEDIA_ROOT, served back out over HTTP by main.py's
/local-media static mount.

Historical note: this class was originally built as a fallback for a
since-removed MinIO/S3 backend, which is why its method surface (upload_*/
download_*/list_objects/copy_object/move_object/verify_permissions/
generate_signed_url, all returning StoredObject) still matches that old
API shape — every call site across the codebase was already written
against it, so keeping the same signatures meant zero call-site churn
when MinIO was removed entirely.
"""

from __future__ import annotations

import io
import json
import logging
import os
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional, Union

logger = logging.getLogger(__name__)

_CONTENT_TYPES = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "pdf": "application/pdf",
    "json": "application/json",
    "txt": "text/plain",
}


@dataclass(frozen=True)
class StoredObject:
    """What every upload method returns: the object's key, its public
    URL, the bucket (directory namespace) it landed in, and its size in
    bytes."""

    key: str
    bucket: str
    public_url: str
    size: int


@dataclass(frozen=True)
class LocalStorageConfig:
    """Deliberately holds only the fields callers actually read off
    `storage.config` (verified against real call sites in both
    ingest/enrich scripts: .bucket, .root_prefix, .startup_report())."""

    root: Path = field(default_factory=lambda: Path(os.getenv("LOCAL_MEDIA_ROOT", "local_media")).resolve())
    bucket: str = field(default_factory=lambda: os.getenv("LOCAL_MEDIA_BUCKET", "education"))
    root_prefix: str = field(default_factory=lambda: os.getenv("LOCAL_MEDIA_ROOT_PREFIX", "classes").strip("/"))
    public_base_url: str = field(
        default_factory=lambda: os.getenv("LOCAL_MEDIA_BASE_URL", "http://localhost:8001/local-media").rstrip("/")
    )

    def startup_report(self, *, status: Optional[str] = None) -> str:
        lines = [
            "====================================",
            "Local Image Storage",
            "====================================",
            "",
            f"Root     : {self.root}",
            f"Bucket   : {self.bucket}  (directory name only - no real bucket)",
            f"Base URL : {self.public_base_url}",
        ]
        if status is not None:
            lines += ["", f"Status    : {status}"]
        lines.append("====================================")
        return "\n".join(lines)


class LocalImageStorage:
    """The sole storage backend — every method here is called directly
    by scripts/ingest_textbook_images.py, scripts/enrich_textbook_images.py,
    rag/image_service.py, and main.py."""

    def __init__(self, *, config: Optional[LocalStorageConfig] = None) -> None:
        self.config = config or LocalStorageConfig()
        self.config.root.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------
    # Path resolution — strips a stray leading slash and collapses
    # doubled internal slashes (both would silently change the
    # effective key without looking wrong at a glance), then joins
    # under the local root. `bucket` is accepted on every method for
    # interface parity but is not itself a path segment — the real key
    # already carries the full education/classes/... structure
    # ChapterWorkspace built.
    # ------------------------------------------------------------
    @staticmethod
    def _normalize_key(key: str) -> str:
        return re.sub(r"/{2,}", "/", key).lstrip("/")

    def _path_for(self, key: str) -> Path:
        return self.config.root / self._normalize_key(key)

    def public_url(self, key: str) -> str:
        return f"{self.config.public_base_url}/{self._normalize_key(key)}"

    # ------------------------------------------------------------
    # Lifecycle — no real connection to verify for local disk; these
    # exist only so callers that unconditionally call
    # ensure_bucket()/verify_connection() at startup get a consistent
    # interface regardless of which storage backend is in use.
    # ------------------------------------------------------------
    def ensure_bucket(self, bucket: Optional[str] = None) -> None:
        self.config.root.mkdir(parents=True, exist_ok=True)

    def verify_connection(self, *, auto_create_bucket: Optional[bool] = None) -> None:
        self.config.root.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------
    # Uploads
    # ------------------------------------------------------------
    def _write(self, key: str, data: bytes) -> StoredObject:
        path = self._path_for(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return StoredObject(key=self._normalize_key(key), bucket=self.config.bucket, public_url=self.public_url(key), size=len(data))

    @staticmethod
    def _coerce_image_bytes(image: Any, *, image_format: str) -> bytes:
        if isinstance(image, (bytes, bytearray)):
            return bytes(image)
        if isinstance(image, (Path, str)):
            return Path(image).read_bytes()
        # Assume a PIL.Image.Image — encode in-memory, no local disk.
        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format=image_format)
        return buffer.getvalue()

    def upload_image(
        self,
        key: str,
        image: Union[bytes, "Path", str, "Any"],
        *,
        image_format: str = "PNG",
        bucket: Optional[str] = None,
    ) -> StoredObject:
        data = self._coerce_image_bytes(image, image_format=image_format)
        return self._write(key, data)

    def upload_pdf(self, key: str, pdf: Union[bytes, "Path", str], *, bucket: Optional[str] = None) -> StoredObject:
        data = pdf if isinstance(pdf, (bytes, bytearray)) else Path(pdf).read_bytes()
        return self._write(key, bytes(data))

    def upload_json(self, key: str, payload: dict, *, bucket: Optional[str] = None) -> StoredObject:
        data = json.dumps(payload, indent=2, default=str).encode("utf-8")
        return self._write(key, data)

    def upload_text(self, key: str, text: str, *, bucket: Optional[str] = None) -> StoredObject:
        return self._write(key, text.encode("utf-8"))

    # ------------------------------------------------------------
    # Downloads / deletes / existence
    # ------------------------------------------------------------
    def download_object(self, key: str, *, bucket: Optional[str] = None) -> bytes:
        path = self._path_for(key)
        if not path.exists():
            raise FileNotFoundError(f"No local object at {path} (key={key!r})")
        return path.read_bytes()

    def download_json(self, key: str, *, bucket: Optional[str] = None) -> dict:
        return json.loads(self.download_object(key, bucket=bucket).decode("utf-8"))

    def delete_object(self, key: str, *, bucket: Optional[str] = None) -> None:
        path = self._path_for(key)
        try:
            path.unlink()
        except FileNotFoundError:
            pass

    def object_exists(self, key: str, *, bucket: Optional[str] = None) -> bool:
        return self._path_for(key).is_file()

    def exists(self, key: str, *, bucket: Optional[str] = None) -> bool:
        return self.object_exists(key, bucket=bucket)

    # ------------------------------------------------------------
    # Sprint 22 parity — key hygiene / permission checks / object ops.
    # ------------------------------------------------------------
    def list_objects(self, prefix: str, *, bucket: Optional[str] = None, recursive: bool = True) -> list[str]:
        base = self._path_for(prefix)
        if not base.exists():
            return []
        if base.is_file():
            return [self._normalize_key(prefix)]
        pattern = "**/*" if recursive else "*"
        return [
            str((base / p.relative_to(base))).replace(str(self.config.root) + os.sep, "").replace(os.sep, "/")
            for p in base.glob(pattern)
            if p.is_file()
        ]

    def delete_prefix(self, prefix: str, *, bucket: Optional[str] = None) -> int:
        base = self._path_for(prefix)
        if not base.exists():
            return 0
        keys = self.list_objects(prefix, bucket=bucket)
        if base.is_dir():
            shutil.rmtree(base)
        else:
            base.unlink()
        return len(keys)

    def copy_object(
        self,
        source_key: str,
        dest_key: str,
        *,
        source_bucket: Optional[str] = None,
        dest_bucket: Optional[str] = None,
    ) -> StoredObject:
        data = self.download_object(source_key, bucket=source_bucket)
        return self._write(dest_key, data)

    def move_object(
        self,
        source_key: str,
        dest_key: str,
        *,
        source_bucket: Optional[str] = None,
        dest_bucket: Optional[str] = None,
    ) -> StoredObject:
        result = self.copy_object(source_key, dest_key, source_bucket=source_bucket, dest_bucket=dest_bucket)
        self.delete_object(source_key, bucket=source_bucket)
        return result

    def verify_permissions(
        self, *, bucket: Optional[str] = None, probe_prefix: str = "_permission_check"
    ) -> dict[str, bool]:
        """Local disk has no per-permission ACL model to probe the way a
        remote object store would — reports all four as OK if a real
        probe write+read+delete under LOCAL_MEDIA_ROOT succeeds. Never
        raises; always returns a dict."""
        probe_key = f"{probe_prefix.strip('/')}/permission_probe.txt"
        try:
            self._write(probe_key, b"local-storage-permission-check")
            self.download_object(probe_key)
            ok = True
        except Exception:
            logger.exception("Local storage permission probe failed under %s", self.config.root)
            ok = False
        finally:
            self.delete_object(probe_key)
        return {"ListBucket": ok, "PutObject": ok, "GetObject": ok, "CopyObject": ok}

    def permissions_report(self, results: dict[str, bool]) -> str:
        lines = ["Local Storage Permissions", ""]
        for name in ("ListBucket", "PutObject", "GetObject", "CopyObject"):
            lines.append(f"{name:<11}: {'OK' if results.get(name) else 'MISSING'}")
        return "\n".join(lines)

    def generate_signed_url(
        self,
        key: str,
        *,
        bucket: Optional[str] = None,
        ttl_seconds: Optional[int] = None,
    ) -> str:
        """No real signing on local disk — same plain URL public_url()
        already returns. main.py's /local-media static mount has no
        access control of its own (matching this codebase's existing
        LocalStorageProvider convention on the Node side), so there is
        nothing meaningful to sign."""
        return self.public_url(key)


# ============================================================
# Singleton accessor — the one thing every caller actually uses.
# ============================================================

_default_local_storage: Optional[LocalImageStorage] = None


def get_local_image_storage() -> LocalImageStorage:
    global _default_local_storage
    if _default_local_storage is None:
        _default_local_storage = LocalImageStorage()
    return _default_local_storage
