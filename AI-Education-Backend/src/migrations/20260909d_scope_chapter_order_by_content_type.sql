-- education_chapters' uniqueness on (subject_id, class_id, chapter_order)
-- predates content_type (see 20260909c) and doesn't account for it — an
-- English chapter's Prose and Poetry sections each need their own
-- independent 1..N numbering (matching how the actual source PDFs are
-- numbered, "Poetry 1", "Poetry 2", ... and how LearningPath.jsx renders
-- each section as its own path), not one shared sequence across both.
-- COALESCE(content_type, '') keeps every subject with no split (Math,
-- Science, Social Studies, ...) uniqued exactly as before — only a
-- subject that actually sets content_type gets a separate sequence per
-- value.

BEGIN;

ALTER TABLE education_chapters
  DROP CONSTRAINT education_chapters_subject_id_class_id_chapter_order_key;

CREATE UNIQUE INDEX education_chapters_subject_class_content_type_order_key
  ON education_chapters (subject_id, class_id, COALESCE(content_type, ''), chapter_order);

COMMIT;
