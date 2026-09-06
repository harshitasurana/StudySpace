-- Phase 4 — Sprint 4: Practice / Quiz (real)
-- Questions (including correct_answer/explanation) are generated once by
-- the AI service and stored here at attempt creation — never regenerated,
-- never trusted from the client on submit. quiz_answers is graded purely
-- by comparing against this stored copy.

BEGIN;

CREATE TABLE IF NOT EXISTS quiz_attempts (
  attempt_id          SERIAL PRIMARY KEY,
  student_profile_id  INTEGER NOT NULL REFERENCES education_student_profiles(student_profile_id),
  chapter_id          INTEGER NOT NULL REFERENCES education_chapters(chapter_id),
  questions           JSONB NOT NULL,
  total_questions     INTEGER NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted')),
  score               INTEGER NOT NULL DEFAULT 0,
  percentage          NUMERIC(5,2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student
  ON quiz_attempts(student_profile_id);

CREATE TABLE IF NOT EXISTS quiz_answers (
  answer_id        SERIAL PRIMARY KEY,
  attempt_id       INTEGER NOT NULL REFERENCES quiz_attempts(attempt_id),
  question_index   INTEGER NOT NULL,
  selected_answer  VARCHAR(10) NOT NULL,
  is_correct       BOOLEAN NOT NULL,
  answered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, question_index)
);

COMMIT;
