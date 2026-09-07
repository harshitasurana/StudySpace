-- Adds live progress visibility for the admin curriculum-processing
-- pipeline (education_book_ingestions) — until now a job only ever
-- reported its final outcome (status/items_processed), so the admin UI
-- had no way to show "what's happening right now" while a job is still
-- 'processing'. current_stage/total_items are updated by a new
-- interim-progress callback the Celery tasks call at meaningful
-- checkpoints (per page for image ingestion, per pipeline stage for
-- enrichment) — separate from the existing completion callback, which
-- still only ever fires once, at the end.

BEGIN;

ALTER TABLE education_book_ingestions
  ADD COLUMN IF NOT EXISTS current_stage VARCHAR(255),
  ADD COLUMN IF NOT EXISTS total_items INTEGER;

COMMIT;
