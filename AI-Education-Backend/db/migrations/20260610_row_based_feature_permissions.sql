-- ============================================================
-- Migration : 20260610_row_based_feature_permissions.sql
-- Date      : 2026-06-10
--
-- Current DB state (verified against healthcare_db):
--
--   feature_permissions        ← old boolean-column schema
--                                 columns: role_id, feature_id, user_id,
--                                          can_read, can_create, can_update, can_delete,
--                                          created_by, created_at, updated_at
--                                 unique: (role_id, feature_id) / (user_id, feature_id)
--
--   feature_custom_permissions ← existing row-based table (code module now removed)
--                                 columns: role_id, user_id, feature_id,
--                                          permission_name, permission_display_name,
--                                          permission_description, is_enabled,
--                                          created_by, created_at, updated_at
--
-- Target state after migration:
--
--   feature_permissions        ← new row-based schema
--                                 one row per (role/user, feature, permission_name)
--                                 is_enabled replaces the old boolean columns
--
--   feature_custom_permissions ← DROPPED (module removed from codebase)
--   feature_permissions_legacy ← DROPPED after data is migrated
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- STEP 1 · Preserve existing data in a legacy table
-- ─────────────────────────────────────────────────────────────
ALTER TABLE feature_permissions RENAME TO feature_permissions_legacy;

-- ─────────────────────────────────────────────────────────────
-- STEP 2 · Create new row-based feature_permissions table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE feature_permissions (
  id                      SERIAL PRIMARY KEY,
  user_id                 INTEGER  NULL REFERENCES users(user_id),
  role_id                 INTEGER  NULL REFERENCES roles(role_id),
  feature_id              INTEGER  NOT NULL REFERENCES features(feature_id),
  permission_name         VARCHAR(100) NOT NULL,
  permission_display_name VARCHAR(120) NULL,
  permission_description  VARCHAR(255) NULL,
  is_enabled              BOOLEAN  NOT NULL DEFAULT TRUE,
  created_by              INTEGER  NULL REFERENCES users(user_id),
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- STEP 3 · Indexes
-- ─────────────────────────────────────────────────────────────

-- Unique: one row per role+feature+permission (role-based entries)
CREATE UNIQUE INDEX feature_permissions_role_feature_permission_unique
  ON feature_permissions(role_id, feature_id, permission_name)
  WHERE user_id IS NULL;

-- Unique: one row per user+feature+permission (user override entries)
CREATE UNIQUE INDEX feature_permissions_user_feature_permission_unique
  ON feature_permissions(user_id, feature_id, permission_name)
  WHERE user_id IS NOT NULL;

-- Lookup indexes
CREATE INDEX feature_permissions_role_idx    ON feature_permissions(role_id);
CREATE INDEX feature_permissions_user_idx    ON feature_permissions(user_id);
CREATE INDEX feature_permissions_feature_idx ON feature_permissions(feature_id);
CREATE INDEX feature_permissions_name_idx    ON feature_permissions(permission_name);
CREATE INDEX feature_permissions_enabled_idx ON feature_permissions(is_enabled);
CREATE INDEX feature_permissions_lookup_idx  ON feature_permissions(feature_id, permission_name, is_enabled);

-- ─────────────────────────────────────────────────────────────
-- STEP 4 · Migrate legacy boolean CRUD columns → permission rows
--          Only TRUE values become rows (FALSE = permission not granted,
--          omit row entirely; absence of row means no permission).
-- ─────────────────────────────────────────────────────────────
INSERT INTO feature_permissions (
  user_id, role_id, feature_id,
  permission_name, permission_display_name, permission_description,
  is_enabled, created_by, created_at, updated_at
)
SELECT
  user_id,
  role_id,
  feature_id,
  permission_name,
  initcap(replace(permission_name, 'can_', '')) AS permission_display_name,
  NULL AS permission_description,
  TRUE  AS is_enabled,
  created_by,
  created_at,
  updated_at
FROM (
  SELECT user_id, role_id, feature_id, created_by, created_at, updated_at,
         'can_read'   AS permission_name
  FROM   feature_permissions_legacy WHERE can_read   = TRUE
  UNION ALL
  SELECT user_id, role_id, feature_id, created_by, created_at, updated_at,
         'can_create' AS permission_name
  FROM   feature_permissions_legacy WHERE can_create = TRUE
  UNION ALL
  SELECT user_id, role_id, feature_id, created_by, created_at, updated_at,
         'can_update' AS permission_name
  FROM   feature_permissions_legacy WHERE can_update = TRUE
  UNION ALL
  SELECT user_id, role_id, feature_id, created_by, created_at, updated_at,
         'can_delete' AS permission_name
  FROM   feature_permissions_legacy WHERE can_delete = TRUE
) standard_perms;

-- ─────────────────────────────────────────────────────────────
-- STEP 5 · Merge feature_custom_permissions into the new table
--          These rows are already in row-based format; copy them
--          directly. ON CONFLICT DO NOTHING skips any duplicate
--          that was already inserted from the legacy CRUD columns.
-- ─────────────────────────────────────────────────────────────
INSERT INTO feature_permissions (
  user_id, role_id, feature_id,
  permission_name, permission_display_name, permission_description,
  is_enabled, created_by, created_at, updated_at
)
SELECT
  user_id, role_id, feature_id,
  permission_name, permission_display_name, permission_description,
  is_enabled, created_by, created_at, updated_at
FROM feature_custom_permissions
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- STEP 6 · Drop obsolete tables
-- ─────────────────────────────────────────────────────────────
DROP TABLE feature_custom_permissions;
DROP TABLE feature_permissions_legacy;

COMMIT;
