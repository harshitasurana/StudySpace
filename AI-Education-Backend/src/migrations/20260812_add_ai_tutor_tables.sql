-- Phase 3 — Sprint 3: AI Tutor (real, persisted)
-- One conversation per (student, chapter) — reopening the same chapter's
-- tutor resumes the same thread rather than starting a new one each time.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_conversations (
  conversation_id     SERIAL PRIMARY KEY,
  student_profile_id  INTEGER NOT NULL REFERENCES education_student_profiles(student_profile_id),
  chapter_id          INTEGER NOT NULL REFERENCES education_chapters(chapter_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_profile_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_student
  ON ai_conversations(student_profile_id);

CREATE TABLE IF NOT EXISTS ai_messages (
  message_id        SERIAL PRIMARY KEY,
  conversation_id   INTEGER NOT NULL REFERENCES ai_conversations(conversation_id),
  role              VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content           TEXT NOT NULL,
  sources           JSONB,
  figures           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
  ON ai_messages(conversation_id, created_at);

COMMIT;
