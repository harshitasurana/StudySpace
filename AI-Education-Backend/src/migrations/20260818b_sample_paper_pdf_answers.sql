-- Sample Papers — Stage 1/2 redesign: a single consolidated answer PDF
-- per attempt, not per-question typed text or per-question photos.
--
-- The student writes out every answer on paper (organized by question
-- number/section), scans/photographs it into ONE PDF, and uploads it once
-- after going through all questions. Grading reuses the Stage 0 admin
-- extraction pattern (core/sample_paper_extraction.py): each PDF page is
-- rendered to an image and read by the local vision model, matched back to
-- the paper's real questions by question number, then graded against the
-- real rubric/model_answer already stored in Postgres (see
-- core/sample_paper_grading.py).
--
-- sample_paper_responses is therefore no longer written by the student in
-- real time (the old submitTextResponseService/submitPhotoResponseService
-- upsert-per-question flow) — it's written entirely by the grading
-- callback, one row per question once that question's transcribed answer
-- has been matched and graded. No real photo/typed response data exists
-- yet for this table (Stage 2 grading was never built until now), so this
-- is a zero-data-loss schema change.

BEGIN;

ALTER TABLE sample_paper_attempts
  ADD COLUMN answer_pdf_key VARCHAR(500);

ALTER TABLE sample_paper_responses
  DROP COLUMN answer_type,
  DROP COLUMN answer_image_key,
  DROP COLUMN image_quality_status,
  DROP COLUMN answered_at;

ALTER TABLE sample_paper_responses
  RENAME COLUMN answer_text TO transcribed_answer;

CREATE TABLE IF NOT EXISTS sample_paper_grading_logs (
  log_id        SERIAL PRIMARY KEY,
  attempt_id    INTEGER NOT NULL REFERENCES sample_paper_attempts(attempt_id),
  status        VARCHAR(10) NOT NULL CHECK (status IN ('completed', 'failed')),
  questions_graded INTEGER,
  raw_output    TEXT,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sample_paper_grading_logs_attempt
  ON sample_paper_grading_logs(attempt_id);

COMMIT;
