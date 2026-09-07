-- Registers the new "AI Provider Keys" Admin page in this app's dynamic,
-- DB-driven menu system (features + feature_permissions) — the sidebar
-- does NOT fall back to a static nav list once any feature_permissions
-- rows exist for the logged-in role (see AppSideNavbar.jsx's
-- hasDynamicMenu check), so a route only appears in the sidebar once it
-- has a real Feature row + explicit permission grants, regardless of any
-- frontend isSuperAdmin bypass on route access itself.
--
-- Modeled directly on the existing "Help Center" feature (feature_id=308):
-- top-level (no parent_feature_id), category_id=13 ("Core"), shown in
-- menu. Permissions are granted ONLY to role_id=1 (super_admin) — unlike
-- Help Center this page is intentionally not delegable to other roles.

BEGIN;

INSERT INTO features (
  feature_name, description, is_active, is_deleted,
  parent_feature_id, show_in_menu, menu_label, menu_icon,
  router_link, menu_order, permissions, category_id
)
VALUES (
  'AI Provider Keys',
  'Manage Google AI Studio (Gemini) API keys used to speed up AI Tutor responses, with automatic fallback to the local model.',
  true, false,
  NULL, true, 'AI Provider Keys', 'bi bi-key',
  '/admin/ai-provider-keys', 18,
  '["can_create","can_read","can_update","can_delete"]'::json, 13
)
ON CONFLICT (feature_name) DO NOTHING;

INSERT INTO feature_permissions (role_id, feature_id, permission_name, is_enabled, permission_display_name)
SELECT 1, f.feature_id, perm.name, true, perm.display_name
FROM features f
CROSS JOIN (VALUES
  ('can_create', 'Create'),
  ('can_read', 'Read'),
  ('can_update', 'Update'),
  ('can_delete', 'Delete')
) AS perm(name, display_name)
WHERE f.feature_name = 'AI Provider Keys'
ON CONFLICT DO NOTHING;

COMMIT;
