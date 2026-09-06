-- Phase 7 hardening follow-up: sidebar ordering + a leaked admin permission.
--
-- 1) Every education feature was seeded with menu_order = 0, so the sidebar
--    fell back to alphabetical (feature_name ASC) tie-breaking, producing
--    Achievements / AI-Tutor / Bookmarks / Mock Tests / ... in a-z order
--    instead of a real learning-flow order. Assigns explicit menu_order
--    values so the self-student sidebar reads top-to-bottom as: Student
--    Dashboard, AI Tutor, Practice, Mock Tests, My Learning, Progress,
--    Notes, Bookmarks, Achievements (children ordered the same way under
--    each parent).
--
-- 2) "Settings" (feature_id 3) was seeded with menu_label = 'menu.settings'
--    (a raw i18n key, never translated) instead of a real display label —
--    fixed to show actual text instead of the literal key.
--
-- 3) The Student role had full CRUD (can_create/read/update/delete) on
--    "Curriculum Management" (feature_id 305, router_link /admin/curriculum)
--    — an admin-only page, seeded onto Student by mistake. This is why the
--    self-student sidebar showed a "Curriculum Managem..." link at all.
--    Revoked entirely for Student.

BEGIN;

UPDATE features SET menu_order = 1 WHERE feature_id = 282; -- Student Dashboard

UPDATE features SET menu_order = 2 WHERE feature_id = 283; -- AI Tutor
UPDATE features SET menu_order = 1 WHERE feature_id = 284; --   Tutor Chat

UPDATE features SET menu_order = 3 WHERE feature_id = 289; -- Practice
UPDATE features SET menu_order = 1 WHERE feature_id = 291; --   By Subject

UPDATE features SET menu_order = 4 WHERE feature_id = 292; -- Mock Tests
UPDATE features SET menu_order = 1 WHERE feature_id = 302; --   Upcoming Tests
UPDATE features SET menu_order = 2 WHERE feature_id = 303; --   Test History

UPDATE features SET menu_order = 5 WHERE feature_id = 285; -- My Learning
UPDATE features SET menu_order = 1 WHERE feature_id = 286; --   Subjects
UPDATE features SET menu_order = 2 WHERE feature_id = 288; --   Learning Path

UPDATE features SET menu_order = 6 WHERE feature_id = 293; -- Progress
UPDATE features SET menu_order = 1 WHERE feature_id = 304; --   Progress-Overview
UPDATE features SET menu_order = 2 WHERE feature_id = 301; --   Subject Progress

UPDATE features SET menu_order = 7 WHERE feature_id = 294; -- Notes
UPDATE features SET menu_order = 1 WHERE feature_id = 299; --   My Notes

UPDATE features SET menu_order = 8 WHERE feature_id = 295; -- Bookmarks
UPDATE features SET menu_order = 9 WHERE feature_id = 296; -- Achievements

UPDATE features SET menu_label = 'Settings' WHERE feature_id = 3;

DELETE FROM feature_permissions
WHERE feature_id = 305
  AND role_id = (SELECT role_id FROM roles WHERE role_name = 'Student');

COMMIT;
