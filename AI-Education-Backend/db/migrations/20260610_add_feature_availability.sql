-- ============================================================
-- Migration : 20260610_add_feature_availability.sql
-- Date      : 2026-06-10
-- Purpose   : Add portal availability to features
-- ============================================================

BEGIN;

ALTER TABLE features
  ADD COLUMN IF NOT EXISTS feature_availability VARCHAR(20);

UPDATE features
SET feature_availability = 'BOTH'
WHERE feature_availability IS NULL;

ALTER TABLE features
  ALTER COLUMN feature_availability SET DEFAULT 'BOTH';

ALTER TABLE features
  ALTER COLUMN feature_availability SET NOT NULL;

ALTER TABLE features
  DROP CONSTRAINT IF EXISTS features_feature_availability_check;

ALTER TABLE features
  ADD CONSTRAINT features_feature_availability_check
  CHECK (feature_availability IN ('REACT', 'ANGULAR', 'BOTH'));

CREATE INDEX IF NOT EXISTS features_feature_availability_idx
  ON features(feature_availability);

COMMIT;
