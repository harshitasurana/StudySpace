-- AI Learning Deck — Phase 1: one RAG-generated, purpose-driven slide
-- deck per (chapter_id, board, standard). Unlike education_mind_maps'
-- 5 pre-generated variants, there's exactly one deck per chapter+scope
-- in Phase 1, so no `variant` column yet — every generation (including
-- a chapter's very first request) runs through RAGProductionApp's
-- Celery worker (core/slide_deck_tasks.py), reporting back through
-- POST /api/slide-deck/callback/:deckId. There is no synchronous
-- generation path at all — see slide_deck_service.js.

BEGIN;

CREATE TABLE IF NOT EXISTS education_slide_decks (
  slide_deck_id   SERIAL PRIMARY KEY,
  chapter_id      INTEGER NOT NULL REFERENCES education_chapters(chapter_id),
  board           VARCHAR(100) NOT NULL,
  standard        VARCHAR(100) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payload         JSONB,
  error_message   TEXT,
  generated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chapter_id, board, standard)
);

CREATE INDEX IF NOT EXISTS idx_education_slide_decks_chapter
  ON education_slide_decks(chapter_id, board, standard);

COMMIT;
