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

export const createFeaturePermissionSchema = Joi.object({
  role_id: Joi.number().integer().min(1).optional(),
  user_id: Joi.number().integer().min(1).optional(),
  feature_id: Joi.number().integer().min(1).required(),
  permissions: Joi.array().items(permissionRowSchema).min(1).required(),
  created_by: Joi.number().integer().positive().optional().allow(null),
  updated_by: Joi.number().integer().positive().optional().allow(null),
  created_by_name: Joi.string().max(120).optional().allow(null),
  updated_by_name: Joi.string().max(120).optional().allow(null),
}).custom((value, helpers) => {
  if (!value.role_id && !value.user_id) {
    return helpers.error("any.custom", { message: "Either role_id or user_id is required" });
  }

  return value;
}).messages({
  "any.custom": "Either role_id or user_id is required",
});

export const updateFeaturePermissionSchema = Joi.object({
  permissions: Joi.array().items(permissionRowSchema).min(1).required(),
  created_by: Joi.number().integer().positive().optional().allow(null),
  updated_by: Joi.number().integer().positive().optional().allow(null),
  created_by_name: Joi.string().max(120).optional().allow(null),
  updated_by_name: Joi.string().max(120).optional().allow(null),
});

export const roleIdSchema = Joi.object({
  roleId: Joi.number().integer().min(1).required(),
});

export const userIdSchema = Joi.object({
  userId: Joi.number().integer().min(1).required(),
});

export const featureIdSchema = Joi.object({
  featureId: Joi.number().integer().min(1).required(),
});

export const roleAndFeatureIdSchema = Joi.object({
  roleId: Joi.number().integer().min(1).required(),
  featureId: Joi.number().integer().min(1).required(),
});

export const permissionTypeSchema = Joi.object({
  permission: permissionNameSchema,
});

const bulkPermissionEntrySchema = Joi.object({
  role_id: Joi.number().integer().min(1).optional(),
  user_id: Joi.number().integer().min(1).optional(),
  feature_id: Joi.number().integer().min(1).required(),
  permissions: Joi.array().items(permissionRowSchema).min(1).required(),
}).custom((value, helpers) => {
  if (!value.role_id && !value.user_id) {
    return helpers.error("any.custom", { message: "Either role_id or user_id is required" });
  }

  return value;
}).messages({
  "any.custom": "Either role_id or user_id is required",
});

export const bulkCreateFeaturePermissionsSchema = Joi.object({
  permissions: Joi.array().items(bulkPermissionEntrySchema).min(1).required(),
});

export const bulkUpdateFeaturePermissionsSchema = Joi.object({
  permissions: Joi.array().items(bulkPermissionEntrySchema).min(1).required(),
});

export const clonePermissionsSchema = Joi.object({
  sourceRoleId: Joi.number().integer().min(1).required(),
  targetRoleId: Joi.number().integer().min(1).required(),
});

export const clonePermissionsToUserSchema = Joi.object({
  sourceRoleId: Joi.number().integer().min(1).required(),
  targetUserId: Joi.number().integer().min(1).required(),
});
