-- Registers the full Parent Portal navigation in the dynamic, DB-driven
-- menu system (features + feature_permissions + feature_availability_map)
-- — see AppSideNavbar.jsx's (Education-Admin) and Sidebar.jsx's
-- (AI-Education-Frontend) shared convention: a role's real sidebar comes
-- from GET /api/menu once it has feature_permissions rows, same as
-- Student.
--
-- Two things confirmed against the live DB before writing this (do not
-- skip re-verifying if this migration is ever adapted):
--   1. category_id 83 ("Education-1", description "Education features")
--      is the real, already-used category for every existing Education
--      feature (Dashboard, AI Tutor, Achievements, Notifications, General
--      Settings, ...) - NOT category_id 82, which is "Education roles"
--      (used by the roles table itself: Student/School Student/Parent).
--   2. Every one of those existing features has a row in
--      feature_availability_map for availability_type_id 25
--      (code = REACT_EDUCATION). AI-Education-Frontend's apiClient.js
--      sends "X-Client-Type: REACT_EDUCATION" on every request, and
--      menu_controller.js's fetchFeaturesFromDatabase does a REQUIRED
--      (inner-join) filter on this when the header is present - a feature
--      with no row here is invisible to this app's GET /api/menu no
--      matter what feature_permissions it has. This was missing from an
--      earlier draft of this migration and would have silently produced
--      an empty Parent menu despite every other piece being correct.
--
-- This is also what closes the real bug in fetchFeaturesFromDatabase — a
-- role with ZERO feature_permissions rows skips its own permission filter
-- and gets served EVERY show_in_menu feature platform-wide (confirmed
-- live for Parent before this migration). Granting real rows here is what
-- makes GET /api/menu start filtering correctly for Parent, not just an
-- additive nice-to-have. Sidebar.jsx's hardcoded 'parent' case (added as a
-- same-day workaround before this existed) should revert to `return []`
-- once this is applied, matching 'student'/'school student'.
--
-- Names are prefixed "Parent " throughout — feature_name is UNIQUE
-- platform-wide across this shared healthcare+education table, and bare
-- names like "Settings"/"Achievements"/"Notifications" are ALREADY taken
-- by the real student-side features listed above (confirmed via direct
-- query) - reusing those names/rows would incorrectly hand Parent the
-- student's own settings/achievements pages instead of parent-scoped
-- ones.
--
-- "Parent Learning Progress" is a group only — no real page of its own,
-- nests Overview/Subjects as children via parent_feature_id, same shape
-- as this table's own real "AI Tutor" (283) -> "Tutor Chat" (284) and
-- "Progress" (293) -> "Progress-Overview"/"Subject Progress" (304/301)
-- examples.

BEGIN;

INSERT INTO features (
  feature_name, description, is_active, is_deleted,
  parent_feature_id, show_in_menu, menu_label, menu_icon,
  router_link, menu_order, permissions, category_id
)
SELECT v.feature_name, v.description, true, false, NULL::integer, true, v.menu_label, v.menu_icon, v.router_link, v.menu_order,
       '["can_create","can_read","can_update","can_delete"]'::json, 83
FROM (VALUES
  ('Parent Dashboard', 'Parent Portal home — overview, subject performance, AI insight, and upcoming items for a linked child.', 'Dashboard', 'home', '/parent-dashboard', 1),
  ('Parent Learning Progress', 'Group node — Overview and Subjects nest under this.', 'Learning Progress', 'trending_up', '/parent-dashboard', 2),
  ('Parent Assessments', 'Recent quiz/mock test results for a linked child.', 'Assessments', 'assignment_turned_in', '/parent-dashboard/assessments', 3),
  ('Parent Academic Calendar', 'Upcoming exams/assignments for a linked child.', 'Academic Calendar', 'calendar_month', '/parent-dashboard/calendar', 4),
  ('Parent AI Insights', 'Computed learning summary + AI Tutor conversation history for a linked child.', 'AI Insights', 'psychology', '/parent-dashboard/insights', 5),
  ('Parent Achievements', 'Badges/milestones a linked child has earned.', 'Achievements', 'emoji_events', '/parent-dashboard/achievements', 6),
  ('Parent Notifications', 'Parent-facing alerts — not yet built (ComingSoonPage).', 'Notifications', 'notifications', '/parent-dashboard/notifications', 7),
  ('Parent Learning Reports', 'Monthly learning reports — not yet built (ComingSoonPage).', 'Learning Reports', 'summarize', '/parent-dashboard/reports', 8),
  ('Parent Settings', 'Account/notification/privacy settings — not yet built (ComingSoonPage).', 'Settings', 'settings', '/parent-dashboard/settings', 9)
) AS v(feature_name, description, menu_label, menu_icon, router_link, menu_order)
WHERE NOT EXISTS (SELECT 1 FROM features f WHERE f.feature_name = v.feature_name);

-- Children of "Parent Learning Progress" — needs that row's real
-- feature_id for parent_feature_id, so inserted as its own statement.
INSERT INTO features (
  feature_name, description, is_active, is_deleted,
  parent_feature_id, show_in_menu, menu_label, menu_icon,
  router_link, menu_order, permissions, category_id
)
SELECT v.feature_name, v.description, true, false, parent.feature_id, true, v.menu_label, v.menu_icon, v.router_link, v.menu_order,
       '["can_create","can_read","can_update","can_delete"]'::json, 83
FROM (VALUES
  ('Parent Progress Overview', 'Same as the Parent Dashboard home.', 'Overview', 'dashboard', '/parent-dashboard', 1),
  ('Parent Subjects', 'Subject-wise chapter completion, quiz scores, and weak areas.', 'Subjects', 'menu_book', '/parent-dashboard/progress', 2)
) AS v(feature_name, description, menu_label, menu_icon, router_link, menu_order)
CROSS JOIN (SELECT feature_id FROM features WHERE feature_name = 'Parent Learning Progress') parent
WHERE NOT EXISTS (SELECT 1 FROM features f WHERE f.feature_name = v.feature_name);

-- Make every one of the 9 rows above visible to this app's GET /api/menu
-- (X-Client-Type: REACT_EDUCATION -> availability_type_id 25).
INSERT INTO feature_availability_map (feature_id, availability_type_id)
SELECT f.feature_id, 25
FROM features f
WHERE f.feature_name IN (
  'Parent Dashboard', 'Parent Learning Progress', 'Parent Progress Overview', 'Parent Subjects',
  'Parent Assessments', 'Parent Academic Calendar', 'Parent AI Insights', 'Parent Achievements',
  'Parent Notifications', 'Parent Learning Reports', 'Parent Settings'
)
ON CONFLICT (feature_id, availability_type_id) DO NOTHING;

-- Grant can_read on every Parent Portal feature to the Parent role
-- (role_id 21 — see 20260906_add_parent_role_and_links.sql).
INSERT INTO feature_permissions (role_id, feature_id, permission_name, is_enabled, permission_display_name)
SELECT (SELECT role_id FROM roles WHERE role_name = 'Parent'), f.feature_id, 'can_read', true, 'Read'
FROM features f
WHERE f.feature_name IN (
  'Parent Dashboard', 'Parent Learning Progress', 'Parent Progress Overview', 'Parent Subjects',
  'Parent Assessments', 'Parent Academic Calendar', 'Parent AI Insights', 'Parent Achievements',
  'Parent Notifications', 'Parent Learning Reports', 'Parent Settings'
)
ON CONFLICT DO NOTHING;

COMMIT;
