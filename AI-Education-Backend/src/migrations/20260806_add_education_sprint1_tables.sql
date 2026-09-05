-- Sprint 1: Student Onboarding Architecture & Self-Student MVP
-- Adds the education academic metadata, student profile, learning
-- preferences, and onboarding session tables described in the
-- "Education Onboarding" plan, section 10 (Database Design).
--
-- school_id on education_student_profiles is intentionally left as a
-- plain integer with no FK constraint here — education_school_profiles
-- (Sprint 2) doesn't exist yet. Add the FK in a Sprint 2 migration once
-- that table lands.

BEGIN;

-- ── Academic masters ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS education_academic_boards (
  board_id     SERIAL PRIMARY KEY,
  name         VARCHAR(150) NOT NULL UNIQUE,
  code         VARCHAR(30),
  description  VARCHAR(255),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS education_academic_classes (
  class_id     SERIAL PRIMARY KEY,
  name         VARCHAR(50) NOT NULL,
  grade_level  INTEGER,
  board_id     INTEGER REFERENCES education_academic_boards(board_id),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_education_academic_classes_board_id
  ON education_academic_classes(board_id);

-- Lets the seed file below use ON CONFLICT DO NOTHING safely on re-run.
CREATE UNIQUE INDEX IF NOT EXISTS uq_education_academic_classes_name_board
  ON education_academic_classes(name, COALESCE(board_id, 0));

CREATE TABLE IF NOT EXISTS education_academic_subjects (
  subject_id   SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  code         VARCHAR(30),
  board_id     INTEGER REFERENCES education_academic_boards(board_id),
  class_id     INTEGER REFERENCES education_academic_classes(class_id),
  description  VARCHAR(255),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_education_academic_subjects_board_id
  ON education_academic_subjects(board_id);
CREATE INDEX IF NOT EXISTS idx_education_academic_subjects_class_id
  ON education_academic_subjects(class_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_education_academic_subjects_name_board_class
  ON education_academic_subjects(name, COALESCE(board_id, 0), COALESCE(class_id, 0));

-- ── Student profile ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS education_student_profiles (
  student_profile_id  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL UNIQUE REFERENCES users(user_id),
  role_id             INTEGER REFERENCES roles(role_id),
  board_id            INTEGER REFERENCES education_academic_boards(board_id),
  class_id            INTEGER REFERENCES education_academic_classes(class_id),
  section             VARCHAR(20),
  school_id           INTEGER,             -- FK added in Sprint 2 migration
  roll_number         VARCHAR(50),
  learning_mode       VARCHAR(10) NOT NULL DEFAULT 'self'
                         CHECK (learning_mode IN ('self', 'school')),
  academic_year       VARCHAR(20),
  student_code        VARCHAR(20) UNIQUE,  -- not in original plan; see student_profile_schema.js
  status              VARCHAR(15) NOT NULL DEFAULT 'in_progress'
                         CHECK (status IN ('in_progress', 'completed')),
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS education_student_subjects (
  id                  SERIAL PRIMARY KEY,
  student_profile_id  INTEGER NOT NULL REFERENCES education_student_profiles(student_profile_id),
  subject_id          INTEGER NOT NULL REFERENCES education_academic_subjects(subject_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_profile_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_education_student_subjects_profile_id
  ON education_student_subjects(student_profile_id);

-- ── Learning preferences ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS education_learning_preferences (
  preference_id          SERIAL PRIMARY KEY,
  student_profile_id     INTEGER NOT NULL UNIQUE
                            REFERENCES education_student_profiles(student_profile_id),
  preferred_language     VARCHAR(50),
  learning_goal          VARCHAR(150),
  difficulty_level       VARCHAR(30),
  subject_interests      JSONB,
  learning_style         VARCHAR(50),
  content_preferences    JSONB,
  allow_parent_tracking  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Onboarding sessions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS education_onboarding_sessions (
  onboarding_session_id  SERIAL PRIMARY KEY,
  user_id                INTEGER NOT NULL REFERENCES users(user_id),
  role_id                INTEGER REFERENCES roles(role_id),
  persona                VARCHAR(50),
  current_step           VARCHAR(50),
  payload                JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                 VARCHAR(15) NOT NULL DEFAULT 'in_progress'
                            CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_education_onboarding_sessions_user_id
  ON education_onboarding_sessions(user_id);

COMMIT;
