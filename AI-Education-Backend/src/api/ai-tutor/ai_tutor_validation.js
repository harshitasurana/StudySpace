import Joi from "joi";

// 4000 (was 2000) — ChapterReader's "Ask AI" embeds the student's actual
// highlighted textbook passage verbatim into this field (see
// MAX_SELECTION_CHARS in ChapterReader.jsx), and a highlighted passage
// covering several paragraphs was getting rejected/truncated under the old
// limit, which produced vague answers since the AI only ever saw a
// mid-sentence fragment of what the student actually selected.
export const chatSchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
  question: Joi.string().trim().min(1).max(4000).required(),
  // Which conversation to continue — omitted means "the chapter's most
  // recent conversation, or start one" (see resolveConversation in
  // ai_tutor_service.js). Never trusted blindly: the service re-checks it
  // actually belongs to the caller's own student profile + this chapter.
  conversation_id: Joi.number().integer().optional().allow(null),
});

// Same fields as chatSchema, but for POST /chat/image (multipart —
// req.body's scalar fields arrive as strings; Joi's default
// convert:true coerces chapter_id/conversation_id back to numbers).
// question is optional here: an image alone (no typed question) is a
// valid message, unlike text chat.
export const chatImageSchema = Joi.object({
  chapter_id: Joi.number().integer().optional().allow(null, ""),
  subject_id: Joi.number().integer().optional().allow(null, ""),
  question: Joi.string().trim().max(4000).allow("").optional(),
  conversation_id: Joi.number().integer().optional().allow(null),
});

export const historyParamsSchema = Joi.object({
  chapterId: Joi.number().integer().required(),
});

// A specific past conversation to load, instead of the chapter's most
// recent one — how AI Sessions resumes an exact old conversation.
export const historyQuerySchema = Joi.object({
  conversation_id: Joi.number().integer().optional(),
});
