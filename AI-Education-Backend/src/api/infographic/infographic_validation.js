import Joi from "joi";

export const generateInfographicSchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
});

export const infographicStatusSchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
});
