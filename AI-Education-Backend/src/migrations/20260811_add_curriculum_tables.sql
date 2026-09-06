-- Sprint 2: Curriculum Foundation
-- Adds the chapter catalog and per-student chapter progress tables
-- described in the "Curriculum Foundation" plan (Step 1).
--
-- class_id is NOT NULL on education_chapters (unlike the nullable/
-- class-agnostic board_id/class_id on education_academic_subjects) —
-- without it, a future Class 10 chapter for a subject already seeded
-- as class-agnostic (e.g. "Mathematics") would collide with today's
-- Class 9 chapters instead of being scoped separately.

BEGIN;

CREATE TABLE IF NOT EXISTS education_chapters (
  chapter_id      SERIAL PRIMARY KEY,
  subject_id      INTEGER NOT NULL REFERENCES education_academic_subjects(subject_id),
  class_id        INTEGER NOT NULL REFERENCES education_academic_classes(class_id),
  name            VARCHAR(200) NOT NULL,
  chapter_order   INTEGER NOT NULL,
  source_file     VARCHAR(150) NOT NULL UNIQUE,
  icon            VARCHAR(50),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_id, class_id, chapter_order)
);

CREATE INDEX IF NOT EXISTS idx_education_chapters_subject_class
  ON education_chapters(subject_id, class_id);

CREATE TABLE IF NOT EXISTS education_student_chapter_progress (
  progress_id           SERIAL PRIMARY KEY,
  student_profile_id    INTEGER NOT NULL REFERENCES education_student_profiles(student_profile_id),
  chapter_id            INTEGER NOT NULL REFERENCES education_chapters(chapter_id),
  progress_percent      NUMERIC(5,2) NOT NULL DEFAULT 0
                           CHECK (progress_percent >= 0 AND progress_percent <= 100),
  status                VARCHAR(20) NOT NULL DEFAULT 'not_started'
                           CHECK (status IN ('not_started', 'in_progress', 'completed')),
  last_activity_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_profile_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_education_student_chapter_progress_student
  ON education_student_chapter_progress(student_profile_id);

COMMIT;
