import {
  getRolesPaginated,
  getRoleByIdService,
  createRoleService,
  updateRoleService,
  deleteRoleService,
  bulkDeleteRolesService,
  updateRolePermissionsService,
  restoreRoleService,
  getDeletedRolesService,
  getOrganizationStaffRolesService,
  getRoleCategoriesList,
  getRolesStatistics,
  activateRoleService,
  deactivateRoleService,
  getSelfAssignableRolesService,
} from "./role_service.js";
import {
  createFeaturePermissionService,
  deleteFeaturePermissionService,
  getFeaturePermissionsByRoleService,
  getAllFeaturePermissionsService,
} from "../feature/feature_permissions_service.js";
import {
  createRoleSchema,
  updateRoleSchema,
  roleIdSchema,
  paginationSchema,
  updatePermissionsSchema,
  roleBulkActionSchema,
  bulkDeleteRolesSchema,
} from "./role_validation.js";

// Self-service: returns only roles flagged is_self_assignable (e.g. Student).
// Used by onboarding's "choose your role" step. Safe for any authenticated
// user to call — never returns admin roles or sensitive fields.
export const getPublicRolesController = async (req, res) => {
  try {
    const categoryId = req.query?.category_id ? Number(req.query.category_id) : null;
    const roles = await getSelfAssignableRolesService(categoryId);
    return res.status(200).json({ success: true, data: roles });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch roles" });
  }
};

export const getRolesController = async (req, res) => {
  try {
    const rawQuery = req.query || {};
    const hasQueryParams = Object.keys(rawQuery).length > 0;
    const parsedQueryOptions = req.queryOptions || {};
    const hasPagination = rawQuery.page !== undefined || rawQuery.limit !== undefined;

    const allRoleFeaturePermissions = await getAllFeaturePermissionsService();
    const permissionsByRoleId = allRoleFeaturePermissions.reduce((accumulator, permissionGroup) => {
      if (!permissionGroup?.role_id) {
        return accumulator;
      }

      const roleId = Number(permissionGroup.role_id);
      if (!accumulator[roleId]) {
        accumulator[roleId] = [];
      }
      accumulator[roleId].push(permissionGroup);
      return accumulator;
    }, {});

    // If no query params at all, return all records for backwards compatibility
    if (!hasQueryParams) {
      const { default: Role } = await import("./role_schema.js");

      const allRoles = await Role.findAll({
        where: { is_deleted: false },
        attributes: ["role_id", "role_name", "description", "category_id", "permissions", "status", "system_flag", "is_active", "created_at", "updated_at"],
        order: [["role_name", "ASC"]],
      });

      const normalizedRoles = allRoles.map((role) => {
        const roleData = role.toJSON ? role.toJSON() : role;
        return {
          ...roleData,
          created_by: role.created_by,
          created_by_name: role.creator ? `${role.creator.first_name} ${role.creator.last_name}`.trim() : null,
          updated_by: role.updated_by,
          updated_by_name: role.updater ? `${role.updater.first_name} ${role.updater.last_name}`.trim() : null,
          permissions: permissionsByRoleId[Number(roleData.role_id)] || [],
        };
      });

      return res.json({
        success: true,
        data: normalizedRoles,
      });
    }

    const queryOptions = {
      ...parsedQueryOptions,
      page: parsedQueryOptions.page || 1,
      limit: parsedQueryOptions.limit || (hasPagination ? 10 : 200),
      offset: parsedQueryOptions.offset !== undefined
        ? parsedQueryOptions.offset
        : (((parsedQueryOptions.page || 1) - 1) * (parsedQueryOptions.limit || (hasPagination ? 10 : 200))),
      search: parsedQueryOptions.search || '',
      filters: parsedQueryOptions.filters || {},
      sort: parsedQueryOptions.sort || [["role_name", "ASC"]],
    };

    const result = await getRolesPaginated(queryOptions);
    const normalizedResult = {
      ...result,
      roles: (result.roles || []).map((role) => {
        const roleData = role.toJSON ? role.toJSON() : role;
        return {
          ...roleData,
          created_by: role.created_by,
          created_by_name: role.creator ? `${role.creator.first_name} ${role.creator.last_name}`.trim() : null,
          updated_by: role.updated_by,
          updated_by_name: role.updater ? `${role.updater.first_name} ${role.updater.last_name}`.trim() : null,
          permissions: permissionsByRoleId[Number(roleData.role_id)] || [],
        };
      }),
    };

    res.json({
      success: true,
      data: normalizedResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve roles",
      message: error.message,
    });
  }
};

export const getRoleByIdController = async (req, res) => {
  try {
    const { error, value } = roleIdSchema.validate(req.params);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { id } = value;
    const role = await getRoleByIdService(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        error: "Role not found",
      });
    }

    const roleData = role.toJSON ? role.toJSON() : role;
    res.json({
      success: true,
      data: {
        ...roleData,
        created_by: role.created_by,
        created_by_name: role.creator ? `${role.creator.first_name} ${role.creator.last_name}`.trim() : null,
        updated_by: role.updated_by,
        updated_by_name: role.updater ? `${role.updater.first_name} ${role.updater.last_name}`.trim() : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve role",
      message: error.message,
    });
  }
};

export const getRolesStatsController = async (req, res) => {
  try {
    const stats = await getRolesStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve role statistics",
      message: error.message,
    });
  }
};
export const createRoleController = async (req, res) => {
  try {
    const { error, value } = createRoleSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const userId = req.user?.user_id || null;
    value.created_by_name = [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ').trim() || null;

    const newRole = await createRoleService(value, userId);
    // expose created id/result for global audit middleware
    res.locals.createdId = newRole.role_id || newRole.id || null;
    res.locals.result = newRole;
    const roleData = newRole.toJSON ? newRole.toJSON() : newRole;
    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: {
        ...roleData,
        created_by: newRole.created_by,
        created_by_name: newRole.creator ? `${newRole.creator.first_name} ${newRole.creator.last_name}`.trim() : null,
        updated_by: newRole.updated_by,
        updated_by_name: newRole.updater ? `${newRole.updater.first_name} ${newRole.updater.last_name}`.trim() : null,
      },
    });
  } catch (error) {
    if (error.message.includes("already exists")) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create role",
      message: error.message,
    });
  }
};

export const updateRoleController = async (req, res) => {
  try {
    // system_flag is immutable after creation — silently ignore it if the
    // client sends it rather than rejecting the whole update request.
    const { system_flag, ...updateBody } = req.body || {};

    const paramsValidation = roleIdSchema.validate(req.params);
    const bodyValidation = updateRoleSchema.validate(updateBody);

    if (paramsValidation.error) {
      return res.status(400).json({
        success: false,
        error: paramsValidation.error.details[0].message,
      });
    }

    if (bodyValidation.error) {
      return res.status(400).json({
        success: false,
        error: bodyValidation.error.details[0].message,
      });
    }

    const { id } = paramsValidation.value;
    const updateData = bodyValidation.value;
    const userId = req.user?.user_id || null;
    updateData.updated_by_name = [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ').trim() || null;

    const updatedRole = await updateRoleService(id, updateData, userId);
    // expose updated id/result for global audit middleware
    res.locals.entityId = id;
    res.locals.result = updatedRole;
    const roleData = updatedRole.toJSON ? updatedRole.toJSON() : updatedRole;
    return res.json({
      success: true,
      message: "Role updated successfully",
      data: {
        ...roleData,
        created_by: updatedRole.created_by,
        created_by_name: updatedRole.creator ? `${updatedRole.creator.first_name} ${updatedRole.creator.last_name}`.trim() : null,
        updated_by: updatedRole.updated_by,
        updated_by_name: updatedRole.updater ? `${updatedRole.updater.first_name} ${updatedRole.updater.last_name}`.trim() : null,
      },
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    if (error.message.includes("already exists")) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update role",
      message: error.message,
    });
  }
};

export const deleteRoleController = async (req, res) => {
  try {
    const { error, value } = roleIdSchema.validate(req.params);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { id } = value;
    const userId = req.user?.user_id || null;

    await deleteRoleService(id, userId);
    res.locals.entityId = id;
    return res.json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    if (error.message.includes("Cannot delete system roles")) {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to delete role",
      message: error.message,
    });
  }
};

export const bulkDeleteRolesController = async (req, res) => {
  try {
    const { error, value } = bulkDeleteRolesSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { role_ids } = value;
    const userId = req.user?.user_id || null;

    const deletedCount = await bulkDeleteRolesService(role_ids, userId);

    res.json({
      success: true,
      message: `${deletedCount} role(s) deleted successfully`,
      data: { deleted_count: deletedCount }
    });
    
    res.locals.entityId = role_ids.join(',');
    res.locals.result = { deleted_count: deletedCount };
  } catch (error) {
    if (error.message.includes("Cannot delete system roles")) {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }

    if (error.message.includes("No roles found to delete")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to delete roles",
      message: error.message,
    });
  }
};

export const updateRolePermissionsController = async (req, res) => {
  try {
    const paramsValidation = roleIdSchema.validate(req.params);
    const bodyValidation = updatePermissionsSchema.validate(req.body);

    if (paramsValidation.error) {
      return res.status(400).json({
        success: false,
        error: paramsValidation.error.details[0].message,
      });
    }

    if (bodyValidation.error) {
      return res.status(400).json({
        success: false,
        error: bodyValidation.error.details[0].message,
      });
    }

    const { id } = paramsValidation.value;
    const { permissions } = bodyValidation.value;
    const userId = req.user?.user_id || null;

    const updatedRole = await updateRolePermissionsService(id, permissions, userId);
    // expose updated permissions info for global audit middleware
    res.locals.entityId = id;
    res.locals.result = updatedRole;
    return res.json({
      success: true,
      message: "Role permissions updated successfully",
      data: updatedRole,
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update role permissions",
      message: error.message,
    });
  }
};

export const restoreRoleController = async (req, res) => {
  try {
    const { error, value } = roleIdSchema.validate(req.params);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { id } = value;
    const userId = req.user?.user_id || null;

    const restoredRole = await restoreRoleService(id, userId);
    // expose restored id/result for global audit middleware
    res.locals.entityId = id;
    res.locals.result = restoredRole;
    const roleData = restoredRole.toJSON ? restoredRole.toJSON() : restoredRole;
    return res.json({
      success: true,
      message: "Role restored successfully",
      data: {
        ...roleData,
        created_by: restoredRole.created_by,
        created_by_name: restoredRole.creator ? `${restoredRole.creator.first_name} ${restoredRole.creator.last_name}`.trim() : null,
        updated_by: restoredRole.updated_by,
        updated_by_name: restoredRole.updater ? `${restoredRole.updater.first_name} ${restoredRole.updater.last_name}`.trim() : null,
      },
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    if (error.message.includes("Cannot restore globally deleted roles")) {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to restore role",
      message: error.message,
    });
  }
};

export const getDeletedRolesController = async (req, res) => {
  try {
    const deletedRoles = await getDeletedRolesService();

    const enriched = deletedRoles.map((role) => {
      const roleData = role.toJSON ? role.toJSON() : role;
      return {
        ...roleData,
        created_by: role.created_by,
        created_by_name: role.creator ? `${role.creator.first_name} ${role.creator.last_name}`.trim() : null,
        updated_by: role.updated_by,
        updated_by_name: role.updater ? `${role.updater.first_name} ${role.updater.last_name}`.trim() : null,
      };
    });
    res.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve deleted roles",
      message: error.message,
    });
  }
};

export const getOrganizationStaffRolesController = async (req, res) => {
  try {
    const staffRoles = await getOrganizationStaffRolesService();

    const enriched = staffRoles.map((role) => {
      const roleData = role.toJSON ? role.toJSON() : role;
      return {
        ...roleData,
        created_by: role.created_by,
        created_by_name: role.creator ? `${role.creator.first_name} ${role.creator.last_name}`.trim() : null,
        updated_by: role.updated_by,
        updated_by_name: role.updater ? `${role.updater.first_name} ${role.updater.last_name}`.trim() : null,
      };
    });
    res.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve hospital staff roles",
      message: error.message,
    });
  }
};

export const getRoleCategoriesController = async (req, res) => {
  try {
    const result = await getRoleCategoriesList(req.queryOptions || {});

    res.json({
      success: true,
      data: result.data || result, // Compatibility with objects or direct arrays
      pagination: result.pagination
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve categories",
      message: error.message,
    });
  }
};

export const bulkActionController = async (req, res) => {
  try {
    const { error, value } = roleBulkActionSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { role_ids, action } = value;
    const userId = req.user?.user_id || null;
    const results = [];
    const errors = [];

    for (const roleId of role_ids) {
      try {
        if (action === 'delete') {
          await deleteRoleService(roleId, userId);
          results.push({ roleId, action: 'deleted', success: true });
        } else if (action === 'restore') {
          await restoreRoleService(roleId, userId);
          results.push({ roleId, action: 'restored', success: true });
        }
      } catch (error) {
        errors.push({ roleId, error: error.message });
      }
    }

    const actionWord = action === 'delete' ? 'delete' : 'restore';

    res.json({
      success: true,
      message: `Bulk ${actionWord} completed`,
      data: {
        processed: role_ids.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
    // expose bulk result for audit middleware
    res.locals.entityId = role_ids.join(',');
    res.locals.result = { processed: role_ids.length, successful: results.length, failed: errors.length, results, errors };
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to process bulk action",
      message: error.message,
    });
  }
};

export const assignFeatureToRoleController = async (req, res) => {
  try {
    const { roleId, featureId } = req.params;
    const { permissions } = req.body || {};
    const userId = req.user?.user_id || null;

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "permissions must be a non-empty array",
      });
    }

    const permissionData = {
      role_id: parseInt(roleId),
      feature_id: parseInt(featureId),
      permissions,
    };

    const result = await createFeaturePermissionService(permissionData, userId);

    res.status(201).json({
      success: true,
      message: "Feature assigned to role successfully",
      data: result,
    });
    // expose assigned permission info for global audit middleware
    res.locals.createdId = result.id || null;
    res.locals.result = result;
  } catch (error) {
    if (error.message.includes("already exists")) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to assign feature to role",
      message: error.message,
    });
  }
};

export const removeFeatureFromRoleController = async (req, res) => {
  try {
    const { roleId, featureId } = req.params;

    await deleteFeaturePermissionService(parseInt(roleId), parseInt(featureId));

    res.json({
      success: true,
      message: "Feature removed from role successfully",
    });
    // expose removed permission info for global audit middleware
    res.locals.entityId = `${roleId}:${featureId}`;
    res.locals.result = { roleId: parseInt(roleId), featureId: parseInt(featureId) };
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to remove feature from role",
      message: error.message,
    });
  }
};

export const getRoleFeaturesController = async (req, res) => {
  try {
    const { roleId } = req.params;

    const featurePermissions = await getFeaturePermissionsByRoleService(parseInt(roleId, 10));

    const features = featurePermissions.map((permissionGroup) => ({
      feature_id: permissionGroup.feature_id,
      feature_name: permissionGroup.feature?.feature_name || "Unknown",
      permissions: permissionGroup.permissions || [],
    }));

    res.json({
      success: true,
      data: features,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve role features",
      message: error.message,
    });
  }
};

export const getAvailableFeaturesForRoleController = async (req, res) => {
  try {
    const { roleId } = req.params;

    // Get all feature permissions
    const allPermissions = await getAllFeaturePermissionsService();

    // Get assigned permissions for this role
    const assignedPermissions = await getFeaturePermissionsByRoleService(parseInt(roleId));

    // Get assigned feature IDs
    const assignedFeatureIds = assignedPermissions.map(p => p.feature_id);

    // Filter available features (all features minus assigned)
    const allFeatures = allPermissions.map(p => p.feature);
    const availableFeatures = allFeatures.filter(feature => 
      !assignedFeatureIds.includes(feature.id)
    );

    res.json({
      success: true,
      data: availableFeatures,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve available features",
      message: error.message,
    });
  }
};

/**
 * Activate a role.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const activateRoleController = async (req, res) => {
  try {
    const { error, value } = roleIdSchema.validate(req.params);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { id } = value;
    const userId = req.user?.user_id || null;
    const role = await activateRoleService(id, userId);

    const roleData = role.toJSON ? role.toJSON() : role;
    res.status(200).json({
      success: true,
      message: "Role activated successfully",
      data: {
        ...roleData,
        created_by: role.created_by,
        created_by_name: role.creator ? `${role.creator.first_name} ${role.creator.last_name}`.trim() : null,
        updated_by: role.updated_by,
        updated_by_name: role.updater ? `${role.updater.first_name} ${role.updater.last_name}`.trim() : null,
      },
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message.includes("already active")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: "Failed to activate role",
      message: error.message,
    });
  }
};

/**
 * Deactivate a role.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deactivateRoleController = async (req, res) => {
  try {
    const { error, value } = roleIdSchema.validate(req.params);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { id } = value;
    const userId = req.user?.user_id || null;
    const role = await deactivateRoleService(id, userId);

    const roleData = role.toJSON ? role.toJSON() : role;
    res.status(200).json({
      success: true,
      message: "Role deactivated successfully",
      data: {
        ...roleData,
        created_by: role.created_by,
        created_by_name: role.creator ? `${role.creator.first_name} ${role.creator.last_name}`.trim() : null,
        updated_by: role.updated_by,
        updated_by_name: role.updater ? `${role.updater.first_name} ${role.updater.last_name}`.trim() : null,
      },
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message.includes("already inactive")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: "Failed to deactivate role",
      message: error.message,
    });
  }
};