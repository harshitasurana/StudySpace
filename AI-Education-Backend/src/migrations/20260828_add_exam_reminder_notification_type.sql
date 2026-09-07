-- Adds the EXAM_REMINDER notification type, for the daily job that nudges
-- a student ahead of an upcoming exam on their Academic Calendar (see
-- common/jobs/exam_reminder_job.js). Additive only, same posture as
-- 20260827_add_education_notification_types.sql and
-- 20260827_add_streak_reminder_notification_type.sql. Must run as its own
-- statement (no BEGIN/COMMIT wrapper) — Postgres won't let a newly added
-- enum value be used within the same transaction that added it, and this
-- file isn't wrapped by the migration runner either.

ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'EXAM_REMINDER';
