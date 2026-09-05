-- Seed data for education_academic_boards / classes / subjects.
--
-- Values mirror the BOARD_OPTIONS / CLASS_OPTIONS / SUBJECT_OPTIONS that
-- were hardcoded in SelfStudentWizard.jsx as a Sprint-1-not-built-yet
-- placeholder. Seeding the same values here means switching the wizard
-- over to the real GET /api/education/academic/* endpoints (done in this
-- Sprint 1 pass) doesn't change what a student sees on screen.
--
-- Safe to re-run: every insert is keyed off a unique/natural column via
-- ON CONFLICT DO NOTHING.

BEGIN;

INSERT INTO education_academic_boards (name, code) VALUES
  ('CBSE', 'CBSE'),
  ('ICSE', 'ICSE'),
  ('State Board', 'STATE'),
  ('IB', 'IB'),
  ('IGCSE', 'IGCSE'),
  ('Other', 'OTHER')
ON CONFLICT (name) DO NOTHING;

-- Classes are board-agnostic (board_id NULL) — every board above reuses
-- the same class list, matching the wizard's flat CLASS_OPTIONS.
INSERT INTO education_academic_classes (name, grade_level, board_id) VALUES
  ('9', 9, NULL),
  ('10', 10, NULL)
ON CONFLICT (name, COALESCE(board_id, 0)) DO NOTHING;

-- Subjects are also board/class-agnostic in this seed (board_id and
-- class_id NULL means "available regardless of board/class" per the
-- OR-based filtering in academic_service.js).
INSERT INTO education_academic_subjects (name, board_id, class_id) VALUES
  ('Mathematics', NULL, NULL),
  ('Science', NULL, NULL),
  ('English', NULL, NULL),
  ('Social Science', NULL, NULL),
  ('Computer Science', NULL, NULL),
  ('Other', NULL, NULL)
ON CONFLICT (name, COALESCE(board_id, 0), COALESCE(class_id, 0)) DO NOTHING;

COMMIT;
