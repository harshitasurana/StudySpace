"""
One-off ops script: uploads ALREADY-COMPUTED embeddings (from metadata/
embeddings.json) straight to Qdrant, for a chapter whose extraction +
embedding stage succeeded but whose final Qdrant Upload stage failed
(confirmed via processing_report.json's qdrant_uploaded=0 despite
embeddings>0). No Ollama calls at all — pure I/O, matching each
embeddings.json record by id to its page_*/*.json region metadata file
for the full payload, and applying the same corrections the main
ingestion pipeline does (chapter_number injection, top-level
education_metadata key, figure/table_number prefix fix).
"""
import json
import os
import sys
import uuid

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.local_image_storage import get_local_image_storage  # noqa: E402
from qdrant_client import QdrantClient  # noqa: E402
from qdrant_client.models import PointStruct  # noqa: E402

QDRANT_URL = os.getenv("QDRANT_URL")
IMAGE_COLLECTION = os.getenv("IMAGE_COLLECTION", "textbook_images")

storage = get_local_image_storage()
qdrant_client = QdrantClient(url=QDRANT_URL, timeout=300)


def qdrant_point_id(candidate_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, candidate_id))


def list_region_json_keys(prefix: str) -> dict:
    """Returns {region_id: object_key} by loading each region json's own 'id' field."""
    keys = [k for k in storage.list_objects(prefix, recursive=True) if "/page_" in k and k.endswith(".json")]
    mapping = {}
    for key in keys:
        try:
            meta = load_json(key)
            rid = meta.get("id")
            if rid:
                mapping[rid] = key
        except Exception as exc:
            print(f"  WARN: failed to read {key}: {exc}")
    return mapping


def load_json(key: str) -> dict:
    return storage.download_json(key)


def upload_chapter(folder: str, label: str) -> dict:
    prefix = f"classes/class_09/textbooks/cbse/ncert/{folder}/"
    embeddings_key = prefix + "metadata/embeddings.json"
    chapter_meta = load_json(prefix + "metadata/chapter_metadata.json")
    chapter_number = chapter_meta.get("chapter_no")

    embeddings_data = load_json(embeddings_key)
    records = embeddings_data.get("records", [])
    print(f"[{label}] {len(records)} precomputed embeddings found")

    region_id_to_key = list_region_json_keys(prefix)
    print(f"[{label}] {len(region_id_to_key)} region metadata files found")

    points = []
    errors = 0
    for record in records:
        region_id = record.get("id")
        embedding = record.get("embedding")
        if not region_id or not embedding:
            errors += 1
            continue

        region_key = region_id_to_key.get(region_id)
        if not region_key:
            print(f"  SKIP {region_id}: no matching region metadata file")
            errors += 1
            continue

        metadata = load_json(region_key)
        metadata["chapter_number"] = chapter_number

        visual = metadata.get("visual")
        if isinstance(visual, dict):
            fig_num = visual.get("figure_number")
            if isinstance(fig_num, str) and fig_num.lower().startswith("figure "):
                visual["figure_number"] = fig_num[len("figure "):].strip()
            tbl_num = visual.get("table_number")
            if isinstance(tbl_num, str) and tbl_num.lower().startswith("table "):
                visual["table_number"] = tbl_num[len("table "):].strip()

        storage_key = (metadata.get("storage") or {}).get("object_key", "") or record.get("storage_key", "")

        payload = {
            "metadata": metadata,
            "education_metadata": metadata,
            "image": storage_key,
            "search_text": "",
        }
        if storage_key:
            payload["storage_key"] = storage_key
            payload["public_url"] = storage.public_url(storage_key)

        points.append(
            PointStruct(id=qdrant_point_id(region_id), vector=embedding, payload=payload)
        )

    if points:
        qdrant_client.upsert(collection_name=IMAGE_COLLECTION, points=points)
        print(f"[{label}] uploaded {len(points)} points ({errors} errors)")
    else:
        print(f"[{label}] nothing to upload ({errors} errors)")

    return {"label": label, "records": len(records), "uploaded": len(points), "errors": errors}


def main():
    if len(sys.argv) < 3:
        print("Usage: python upload_precomputed_embeddings.py <folder> <label>")
        sys.exit(1)
    folder, label = sys.argv[1], sys.argv[2]
    result = upload_chapter(folder, label)
    print(result)
    total = qdrant_client.get_collection(IMAGE_COLLECTION).points_count
    print(f"textbook_images collection now has {total} total points")


if __name__ == "__main__":
    main()
