-- Adds a real "School Student" role, distinct from the existing "Student"
-- (self-directed) role, for students onboarding via a school code.
--
-- organization_id is deliberately NULL here (unlike Student's 6 /
-- Myntiq-Education) — a school-student's real org affiliation should come
-- from the specific school they verify into via school_code, not a shared
-- catch-all org, so updateOwnRole()'s auto-org-enroll step
-- (`if (role.organization_id) assignUserToOrganization(...)`) correctly
-- does not fire at role-selection time.
--
-- Role string note: role_name is put into the JWT verbatim and compared
-- frontend-side as `role_name.toLowerCase()` with no space->underscore
-- conversion anywhere (verified against user_service.js/RoleBasedRoute.jsx/
-- routeConfig.js) - so this MUST stay 'School Student' (title case) to
-- match the frontend's `role === 'school student'` checks.
--
-- Rollback, if the permission clone below runs partially: both statements
-- are idempotent, so
--   DELETE FROM feature_permissions WHERE role_id = (SELECT role_id FROM roles WHERE role_name = 'School Student');
--   DELETE FROM roles WHERE role_name = 'School Student';
-- followed by re-running this file reproduces the same end state cleanly.

BEGIN;

INSERT INTO roles (
  role_name, description, category_id, organization_id,
  status, is_self_assignable, is_active, system_flag, is_deleted
)
VALUES (
  'School Student',
  'A student onboarding through their school via a school code, rather than self-directed study.',
  82,    -- Education category (same as Student, role_id 19)
  NULL,  -- no umbrella org - affiliation comes from the verified school
  'Active', TRUE, TRUE, FALSE, FALSE
)
ON CONFLICT (role_name) DO NOTHING;

-- Clone Student's (role_id 19) feature_permissions rows so the sidebar/
-- menu populate identically for School Student - useStudentRBAC/Sidebar.jsx
-- menu content is entirely feature_permissions-by-role_id driven, no
-- role-name branching involved.
INSERT INTO feature_permissions (
  role_id, feature_id, permission_name, is_enabled,
  permission_display_name, permission_description
)
SELECT
  (SELECT role_id FROM roles WHERE role_name = 'School Student'),
  feature_id, permission_name, is_enabled,
  permission_display_name, permission_description
FROM feature_permissions
WHERE role_id = 19 AND user_id IS NULL
ON CONFLICT (role_id, feature_id, permission_name) WHERE user_id IS NULL DO NOTHING;

COMMIT;
