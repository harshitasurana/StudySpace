-- Notes: Smart Tags. Bookmarks: more source types (diagrams, flashcards,
-- concepts, tests) + Collections (Exam/Revision/Important/Favorites/Need
-- Practice), per the Notes/Bookmarks UI redesign.

BEGIN;

ALTER TABLE education_student_notes
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE education_student_bookmarks
  DROP CONSTRAINT IF EXISTS education_student_bookmarks_source_type_check;

ALTER TABLE education_student_bookmarks
  ADD CONSTRAINT education_student_bookmarks_source_type_check
  CHECK (source_type IN ('chapter', 'tutor_message', 'quiz_question', 'diagram', 'flashcard', 'concept', 'test'));

ALTER TABLE education_student_bookmarks
  ADD COLUMN IF NOT EXISTS collection VARCHAR(20) NULL;

ALTER TABLE education_student_bookmarks
  ADD CONSTRAINT education_student_bookmarks_collection_check
  CHECK (collection IS NULL OR collection IN ('exam', 'revision', 'important', 'favorites', 'need_practice'));

COMMIT;
