-- Checkpointed pause/resume for the 'images' ingestion job (the long,
-- vision-heavy one — see RAGProductionApp/core/image_ingestion_tasks.py
-- and scripts/ingest_textbook_images.py's process_pdf for the actual
-- checkpointing). pause_requested is polled by the running Celery task
-- once per page (GET /api/admin/ingestion/:jobId/pause-status); 'paused'
-- is a new terminal-ish status alongside pending/processing/completed/
-- failed — items_processed on a paused row is the last page actually
-- completed, which a resume request uses as its new start_page.

ALTER TABLE education_book_ingestions
  ADD COLUMN IF NOT EXISTS pause_requested BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE education_book_ingestions
  DROP CONSTRAINT IF EXISTS education_book_ingestions_status_check;

ALTER TABLE education_book_ingestions
  ADD CONSTRAINT education_book_ingestions_status_check
  CHECK (status::text = ANY (ARRAY['pending', 'processing', 'completed', 'failed', 'paused']::text[]));
