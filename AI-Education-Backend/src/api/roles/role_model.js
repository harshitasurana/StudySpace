import Role from "./role_schema.js";
import { Op } from "sequelize";
import FeaturePermission from "../feature/feature_permissions_schema.js";
import Feature from "../feature/feature_schema.js";
import { buildWhere } from "../../common/utils/buildWhere.js";
import { ROLE_FILTER_SCHEMA } from "./role.filter.schema.js";
import User from "../user/user_schema.js";

export const getAllRoles = async () => {
  return await Role.findAll({
    attributes: ["role_id", "role_name", "description", "category_id", "status", "system_flag", "is_active", "created_at", "updated_at"],
    include: [
      {
        model: FeaturePermission,
        as: "featurePermissions",
        include: [
          {
            model: Feature,
            as: "feature",
            attributes: ["feature_id", "feature_name", "description", "category_id"],
          },
        ],
      },
      { model: User, as: 'creator', attributes: ['user_id', 'first_name', 'last_name'] },
      { model: User, as: 'updater', attributes: ['user_id', 'first_name', 'last_name'] },
    ],
    order: [["role_id", "ASC"]],
  });
};

export const getRolesWithPagination = async (queryOptions) => {
  let limit, offset, sort, search, filters;

  if (queryOptions && queryOptions.limit !== undefined) {
    // Using queryParser format
    ({ limit = 10, offset = 0, sort = [['role_id', 'ASC']], search, filters = {} } = queryOptions);
  } else {
    // Fallback to old format
    const { page = 1, limit: lim = 10, search: s = '', sort_by = 'role_id', sort_order = 'ASC' } = queryOptions || {};
    limit = lim;
    offset = (page - 1) * limit;
    search = s;
    sort = [[sort_by, sort_order.toUpperCase()]];
    filters = {};
  }

  const whereCondition = buildWhere({
    baseWhere: filters.is_active !== undefined ? {} : { is_deleted: false },
    search,
    filters,
    schema: ROLE_FILTER_SCHEMA,
  });

  // Validate sort fields
  const validSortFields = ['role_id', 'role_name', 'description', 'created_at', 'updated_at'];
  const [sortField, sortDirection] = sort[0] || ['role_id', 'ASC'];
  const finalSortField = validSortFields.includes(sortField) ? sortField : 'role_id';
  const finalSortDirection = ['ASC', 'DESC'].includes(sortDirection.toUpperCase()) ? sortDirection.toUpperCase() : 'ASC';

  const { Category } = await import('../metadata/category/category_schema.js');
  const { count, rows } = await Role.findAndCountAll({
    where: whereCondition,
    attributes: ["role_id", "role_name", "description", "category_id", "permissions", "status", "system_flag", "is_active", "created_at", "updated_at"],
    include: [{
      model: Category,
      as: 'category',
      attributes: [['name', 'category_name']],
      required: false
    },
    { model: User, as: 'creator', attributes: ['user_id', 'first_name', 'last_name'] },
    { model: User, as: 'updater', attributes: ['user_id', 'first_name', 'last_name'] },
    ],
    order: [[finalSortField, finalSortDirection]],
    limit,
    offset,
  });

  const totalPages = Math.ceil(count / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return {
    roles: rows,
    pagination: {
      currentPage,
      totalPages,
      totalItems: count,
      itemsPerPage: limit,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
  };
};

export const getRoleById = async (id) => {
  return await Role.findOne({
    where: { role_id: id },
    include: [
      { model: User, as: 'creator', attributes: ['user_id', 'first_name', 'last_name'] },
      { model: User, as: 'updater', attributes: ['user_id', 'first_name', 'last_name'] },
    ],
  });
};

export const getRoleByName = async (roleName, excludeId = null) => {
  const whereCondition = {
    role_name: roleName,
    is_deleted: false,
  };
  
  if (excludeId) {
    whereCondition.role_id = { [Op.ne]: excludeId };
  }
  
  return await Role.findOne({
    where: whereCondition,
  });
};

// Healthcare-vertical role list (this backend also serves an unrelated
// healthcare vertical off the same roles table — see patient_model.js).
// Single-tenant app: no organization to scope by, so this is always the
// fixed hardcoded list of healthcare staff role names.
export const getOrganizationStaffRoles = async () => {
  const where = {
    is_deleted: false,
    role_name: {
      [Op.in]: ['doctor', 'nurse', 'lab_tech', 'receptionist', 'billing_staff', 'hospital_admin']
    },
  };

  return await Role.findAll({
    where,
      attributes: ["role_id", "role_name", "description", "category_id"],
      include: [
        {
          model: FeaturePermission,
          as: "featurePermissions",
          include: [
            {
              model: Feature,
              as: "feature",
              attributes: ["feature_id", "feature_name", "description", "category_id"],
            },
          ],
        },
        { model: User, as: 'creator', attributes: ['user_id', 'first_name', 'last_name'] },
        { model: User, as: 'updater', attributes: ['user_id', 'first_name', 'last_name'] },
      ],
      order: [["role_name", "ASC"]],
  });
};

export const createRole = async (roleData, userId = null) => {
  const roleWithMetadata = {
    ...roleData,
    created_by: userId,
    updated_by: userId,
  };
  
  return await Role.create(roleWithMetadata);
};

export const updateRole = async (id, updateData, userId = null) => {
  const updateWithMetadata = {
    ...updateData,
    updated_by: userId,
  };

  const [updated] = await Role.update(updateWithMetadata, {
    where: { role_id: id, is_deleted: false },
  });
  
  if (!updated) {
    throw new Error("Role not found or already deleted");
  }
  
  return await Role.findByPk(id);
};

export const softDeleteRole = async (id, userId = null) => {
  const [updated] = await Role.update(
    { 
      is_deleted: true,
      is_active: false,
      updated_by: userId,
    },
    { 
      where: { 
        role_id: id, 
        is_deleted: false 
      } 
    }
  );
  
  if (!updated) {
    throw new Error("Role not found or already deleted");
  }
  
  return { success: true, message: "Role deleted successfully" };
};

export const bulkSoftDeleteRoles = async (roleIds, userId = null) => {
  const [affectedRows] = await Role.update(
    { 
      is_deleted: true,
      is_active: false,
      updated_by: userId,
    },
    { 
      where: { 
        role_id: { [Op.in]: roleIds },
        is_deleted: false 
      } 
    }
  );
  
  return affectedRows;
};

export const updateRolePermissions = async (roleId, permissions, userId = null) => {
  const [updated] = await Role.update(
    { 
      permissions,
      updated_by: userId,
    },
    { 
      where: { 
        role_id: roleId, 
        is_deleted: false 
      } 
    }
  );
  
  if (!updated) {
    throw new Error("Role not found or already deleted");
  }
  
  return await Role.findByPk(roleId);
};

export const restoreRole = async (id, userId = null) => {
  const [updated] = await Role.update(
    { 
      is_deleted: false,
      updated_by: userId,
    },
    { 
      where: { 
        role_id: id, 
        is_deleted: true 
      } 
    }
  );
  
  if (!updated) {
    throw new Error("Role not found or already active");
  }
  
  return await Role.findByPk(id);
};

export const getDeletedRoles = async () => {
  return await Role.scope('deleted').findAll({
    attributes: ["role_id", "role_name", "description", "category_id", "permissions", "status", "system_flag", "is_active", "created_at", "updated_at", "is_deleted"],
    include: [
      { model: User, as: 'creator', attributes: ['user_id', 'first_name', 'last_name'] },
      { model: User, as: 'updater', attributes: ['user_id', 'first_name', 'last_name'] },
    ],
    order: [["role_id", "ASC"]],
  });
};

/**
 * Activate a role (set is_active to true)
 * @param {number} roleId - The role ID
 * @returns {Promise<Object|null>} The updated role or null
 */
export const activateRole = async (roleId) => {
  if (!roleId || roleId <= 0) {
    throw new Error("Valid role ID is required");
  }

  const [affectedRows] = await Role.update(
    {
      is_active: true,
      updated_at: new Date(),
    },
    {
      where: {
        role_id: roleId,
        is_deleted: false,
      },
    }
  );

  if (affectedRows === 0) {
    return null;
  }

  return await getRoleById(roleId);
};

/**
 * Deactivate a role (set is_active to false)
 * @param {number} roleId - The role ID
 * @returns {Promise<Object|null>} The updated role or null
 */
export const deactivateRole = async (roleId) => {
  if (!roleId || roleId <= 0) {
    throw new Error("Valid role ID is required");
  }

  const [affectedRows] = await Role.update(
    {
      is_active: false,
      updated_at: new Date(),
    },
    {
      where: {
        role_id: roleId,
        is_deleted: false,
      },
    }
  );

  if (affectedRows === 0) {
    return null;
  }

  return await getRoleById(roleId);
};