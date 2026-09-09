-- Shared, chapter-level flashcard POOL. Deliberately NOT applied to
-- quizzes (they stay personal/fresh-every-time — see quiz_attempts —
-- since a shared quiz would mean students getting recycled questions
-- for something used for scoring).
--
-- Unlike education_mind_maps' single cached row per scope, a
-- chapter+board+standard+num_cards can hold MANY distinct sets here —
-- the product rule (flashcards_service.js's ensureSharedFlashcardSet):
-- a student cycles through pool members they haven't been shown yet
-- (instant, no AI call); only once they've exhausted every existing
-- member does a genuinely new one get generated, joining the pool for
-- the next student who needs it. education_flashcard_set_views is what
-- tracks "has this specific student seen this specific pool member" —
-- there's deliberately no unique index forcing one row per scope here.
--
-- student_profile_id distinguishes the two kinds of row this table
-- holds:
--   NULL     -> a shared pool member (any eligible student may be
--               shown this row, tracked via education_flashcard_set_views).
--   NOT NULL -> a personal, note-grounded generation (source_text is
--               also set) that must never be shared — a student's own
--               private note content shouldn't surface to anyone else,
--               so these never enter the pool at all.

BEGIN;

CREATE TABLE education_flashcard_sets (
  set_id              SERIAL PRIMARY KEY,
  chapter_id          INTEGER NOT NULL REFERENCES education_chapters(chapter_id),
  board               VARCHAR(100) NOT NULL,
  standard            VARCHAR(100) NOT NULL,
  num_cards           INTEGER NOT NULL DEFAULT 8,
  student_profile_id  INTEGER REFERENCES education_student_profiles(student_profile_id),
  source_text         TEXT,
  cards               JSONB,
  generation_status   VARCHAR(20) NOT NULL DEFAULT 'processing'
    CHECK (generation_status IN ('processing', 'completed', 'failed')),
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Not unique — a chapter+scope's pool of shared sets is expected to
-- grow to more than one row as students exhaust what already exists.
-- This just makes "find the pool for this scope" and "find this
-- student's own personal rows" both fast.
CREATE INDEX idx_flashcard_sets_shared_pool
  ON education_flashcard_sets(chapter_id, board, standard, num_cards)
  WHERE student_profile_id IS NULL;

CREATE INDEX idx_education_flashcard_sets_student
  ON education_flashcard_sets(student_profile_id, chapter_id)
  WHERE student_profile_id IS NOT NULL;

-- Per-student "I've been shown this specific pool member" record —
-- this is what lets a student cycle through unseen pool members on
-- repeat generation, and what powers each student's own real "Past
-- Sets" history in Flashcards.jsx (a shared row has no student of its
-- own to list it under otherwise).
CREATE TABLE education_flashcard_set_views (
  student_profile_id INTEGER NOT NULL REFERENCES education_student_profiles(student_profile_id),
  set_id             INTEGER NOT NULL REFERENCES education_flashcard_sets(set_id),
  viewed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_profile_id, set_id)
);

COMMIT;
