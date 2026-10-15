"""One-time backfill: re-encode JPXDecode figures in already-ingested
chapter PDFs so previously-uploaded chapters get the same fix new
ingestions get automatically (see core/pdf_image_sanitizer.py for why).

Storage keys come from stdin (one per line) rather than a direct DB query
so this script doesn't need a new DB driver dependency added just for a
one-time run — get the list with:
    psql ... -t -A -c "SELECT storage_key FROM education_book_ingestions
      WHERE job_type='text' AND status='completed'
        AND storage_key IS NOT NULL AND storage_key <> ''"
      | .venv/Scripts/python.exe scripts/backfill_sanitize_chapter_pdf_images.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()

from core.local_image_storage import get_local_image_storage  # noqa: E402
from core.pdf_image_sanitizer import sanitize_pdf_images  # noqa: E402


def main():
    storage_keys = [line.strip() for line in sys.stdin if line.strip()]
    print(f"Checking {len(storage_keys)} chapter PDFs.")

    storage = get_local_image_storage()
    fixed = 0
    for storage_key in storage_keys:
        try:
            pdf_bytes = storage.download_object(storage_key)
        except Exception as e:
            print(f"  {storage_key}: DOWNLOAD FAILED: {e}")
            continue

        sanitized = sanitize_pdf_images(pdf_bytes)
        if sanitized == pdf_bytes:
            print(f"  {storage_key}: no JPX images, unchanged")
            continue

        storage.upload_pdf(storage_key, sanitized)
        fixed += 1
        print(f"  {storage_key}: FIXED ({len(pdf_bytes)} -> {len(sanitized)} bytes)")

    print(f"\nDone. {fixed}/{len(storage_keys)} chapter PDFs had images re-encoded.")


if __name__ == "__main__":
    main()
