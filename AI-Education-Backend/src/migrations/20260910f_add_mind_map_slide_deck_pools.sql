-- Converts Mind Maps and Slide Decks from chapter-level singletons (one
-- row/group shared by every student, enforced by a unique constraint) into
-- the same shared-pool + per-student-view-history model Flashcards already
-- has (education_flashcard_sets + education_flashcard_set_views): many pool
-- members can now exist per chapter+board+standard, and a view-history
-- table tracks which ones a given student has already generated/seen —
-- what powers "My Mind Maps" / "My Learning Decks" and lets "Generate New"
-- actually produce something fresh instead of always returning the one
-- cached row. See mindmap_service.js / slide_deck_service.js.
BEGIN;

-- Mind maps generate 5 variant rows together per "one mind map" a student
-- sees (concept_overview synchronously, 4 more in the background) —
-- generation_group_id is what ties those 5 rows together as a single
-- browsable/listable unit, replacing the old unique constraint's job of
-- guaranteeing there was only ever one such group per chapter+scope.
ALTER TABLE education_mind_maps
  ADD COLUMN IF NOT EXISTS generation_group_id uuid;

-- Backfill: every existing (chapter_id, board, standard) group of variant
-- rows gets one shared new uuid. MATERIALIZED is load-bearing here, not
-- decoration: gen_random_uuid() is volatile, and without it Postgres can
-- (and, confirmed live, does) re-plan this as re-evaluating the subquery
-- per joined row of education_mind_maps instead of once per group,
-- silently giving all 5 variant rows in the same group 5 DIFFERENT ids.
WITH groups AS MATERIALIZED (
  SELECT chapter_id, board, standard, gen_random_uuid() AS group_id
  FROM education_mind_maps
  GROUP BY chapter_id, board, standard
)
UPDATE education_mind_maps m
SET generation_group_id = g.group_id
FROM groups g
WHERE m.chapter_id = g.chapter_id AND m.board = g.board AND m.standard = g.standard
  AND m.generation_group_id IS NULL;

ALTER TABLE education_mind_maps
  ALTER COLUMN generation_group_id SET NOT NULL;

-- The old UNIQUE CONSTRAINT (not a plain index — must be dropped as a
-- constraint) is what enforced "exactly one group per chapter+scope";
-- idx_education_mind_maps_chapter (chapter_id, board, standard) already
-- exists as a plain lookup index and stays, covering the same columns.
ALTER TABLE education_mind_maps
  DROP CONSTRAINT IF EXISTS education_mind_maps_chapter_id_board_standard_variant_key;
CREATE INDEX IF NOT EXISTS idx_education_mind_maps_generation_group
  ON education_mind_maps (generation_group_id);

CREATE TABLE IF NOT EXISTS education_mind_map_views (
  student_profile_id integer NOT NULL REFERENCES education_student_profiles(student_profile_id) ON DELETE CASCADE,
  generation_group_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_profile_id, generation_group_id)
);

-- Slide decks are a single row per generation (no variant bundling) — a
-- direct mirror of education_flashcard_set_views, keyed by row id.
-- idx_education_slide_decks_chapter (chapter_id, board, standard) already
-- exists as a plain lookup index and stays.
ALTER TABLE education_slide_decks
  DROP CONSTRAINT IF EXISTS education_slide_decks_chapter_id_board_standard_key;

CREATE TABLE IF NOT EXISTS education_slide_deck_views (
  student_profile_id integer NOT NULL REFERENCES education_student_profiles(student_profile_id) ON DELETE CASCADE,
  slide_deck_id integer NOT NULL REFERENCES education_slide_decks(slide_deck_id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_profile_id, slide_deck_id)
);

-- Backfill both view tables so existing chapter progress isn't lost from
-- "My Mind Maps"/"My Learning Decks" the moment this ships: every student
-- whose board/class scope matches an existing completed group/deck is
-- recorded as having viewed it (best-effort — there's no real per-student
-- access log to backfill from, this just seeds a reasonable starting
-- history rather than shipping every list empty).
INSERT INTO education_mind_map_views (student_profile_id, generation_group_id, viewed_at)
SELECT DISTINCT sp.student_profile_id, m.generation_group_id, m.updated_at
FROM education_mind_maps m
JOIN education_academic_boards b ON b.name = m.board
JOIN education_student_profiles sp ON sp.board_id = b.board_id
JOIN education_academic_classes c ON c.class_id = sp.class_id AND ('Standard ' || c.name) = m.standard
WHERE m.variant = 'concept_overview' AND m.status = 'completed'
ON CONFLICT DO NOTHING;

INSERT INTO education_slide_deck_views (student_profile_id, slide_deck_id, viewed_at)
SELECT DISTINCT sp.student_profile_id, d.slide_deck_id, d.updated_at
FROM education_slide_decks d
JOIN education_academic_boards b ON b.name = d.board
JOIN education_student_profiles sp ON sp.board_id = b.board_id
JOIN education_academic_classes c ON c.class_id = sp.class_id AND ('Standard ' || c.name) = d.standard
WHERE d.status = 'completed'
ON CONFLICT DO NOTHING;

COMMIT;
