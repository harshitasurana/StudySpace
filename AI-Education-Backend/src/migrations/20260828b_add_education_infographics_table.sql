-- Infographic — a single-page, whole-chapter overview, generated in the
-- background. Exact schema mirror of education_slide_decks (one row per
-- chapter_id + board + standard, JSONB payload, pending/processing/
-- completed/failed status). Applied via direct sequelize.query() rather
-- than `npm run db:sync`, same workaround already used for the Academic
-- Calendar tables (db:sync is currently broken on an unrelated
-- pre-existing education_student_profiles.learning_mode issue).

BEGIN;

CREATE TABLE IF NOT EXISTS education_infographics (
  infographic_id  SERIAL PRIMARY KEY,
  chapter_id      INTEGER NOT NULL REFERENCES education_chapters(chapter_id),
  board           VARCHAR(100) NOT NULL,
  standard        VARCHAR(100) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payload         JSONB,
  error_message   TEXT,
  generated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chapter_id, board, standard)
);

COMMIT;
