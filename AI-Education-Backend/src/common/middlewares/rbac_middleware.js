import { checkUserFeaturePermission } from "../../api/feature/feature_permissions_model.js";

/**
 * Middleware to check if user has permission for a specific feature and action
 * @param {string} featureName - Name of the feature (e.g., 'Roles', 'Features')
 * @param {string} permissionType - Type of permission ('read', 'create', 'update', 'delete')
 * @returns {Function} Express middleware function
 */
export const checkPermission = (featureName, permissionType) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get user role ID - ensure it's an integer
      let userRoleId = req.user.role_id;

      // If role_id is not set or is a string, try to map from role name
      if (!userRoleId || typeof userRoleId === 'string') {
        const roleMappings = {
          'super_admin': 1,
          'hospital_admin': 2,
          'doctor': 3,
          'department_admin': 4
        };
        userRoleId = roleMappings[req.user.role] || req.user.role_id;
      }

      if (!userRoleId || typeof userRoleId !== 'number') {
        return res.status(403).json({ error: "User role not found or invalid" });
      }

      // Check if user has the required permission for the feature
      const hasPermission = await checkUserFeaturePermission(req.user.user_id, userRoleId, featureName, permissionType);

      if (!hasPermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: `${featureName}:${permissionType}`
        });
      }

      next();
    } catch (error) {
      console.error("RBAC permission check error:", error);
      res.status(500).json({
        error: "Permission check failed",
        message: error.message
      });
    }
  };
};

/**
 * Middleware to check multiple permissions (OR condition)
 * @param {Array} permissions - Array of {featureName, permissionType} objects
 * @returns {Function} Express middleware function
 */
export const checkAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const userRoleId = req.user.role_id || req.user.role;

      if (!userRoleId) {
        return res.status(403).json({ error: "User role not found" });
      }

      // Check if user has any of the required permissions
      for (const perm of permissions) {
        const hasPermission = await checkUserFeaturePermission(req.user.user_id, userRoleId, perm.featureName, perm.permissionType);
        if (hasPermission) {
          return next();
        }
      }

      return res.status(403).json({
        error: "Insufficient permissions",
        required: permissions.map(p => `${p.featureName}:${p.permissionType}`).join(' OR ')
      });
    } catch (error) {
      console.error("RBAC any permission check error:", error);
      res.status(500).json({
        error: "Permission check failed",
        message: error.message
      });
    }
  };
};

/**
 * Middleware to check all permissions (AND condition)
 * @param {Array} permissions - Array of {featureName, permissionType} objects
 * @returns {Function} Express middleware function
 */
export const checkAllPermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const userRoleId = req.user.role_id || req.user.role;

      if (!userRoleId) {
        return res.status(403).json({ error: "User role not found" });
      }

      // Check if user has all required permissions
      for (const perm of permissions) {
        const hasPermission = await checkUserFeaturePermission(req.user.user_id, userRoleId, perm.featureName, perm.permissionType);
        if (!hasPermission) {
          return res.status(403).json({
            error: "Insufficient permissions",
            required: `${perm.featureName}:${perm.permissionType}`,
            missing: permissions.filter(p => !hasPermission).map(p => `${p.featureName}:${p.permissionType}`)
          });
        }
      }

      next();
    } catch (error) {
      console.error("RBAC all permissions check error:", error);
      res.status(500).json({
        error: "Permission check failed",
        message: error.message
      });
    }
  };
};
