import Joi from "joi";

export const createAvailabilityTypeSchema = Joi.object({
  code: Joi.string().uppercase().max(50).required()
    .messages({
      "string.empty": "Code is required",
      "any.required": "Code is required",
    }),
  name: Joi.string().max(100).required()
    .messages({
      "string.empty": "Name is required",
      "any.required": "Name is required",
    }),
  description: Joi.string().allow("", null).optional(),
  display_order: Joi.number().integer().min(0).default(0),
  created_by: Joi.number().integer().positive().optional().allow(null),
  updated_by: Joi.number().integer().positive().optional().allow(null),
  created_by_name: Joi.string().max(100).optional().allow(null),
  updated_by_name: Joi.string().max(100).optional().allow(null),
});

export const updateAvailabilityTypeSchema = Joi.object({
  name: Joi.string().max(100).optional(),
  description: Joi.string().allow("", null).optional(),
  display_order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
  created_by: Joi.number().integer().positive().optional().allow(null),
  updated_by: Joi.number().integer().positive().optional().allow(null),
  created_by_name: Joi.string().max(100).optional().allow(null),
  updated_by_name: Joi.string().max(100).optional().allow(null),
}).min(1).messages({
  "object.min": "At least one field must be provided for update",
});
