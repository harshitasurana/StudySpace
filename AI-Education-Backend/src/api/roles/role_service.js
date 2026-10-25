import {
  getAllRoles,
  getRolesWithPagination,
  getRoleById,
  getRoleByName,
  createRole,
  updateRole,
  softDeleteRole,
  bulkSoftDeleteRoles,
  updateRolePermissions,
  restoreRole,
  getDeletedRoles,
  getOrganizationStaffRoles,
} from "./role_model.js";
import { Op } from "sequelize";
import User from "../user/user_schema.js";
import sequelize from "../../config/database.js";
import {
  bulkCreateFeaturePermissionsService,
  getFeaturePermissionsByRoleService,
} from "../feature/feature_permissions_service.js";
import FeaturePermission from "../feature/feature_permissions_schema.js";
import Role from "./role_schema.js";
import { CATEGORY_TYPES } from "../../common/constants/category_types.js";

const normalizePermissionName = (permissionName) => {
  if (typeof permissionName !== "string") return null;
  const trimmed = permissionName.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.startsWith("can_") ? trimmed : `can_${trimmed}`;
};

const normalizeRoleFeaturePermissions = (permissions) => {
  if (!Array.isArray(permissions)) {
    throw new Error("Permissions must be a valid array");
  }

  return permissions.map((permission) => {
    if (!permission || typeof permission !== "object" || Array.isArray(permission)) {
      throw new Error("Each permission entry must be a valid object");
    }

    if (!permission.feature_id) {
      throw new Error("Each permission entry must include feature_id");
    }

    if (!Array.isArray(permission.permissions) || permission.permissions.length === 0) {
      throw new Error("Each permission entry must include a non-empty permissions array");
    }

    const permissionRows = permission.permissions
      .map((row) => {
        const normalizedPermissionName = normalizePermissionName(row.permission_name);
        if (!normalizedPermissionName) {
          throw new Error("Each permission row must include permission_name");
        }

        return {
          permission_name: normalizedPermissionName,
          permission_display_name: row.permission_display_name || null,
          permission_description: row.permission_description || null,
          is_enabled: row.is_enabled === true,
        };
      });

    return {
      feature_id: permission.feature_id,
      permissions: permissionRows,
    };
  });
};

const buildRoleResponseWithFeaturePermissions = async (role) => {
  if (!role) return role;

  const roleData = role.toJSON ? role.toJSON() : role;
  const normalizedPermissions = await getFeaturePermissionsByRoleService(roleData.role_id);

  return {
    ...roleData,
    permissions: normalizedPermissions,
  };
};

export const getAllActiveRoles = async () => {
  return await getAllRoles();
};

export const getRolesPaginated = async (queryOptions) => {
  return await getRolesWithPagination(queryOptions);
};

export const getRoleByIdService = async (id) => {
  const role = await getRoleById(id);
  return await buildRoleResponseWithFeaturePermissions(role);
};

export const createRoleService = async (roleData, userId = null) => {
  // Validate Category by category_id
  if (roleData.category_id) {
    const { Category, CategoryType } = await import('../metadata/category/category_schema.js');
    const categoryExists = await Category.findOne({
      where: { category_id: roleData.category_id },
      include: [{
        model: CategoryType,
        where: { code: CATEGORY_TYPES.ROLE }
      }]
    });
    if (!categoryExists) throw new Error('Invalid Role Category');
  }

  // Validate role name uniqueness
  const existingRole = await getRoleByName(roleData.role_name);
  if (existingRole) {
    throw new Error('Role with this name already exists');
  }

  const normalizedPermissions = roleData.permissions !== undefined
    ? normalizeRoleFeaturePermissions(roleData.permissions)
    : [];

  const { permissions, ...roleFields } = roleData;

  // Frontend-created roles are always Custom Roles. system_flag is never
  // accepted from the request body here — System Roles are seeded directly
  // at the database/migration level, not through this API.
  roleFields.system_flag = false;

  // Create role record
  const createdRole = await createRole({
    ...roleFields,
    permissions: [],
  }, userId);

  if (normalizedPermissions.length > 0) {
    const permissionsToCreate = normalizedPermissions.map((permission) => ({
      role_id: createdRole.role_id,
      feature_id: permission.feature_id,
      permissions: permission.permissions,
    }));

    await bulkCreateFeaturePermissionsService(permissionsToCreate, userId, { replaceExisting: true });
  }

  return await getRoleByIdService(createdRole.role_id);
};

export const updateRoleService = async (id, updateData, userId = null) => {
  // Validate role exists
  const existingRole = await getRoleById(id);
  if (!existingRole) {
    throw new Error('Role not found');
  }

  // Validate Category by category_id
  if (updateData.category_id) {
    const { Category, CategoryType } = await import('../metadata/category/category_schema.js');
    const categoryExists = await Category.findOne({
      where: { category_id: updateData.category_id },
      include: [{
        model: CategoryType,
        where: { code: CATEGORY_TYPES.ROLE }
      }]
    });
    if (!categoryExists) throw new Error('Invalid Role Category');
  }

  // If updating role name, check for duplicates
  if (updateData.role_name && updateData.role_name !== existingRole.role_name) {
    const duplicateRole = await getRoleByName(updateData.role_name, id);
    if (duplicateRole) {
      throw new Error('Another role with this name already exists');
    }
  }

  const { permissions, system_flag, ...roleFields } = updateData;
  // system_flag is immutable after creation — always ignored on update,
  // even if a caller manages to slip it into the payload.
  const normalizedPermissions = permissions !== undefined
    ? normalizeRoleFeaturePermissions(permissions)
    : null;

  let updatedRole = existingRole;

  if (Object.keys(roleFields).length > 0) {
    updatedRole = await updateRole(id, roleFields, userId);
  }

  if (permissions !== undefined) {
    await FeaturePermission.destroy({
      where: {
        role_id: id,
        user_id: null,
      },
    });

    if (normalizedPermissions.length > 0) {
      await bulkCreateFeaturePermissionsService(
        normalizedPermissions.map((permission) => ({
          role_id: id,
          feature_id: permission.feature_id,
          permissions: permission.permissions,
        })),
        userId,
        { replaceExisting: true },
      );
    }

    await updateRolePermissions(id, [], userId);
    updatedRole = await getRoleById(id);
  }

  return await buildRoleResponseWithFeaturePermissions(updatedRole);
};

// Single-tenant app: there's no organization to scope a soft-disable by,
// so every delete is a real (soft, via Role.is_deleted) delete — the same
// path this used to reserve for super_admin only.
export const deleteRoleService = async (id, userId = null) => {
  const role = await getRoleById(id);

  if (!role) {
    throw new Error("Role not found");
  }

  if (role.system_flag) {
    throw new Error("Cannot delete system roles");
  }

  return await softDeleteRole(id, userId);
};

export const bulkDeleteRolesService = async (roleIds, userId = null) => {
  const rolesToCheck = await Promise.all(
    roleIds.map(id => getRoleById(id))
  );

  const systemRoleFound = rolesToCheck.find(role => role && role.system_flag);
  if (systemRoleFound) {
    throw new Error('Cannot delete system roles');
  }

  const deletedCount = await bulkSoftDeleteRoles(roleIds, userId);
  if (deletedCount === 0) {
    throw new Error("No roles found to delete");
  }
  return deletedCount;
};

export const updateRolePermissionsService = async (id, permissions, userId = null) => {
  const role = await getRoleById(id);
  if (!role) {
    throw new Error('Role not found');
  }

  const normalizedPermissions = normalizeRoleFeaturePermissions(permissions);

  await FeaturePermission.destroy({
    where: {
      role_id: id,
      user_id: null,
    },
  });

  if (normalizedPermissions.length > 0) {
    await bulkCreateFeaturePermissionsService(
      normalizedPermissions.map((permission) => ({
        role_id: id,
        feature_id: permission.feature_id,
        permissions: permission.permissions,
      })),
      userId,
      { replaceExisting: true },
    );
  }

  await updateRolePermissions(id, [], userId);
  return await getRoleByIdService(id);
};

// Single-tenant app: restore always goes through the real Role.is_deleted
// flag — the same path this used to reserve for super_admin only.
export const restoreRoleService = async (id, userId = null) => {
  const RoleModel = (await import("./role_schema.js")).default;
  const roleWithDeleted = await RoleModel.scope('withDeleted').findByPk(id);
  if (!roleWithDeleted) {
    throw new Error('Role not found');
  }

  if (roleWithDeleted.is_deleted) {
    return await restoreRole(id, userId);
  }

  return await getRoleByIdService(id);
};

export const getDeletedRolesService = async () => {
  return await getDeletedRoles();
};

export const getOrganizationStaffRolesService = async () => {
  return await getOrganizationStaffRoles();
};

export const getRolesForUserAssignment = async () => {
  const roles = await getAllRoles();
  return roles.filter(role => !role.is_deleted);
};

/**
 * Returns the minimal, public-safe list of roles a regular (non-admin)
 * authenticated user is allowed to see and pick for themselves — e.g. the
 * role list shown on an onboarding "choose your role" screen.
 *
 * Deliberately separate from getAllRoles()/getRolesWithPagination():
 * - Only roles with is_self_assignable = true are returned (admin roles
 *   like super_admin/hospital_admin are never included, regardless of
 *   category).
 * - Only display-safe fields are returned — no permissions, no org/division
 *   scoping, no audit fields.
 *
 * @param {number} [categoryId] optional filter, e.g. the Education category
 */
export const getSelfAssignableRolesService = async (categoryId = null) => {
  const where = {
    is_self_assignable: true,
    is_active: true,
    // defaultScope on Role already excludes is_deleted: true
  };

  if (categoryId) {
    where.category_id = categoryId;
  }

  return await Role.findAll({
    where,
    attributes: ["role_id", "role_name", "description", "category_id"],
    order: [["role_name", "ASC"]],
  });
};

export const getRoleCategoriesList = async (queryOptions = {}) => {
  try {
    const { Category, CategoryType } = await import('../metadata/category/category_schema.js');

    const { limit, offset, search, filters = {} } = queryOptions;

    // Base where condition
    const whereCondition = { is_active: true };

    // Apply search filter if present
    if (search) {
      whereCondition.name = { [Op.iLike]: `%${search}%` };
    }

    // Override is_active if explicitly requested in filters
    if (filters.is_active !== undefined) {
      whereCondition.is_active = filters.is_active === 'true' || filters.is_active === true;
    }

    const dbQueryOptions = {
      where: whereCondition,
      include: [{
        model: CategoryType,
        where: { code: CATEGORY_TYPES.ROLE, is_active: true },
        attributes: []
      }],
      order: [['display_order', 'ASC'], ['name', 'ASC']]
    };

    if (limit !== undefined && offset !== undefined) {
      dbQueryOptions.limit = limit;
      dbQueryOptions.offset = offset;
    }

    const { count, rows } = await Category.findAndCountAll(dbQueryOptions);
    const result = { data: rows };

    if (limit !== undefined && offset !== undefined) {
      const page = Math.floor(offset / limit) + 1;
      result.pagination = {
        total: count,
        page: page,
        limit: limit,
        totalPages: Math.ceil(count / limit)
      };
    }

    return result;
  } catch (error) {
    console.error("Error fetching role categories from metadata:", error);
    throw error;
  }
};

export const validatePermissions = async (roleId, requiredPermissions = []) => {
  const role = await getRoleById(roleId);
  if (!role) {
    return false;
  }

  const rolePermissions = role.permissions || [];

  // Check if role has all required permissions
  return requiredPermissions.every(permission =>
    rolePermissions.includes(permission)
  );
};

export const getRolesWithPermission = async (permission) => {
  const roles = await getAllRoles();
  return roles.filter(role =>
    role.permissions && role.permissions.includes(permission)
  );
};

export const getRolesStatistics = async () => {
  // Get all roles (default scope excludes deleted) and exclude super_admin
  const allRoles = await getAllRoles();
  const roles = allRoles.filter((r) => r.role_name !== "super_admin");

  const totalRoles = roles.length;
  const activeRoles = roles.filter((r) => r.is_active).length;
  const inactiveRoles = totalRoles - activeRoles;

  const { Category, CategoryType } = await import('../metadata/category/category_schema.js');

  const categories = await Category.findAll({
    include: [
      {
        model: CategoryType,
        where: {
          code: CATEGORY_TYPES.ROLE,
          is_active: true,
        },
        attributes: [],
        required: true,
      },
    ],
    attributes: ['category_id', ['name', 'category_name']],
    order: [['name', 'ASC']],
    raw: true,
  });

  const categoryCounts = await Role.findAll({
    where: {
      is_deleted: false,
      role_name: { [Op.ne]: 'super_admin' },
    },
    attributes: [
      'category_id',
      [sequelize.fn('COUNT', sequelize.col('role_id')), 'total_roles'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN is_active THEN 1 ELSE 0 END')), 'active_roles'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN is_active = false THEN 1 ELSE 0 END')), 'inactive_roles'],
    ],
    group: ['category_id'],
    raw: true,
  });

  const countsMap = categoryCounts.reduce((acc, row) => {
    acc[row.category_id] = {
      total_roles: Number(row.total_roles || 0),
      active_roles: Number(row.active_roles || 0),
      inactive_roles: Number(row.inactive_roles || 0),
    };
    return acc;
  }, {});

  const categoriesData = categories
    .map((category) => ({
      category_id: category.category_id,
      category_name: category.category_name,
      total_roles: countsMap[category.category_id]?.total_roles || 0,
      active_roles: countsMap[category.category_id]?.active_roles || 0,
      inactive_roles: countsMap[category.category_id]?.inactive_roles || 0,
    }))
    .filter(c => c.total_roles > 0);

  return {
    total_roles: totalRoles,
    active_roles: activeRoles,
    inactive_roles: inactiveRoles,
    categories: categoriesData,
  };
};

/**
 * Activate a role service
 * @param {number} id - The role ID
 * @param {number} userId - The user ID updating the role
 * @returns {Promise<Object>} The activated role
 */
export const activateRoleService = async (id, userId = null) => {
  if (!id || id <= 0) {
    throw new Error("Valid role ID is required");
  }

  // Check if role exists
  const existingRole = await getRoleById(id);
  if (!existingRole) {
    throw new Error("Role not found");
  }

  // Check if already active
  if (existingRole.is_active === true) {
    throw new Error("Role is already active");
  }

  // Activate the role
  const { activateRole } = await import("./role_model.js");
  const activated = await activateRole(id);

  if (!activated) {
    throw new Error("Failed to activate role");
  }

  return await getRoleByIdService(id);
};

/**
 * Deactivate a role service
 * @param {number} id - The role ID
 * @param {number} userId - The user ID updating the role
 * @returns {Promise<Object>} The deactivated role
 */
export const deactivateRoleService = async (id, userId = null) => {
  if (!id || id <= 0) {
    throw new Error("Valid role ID is required");
  }

  // Check if role exists
  const existingRole = await getRoleById(id);
  if (!existingRole) {
    throw new Error("Role not found");
  }

  // Check if already inactive
  if (existingRole.is_active === false) {
    throw new Error("Role is already inactive");
  }

  // Deactivate the role
  const { deactivateRole } = await import("./role_model.js");
  const deactivated = await deactivateRole(id);

  if (!deactivated) {
    throw new Error("Failed to deactivate role");
  }

  return await getRoleByIdService(id);
};