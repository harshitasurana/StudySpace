-- Registers "Student Activity" (GET /api/admin/student-activity — which
-- students are signing in, what they're doing, and an estimate of how
-- long, derived from the existing platform-wide audit_logs request
-- logging via gap-based session detection, no new tracking needed) in
-- the dynamic, DB-driven Education-Admin menu — see AppSideNavbar.jsx's
-- hasDynamicMenu check for why a Feature row + explicit grants +
-- availability mapping are required for a sidebar entry to appear at
-- all, regardless of the route already existing.
--
-- Modeled directly on the sibling "Curriculum Management" (feature_id
-- 305): nested under the existing "Education" group (feature_id 318),
-- category_id 83 ("Education-1"), same role grants, same
-- availability_type_id 19 (REACT — the admin console's own client type,
-- distinct from the student app's REACT_EDUCATION=25).

BEGIN;

INSERT INTO features (
  feature_name, description, is_active, is_deleted,
  parent_feature_id, show_in_menu, menu_label, menu_icon,
  router_link, menu_order, permissions, category_id
)
VALUES (
  'Student Activity Monitoring',
  'Which students are signing in, what they''re doing, and an estimate of how much time they''re spending, derived from existing request activity logs.',
  true, false,
  318, true, 'Student Activity', 'bi bi-activity',
  '/admin/student-activity', 2,
  '["can_read"]'::json, 83
)
ON CONFLICT (feature_name) DO NOTHING;

INSERT INTO feature_permissions (role_id, feature_id, permission_name, is_enabled, permission_display_name)
SELECT fp.role_id, f.feature_id, 'can_read', true, 'Read'
FROM features f
CROSS JOIN (SELECT DISTINCT role_id FROM feature_permissions WHERE feature_id = 305) AS fp
WHERE f.feature_name = 'Student Activity Monitoring'
ON CONFLICT DO NOTHING;

INSERT INTO feature_availability_map (feature_id, availability_type_id)
SELECT f.feature_id, 19
FROM features f
WHERE f.feature_name = 'Student Activity Monitoring'
ON CONFLICT DO NOTHING;

COMMIT;
