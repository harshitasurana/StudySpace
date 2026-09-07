-- Adds the STREAK_REMINDER notification type, for the daily job that
-- nudges a Self Student who has an active streak but hasn't done any
-- learning activity yet today (see common/jobs/streak_reminder_job.js).
-- Additive only, same posture as 20260827_add_education_notification_types.sql.

ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'STREAK_REMINDER';
