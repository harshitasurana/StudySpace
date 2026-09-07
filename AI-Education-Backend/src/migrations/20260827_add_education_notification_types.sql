-- Adds Education-specific notification types alongside the existing
-- healthcare set (SYSTEM/ORDER/MESSAGE/SECURITY/ANNOUNCEMENT/APPOINTMENT/
-- STAFF/PATIENT) on the shared enum_notifications_type type. Additive only
-- — existing rows/values are untouched. Each ALTER TYPE ADD VALUE must run
-- as its own statement (no BEGIN/COMMIT wrapper), since Postgres won't let
-- a newly added enum value be used within the same transaction that added
-- it, and this file isn't wrapped by the migration runner either.

ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'QUIZ_RESULT';
ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'MOCK_TEST_RESULT';
ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'STREAK_MILESTONE';
