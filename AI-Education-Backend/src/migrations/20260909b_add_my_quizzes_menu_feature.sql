-- Registers "My Quizzes" (every quiz a student has generated, across
-- every subject, with Reattempt/Retry actions — see
-- src/modules/quiz/pages/MyQuizzes.jsx and its route at
-- /practice/my-quizzes) in the dynamic, DB-driven menu system
-- (features + feature_permissions + feature_availability_map) — see
-- Sidebar.jsx's dynamicItems and GET /api/menu for why a feature row +
-- explicit grant + availability mapping is required for a sidebar entry
-- to appear at all, regardless of the route already existing.
--
-- The route itself has existed since MyQuizzes.jsx shipped, reachable
-- only via a small "My Quizzes" text link buried inside the Practice
-- hub — this migration is what actually surfaces it as a real,
-- always-visible sidebar entry.
--
-- Modeled directly on feature_id 291 ("By Subject"): nested under
-- "Practice" (feature_id 289), category_id 83 ("Education-1"), same
-- role grants (Student, School Student, plus the two admin-ish roles
-- already granted on its siblings), same availability_type_id 25
-- (REACT_EDUCATION) mapping.

BEGIN;

INSERT INTO features (
  feature_name, description, is_active, is_deleted,
  parent_feature_id, show_in_menu, menu_label, menu_icon,
  router_link, menu_order, permissions, category_id
)
VALUES (
  'My Quizzes',
  'Every quiz this student has generated, across every subject, with Reattempt/Retry actions.',
  true, false,
  289, true, 'My Quizzes', 'fas fa-clipboard-check',
  '/practice/my-quizzes', 2,
  '["can_create","can_read","can_update","can_delete"]'::json, 83
)
ON CONFLICT (feature_name) DO NOTHING;

INSERT INTO feature_permissions (role_id, feature_id, permission_name, is_enabled, permission_display_name)
SELECT r.role_id, f.feature_id, perm.name, true, perm.display_name
FROM features f
CROSS JOIN (VALUES (1), (16), (19), (20)) AS r(role_id)
CROSS JOIN (VALUES
  ('can_create', 'Create'),
  ('can_read', 'Read'),
  ('can_update', 'Update'),
  ('can_delete', 'Delete')
) AS perm(name, display_name)
WHERE f.feature_name = 'My Quizzes'
ON CONFLICT DO NOTHING;

INSERT INTO feature_availability_map (feature_id, availability_type_id)
SELECT f.feature_id, 25
FROM features f
WHERE f.feature_name = 'My Quizzes'
ON CONFLICT DO NOTHING;

COMMIT;
