-- ============================================================
-- Migration : 20260611_migrate_role_permissions_to_feature_permissions.sql
-- Date      : 2026-06-11
-- Purpose   : Backfill role-level feature permissions from roles.permissions JSONB
--             into the row-based feature_permissions table
-- ============================================================

BEGIN;

WITH role_permission_entries AS (
  SELECT
    r.role_id,
    COALESCE(r.updated_by, r.created_by) AS actor_id,
    permission_entry
  FROM roles r
  CROSS JOIN LATERAL jsonb_array_elements(r.permissions) AS permission_entry
  WHERE r.permissions IS NOT NULL
    AND jsonb_typeof(r.permissions) = 'array'
    AND r.is_deleted = false
),
permission_rows AS (
  SELECT
    rpe.role_id,
    (rpe.permission_entry->>'feature_id')::INTEGER AS feature_id,
    kv.key AS permission_name,
    CASE
      WHEN lower(kv.value) = 'true' THEN true
      WHEN lower(kv.value) = 'false' THEN false
      ELSE false
    END AS is_enabled,
    rpe.actor_id
  FROM role_permission_entries rpe
  CROSS JOIN LATERAL jsonb_each_text(rpe.permission_entry) AS kv(key, value)
  WHERE kv.key LIKE 'can\_%' ESCAPE '\\'
    AND rpe.permission_entry ? 'feature_id'
    AND (rpe.permission_entry->>'feature_id') ~ '^[0-9]+$'
),
normalized_permission_rows AS (
  SELECT
    pr.role_id,
    NULL::INTEGER AS user_id,
    pr.feature_id,
    pr.permission_name,
    initcap(replace(replace(pr.permission_name, 'can_', ''), '_', ' ')) AS permission_display_name,
    initcap(replace(replace(pr.permission_name, 'can_', ''), '_', ' ')) || ' access' AS permission_description,
    pr.is_enabled,
    pr.actor_id
  FROM permission_rows pr
)
INSERT INTO feature_permissions (
  role_id,
  user_id,
  feature_id,
  permission_name,
  permission_display_name,
  permission_description,
  is_enabled,
  created_by,
  created_at,
  updated_at
)
SELECT
  npr.role_id,
  npr.user_id,
  npr.feature_id,
  npr.permission_name,
  npr.permission_display_name,
  npr.permission_description,
  npr.is_enabled,
  npr.actor_id,
  NOW(),
  NOW()
FROM normalized_permission_rows npr
ON CONFLICT (role_id, feature_id, permission_name) WHERE user_id IS NULL
DO UPDATE SET
  permission_display_name = EXCLUDED.permission_display_name,
  permission_description = EXCLUDED.permission_description,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW();

COMMIT;
