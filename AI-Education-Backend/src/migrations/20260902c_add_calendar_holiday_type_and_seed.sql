-- Adds a HOLIDAY event_type (global, shown to every student) to My
-- Calendar and seeds the real 2026-27 Indian national/festival holiday
-- dates. student_profile_id must become nullable first — a HOLIDAY row is
-- shared across every student rather than owned by one, and this schema
-- previously required a specific owner on every single row.

ALTER TABLE education_calendar_events ALTER COLUMN student_profile_id DROP NOT NULL;

ALTER TABLE education_calendar_events DROP CONSTRAINT IF EXISTS education_calendar_events_event_type_check;
ALTER TABLE education_calendar_events ADD CONSTRAINT education_calendar_events_event_type_check
  CHECK (event_type::text = ANY (ARRAY['EXAM', 'ASSIGNMENT', 'STUDY', 'REVISION', 'ACADEMIC', 'REMINDER', 'HOLIDAY']::text[]));

-- Real, sourced dates (qppstudio.net / digisme.in / bankbazaar.com) for
-- the current academic year — inserted once as global rows
-- (student_profile_id IS NULL) so every student sees the same calendar
-- without one duplicated row per student.
INSERT INTO education_calendar_events
  (student_profile_id, event_type, title, description, start_datetime, end_datetime, all_day, status, notes, created_at, updated_at)
SELECT NULL, 'HOLIDAY', v.title, NULL, v.dt::timestamptz, (v.dt::timestamptz + interval '23 hours 59 minutes'), true, 'scheduled', NULL, now(), now()
FROM (VALUES
  ('Gandhi Jayanti', '2026-10-02'::date),
  ('Dussehra (Vijayadashami)', '2026-10-20'::date),
  ('Diwali', '2026-11-08'::date),
  ('Guru Nanak Jayanti', '2026-11-24'::date),
  ('Christmas', '2026-12-25'::date),
  ('Makar Sankranti', '2027-01-14'::date),
  ('Republic Day', '2027-01-26'::date),
  ('Eid-ul-Fitr', '2027-03-10'::date),
  ('Holi', '2027-03-23'::date),
  ('Ambedkar Jayanti', '2027-04-14'::date),
  ('Ram Navami', '2027-04-15'::date),
  ('Mahavir Jayanti', '2027-04-19'::date),
  ('Eid-ul-Adha (Bakrid)', '2027-05-17'::date),
  ('Buddha Purnima', '2027-05-20'::date),
  ('Independence Day', '2027-08-15'::date)
) AS v(title, dt)
WHERE NOT EXISTS (
  SELECT 1 FROM education_calendar_events e
  WHERE e.event_type = 'HOLIDAY' AND e.student_profile_id IS NULL
    AND e.title = v.title AND e.start_datetime::date = v.dt
);
