import Joi from "joi";

const COLORS = ["yellow", "green", "blue", "pink", "orange"];

export const createHighlightSchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
  page_index: Joi.number().integer().min(0).required(),
  text: Joi.string().trim().min(1).max(4000).required(),
  color: Joi.string().valid(...COLORS).required(),
});

export const listHighlightsQuerySchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
});

export const highlightParamsSchema = Joi.object({
  highlightId: Joi.number().integer().required(),
});
