import Joi from 'joi';

export const createCategoryTypeSchema = Joi.object({
  name: Joi.string().max(100).required(),
  code: Joi.string().max(50).required(),
  description: Joi.string().allow('')
});

export const updateCategoryTypeSchema = Joi.object({
  name: Joi.string().max(100),
  code: Joi.string().max(50),
  description: Joi.string().allow(''),
  is_active: Joi.boolean()
});

export const createCategorySchema = Joi.object({
  type: Joi.string().required(), // 'pharmacy'
  name: Joi.string().max(100).required(),
  code: Joi.string().max(50).allow(''),
  description: Joi.string().allow(''),
  display_order: Joi.number().integer().default(0)
});

export const updateCategorySchema = Joi.object({
  type: Joi.string(),
  name: Joi.string().max(100),
  code: Joi.string().max(50),
  description: Joi.string().allow(''),
  display_order: Joi.number().integer(),
  is_active: Joi.boolean()
});

export const categoryTypeParamsSchema = Joi.object({
  id: Joi.number().integer().required()
});

export const categoryParamsSchema = Joi.object({
  id: Joi.number().integer().required()
});

