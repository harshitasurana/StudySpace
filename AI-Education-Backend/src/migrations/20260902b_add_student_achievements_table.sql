-- Persists WHEN each of the 11 real achievements (see
-- progress_service.js's getAchievementsService) was first earned — until
-- now that state was recomputed fresh on every GET with nothing stored,
-- so there was no way to detect "this was JUST unlocked" (needed to fire
-- a one-time notification + award a one-time XP bonus, rather than
-- re-notifying/re-awarding on every single page load).
--
-- bonus_xp is stored per-row (not just a fixed constant read at
-- award-time) so a later change to the per-achievement bonus amount
-- never silently rewrites what a student already actually earned.

CREATE TABLE IF NOT EXISTS education_student_achievements (
  id SERIAL PRIMARY KEY,
  student_profile_id INTEGER NOT NULL REFERENCES education_student_profiles(student_profile_id),
  achievement_id VARCHAR(50) NOT NULL,
  bonus_xp INTEGER NOT NULL DEFAULT 0,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_profile_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_education_student_achievements_student
  ON education_student_achievements (student_profile_id);
