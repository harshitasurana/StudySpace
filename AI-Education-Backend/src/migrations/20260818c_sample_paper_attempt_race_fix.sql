-- Sample Papers — closes a real race condition in startAttemptService.
--
-- startAttemptService checks for an existing in_progress attempt before
-- creating a new one (added earlier to stop a page refresh from
-- orphaning a student's progress), but that check-then-create is not
-- atomic against two near-simultaneous requests — verified directly:
-- React StrictMode's dev-only double-invoke of the attempt page's mount
-- effect produced two real 'in_progress' rows for the same
-- student_profile_id+sample_paper_id, 14ms apart, both requests having
-- passed the "no existing attempt" check before either INSERT committed.
--
-- A partial unique index makes this atomic at the database level — the
-- one place a check-then-act race can actually be closed for good. The
-- second concurrent INSERT now fails with a real unique-violation, which
-- sample_paper_service.js catches and resolves to the row that won.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sample_paper_attempts_one_in_progress
  ON sample_paper_attempts (student_profile_id, sample_paper_id)
  WHERE status = 'in_progress';

COMMIT;
