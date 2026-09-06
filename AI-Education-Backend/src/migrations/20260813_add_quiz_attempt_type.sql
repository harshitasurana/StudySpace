-- Phase 5 — Sprint 5: Mock Tests + Pre-Assessment
-- Reuses quiz_attempts/quiz_answers from Phase 4 — attempt_type is the only
-- new column needed to tell a practice quiz apart from a timed mock test
-- or a chapter-starting pre-assessment.

BEGIN;

ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS attempt_type VARCHAR(20) NOT NULL DEFAULT 'quiz';

ALTER TABLE quiz_attempts
  DROP CONSTRAINT IF EXISTS quiz_attempts_attempt_type_check;

ALTER TABLE quiz_attempts
  ADD CONSTRAINT quiz_attempts_attempt_type_check
  CHECK (attempt_type IN ('quiz', 'mock_test', 'pre_assessment'));

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_type
  ON quiz_attempts(student_profile_id, attempt_type);

COMMIT;
