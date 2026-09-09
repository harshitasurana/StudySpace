-- Grants the Parent role (role_id 21) the same feature_permissions rows
-- the Student role (role_id 19) already has on the real, existing
-- self-student features — AI Tutor (+ AI Study Plan/AI Sessions nested
-- under it), Practice, Mock Tests, Notes, Bookmarks, Learning Path.
--
-- Deliberately NOT new feature rows (unlike
-- 20260906c_add_parent_portal_features.sql's "Parent "-prefixed rows) —
-- these are the actual student-facing pages themselves, reused as-is via
-- the X-Acting-Student-Profile-Id substitution in auth_middleware.js, so
-- Parent gets grants on the SAME feature_ids Student already uses, not
-- parallel Parent-only copies. Every one of these feature_ids already has
-- a feature_availability_map row for availability_type_id 25
-- (REACT_EDUCATION) — confirmed live — so no availability_map work is
-- needed here, only feature_permissions.
--
-- Mind Map (320) / Infographic (322) / Flashcards (323) / Quiz-Practice
-- Drills (325) are deliberately excluded — confirmed live that Student
-- itself has zero feature_permissions rows on any of these four (they're
-- chapter-embedded generation actions, not separately-gated menu
-- destinations), so there is nothing to mirror for Parent either;
-- granting rows Student doesn't have would be new, unreviewed scope, not
-- parity.

BEGIN;

INSERT INTO feature_permissions (role_id, feature_id, permission_name, is_enabled, permission_display_name)
SELECT 21, feature_id, permission_name, is_enabled, permission_display_name
FROM feature_permissions
WHERE role_id = 19
  -- AI Tutor, Tutor Chat, Learning Path, Practice, Mock Tests, Notes,
  -- Bookmarks, AI Study Plan, AI Sessions. 284 (Tutor Chat) was missing
  -- from the original list here — AI Tutor's menu group (283) and its
  -- Study Plan/Sessions children (306/307) got granted, but not the
  -- actual chat interface, so a parent had no way to reach AI Tutor
  -- chat at all despite the feature otherwise "working." Caught live
  -- testing the sidebar after linking a child.
  AND feature_id IN (283, 284, 288, 289, 292, 294, 295, 306, 307)
ON CONFLICT DO NOTHING;

COMMIT;
