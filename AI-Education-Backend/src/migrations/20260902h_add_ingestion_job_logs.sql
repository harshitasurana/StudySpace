-- Real timestamped log history per ingestion job, for the admin
-- Ingestion Monitor — previously current_stage was overwritten in place
-- on every progress ping (recordIngestionProgressService), so nothing
-- but the single most recent stage was ever visible; a job's actual
-- timeline (queued -> started -> page 1..N -> completed/failed) was
-- unrecoverable once overwritten.

ALTER TABLE education_book_ingestions ADD COLUMN IF NOT EXISTS logs JSONB NOT NULL DEFAULT '[]'::jsonb;
