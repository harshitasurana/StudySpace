-- NCERT Solutions/Notes RAG grounding: the AI Tutor can now cite real
-- NCERT content (not just the textbook) alongside its usual source/
-- figures attribution. Additive/backward-compatible — same nullable
-- JSONB shape as the existing sources/figures columns, old rows just
-- have citations: null.

BEGIN;

ALTER TABLE ai_messages ADD COLUMN citations JSONB;

COMMIT;
