-- Background-job quiz/mock-test/pre-assessment generation. Today a
-- quiz_attempts row is only ever created AFTER the AI service's response
-- comes back — if the student navigates away while generation is still
-- running, nothing in the DB reflects that an attempt was ever requested,
-- and the generated questions (once the AI service does resolve) have no
-- live client left to persist them. This adds a generation_status
-- lifecycle (mirroring education_mind_maps/education_slide_decks'
-- pending/processing/completed/failed pattern) so the row exists BEFORE
-- generation starts and survives navigation — RAGProductionApp's Celery
-- worker now reports the outcome back via
-- POST /api/quiz/attempts/:attemptId/callback instead of the request
-- blocking until the questions are ready.
--
-- generation_status is deliberately separate from the existing `status`
-- column, which tracks ANSWERING progress (in_progress/submitted) and is
-- meaningless until generation_status = 'completed'.

BEGIN;

ALTER TABLE quiz_attempts
  ALTER COLUMN questions DROP NOT NULL,
  ALTER COLUMN total_questions DROP NOT NULL;

ALTER TABLE quiz_attempts
  ADD COLUMN generation_status VARCHAR(20) NOT NULL DEFAULT 'completed'
    CHECK (generation_status IN ('processing', 'completed', 'failed')),
  ADD COLUMN error_message TEXT,
  -- The resolved buildQuizFocus() instruction and, for a note-to-quiz
  -- conversion, the exact grounding text — persisted so a stuck-row retry
  -- (see quiz_service.js's recoverStuckQuizAttempt) can redo the EXACT
  -- original generation request without needing the student's original
  -- `mode` again (mode itself is never stored; only the focus it resolved
  -- to is needed to regenerate).
  ADD COLUMN generation_focus TEXT,
  ADD COLUMN source_text TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMIT;
