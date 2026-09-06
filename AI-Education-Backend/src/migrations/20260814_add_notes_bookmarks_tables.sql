-- Phase 7 — Sprint 7: Notes / Bookmarks / Hardening
-- Pure CRUD, scoped to the student's own profile, no AI dependency.
-- Bookmarks are self-contained snapshots (title/content copied at bookmark
-- time) rather than references into ai_messages/quiz_attempts.questions —
-- simpler and doesn't break if the source conversation/attempt changes.

BEGIN;

CREATE TABLE IF NOT EXISTS education_student_notes (
  note_id             SERIAL PRIMARY KEY,
  student_profile_id  INTEGER NOT NULL REFERENCES education_student_profiles(student_profile_id),
  chapter_id          INTEGER REFERENCES education_chapters(chapter_id),
  title               VARCHAR(255),
  content             TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_education_student_notes_student
  ON education_student_notes(student_profile_id);

CREATE TABLE IF NOT EXISTS education_student_bookmarks (
  bookmark_id         SERIAL PRIMARY KEY,
  student_profile_id  INTEGER NOT NULL REFERENCES education_student_profiles(student_profile_id),
  chapter_id          INTEGER NOT NULL REFERENCES education_chapters(chapter_id),
  source_type         VARCHAR(20) NOT NULL CHECK (source_type IN ('chapter', 'tutor_message', 'quiz_question')),
  title               VARCHAR(255),
  content             TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_education_student_bookmarks_student
  ON education_student_bookmarks(student_profile_id);

COMMIT;
