-- Academic Calendar ("My Calendar") — Phase 1: a self-student's personal
-- calendar (exams, assignments, study/revision sessions, academic events,
-- reminders), owned entirely by the student — no school calendar import,
-- no shared/multi-user editing.
--
-- IMPORTANT: this app already has an UNRELATED, pre-existing "calendar_events"
-- table (src/api/calendar/calendar_schema.js) from the generic CRM/
-- healthcare template this backend was forked from — generic scheduling for
-- doctors/patients/accountants, no student/subject/chapter concept, still
-- live and mounted at /api/calendar. New tables here are prefixed
-- "education_" (matching every other education table) specifically to
-- avoid colliding with it; the new API mounts at /api/my-calendar instead
-- of /api/calendar.

BEGIN;

CREATE TABLE IF NOT EXISTS education_calendar_events (
  calendar_event_id  SERIAL PRIMARY KEY,
  student_profile_id INTEGER NOT NULL REFERENCES education_student_profiles(student_profile_id),
  event_type         VARCHAR(20) NOT NULL CHECK (event_type IN ('EXAM', 'ASSIGNMENT', 'STUDY', 'REVISION', 'ACADEMIC', 'REMINDER')),
  title              VARCHAR(255) NOT NULL,
  description        TEXT,
  start_datetime     TIMESTAMPTZ NOT NULL,
  end_datetime       TIMESTAMPTZ NOT NULL,
  all_day            BOOLEAN NOT NULL DEFAULT false,
  subject_id         INTEGER REFERENCES education_academic_subjects(subject_id),
  -- Single-chapter association for non-exam events (a study/revision
  -- session is about one chapter). Exams cover potentially several
  -- chapters — see education_exam_chapters below, not this column.
  chapter_id         INTEGER REFERENCES education_chapters(chapter_id),
  status             VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes              TEXT,
  -- Nullable override — the real default is derived client-side from
  -- event_type (this app's own existing palette), not stored per-row.
  color              VARCHAR(20),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_education_calendar_events_student_date
  ON education_calendar_events(student_profile_id, start_datetime);
CREATE INDEX IF NOT EXISTS idx_education_calendar_events_type
  ON education_calendar_events(event_type);

CREATE TABLE IF NOT EXISTS education_exam_details (
  exam_detail_id     SERIAL PRIMARY KEY,
  calendar_event_id  INTEGER NOT NULL UNIQUE REFERENCES education_calendar_events(calendar_event_id) ON DELETE CASCADE,
  exam_type          VARCHAR(30) NOT NULL CHECK (exam_type IN ('UNIT_TEST', 'MID_TERM', 'FINAL', 'MOCK_TEST', 'OTHER')),
  total_marks        INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Many-to-many: "Mathematics Mid-Term covers Chapters 1, 2 and 3" — chapter
-- identity/name always comes from the real education_chapters row, never
-- duplicated here.
CREATE TABLE IF NOT EXISTS education_exam_chapters (
  exam_detail_id     INTEGER NOT NULL REFERENCES education_exam_details(exam_detail_id) ON DELETE CASCADE,
  chapter_id         INTEGER NOT NULL REFERENCES education_chapters(chapter_id),
  PRIMARY KEY (exam_detail_id, chapter_id)
);

COMMIT;
