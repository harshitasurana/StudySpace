-- Registers "My Flashcards", "My Mind Maps", "My Learning Decks" in the
-- dynamic, DB-driven menu system (features + feature_permissions +
-- feature_availability_map) — same reasoning and exact same shape as
-- 20260909b_add_my_quizzes_menu_feature.sql for "My Quizzes": a Feature
-- row + explicit grant + availability mapping is required for a sidebar
-- entry to appear at all (see Sidebar.jsx's dynamicItems / GET /api/menu).
--
-- Modeled directly on feature_id 291 ("By Subject") / the "My Quizzes"
-- feature: nested under "Practice" (feature_id 289), category_id 83
-- ("Education-1"), same role grants (1/16/19/20), same availability_type_id
-- 25 (REACT_EDUCATION) mapping.

BEGIN;

INSERT INTO features (
  feature_name, description, is_active, is_deleted,
  parent_feature_id, show_in_menu, menu_label, menu_icon,
  router_link, menu_order, permissions, category_id
)
VALUES
(
  'My Flashcards',
  'Every flashcard set this student has generated, across every subject, with a Generate New action.',
  true, false,
  289, true, 'My Flashcards', 'fas fa-clone',
  '/practice/my-flashcards', 3,
  '["can_create","can_read","can_update","can_delete"]'::json, 83
),
(
  'My Mind Maps',
  'Every mind map this student has generated, across every subject, with a Generate New action.',
  true, false,
  289, true, 'My Mind Maps', 'fas fa-diagram-project',
  '/practice/my-mind-maps', 4,
  '["can_create","can_read","can_update","can_delete"]'::json, 83
),
(
  'My Learning Decks',
  'Every learning (slide) deck this student has generated, across every subject, with a Generate New action.',
  true, false,
  289, true, 'My Learning Decks', 'fas fa-layer-group',
  '/practice/my-learning-decks', 5,
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
WHERE f.feature_name IN ('My Flashcards', 'My Mind Maps', 'My Learning Decks')
ON CONFLICT DO NOTHING;

INSERT INTO feature_availability_map (feature_id, availability_type_id)
SELECT f.feature_id, 25
FROM features f
WHERE f.feature_name IN ('My Flashcards', 'My Mind Maps', 'My Learning Decks')
ON CONFLICT DO NOTHING;

COMMIT;
