-- Persists a student's explicit "skip ahead and unlock this chapter"
-- action in My Learning's Learning Path — previously this only lived in
-- frontend React state (a Set that reset to empty on every reload), so a
-- manually-unlocked chapter silently re-locked itself the next time the
-- page loaded, even though nothing about the student's real progress
-- had changed.

ALTER TABLE education_student_chapter_progress ADD COLUMN IF NOT EXISTS manually_unlocked_at TIMESTAMPTZ;
