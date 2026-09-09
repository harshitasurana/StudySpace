-- Subscription/Paywall System, Phase 3 — per-student/feature/period usage
-- counters. One row per (student_profile_id, feature_key, period_start)
-- bucket; resets naturally when period_start rolls over to a new day/month,
-- no cron job needed. usage_limit_service.js's incrementAndCheckUsage does
-- an atomic upsert-and-increment against the unique constraint below.

BEGIN;

CREATE TABLE IF NOT EXISTS feature_usage_counters (
  usage_counter_id     SERIAL PRIMARY KEY,
  student_profile_id   INTEGER NOT NULL REFERENCES education_student_profiles(student_profile_id),
  feature_key           VARCHAR(100) NOT NULL,
  period_start          DATE NOT NULL,
  period_type           VARCHAR(10) NOT NULL CHECK (period_type IN ('day', 'month')),
  count                 INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_profile_id, feature_key, period_start)
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_counters_student_feature
  ON feature_usage_counters(student_profile_id, feature_key);

COMMIT;
