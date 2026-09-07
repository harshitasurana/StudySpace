-- Generalizes education_book_ingestions from "text ingestion job" into
-- "any chapter-processing job" — image ingestion and enrichment reuse the
-- exact same table/columns rather than forking into sibling tables,
-- matching SamplePaperExtractionJob's own convention of type-varying
-- nullable columns in one table.
--
-- waits_for_job_id lets a dependent job (enrich, which can only run after
-- image ingestion has written its MinIO/Qdrant state) be created up front
-- in 'pending' and actually triggered later by the prerequisite job's own
-- completion callback — persisted rather than held in memory so a Node
-- restart mid-chain doesn't strand it (matches this codebase's existing
-- stuck-row recovery philosophy, e.g. mindmap_service.js).
--
-- also_generate lets a 'text' job row carry "also kick off mind map /
-- slide deck generation once this completes" without a separate job
-- table for those two — they already track their own status via
-- EducationMindMap/EducationSlideDeck, so this is just the trigger memo.

BEGIN;

-- 'enrich' jobs never take a PDF upload — they operate on state an earlier
-- 'images' job already wrote to MinIO/Qdrant — so a filename is no longer
-- guaranteed to exist.
ALTER TABLE education_book_ingestions
  ALTER COLUMN source_filename DROP NOT NULL;

ALTER TABLE education_book_ingestions
  ADD COLUMN IF NOT EXISTS job_type VARCHAR(20) NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS waits_for_job_id INTEGER REFERENCES education_book_ingestions(id),
  ADD COLUMN IF NOT EXISTS also_generate JSON,
  ADD COLUMN IF NOT EXISTS items_processed INTEGER;

ALTER TABLE education_book_ingestions
  ADD CONSTRAINT education_book_ingestions_job_type_check
    CHECK (job_type IN ('text', 'images', 'enrich'));

CREATE INDEX IF NOT EXISTS education_book_ingestions_job_type_idx
  ON education_book_ingestions (chapter_id, job_type);

CREATE INDEX IF NOT EXISTS education_book_ingestions_waits_for_idx
  ON education_book_ingestions (waits_for_job_id)
  WHERE waits_for_job_id IS NOT NULL;

COMMIT;
