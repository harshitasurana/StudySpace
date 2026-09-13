import Joi from "joi";


/**
 * Transform permission from API format (CREATE) to DB format (can_create)
 * @param {string} permission - Permission in API format (e.g., "CREATE", "EXPORT")
 * @returns {string} Permission in DB format (e.g., "can_create", "can_export")
 */
export const transformPermissionToDbFormat = (permission) => {
  if (!permission) return permission;
  
  // Convert to lowercase and add 'can_' prefix if not already present
  const lowerPerm = permission.toLowerCase();
  if (lowerPerm.startsWith('can_')) {
    return lowerPerm;
  }
  return `can_${lowerPerm}`;
};

/**
 * Transform permission from DB format (can_create) to API format (CREATE)
 * @param {string} permission - Permission in DB format (e.g., "can_create", "can_export")
 * @returns {string} Permission in API format (e.g., "CREATE", "EXPORT")
 */
export const transformPermissionToApiFormat = (permission) => {
  if (!permission) return permission;
  
  // Remove 'can_' prefix if present and convert to uppercase
  if (permission.startsWith('can_')) {
    return permission.substring(4).toUpperCase();
  }
  return permission.toUpperCase();
};

// Simple permissions array: ["READ", "CREATE", "UPDATE", "DELETE", "EXPORT", "APPROVE"]
// Values are normalized to DB format (can_read, can_create, …) automatically.
const simplePermissionSchema = Joi.string().min(1).max(50);

export const createFeatureSchema = Joi.object({
  feature_name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  category_id: Joi.number().integer().positive().optional().allow(null),
  parent_feature_id: Joi.number().integer().positive().optional().allow(null),
  // Multi-availability: array of availability_type IDs
  availability_type_ids: Joi.array()
    .items(Joi.number().integer().positive())
    .optional()
    .allow(null)
    .default([]),
  is_active: Joi.boolean().optional(),
  show_in_menu: Joi.boolean().optional(),
  menu_label: Joi.string().max(100).optional().allow(null).allow(''),
  menu_icon: Joi.string().max(200).optional().allow(null).allow(''),
  router_link: Joi.string().max(255).optional().allow(null).allow(''),
  menu_order: Joi.number().integer().min(0).optional().default(0),
  
  // New simple permissions array format: ["CREATE", "READ", "UPDATE", "DELETE", "EXPORT", "APPROVE"]
  // Assigned to all roles automatically. Transformed to DB format (can_read, can_create…).
  permissions: Joi.array()
    .items(simplePermissionSchema)
    .optional()
    .allow(null),
  created_by: Joi.number().integer().positive().optional().allow(null),
  updated_by: Joi.number().integer().positive().optional().allow(null),
  created_by_name: Joi.string().max(100).optional().allow(null),
  updated_by_name: Joi.string().max(100).optional().allow(null),
}).custom((value, helpers) => {
  // Transform permissions array from API format to DB format
  if (value.permissions && Array.isArray(value.permissions)) {
    value.permissions = value.permissions.map(p => transformPermissionToDbFormat(p));
  }
  return value;
});

export const updateFeatureSchema = Joi.object({
  feature_name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).optional(),
  category_id: Joi.number().integer().positive().optional().allow(null),
  parent_feature_id: Joi.number().integer().positive().optional().allow(null),
  // Multi-availability: array of availability_type IDs
  availability_type_ids: Joi.array()
    .items(Joi.number().integer().positive())
    .optional()
    .allow(null),
  is_active: Joi.boolean().optional(),
  show_in_menu: Joi.boolean().optional(),
  menu_label: Joi.string().max(100).optional().allow(null).allow(''),
  menu_icon: Joi.string().max(200).optional().allow(null).allow(''),
  router_link: Joi.string().max(255).optional().allow(null).allow(''),
  menu_order: Joi.number().integer().min(0).optional(),
  
  // New simple permissions array format: ["CREATE", "READ", "UPDATE", "DELETE", "EXPORT"]
  // Assigned to all roles automatically. Transformed to DB format (can_read, can_create…).
  permissions: Joi.array()
    .items(simplePermissionSchema)
    .optional()
    .allow(null),
  created_by: Joi.number().integer().positive().optional().allow(null),
  updated_by: Joi.number().integer().positive().optional().allow(null),
  created_by_name: Joi.string().max(100).optional().allow(null),
  updated_by_name: Joi.string().max(100).optional().allow(null),
}).custom((value, helpers) => {
  // Transform permissions array from API format to DB format
  if (value.permissions && Array.isArray(value.permissions)) {
    value.permissions = value.permissions.map(p => transformPermissionToDbFormat(p));
  }
  return value;
});

export const featureIdSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const categorySchema = Joi.object({
  category_id: Joi.number().integer().positive().required(),
});

export const validateCreateFeature = (req, res, next) => {
  const { error } = createFeatureSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const validateUpdateFeature = (req, res, next) => {
  const { error } = updateFeatureSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const validateFeatureId = (req, res, next) => {
  const { error } = featureIdSchema.validate(req.params);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const validateCategory = (req, res, next) => {
  const { error } = categorySchema.validate(req.params);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const featureFilterSchema = Joi.object({
  feature_name: Joi.string().optional(),
  description: Joi.string().optional(),
  category_id: Joi.number().optional(),
  parent_feature_id: Joi.number().optional(),
  availability_type_ids: Joi.array()
    .items(Joi.number().integer().positive())
    .optional(),
  show_in_menu: Joi.boolean().optional(),
  menu_label: Joi.string().optional(),
  menu_icon: Joi.string().optional(),
  router_link: Joi.string().optional(),
  is_active: Joi.boolean().optional(),
  is_deleted: Joi.boolean().optional(),
  created_by: Joi.number().optional(),
  updated_by: Joi.number().optional(),
  created_by_name: Joi.string().optional(),
  updated_by_name: Joi.string().optional(),
  created_at: Joi.string().optional(), // date-only filter
  created_at_from: Joi.date().iso().optional(),
  created_at_to: Joi.date().iso().optional(),
  updated_at: Joi.string().optional(), // date-only filter
  updated_at_from: Joi.date().iso().optional(),
  updated_at_to: Joi.date().iso().optional(),
}).unknown(true);


export const bulkDeleteFeatureSchema = Joi.object({
  feature_ids: Joi.array()
    .items(Joi.number().integer())
    .min(1)
    .unique()
    .required()
    .messages({
      'array.min': 'feature_ids must contain at least 1 item',
      'array.unique': 'feature_ids must contain unique values',
      'any.required': 'feature_ids is required'
    })
});
