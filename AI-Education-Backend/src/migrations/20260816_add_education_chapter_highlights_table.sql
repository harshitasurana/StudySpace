-- Chapter Reader text highlighter — a student can mark a passage in one
-- of a few colors, same "copy the real text at creation time" pattern as
-- education_student_bookmarks (not a live position/offset into the
-- chapter's markdown, which would break the moment content is
-- regenerated - see education_chapter_content). page_index anchors a
-- highlight to the specific reader page it was made on (matches the
-- 1-based index into getChapterContentService's `pages` array), so the
-- reader only has to re-scan the current page's own text to reapply
-- highlights, not the whole chapter.

BEGIN;

CREATE TABLE IF NOT EXISTS education_chapter_highlights (
  highlight_id        SERIAL PRIMARY KEY,
  student_profile_id  INTEGER NOT NULL REFERENCES education_student_profiles(student_profile_id),
  chapter_id           INTEGER NOT NULL REFERENCES education_chapters(chapter_id),
  page_index           INTEGER NOT NULL,
  text                 TEXT NOT NULL,
  color                VARCHAR(20) NOT NULL CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'orange')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_education_chapter_highlights_student_chapter
  ON education_chapter_highlights (student_profile_id, chapter_id, page_index);

COMMIT;
