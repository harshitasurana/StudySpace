import os

from dotenv import load_dotenv
from ollama import Client
from llama_index.readers.file import PDFReader
from llama_index.core.node_parser import SentenceSplitter


# =========================================
# ENVIRONMENT
# =========================================

load_dotenv(override=True)


# =========================================
# OLLAMA CONFIGURATION
# =========================================

OLLAMA_HOST = os.getenv(
    "OLLAMA_HOST",
    "http://127.0.0.1:11434",
)

# Renamed from OLLAMA_EMBED_MODEL — this is the AI Tutor's own embedding
# model config.
OLLAMA_EMBED_MODEL = os.getenv(
    "TUTOR_EMBED_MODEL",
    "bge-m3",
)


# =========================================
# VECTOR CONFIGURATION
# =========================================

EMBED_DIM = int(
    os.getenv(
        "QDRANT_VECTOR_DIM",
        "1024",
    )
)


# =========================================
# CHUNKING CONFIGURATION
# =========================================

CHUNK_SIZE = int(
    os.getenv(
        "CHUNK_SIZE",
        "1000",
    )
)

CHUNK_OVERLAP = int(
    os.getenv(
        "CHUNK_OVERLAP",
        "200",
    )
)


# =========================================
# EXPLICIT OLLAMA CLIENT
# =========================================

ollama_client = Client(
    host=OLLAMA_HOST,
)


# =========================================
# TEXT SPLITTER
# =========================================

splitter = SentenceSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
)


# =========================================
# LOAD AND CHUNK PDF
# =========================================

def load_and_chunk_pdf(
    path: str,
) -> list[str]:

    docs = PDFReader().load_data(
        file=path
    )

    texts = [
        doc.text
        for doc in docs
        if getattr(
            doc,
            "text",
            None,
        )
    ]

    chunks = []

    for text in texts:

        chunks.extend(
            splitter.split_text(
                text
            )
        )

    return chunks


# =========================================
# LOAD PDF AS READABLE PAGES
# =========================================
# Used by the chapter-reader feature — the actual textbook content, not
# search chunks. Same PDFReader as load_and_chunk_pdf above, just returned
# per-page and unsplit, since a reader wants real page boundaries, not
# overlapping embedding-sized chunks.

def load_pdf_pages(
    path: str,
) -> list[dict]:

    docs = PDFReader().load_data(
        file=path
    )

    pages = []
    index = 0

    for doc in docs:
        text = getattr(doc, "text", None)
        if not text or not text.strip():
            continue
        index += 1
        page_label = (
            (doc.metadata or {}).get("page_label")
            if getattr(doc, "metadata", None)
            else None
        )
        pages.append(
            {
                # 1-based position within THIS chapter's own PDF file —
                # matches the "page" metadata textbook image ingestion
                # stamps on figures (also indexed per-chapter-PDF, not
                # against the printed book). page_label below is the
                # printed book page number instead — display-only, not
                # reliable for matching against anything else.
                "page_index": index,
                "page_label": page_label,
                "text": text.strip(),
            }
        )

    return pages


# =========================================
# EMBED TEXTS
# =========================================

def embed_texts(
    texts: list[str],
    model: str | None = None,
) -> list[list[float]]:
    # model defaults to the AI Tutor's own TUTOR_EMBED_MODEL.

    embeddings = []

    for text in texts:

        clean_text = text.strip()

        if not clean_text:
            continue

        response = ollama_client.embeddings(
            model=model or OLLAMA_EMBED_MODEL,
            prompt=clean_text,
        )

        embeddings.append(
            response["embedding"]
        )

    return embeddings