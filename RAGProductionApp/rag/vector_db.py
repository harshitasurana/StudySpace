import os

from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams,
    Distance,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)


# =========================================
# LOAD ENVIRONMENT VARIABLES
# =========================================

load_dotenv()


# =========================================
# QDRANT CONFIG
# =========================================

QDRANT_URL = os.getenv(
    "QDRANT_URL",
    "http://127.0.0.1:6333",
)

QDRANT_COLLECTION = os.getenv(
    "QDRANT_COLLECTION",
    "docs",
)

QDRANT_VECTOR_DIM = int(
    os.getenv(
        "QDRANT_VECTOR_DIM",
        "1024",
    )
)

QDRANT_TIMEOUT = int(
    os.getenv(
        "QDRANT_TIMEOUT",
        "30",
    )
)


class VectorDB:

    def __init__(
        self,
        url=None,
        collection=None,
        dim=None,
    ):

        # Use manually provided values first.
        # Otherwise use values from .env.
        self.url = url or QDRANT_URL

        self.collection = (
            collection or QDRANT_COLLECTION
        )

        self.dim = (
            dim or QDRANT_VECTOR_DIM
        )

        self.client = QdrantClient(
            url=self.url,
            timeout=QDRANT_TIMEOUT,
        )

        # Create collection only if it
        # does not already exist.
        if not self.client.collection_exists(
            self.collection
        ):
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config=VectorParams(
                    size=self.dim,
                    distance=Distance.COSINE,
                ),
            )

    # =====================================
    # UPSERT VECTORS
    # =====================================

    def upsert(
        self,
        ids,
        vectors,
        payloads,
    ):

        points = [
            PointStruct(
                id=ids[i],
                vector=vectors[i],
                payload=payloads[i],
            )
            for i in range(len(ids))
        ]

        self.client.upsert(
            collection_name=self.collection,
            points=points,
        )

    # =====================================
    # SEARCH VECTORS
    # =====================================

    def search(
            self,
            query_vector,
            subject=None,
            chapter=None,
            board=None,
            class_name=None,
            academic_year=None,
            top_k=5,
    ):

        conditions = []

        # ---------------------------------
        # Subject Filter
        # ---------------------------------

        if subject:
            conditions.append(
                FieldCondition(
                    key="subject",
                    match=MatchValue(value=subject),
                )
            )

        # ---------------------------------
        # Chapter Filter
        # ---------------------------------

        if chapter:
            conditions.append(
                FieldCondition(
                    key="chapter",
                    match=MatchValue(value=chapter),
                )
            )

        # ---------------------------------
        # Board / Class / Academic Year Filters
        # (optional — older ingested points have none of these fields, so
        # only apply a condition when the caller actually asks for one;
        # existing callers that never pass these keep working unchanged.)
        # ---------------------------------

        if board:
            conditions.append(
                FieldCondition(
                    key="board",
                    match=MatchValue(value=board),
                )
            )

        if class_name:
            conditions.append(
                FieldCondition(
                    key="class",
                    match=MatchValue(value=class_name),
                )
            )

        if academic_year:
            conditions.append(
                FieldCondition(
                    key="academic_year",
                    match=MatchValue(value=academic_year),
                )
            )

        # ---------------------------------
        # Build Filter
        # ---------------------------------

        query_filter = None

        if conditions:
            query_filter = Filter(
                must=conditions
            )

        # ---------------------------------
        # Debug
        # ---------------------------------

        # Non-Latin subject/chapter values (Hindi/Gujarati) raised
        # UnicodeEncodeError here on Windows' cp1252 console - this print
        # is pure debug output, but an uncaught exception here aborted
        # search() entirely, which the caller's try/except then silently
        # swallowed as "no results" (see main.py's TEXT SEARCH block).
        # That looked exactly like a retrieval/data problem instead of a
        # console-encoding one, so debug output must never be able to
        # break the actual search.
        try:
            print("=" * 60)
            print("VECTOR SEARCH")
            print("Subject :", subject)
            print("Chapter :", chapter)
            print("Top K   :", top_k)
            print("=" * 60)
        except UnicodeEncodeError:
            pass

        # ---------------------------------
        # Query Qdrant
        # ---------------------------------

        results = self.client.query_points(
            collection_name=self.collection,
            query=query_vector,
            query_filter=query_filter,
            with_payload=True,
            limit=top_k,
        )

        contexts = []
        sources = set()
        chunks = []

        # ---------------------------------
        # Process Results
        # ---------------------------------

        for point in results.points:

            payload = point.payload or {}

            text = payload.get("text", "")
            source = payload.get("source", "")

            if text:
                contexts.append(text)

            if source:
                sources.add(source)

            chunks.append(
                {
                    "id": str(point.id),
                    "score": point.score,
                    "page": payload.get("page"),
                    "subject": payload.get("subject"),
                    "chapter": payload.get("chapter"),
                    "source": source,
                    "text": text,
                    "payload": payload,
                }
            )

        # ---------------------------------
        # Debug Results
        # ---------------------------------

        print("=" * 60)
        print("TEXT SEARCH RESULTS")
        print("=" * 60)
        print(f"Found: {len(chunks)}")

        for i, chunk in enumerate(chunks, 1):
            print(
                f"[{i}] "
                f"Score={chunk['score']:.4f} "
                f"Page={chunk['page']} "
                f"Source={chunk['source']}"
            )

        return {
            "contexts": contexts,
            "source": list(sources),
            "chunks": chunks,
        }