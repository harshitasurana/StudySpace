BEGIN;

-- Remember-last-position: the reader resumes here on open when no
-- explicit ?page= deep link is present. Nullable — old/unread rows have
-- no last page yet.
ALTER TABLE education_student_chapter_progress
  ADD COLUMN IF NOT EXISTS last_page_index INTEGER NULL;

-- Basic page bookmarks: only source_type='chapter' bookmarks (created
-- from the reader's own "bookmark this page" button) use this — every
-- other source_type (tutor_message, quiz_question, etc.) has no page,
-- hence nullable.
ALTER TABLE education_student_bookmarks
  ADD COLUMN IF NOT EXISTS page_index INTEGER NULL;

COMMIT;
