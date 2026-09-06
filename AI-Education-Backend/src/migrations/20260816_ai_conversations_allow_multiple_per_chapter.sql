-- "New Chat" (ai_tutor_service.js's resetConversationService) used to
-- DELETE a chapter's only conversation row's messages to start fresh -
-- meaning every past AI Tutor conversation was destroyed the moment a
-- student started a new one, silently. Every conversation should be kept:
-- a chapter can now have many conversations over time (AI Sessions lists
-- them all, newest first), and "New Chat" creates a new row instead of
-- wiping the old one.

BEGIN;

ALTER TABLE ai_conversations
  DROP CONSTRAINT IF EXISTS ai_conversations_student_profile_id_chapter_id_key;

-- Replaces idx_ai_conversations_student - same leading column, now also
-- covers "this student's conversations for one chapter, newest first",
-- the lookup resolveConversation()/startNewConversationService() do on
-- every chat/history/new-chat call now that (student, chapter) is no
-- longer unique.
DROP INDEX IF EXISTS idx_ai_conversations_student;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_student_chapter_recency
  ON ai_conversations (student_profile_id, chapter_id, created_at DESC);

COMMIT;
