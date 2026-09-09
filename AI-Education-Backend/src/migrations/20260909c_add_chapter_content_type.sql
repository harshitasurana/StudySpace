-- English splits into two distinct parts — Prose and Poetry — that need
-- to be manageable and browsable as separate groups, not just a flat
-- chapter list. Rather than a new table/subject, this is a nullable tag
-- on the existing education_chapters row: NULL for every subject that
-- has no such split (Math, Science, Social Studies, ...), 'prose' or
-- 'poetry' for an English chapter. Generic by design — any future
-- subject that needs the same kind of split (e.g. Hindi/Sanskrit prose
-- vs poetry) reuses this same column, not a bespoke one.

BEGIN;

ALTER TABLE education_chapters
  ADD COLUMN content_type VARCHAR(20)
    CHECK (content_type IN ('prose', 'poetry'));

COMMENT ON COLUMN education_chapters.content_type IS
  'NULL for subjects with no prose/poetry split. ''prose'' or ''poetry'' groups an English (or similar) chapter into its Learning Path/Admin section.';

COMMIT;
