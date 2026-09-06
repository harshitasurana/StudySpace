-- Persistent cache for the Chapter Reader's generated content (see
-- curriculum_service.js's getChapterContentService and
-- common/services/ai_service_client.js's getChapterContent).
--
-- The AI service already caches this per-chapter, but only in that Python
-- process's own memory - a restart/redeploy wipes it, and the very first
-- request after that eats the full ~3 minute generation again (one Ollama
-- markdown-formatting call per reader page). This table makes that
-- generation durable: once built for a chapter, ANY student's request for
-- it is served straight from Postgres, forever (until the chapter's
-- source PDF is genuinely re-ingested), regardless of what the AI
-- service's own process-lifetime cache is doing.
--
-- One row per chapter - chapter_id is both the natural key and the PK, no
-- surrogate id needed for a pure 1:1 cache.
BEGIN;

CREATE TABLE IF NOT EXISTS education_chapter_content (
  chapter_id   INTEGER PRIMARY KEY REFERENCES education_chapters(chapter_id),
  pages        JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
