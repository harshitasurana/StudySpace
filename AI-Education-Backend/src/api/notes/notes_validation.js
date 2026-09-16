import Joi from "joi";

const tagsSchema = Joi.array().items(Joi.string().trim().max(30)).max(10).optional();

export const createNoteSchema = Joi.object({
  chapter_id: Joi.number().integer().optional().allow(null),
  title: Joi.string().trim().max(255).optional().allow(null, ""),
  content: Joi.string().trim().min(1).required(),
  tags: tagsSchema,
});

export const updateNoteSchema = Joi.object({
  title: Joi.string().trim().max(255).optional().allow(null, ""),
  content: Joi.string().trim().min(1).optional(),
  tags: tagsSchema,
});

export const listNotesQuerySchema = Joi.object({
  chapter_id: Joi.number().integer().optional(),
});

export const noteParamsSchema = Joi.object({
  noteId: Joi.number().integer().required(),
});
