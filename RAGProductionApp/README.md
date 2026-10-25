# Production RAG & AI Tutor Service (`RAGProductionApp`)

High-performance Retrieval-Augmented Generation (RAG) microservice powering intelligent textbook chunking, multimodal PDF parsing, NCERT Notes & Solutions vector search, and grounded AI Tutor responses.

---

## 🎨 Technology Stack

- **Core Language**: Python 3.12+
- **API Framework**: FastAPI & Uvicorn
- **Interactive UI / Debug Dashboard**: Streamlit (`streamlit_app.py`)
- **Workflow Orchestration**: Inngest (`inngest`)
- **Vector Database**: Qdrant (`qdrant-client`)
- **LLM Integrations**: Ollama (Local LLM), OpenAI API, Google Gemini API
- **RAG & Chunking Engine**: LlamaIndex Core (`llama-index-core`), Sentence Transformers (`sentence-transformers`)
- **OCR & Computer Vision**: PaddleOCR (`paddleocr`), PyMuPDF (`PyMuPDF`), OpenCV (`opencv-python`), PyTorch (`torch`), Ultralytics YOLO (`ultralytics`), Transformers
- **Observability**: Langfuse (`langfuse`) for LLM request tracing and evaluation
- **Package Management**: `uv` / `pip` with `pyproject.toml`

---

## 🚀 Architecture & Core Components

### 1. Multimodal Document Parsing & Ingestion Engine (`rag/`)
- **NCERT Solutions & Notes Parser**: Custom structured parser (`chapter_resources.py`) that extracts page content, question indices, exercise numbers, and visual diagrams from NCERT PDF documents.
- **Vision & OCR Pipeline**: Integrates PaddleOCR and PyMuPDF to extract text, mathematical formulas, and diagrams embedded inside textbook PDFs.

### 2. Dense & Sparse Vector Search (`qdrant_storage/`)
- **Qdrant Vector Database**: Local/Remote vector storage holding high-dimensional embeddings generated via `sentence-transformers`.
- **Hybrid Search**: Combines semantic vector similarity search with structured metadata filtering (Subject, Chapter, Resource Type, Page Number).

### 3. Grounded AI Tutor (`main.py`, `rag/`)
- **Citation & Grounding Engine**: Every AI Tutor response is grounded strictly in indexed NCERT materials, producing page number citation chips (`Page N`, `Solution Q3`).
- **Deep-Link Integration**: Outputs page citations that frontend readers (`ChapterReader.jsx`) consume to deep-link directly to cited PDF pages.

### 4. Interactive Streamlit Dashboard (`streamlit_app.py`)
- Provides a visual interface to query the RAG engine, inspect vector embeddings, view PDF pages, debug retrieval scores, and test local Ollama / Cloud LLM prompts.

---

## 🏁 Getting Started

### Prerequisites
- **Python**: `v3.12` (recommended)
- **uv** (or `pip` / `venv`)
- **Qdrant** (local storage directory or Qdrant Cloud cluster)
- **Ollama** (optional, for offline LLM execution)

### Installation

```bash
# Navigate to RAGProductionApp directory
cd RAGProductionApp

# Create and activate virtual environment using uv
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
uv sync
```

Or using standard `pip`:

```bash
pip install -r requirements.txt
```

### Environment Configuration

Create a `.env` file in the root directory (refer to `.env.example`):

```env
# Vector Database
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_STORAGE_PATH=./qdrant_storage

# LLM Providers
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_LLM_MODEL=llama3.2

# Observability
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_SECRET_KEY=your_langfuse_secret_key
LANGFUSE_HOST=https://cloud.langfuse.com
```

### Running the Services

#### 1. Start the FastAPI Service

```bash
# Run FastAPI server with Uvicorn
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

FastAPI OpenAPI interactive docs will be available at `http://localhost:8001/docs`.

#### 2. Start the Streamlit Dashboard

```bash
# Run Streamlit interactive UI
streamlit run streamlit_app.py
```

The Streamlit UI will open automatically at `http://localhost:8501`.

---

## 📁 Directory Structure

```
RAGProductionApp/
├── config/                 # RAG & embedding model configuration settings
├── core/                   # Shared pipeline utilities & constants
├── data/                   # Raw textbook PDFs and dataset files
├── knowledge_base/         # Processed knowledge artifacts & vector stores
├── NCERT-Notes/            # NCERT Notes PDF documents
├── NCERT-Solutions/        # NCERT Solutions PDF documents
├── qdrant_storage/         # Qdrant vector database persistence folder
├── rag/                    # RAG pipelines, chunkers, OCR & vector retrievers
│   ├── chapter_resources.py# NCERT Solutions & Notes structured indexer
│   └── ...                 # Vector search & embedding utilities
├── observability/          # Langfuse tracing & telemetry configs
├── main.py                 # FastAPI application server entrypoint
├── streamlit_app.py        # Streamlit interactive testing & debug dashboard
├── pyproject.toml          # uv / PyPI dependencies definition
└── requirements.txt        # Pip requirement specifications
```

---

## 👥 Authors & Contributors

- **Harshita Surana** - Project Author & Lead Developer ([@harshitasurana](https://github.com/harshitasurana))
- **Yash Joshi** - Co-Author & Core Contributor

