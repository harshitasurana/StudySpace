-- Adds the CHAPTER_UNLOCKED notification type, fired when a student's
-- subscription genuinely transitions Free -> Pro/School (see
-- subscription_service.js's updateSubscription) — the only real
-- "chapter unlock" event that exists today, since content access is
-- purely product-tier-gated, not per-chapter progression (see
-- content_access_service.js's resolveChapterAccess). Additive only, same
-- posture as the other *_notification_type.sql migrations in this
-- directory. Must run as its own statement (no BEGIN/COMMIT wrapper) —
-- Postgres won't let a newly added enum value be used within the same
-- transaction that added it, and this file isn't wrapped by the
-- migration runner either.

ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'CHAPTER_UNLOCKED';

-- Bundled in the same file since both were added together — fired when
-- getAchievementsService detects a newly-crossed milestone (see
-- progress_service.js and the new education_student_achievements table).
ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'ACHIEVEMENT_UNLOCKED';
