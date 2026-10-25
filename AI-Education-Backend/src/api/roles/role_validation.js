import Joi from "joi";

const permissionNameSchema = Joi.string()
  .trim()
  .pattern(/^can_[a-z0-9_]+$/)
  .required()
  .messages({
    "string.pattern.base": "permission_name must use can_<name> format",
    "any.required": "permission_name is required",
  });

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

export const createRoleSchema = Joi.object({
  role_name: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .required()
    .messages({
      'string.empty': 'Role name is required',
      'string.max': 'Role name cannot exceed 100 characters',
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
  system_flag: Joi.boolean().default(false).messages({
    'boolean.base': 'system_flag must be a boolean',
  }),
  created_by: Joi.number().integer().optional().allow(null),
  updated_by: Joi.number().integer().optional().allow(null),
  created_by_name: Joi.string().optional().allow(null),
  updated_by_name: Joi.string().optional().allow(null),
});

export const updateRoleSchema = Joi.object({
  role_name: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .optional()
    .messages({
      'string.empty': 'Role name cannot be empty',
      'string.max': 'Role name cannot exceed 100 characters',
    }),
  category_id: Joi.number().integer().positive().optional().allow(null),
  description: Joi.string()
    .max(255)
    .trim()
    .allow(null, '')
    .optional(),
  permissions: permissionsSchema.optional(),
  is_active: Joi.boolean().optional(),
  created_by: Joi.number().integer().optional().allow(null),
  updated_by: Joi.number().integer().optional().allow(null),
  created_by_name: Joi.string().optional().allow(null),
  updated_by_name: Joi.string().optional().allow(null),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

export const roleIdSchema = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'Role ID must be a number',
      'number.positive': 'Role ID must be positive',
      'any.required': 'Role ID is required',
    }),
});

export const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.min': 'Page must be at least 1',
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(200)
    .default(10)
    .messages({
      'number.base': 'Limit must be a number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 200',
    }),
  search: Joi.string()
    .trim()
    .max(100)
    .optional()
    .allow(''),
  sort_by: Joi.string()
    .valid('role_id', 'role_name', 'created_at', 'updated_at')
    .default('role_id'),
  sort_order: Joi.string()
    .valid('ASC', 'DESC')
    .default('ASC'),
});

export const updatePermissionsSchema = Joi.object({
  permissions: Joi.array()
    .items(featurePermissionSchema)
    .min(1)
    .required()
    .messages({
      'array.base': 'Permissions must be a valid array',
      'array.min': 'At least one permission is required',
      'any.required': 'Permissions are required',
    }),
});

export const roleBulkActionSchema = Joi.object({
  role_ids: Joi.array()
    .items(Joi.number().integer().positive())
    .min(1)
    .required()
    .messages({
      'array.base': 'Role IDs must be an array',
      'array.min': 'At least one role ID is required',
    }),
  action: Joi.string()
    .valid('delete', 'restore')
    .required(),
});

export const bulkDeleteRolesSchema = Joi.object({
  role_ids: Joi.array()
    .items(Joi.number().integer().positive())
    .min(1)
    .unique()
    .required()
    .messages({
      'array.base': 'role_ids must be an array',
      'array.min': 'role_ids must contain at least 1 item',
      'array.unique': 'role_ids must contain unique values',
      'any.required': 'role_ids is required'
    })
});