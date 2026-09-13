import {
  getAllFeaturePermissionsService,
  getFeaturePermissionsByRoleService,
  getFeaturePermissionsByUserService,
  getFeaturePermissionsByFeatureService,
  getFeaturePermissionService,
  createFeaturePermissionService,
  updateFeaturePermissionService,
  deleteFeaturePermissionService,
  checkRoleFeaturePermissionService,
  bulkCreateFeaturePermissionsService,
  bulkUpdateFeaturePermissionsService,
  getRolesWithPermissionForFeatureService,
  getFeaturesWithPermissionForRoleService,
  clonePermissionsFromRole,
  clonePermissionsFromRoleToUser,
} from "./feature_permissions_service.js";
import {
  roleIdSchema,
  userIdSchema,
  featureIdSchema,
  roleAndFeatureIdSchema,
  permissionTypeSchema,
  bulkCreateFeaturePermissionsSchema,
  bulkUpdateFeaturePermissionsSchema,
  clonePermissionsSchema,
  clonePermissionsToUserSchema,
  createFeaturePermissionSchema,
  updateFeaturePermissionSchema,
} from "./feature_permissions_validation.js";
import HttpError from "../../common/exceptions/HttpError.js";
import { ERROR_MESSAGES } from "../../common/constants/errors.js";

// Helper functions for normalized error responses
const notFound = msg => ({ success: false, message: msg });
const badReq = msg => ({ success: false, message: msg });

/**
 * Get all feature permissions.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getAllFeaturePermissions = async (req, res, next) => {
  try {
    const permissions = await getAllFeaturePermissionsService();

    res.status(200).json({
      success: true,
      message: "Feature permissions retrieved successfully",
      data: permissions,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Get feature permissions by role ID.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getFeaturePermissionsByRole = async (req, res, next) => {
  try {
    const { error, value } = roleIdSchema.validate(req.params);
    if (error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const { roleId } = value;
    const permissions = await getFeaturePermissionsByRoleService(roleId);

    res.status(200).json({
      success: true,
      message: "Feature permissions for role retrieved successfully",
      data: permissions,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Get feature permissions by user ID.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getFeaturePermissionsByUser = async (req, res, next) => {
  try {
    const { error, value } = userIdSchema.validate(req.params);
    if (error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const { userId } = value;
    const permissions = await getFeaturePermissionsByUserService(userId);

    res.status(200).json({
      success: true,
      message: "Feature permissions for user retrieved successfully",
      data: permissions,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Get feature permissions by feature ID.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getFeaturePermissionsByFeature = async (req, res, next) => {
  try {
    const { error, value } = featureIdSchema.validate(req.params);
    if (error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const { featureId } = value;
    const permissions = await getFeaturePermissionsByFeatureService(featureId);

    res.status(200).json({
      success: true,
      message: "Feature permissions for feature retrieved successfully",
      data: permissions,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Get a specific feature permission by role and feature ID.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getFeaturePermission = async (req, res, next) => {
  try {
    const { error, value } = roleAndFeatureIdSchema.validate(req.params);
    if (error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const { roleId, featureId } = value;
    const permission = await getFeaturePermissionService(roleId, featureId);

    if (!permission) {
      return res.status(404).json(notFound(ERROR_MESSAGES.PERMISSION_NOT_FOUND));
    }

    res.status(200).json({
      success: true,
      message: "Feature permission retrieved successfully",
      data: permission,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Create a new feature permission.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createFeaturePermission = async (req, res, next) => {
  try {
    const { error, value } = createFeaturePermissionSchema.validate(req.body);
    if (error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const userId = req.user?.user_id || null;
    const permission = await createFeaturePermissionService(value, userId);

    res.status(201).json({
      success: true,
      message: "Feature permission created successfully",
      data: permission,
    });
  } catch (error) {
    if (error.message.includes("already exists")) {
      return res.status(409).json(badReq(ERROR_MESSAGES.DUPLICATE_RESOURCE));
    } else {
      next(new HttpError(error.message, 500));
    }
  }
};

/**
 * Update an existing feature permission.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateFeaturePermission = async (req, res, next) => {
  try {
    const paramsValidation = roleAndFeatureIdSchema.validate(req.params);
    const bodyValidation = updateFeaturePermissionSchema.validate(req.body);

    if (paramsValidation.error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    if (bodyValidation.error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const { roleId, featureId } = paramsValidation.value;
    const updateData = bodyValidation.value;
    const userId = req.user?.user_id || null;
    const permission = await updateFeaturePermissionService(roleId, featureId, updateData, userId);

    if (!permission) {
      return res.status(404).json(notFound(ERROR_MESSAGES.PERMISSION_NOT_FOUND));
    }

    res.status(200).json({
      success: true,
      message: "Feature permission updated successfully",
      data: permission,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Delete a feature permission.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteFeaturePermission = async (req, res, next) => {
  try {
    const { error, value } = roleAndFeatureIdSchema.validate(req.params);
    if (error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const { roleId, featureId } = value;
    await deleteFeaturePermissionService(roleId, featureId);

    res.status(200).json({
      success: true,
      message: "Feature permission deleted successfully",
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Check if a role has a specific permission for a feature.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const checkRoleFeaturePermission = async (req, res, next) => {
  try {
    const roleFeatureValidation = roleAndFeatureIdSchema.validate(req.params);
    const permissionValidation = permissionTypeSchema.validate(req.params);

    if (roleFeatureValidation.error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    if (permissionValidation.error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const { roleId, featureId } = roleFeatureValidation.value;
    const { permission } = permissionValidation.value;
    const hasPermission = await checkRoleFeaturePermissionService(roleId, featureId, permission);

    res.status(200).json({
      success: true,
      message: "Permission check completed",
      data: {
        role_id: roleId,
        feature_id: featureId,
        permission: permission,
        hasPermission: hasPermission,
      },
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Bulk create feature permissions.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const bulkCreateFeaturePermissions = async (req, res, next) => {
  try {
    const { error, value } = bulkCreateFeaturePermissionsSchema.validate(req.body);
    if (error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const userId = req.user?.user_id || null;
    const result = await bulkCreateFeaturePermissionsService(value.permissions, userId);

    res.status(201).json({
      success: true,
      message: "Bulk feature permissions creation completed",
      data: {
        created: result,
      },
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Bulk update feature permissions.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const bulkUpdateFeaturePermissions = async (req, res, next) => {
  try {
    const { error, value } = bulkUpdateFeaturePermissionsSchema.validate(req.body);
    if (error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const userId = req.user?.user_id || null;
    const result = await bulkUpdateFeaturePermissionsService(value.permissions, userId);

    res.status(200).json({
      success: true,
      message: "Bulk feature permissions update completed",
      data: result,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Get roles that have a specific permission for a feature.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getRolesWithPermissionForFeature = async (req, res, next) => {
  try {
    const featureValidation = featureIdSchema.validate(req.params);
    const permissionValidation = permissionTypeSchema.validate(req.params);

    if (featureValidation.error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    if (permissionValidation.error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const { featureId } = featureValidation.value;
    const { permission } = permissionValidation.value;
    const roles = await getRolesWithPermissionForFeatureService(featureId, permission);

    res.status(200).json({
      success: true,
      message: "Roles with permission for feature retrieved successfully",
      data: roles,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Get features that a role has a specific permission for.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getFeaturesWithPermissionForRole = async (req, res, next) => {
  try {
    const roleValidation = roleIdSchema.validate(req.params);
    const permissionValidation = permissionTypeSchema.validate(req.params);

    if (roleValidation.error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    if (permissionValidation.error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const { roleId } = roleValidation.value;
    const { permission } = permissionValidation.value;
    const features = await getFeaturesWithPermissionForRoleService(roleId, permission);

    res.status(200).json({
      success: true,
      message: "Features with permission retrieved successfully",
      data: features,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Clone permissions from one role to another.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const clonePermissionsFromRoleController = async (req, res, next) => {
  try {
    const { error, value } = clonePermissionsSchema.validate(req.params);
    if (error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const { sourceRoleId, targetRoleId } = value;
    const userId = req.user?.user_id || null;
    const result = await clonePermissionsFromRole(sourceRoleId, targetRoleId, userId);

    res.status(201).json({
      success: true,
      message: "Permissions cloned successfully",
      data: result,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Clone permissions from a role to a user.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const clonePermissionsFromRoleToUserController = async (req, res, next) => {
  try {
    const { error, value } = clonePermissionsToUserSchema.validate(req.params);
    if (error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const { sourceRoleId, targetUserId } = value;
    const userId = req.user?.user_id || null;
    const result = await clonePermissionsFromRoleToUser(sourceRoleId, targetUserId, userId);
    console.log("Clone permissions from role to user result:", result);
    res.status(201).json({
      success: true,
      message: "Role permissions cloned to user successfully",
      data: result,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Get all modules with their available permissions (standard + custom)
 * GET /api/feature-permissions/modules
 */
export const getModulesWithPermissions = async (req, res, next) => {
  try {
    const { getModulesWithPermissionsService } = await import("./feature_permissions_service.js");
    const result = await getModulesWithPermissionsService();

    res.status(200).json({
      success: true,
      message: "Modules and permissions retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Get a single module with its permissions
 * GET /api/feature-permissions/modules/:id
 */
export const getModulePermissionsById = async (req, res, next) => {
  try {
    const { error, value } = featureIdSchema.validate(req.params);
    if (error) {
      return res.status(400).json(badReq(ERROR_MESSAGES.VALIDATION_FAILED));
    }

    const { featureId } = value;
    const { getModulePermissionsByIdService } = await import("./feature_permissions_service.js");
    const result = await getModulePermissionsByIdService(featureId);

    if (!result) {
      return res.status(404).json(notFound("Module not found"));
    }

    res.status(200).json({
      success: true,
      message: "Module permissions retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Get all unique permission names across the system
 * GET /api/feature-permissions/permission-names
 */
export const getAllPermissionNames = async (req, res, next) => {
  try {
    const { getAllPermissionNamesService } = await import("./feature_permissions_service.js");
    const result = await getAllPermissionNamesService();

    res.status(200).json({
      success: true,
      message: "All permission names retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};
