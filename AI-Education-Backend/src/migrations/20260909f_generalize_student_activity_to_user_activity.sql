-- Generalizes "Student Activity Monitoring" into "User Activity
-- Monitoring": moves it out of the education-specific "Education
-- Management" group (feature_id 318) and renames it so the sidebar/API
-- read as organization-generic rather than education/student-specific.
--
-- parent_feature_id is set to NULL (a genuine top-level sidebar entry),
-- not re-parented under "User Management" (feature_id 264) — tried that
-- first, but 264 itself turns out to have no feature_availability_map
-- entry for this client type, so it never appears in GET /api/menu at
-- all; a child of an invisible parent just orphans back to the menu
-- root on its own anyway (confirmed live), so NULL says explicitly what
-- was already happening implicitly.
--
-- Updates the existing row in place (same feature_id) rather than
-- insert+delete, so its feature_permissions grants and
-- feature_availability_map row carry over untouched — they reference
-- feature_id, not the name. See user_activity_service.js for the actual
-- generalized query (any role, org-scoped via
-- UserStructureAssignment/organization_id, education-specific fields
-- now an optional enrichment instead of a required join).

BEGIN;

UPDATE features
SET
  feature_name = 'User Activity Monitoring',
  description = 'Which users are signing in, what they''re doing, and an estimate of how much time they''re spending, derived from existing request activity logs. Covers every role in the organization, not just students.',
  parent_feature_id = NULL,
  -- category_id 13 ("Core") is the same generic admin-console category
  -- User Management/Organization/System Settings/Security Settings/Admin
  -- Roles already live in — was 83 ("Education-1"), which would have
  -- kept this reading as education-specific in any UI that groups by
  -- category even after moving it out of the Education Management menu
  -- group itself.
  category_id = 13,
  menu_label = 'User Activity',
  router_link = '/admin/user-activity',
  menu_order = 9
WHERE feature_name = 'Student Activity Monitoring';

COMMIT;
