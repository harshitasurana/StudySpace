-- Interactive RAG Mind Map — Phase 2: pre-generated variants, cached.
-- 5 rows per (chapter_id, board, standard), one per MIND_MAP_LENS_INSTRUCTIONS
-- variant. The first student to request a chapter's mind map with
-- nothing cached generates "concept_overview" synchronously (still
-- waits once, like before) while the other 4 rows generate in the
-- background via the Celery worker in RAGProductionApp, reporting back
-- through POST /api/mindmap/callback/:mindMapId. Every student after
-- that gets all variants instantly from here.
--
-- Scoped by (chapter_id, board, standard), not chapter_id alone — matches
-- exactly what's sent to the AI service today, so a school with more
-- than one board mapped to the same class never gets served another
-- board's cached content.

BEGIN;

CREATE TABLE IF NOT EXISTS education_mind_maps (
  mind_map_id     SERIAL PRIMARY KEY,
  chapter_id      INTEGER NOT NULL REFERENCES education_chapters(chapter_id),
  board           VARCHAR(100) NOT NULL,
  standard        VARCHAR(100) NOT NULL,
  variant         VARCHAR(50) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payload         JSONB,
  error_message   TEXT,
  generated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chapter_id, board, standard, variant)
);

CREATE INDEX IF NOT EXISTS idx_education_mind_maps_chapter
  ON education_mind_maps(chapter_id, board, standard);

COMMIT;
