import Joi from "joi";

export const generateFlashcardsSchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
  num_cards: Joi.number().integer().min(3).max(20).default(8),
  // Convert-a-note-to-flashcards — when set, generation is grounded in
  // this exact text instead of the chapter's RAG content.
  source_text: Joi.string().trim().min(1).max(8000).allow(null).optional(),
});

export const flashcardSetParamsSchema = Joi.object({
  setId: Joi.number().integer().required(),
});
