-- Seed data for education_chapters: the Class 9 Mathematics and Science
-- chapter lists, replacing the CHAPTER_METADATA hardcoded in
-- Curriculum.jsx as a Sprint-1-not-built-yet placeholder.
--
-- subject_id/class_id are resolved by name via subquery rather than
-- hardcoded, since actual ids depend on insert order from
-- 20260806_seed_education_academic_data.sql.
--
-- Safe to re-run: keyed off source_file (unique) via ON CONFLICT DO NOTHING.
-- When Class 10 content is ready, add a new insert block with class_id
-- resolved for '10' — no changes needed to the rows below.

BEGIN;

INSERT INTO education_chapters (subject_id, class_id, name, chapter_order, source_file, icon)
SELECT
  (SELECT subject_id FROM education_academic_subjects WHERE name = 'Mathematics'),
  (SELECT class_id FROM education_academic_classes WHERE name = '9'),
  v.name, v.chapter_order, v.source_file, 'calculate'
FROM (VALUES
  (1, 'Orienting Yourself: The Use of Coordinates', 'math_chapter1.pdf'),
  (2, 'Introduction to Linear Polynomials', 'math_chapter2.pdf'),
  (3, 'The World of Numbers', 'math_chapter3.pdf'),
  (4, 'Exploring Algebraic Identities', 'math_chapter4.pdf'),
  (5, 'I''m Up and Down, and Round and Round', 'math_chapter5.pdf'),
  (6, 'Measuring Space: Perimeter and Area', 'math_chapter6.pdf'),
  (7, 'The Mathematics of Maybe: Introduction to Probability', 'math_chapter7.pdf'),
  (8, 'Predicting What Comes Next: Exploring Sequences and Progressions', 'math_chapter8.pdf')
) AS v(chapter_order, name, source_file)
ON CONFLICT (source_file) DO NOTHING;

INSERT INTO education_chapters (subject_id, class_id, name, chapter_order, source_file, icon)
SELECT
  (SELECT subject_id FROM education_academic_subjects WHERE name = 'Science'),
  (SELECT class_id FROM education_academic_classes WHERE name = '9'),
  v.name, v.chapter_order, v.source_file, 'science'
FROM (VALUES
  (1, 'Exploration: Entering the World of Secondary Science', 'science_chapter1.pdf'),
  (2, 'Nature''s Treasures', 'science_chapter2.pdf'),
  (3, 'Tissues in Action', 'science_chapter3.pdf'),
  (4, 'Describing Motion Around Us', 'science_chapter4.pdf'),
  (5, 'Exploring Mixtures and their Separation', 'science_chapter5.pdf'),
  (6, 'How Forces Affect Motion', 'science_chapter6.pdf'),
  (7, 'Work, Energy, and Simple Machines', 'science_chapter7.pdf'),
  (8, 'Journey Inside the Atom', 'science_chapter8.pdf'),
  (9, 'Atomic Foundations of Matter', 'science_chapter9.pdf'),
  (10, 'Sound Waves: Characteristics and Applications', 'science_chapter10.pdf'),
  (11, 'Reproduction: How Life Continues', 'science_chapter11.pdf'),
  (12, 'Nature''s Balance', 'science_chapter12.pdf'),
  (13, 'Earth as a System: Energy, Matter, and Life', 'science_chapter13.pdf')
) AS v(chapter_order, name, source_file)
ON CONFLICT (source_file) DO NOTHING;

COMMIT;
