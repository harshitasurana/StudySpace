-- Persists the first Free -> Pro/School upgrade moment per student so a
-- chapter unlock is permanent, matching the actual product intent — a
-- later subscription downgrade/lapse must never silently re-lock a
-- chapter a student already earned access to. Previously
-- resolveChapterAccess recomputed access from the LIVE subscription tier
-- on every single check, with nothing persisted at all.

ALTER TABLE education_student_profiles ADD COLUMN IF NOT EXISTS pro_access_unlocked_at TIMESTAMPTZ;
