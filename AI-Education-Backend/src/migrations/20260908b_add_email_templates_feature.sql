-- Registers the new "Email Templates" Admin page in the dynamic,
-- DB-driven menu system (features + feature_permissions) — same pattern
-- as 20260905b_add_site_feedback_feature.sql: top-level, category_id=13
-- ("Core", the Education-Admin console's own category — NOT 83, which is
-- for the student-facing app's features), permissions granted only to
-- role_id=1 (super_admin) to start.

BEGIN;

INSERT INTO features (
  feature_name, description, is_active, is_deleted,
  parent_feature_id, show_in_menu, menu_label, menu_icon,
  router_link, menu_order, permissions, category_id
)
VALUES (
  'Email Templates',
  'Edit the branded welcome emails sent to students and parents when they register, and send test emails.',
  true, false,
  NULL, true, 'Email Templates', 'bi bi-envelope',
  '/admin/email-templates', 20,
  '["can_read","can_update"]'::json, 13
)
ON CONFLICT (feature_name) DO NOTHING;

INSERT INTO feature_permissions (role_id, feature_id, permission_name, is_enabled, permission_display_name)
SELECT 1, f.feature_id, perm.name, true, perm.display_name
FROM features f
CROSS JOIN (VALUES
  ('can_read', 'Read'),
  ('can_update', 'Update')
) AS perm(name, display_name)
WHERE f.feature_name = 'Email Templates'
ON CONFLICT DO NOTHING;

COMMIT;
