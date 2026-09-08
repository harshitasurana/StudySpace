-- Adds the STUDY_REMINDER notification type, for the daily job that nudges
-- a self-mode student toward a specific real chapter to study today (see
-- common/jobs/study_reminder_job.js) — the counterpart to
-- STREAK_REMINDER for students who don't currently have an active streak
-- at risk (streak_reminder_job.js only fires for those who do). Additive
-- only, same posture as 20260827_add_streak_reminder_notification_type.sql
-- and 20260828_add_exam_reminder_notification_type.sql. Must run as its
-- own statement (no BEGIN/COMMIT wrapper) — Postgres won't let a newly
-- added enum value be used within the same transaction that added it, and
-- this file isn't wrapped by the migration runner either.

ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'STUDY_REMINDER';
