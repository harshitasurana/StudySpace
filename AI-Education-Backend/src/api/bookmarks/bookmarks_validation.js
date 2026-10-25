import Joi from "joi";

const SOURCE_TYPES = ["chapter", "tutor_message", "quiz_question", "diagram", "flashcard", "concept", "test"];
const COLLECTIONS = ["exam", "revision", "important", "favorites", "need_practice"];

export const createBookmarkSchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
  source_type: Joi.string().valid(...SOURCE_TYPES).required(),
  title: Joi.string().trim().max(255).optional().allow(null, ""),
  content: Joi.string().trim().min(1).required(),
  collection: Joi.string().valid(...COLLECTIONS).optional().allow(null),
  // Only sent for source_type: "chapter" bookmarks (the reader's "bookmark
  // this page" button) — content is still a required snapshot either way.
  page_index: Joi.number().integer().min(0).optional().allow(null),
});

export const updateBookmarkSchema = Joi.object({
  collection: Joi.string().valid(...COLLECTIONS).allow(null).required(),
});

export const listBookmarksQuerySchema = Joi.object({
  chapter_id: Joi.number().integer().optional(),
  collection: Joi.string().valid(...COLLECTIONS).optional(),
});

export const bookmarkParamsSchema = Joi.object({
  bookmarkId: Joi.number().integer().required(),
});
