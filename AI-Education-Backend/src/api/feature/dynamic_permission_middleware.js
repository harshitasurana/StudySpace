import { checkEffectiveFeaturePermission } from "./feature_permissions_model.js";
import HttpError from "../../common/exceptions/HttpError.js";

// Standard permissions that exist in the base feature_permissions table
const STANDARD_PERMISSIONS = ["can_read", "can_create", "can_update", "can_delete"];

/**
 * Transform permission from API format (CREATE) to DB format (can_create)
 * @param {string} permission - Permission in API format (e.g., "CREATE", "EXPORT")
 * @returns {string} Permission in DB format (e.g., "can_create", "can_export")
 */
const transformPermissionToDbFormat = (permission) => {
  if (!permission) return permission;
  
  // Convert to lowercase and add 'can_' prefix if not already present
  const lowerPerm = permission.toLowerCase();
  if (lowerPerm.startsWith('can_')) {
    return lowerPerm;
  }
  return `can_${lowerPerm}`;
};

/**
 * Dynamic permission middleware that checks feature permissions from database
 * Supports both standard permissions (can_read, can_create, etc.) and custom permissions
 * @param {string} requiredPermission - The permission to check (can_read, can_create, can_update, can_delete, or custom permission name)
 * @returns {Function} Express middleware function
 */
export const checkDynamicFeaturePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const userRoleId = req.user?.role_id;
      const userId = req.user?.user_id;
      const featureId = req.params.id || req.body.feature_id;

      // Validate required data
      if (!userRoleId) {
        return next(new HttpError("User role not found", 401));
      }

      if (!featureId) {
        return next(new HttpError("Feature ID not found in request", 400));
      }

      if (!requiredPermission) {
        return next(new HttpError("Permission type is required", 400));
      }

      // Transform permission to DB format
      const dbPermission = transformPermissionToDbFormat(requiredPermission);

      const permissionMap = {
        can_read: 'read',
        can_create: 'create',
        can_update: 'update',
        can_delete: 'delete',
      };

      const hasPermission = await checkEffectiveFeaturePermission(
        userId,
        userRoleId,
        featureId,
        STANDARD_PERMISSIONS.includes(dbPermission) ? permissionMap[dbPermission] : dbPermission
      );

      if (!hasPermission) {
        return next(
          new HttpError(
            `Access denied: insufficient permissions for this feature (${requiredPermission})`,
            403
          )
        );
      }

      next();
    } catch (error) {
      next(new HttpError("Permission check failed: " + error.message, 500));
    }
  };
};

/**
 * Middleware to check multiple permissions (OR condition)
 * @param {string[]} requiredPermissions - Array of permissions to check
 * @returns {Function} Express middleware function
 */
export const checkAnyDynamicFeaturePermission = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      const userRoleId = req.user?.role_id;
      const userId = req.user?.user_id;
      const featureId = req.params.id || req.body.feature_id;

      if (!userRoleId) {
        return next(new HttpError("User role not found", 401));
      }

      if (!featureId) {
        return next(new HttpError("Feature ID not found in request", 400));
      }

      // Transform permissions to DB format
      const dbPermissions = requiredPermissions.map(p => transformPermissionToDbFormat(p));

      // Check if user has any of the required permissions
      let hasPermission = false;
      for (const permission of dbPermissions) {
        const permissionMap = {
          can_read: 'read',
          can_create: 'create',
          can_update: 'update',
          can_delete: 'delete',
        };
        const result = await checkEffectiveFeaturePermission(
          userId,
          userRoleId,
          featureId,
          STANDARD_PERMISSIONS.includes(permission) ? permissionMap[permission] : permission
        );
        if (result) {
          hasPermission = true;
          break;
        }
      }

      if (!hasPermission) {
        return next(
          new HttpError(
            `Access denied: insufficient permissions for this feature (requires one of: ${requiredPermissions.join(", ")})`,
            403
          )
        );
      }

      next();
    } catch (error) {
      next(new HttpError("Permission check failed", 500));
    }
  };
};

/**
 * Middleware to check if user has admin permissions for features
 * @returns {Function} Express middleware function
 */
export const checkFeatureAdminPermission = () => {
  return async (req, res, next) => {
    try {
      const userRoleId = req.user?.role_id;
      const userId = req.user?.user_id;

      if (!userRoleId) {
        return next(new HttpError("User role not found", 401));
      }

      // Super admin (role_id = 1) has all permissions
      if (userRoleId === 1) {
        return next();
      }

      // For other roles, check if they have create permission on features
      // This could be extended to check for a specific "feature_admin" feature
      const hasAdminPermission = await checkEffectiveFeaturePermission(
        userId,
        userRoleId,
        1, // Assuming feature_id 1 is for feature management
        "create"
      );

      if (!hasAdminPermission) {
        return next(new HttpError("Access denied: feature administration permissions required", 403));
      }

      next();
    } catch (error) {
      next(new HttpError("Permission check failed", 500));
    }
  };
};

/**
 * Middleware to check permissions for bulk operations
 * @param {string} requiredPermission - The permission to check
 * @returns {Function} Express middleware function
 */
export const checkBulkDynamicFeaturePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const userRoleId = req.user?.role_id;
      const userId = req.user?.user_id;
      const featureIds = req.body.feature_ids || [];

      if (!userRoleId) {
        return next(new HttpError("User role not found", 401));
      }

      if (!Array.isArray(featureIds) || featureIds.length === 0) {
        return next(new HttpError("Feature IDs array is required", 400));
      }

      // Transform permission to DB format
      const dbPermission = transformPermissionToDbFormat(requiredPermission);
      
      // Map to short form if it's a standard permission
      const permissionMap = {
        can_read: 'read',
        can_create: 'create',
        can_update: 'update',
        can_delete: 'delete',
      };
      const shortPermission = permissionMap[dbPermission] || dbPermission;

      // Check permissions for all features in the bulk operation
      for (const featureId of featureIds) {
        const hasPermission = await checkEffectiveFeaturePermission(
          userId,
          userRoleId,
          featureId,
          shortPermission
        );

        if (!hasPermission) {
          return next(
            new HttpError(
              `Access denied: insufficient permissions for feature ${featureId} (${requiredPermission})`,
              403
            )
          );
        }
      }

      next();
    } catch (error) {
      next(new HttpError("Bulk permission check failed", 500));
    }
  };
};
