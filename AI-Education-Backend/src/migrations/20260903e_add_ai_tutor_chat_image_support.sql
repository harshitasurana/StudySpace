-- AI Tutor chat image attachments (multimodal Phase 1 — see
-- core/image_chat.py on the AI-service side). image_key is nullable
-- since almost every message is still text-only; when set, it resolves
-- to a MinIO-stored image via fileStorage.service.js's
-- resolveStoredFileUrl, same pattern as profile avatars.

ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS image_key VARCHAR(500);
