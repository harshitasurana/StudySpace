-- Lets content a Parent creates while acting as a linked child (see
-- auth_middleware.js's X-Acting-Student-Profile-Id substitution) be
-- distinguished from the child's own activity, without changing who
-- OWNS the row — every row below still belongs to the same
-- student_profile_id it always would have; added_by_user_id just
-- records who actually performed the action when that's someone other
-- than the student themselves.
--
-- NULL (the default, and every existing row) = the student's own
-- action, unchanged from today. Non-NULL = the parent's real user_id.
--
-- No column added to education_mind_maps/education_infographics —
-- those are shared per-(chapter,board,standard) caches with no
-- student-ownership column at all, so "who generated this" doesn't
-- apply the way it does to a quiz attempt or a note.

BEGIN;

ALTER TABLE ai_messages
  ADD COLUMN added_by_user_id INTEGER REFERENCES users(user_id);

ALTER TABLE quiz_attempts
  ADD COLUMN added_by_user_id INTEGER REFERENCES users(user_id);

ALTER TABLE education_student_notes
  ADD COLUMN added_by_user_id INTEGER REFERENCES users(user_id);

ALTER TABLE education_student_bookmarks
  ADD COLUMN added_by_user_id INTEGER REFERENCES users(user_id);

ALTER TABLE education_flashcard_sets
  ADD COLUMN added_by_user_id INTEGER REFERENCES users(user_id);

COMMIT;
