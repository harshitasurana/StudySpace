-- Sample Papers — Stage 1 (student paper-taking flow).
--
-- Mirrors quiz_attempts/quiz_answers' shape (see 20260812_add_quiz_tables.sql)
-- but for free-response answers (typed text or an uploaded photo) instead
-- of MCQ selection, and per-question structured grading instead of a
-- single correct/incorrect flag.
--
-- grading_internal_notes is intentionally never read by any student-facing
-- API route (see sample_paper_service.js) — it holds the LLM's raw
-- grading reasoning, kept only for debugging/audit, same discipline as
-- quiz_service.js stripping correct_answer/explanation via
-- toPublicQuestion before a question ever reaches the client.
--
-- needs_self_review is a student-facing uncertainty flag only (this
-- product has no teacher/reviewer for self students) — it drives the
-- results UI to show the model answer/rubric alongside an uncertain
-- score and tell the student to judge it themselves, not the seed of an
-- operational review queue.

BEGIN;

CREATE TABLE IF NOT EXISTS sample_paper_attempts (
  attempt_id          SERIAL PRIMARY KEY,
  student_profile_id  INTEGER NOT NULL REFERENCES education_student_profiles(student_profile_id),
  sample_paper_id     INTEGER NOT NULL REFERENCES sample_papers(sample_paper_id),
  status               VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress', 'submitted', 'grading', 'graded', 'failed')),
  total_marks           INTEGER NOT NULL,
  score                 NUMERIC(6,2),
  percentage             NUMERIC(5,2),
  started_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at            TIMESTAMPTZ,
  graded_at               TIMESTAMPTZ,
  grading_error           TEXT
);

CREATE INDEX IF NOT EXISTS idx_sample_paper_attempts_student
  ON sample_paper_attempts(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_sample_paper_attempts_paper
  ON sample_paper_attempts(sample_paper_id);

CREATE TABLE IF NOT EXISTS sample_paper_responses (
  response_id          SERIAL PRIMARY KEY,
  attempt_id           INTEGER NOT NULL REFERENCES sample_paper_attempts(attempt_id),
  question_id          INTEGER NOT NULL REFERENCES sample_paper_questions(question_id),
  answer_type          VARCHAR(10) NOT NULL CHECK (answer_type IN ('typed', 'photo')),
  answer_text          TEXT,
  answer_image_key     VARCHAR(500),
  max_marks            INTEGER NOT NULL CHECK (max_marks > 0),
  marks_awarded         NUMERIC(5,2)
                        CHECK (marks_awarded IS NULL OR (marks_awarded >= 0 AND marks_awarded <= max_marks)),
  rubric_breakdown        JSONB,
  feedback                 TEXT,
  grading_internal_notes    TEXT,
  grading_confidence          VARCHAR(10) CHECK (grading_confidence IS NULL OR grading_confidence IN ('high', 'medium', 'low')),
  needs_self_review              BOOLEAN NOT NULL DEFAULT FALSE,
  image_quality_status             VARCHAR(10) NOT NULL DEFAULT 'n/a'
                                    CHECK (image_quality_status IN ('n/a', 'pending', 'ok', 'rejected')),
  answered_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graded_at                           TIMESTAMPTZ,
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_sample_paper_responses_attempt
  ON sample_paper_responses(attempt_id);

COMMIT;
