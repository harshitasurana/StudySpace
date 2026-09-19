import Joi from "joi";

const permissionNameSchema = Joi.string()
  .trim()
  .pattern(/^can_[a-z0-9_]+$/)
  .required();

const permissionRowSchema = Joi.object({
  permission_name: permissionNameSchema,
  permission_display_name: Joi.string().trim().max(120).allow(null, "").optional(),
  permission_description: Joi.string().trim().max(255).allow(null, "").optional(),
  is_enabled: Joi.boolean().required(),
});

const featurePermissionSchema = Joi.object({
  feature_id: Joi.number().integer().positive().required(),
  permissions: Joi.array().items(permissionRowSchema).min(1).required(),
});

const permissionsSchema = Joi.array()
  .items(featurePermissionSchema)
  .default([]);

export const createRoleTemplateSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .required()
    .messages({
      'string.empty': 'Template name is required',
      'string.max': 'Template name cannot exceed 100 characters',
    }),
  category_id: Joi.number().integer().positive().required().messages({
    'any.required': 'Category ID is required',
  }),
  description: Joi.string()
    .max(255)
    .trim()
    .allow(null, '')
    .optional(),
  permissions: permissionsSchema,
  status: Joi.string().valid('active', 'inactive').optional(),
  created_by: Joi.number().integer().optional().allow(null),
  updated_by: Joi.number().integer().optional().allow(null),
  created_by_name: Joi.string().optional().allow(null),
  updated_by_name: Joi.string().optional().allow(null),
});

export const updateRoleTemplateSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .optional(),
  category_id: Joi.number().integer().positive().optional().allow(null),
  description: Joi.string().max(255).trim().allow(null, '').optional(),
  permissions: permissionsSchema,
  status: Joi.string().valid('active', 'inactive').optional(),
  created_by: Joi.number().integer().optional().allow(null),
  updated_by: Joi.number().integer().optional().allow(null),
  created_by_name: Joi.string().optional().allow(null),
  updated_by_name: Joi.string().optional().allow(null),
});
