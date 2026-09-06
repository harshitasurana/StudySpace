-- Admin content-ingestion UI: lets a chapter be tagged with the academic
-- year its content belongs to (so a revised syllabus adds new chapter rows
-- instead of overwriting the old ones), and tracks the async PDF -> Qdrant
-- ingestion job an admin triggers per chapter, replacing the manual
-- config/curriculum.py + scripts/ingest_books.py workflow in RAGProductionApp.

BEGIN;

ALTER TABLE education_chapters
  ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20);

-- source_file used to be a hand-typed filename the old manual script
-- resolved on local disk ("feeds scripts/ingest_books.py directly — must
-- stay unique"). The new ingestion flow generates this server-side instead
-- of asking an admin to invent a filename, but chapters created before a
-- PDF is ever uploaded (or without going through ingestion at all) have
-- nothing meaningful to put here yet, so it can no longer be required.
ALTER TABLE education_chapters
  ALTER COLUMN source_file DROP NOT NULL;

CREATE TABLE IF NOT EXISTS education_book_ingestions (
  id                SERIAL PRIMARY KEY,
  chapter_id        INTEGER NOT NULL REFERENCES education_chapters(chapter_id),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  source_filename   VARCHAR(255) NOT NULL,
  storage_key       VARCHAR(500),
  chunks_ingested   INTEGER,
  error_message     TEXT,
  requested_by      INTEGER REFERENCES users(user_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT education_book_ingestions_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS education_book_ingestions_chapter_idx
  ON education_book_ingestions (chapter_id);

COMMIT;
