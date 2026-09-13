import FeaturePermission from "./feature_permissions_schema.js";
import Role from "../roles/role_schema.js";
import Feature from "./feature_schema.js";

const normalizePermissionName = (permission) => {
  if (typeof permission !== "string") return null;
  const trimmed = permission.trim().toLowerCase();
  if (!trimmed) return null;

  if (["read", "create", "update", "delete"].includes(trimmed)) {
    return `can_${trimmed}`;
  }

  return trimmed.startsWith("can_") ? trimmed : `can_${trimmed}`;
};

const normalizePermissionRows = (permissionData) => {
  if (!permissionData || typeof permissionData !== "object") {
    return [];
  }

  if (Array.isArray(permissionData.permissions)) {
    return permissionData.permissions
      .map((row) => ({
        permission_name: normalizePermissionName(row.permission_name),
        permission_display_name: row.permission_display_name || null,
        permission_description: row.permission_description || null,
        is_enabled: row.is_enabled !== false,
      }))
      .filter((row) => !!row.permission_name);
  }

  const dynamicRows = Object.entries(permissionData)
    .filter(([key, value]) => key.startsWith("can_") && typeof value === "boolean")
    .map(([permissionName, isEnabled]) => ({
      permission_name: normalizePermissionName(permissionName),
      permission_display_name: null,
      permission_description: null,
      is_enabled: isEnabled,
    }));

  if (dynamicRows.length > 0) {
    return dynamicRows;
  }

  const singlePermissionName = normalizePermissionName(permissionData.permission_name);
  if (!singlePermissionName) {
    return [];
  }

  return [
    {
      permission_name: singlePermissionName,
      permission_display_name: permissionData.permission_display_name || null,
      permission_description: permissionData.permission_description || null,
      is_enabled: permissionData.is_enabled !== false,
    },
  ];
};

const groupPermissions = (rows) => {
  const grouped = new Map();

  for (const row of rows) {
    const json = row.toJSON ? row.toJSON() : row;
    const key = `${json.role_id ?? "null"}:${json.user_id ?? "null"}:${json.feature_id}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        role_id: json.role_id ?? null,
        user_id: json.user_id ?? null,
        feature_id: json.feature_id,
        permissions: [],
        featureRole: json.featureRole || null,
        feature: json.feature || null,
      });
    }

    grouped.get(key).permissions.push({
      permission_name: normalizePermissionName(json.permission_name) || json.permission_name,
      permission_display_name: json.permission_display_name,
      permission_description: json.permission_description,
      is_enabled: json.is_enabled === true,
    });
  }

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    permissions: group.permissions.sort((a, b) => a.permission_name.localeCompare(b.permission_name)),
  }));
};

export const getAllFeaturePermissions = async () => {
  const rows = await FeaturePermission.findAll({
    where: { user_id: null },
    include: [
      {
        model: Role,
        as: "featureRole",
        attributes: ["role_id", "role_name"],
      },
      {
        model: Feature,
        as: "feature",
        attributes: ["feature_id", "feature_name", "category_id"],
      },
    ],
    order: [["role_id", "ASC"], ["feature_id", "ASC"], ["permission_name", "ASC"]],
  });

  return groupPermissions(rows);
};

export const getFeaturePermissionsByRole = async (roleId) => {
  const rows = await FeaturePermission.findAll({
    where: { role_id: roleId, user_id: null },
    include: [
      {
        model: Feature,
        as: "feature",
        attributes: ["feature_id", "feature_name", "description", "category_id"],
      },
    ],
    order: [["feature_id", "ASC"], ["permission_name", "ASC"]],
  });

  return groupPermissions(rows);
};

export const getFeaturePermissionsByUser = async (userId) => {
  const rows = await FeaturePermission.findAll({
    where: { user_id: userId },
    include: [
      {
        model: Feature,
        as: "feature",
        attributes: ["feature_id", "feature_name", "description", "category_id"],
      },
    ],
    order: [["feature_id", "ASC"], ["permission_name", "ASC"]],
  });

  return groupPermissions(rows);
};

export const getFeaturePermissionsByFeature = async (featureId) => {
  const rows = await FeaturePermission.findAll({
    where: { feature_id: featureId, user_id: null },
    include: [
      {
        model: Role,
        as: "featureRole",
        attributes: ["role_id", "role_name", "description"],
      },
    ],
    order: [["role_id", "ASC"], ["permission_name", "ASC"]],
  });

  return groupPermissions(rows);
};

export const getFeaturePermission = async (roleId, featureId) => {
  const rows = await FeaturePermission.findAll({
    where: { role_id: roleId, feature_id: featureId, user_id: null },
    include: [
      {
        model: Role,
        as: "featureRole",
        attributes: ["role_id", "role_name"],
      },
      {
        model: Feature,
        as: "feature",
        attributes: ["feature_id", "feature_name", "category_id"],
      },
    ],
    order: [["permission_name", "ASC"]],
  });

  if (!rows.length) {
    return null;
  }

  return groupPermissions(rows)[0];
};

export const createFeaturePermission = async (permissionData, userId = null) => {
  const now = new Date();
  const rows = normalizePermissionRows(permissionData).map((row) => ({
    role_id: permissionData.role_id ?? null,
    user_id: permissionData.user_id ?? null,
    feature_id: permissionData.feature_id,
    ...row,
    created_by: userId,
    updated_by: userId,
    created_at: now,
    updated_at: now,
  }));

  if (!rows.length) {
    throw new Error("At least one permission row is required");
  }

  await FeaturePermission.bulkCreate(rows, {
    updateOnDuplicate: ["permission_display_name", "permission_description", "is_enabled", "updated_by", "updated_at"],
  });

  if (permissionData.role_id) {
    return getFeaturePermission(permissionData.role_id, permissionData.feature_id);
  }

  return {
    role_id: null,
    user_id: permissionData.user_id ?? null,
    feature_id: permissionData.feature_id,
    permissions: rows.map((row) => ({
      permission_name: row.permission_name,
      permission_display_name: row.permission_display_name,
      permission_description: row.permission_description,
      is_enabled: row.is_enabled,
    })),
  };
};

export const updateFeaturePermission = async (roleId, featureId, updateData, userId = null) => {
  const permissionRows = normalizePermissionRows(updateData);
  if (!permissionRows.length) {
    throw new Error("At least one permission row is required");
  }

  const now = new Date();
  const rows = permissionRows.map((row) => ({
    role_id: roleId,
    user_id: null,
    feature_id: featureId,
    ...row,
    created_by: userId,
    updated_by: userId,
    created_at: now,
    updated_at: now,
  }));

  await FeaturePermission.bulkCreate(rows, {
    updateOnDuplicate: ["permission_display_name", "permission_description", "is_enabled", "updated_by", "updated_at"],
  });

  return await getFeaturePermission(roleId, featureId);
};

export const deleteFeaturePermission = async (roleId, featureId) => {
  const affectedRows = await FeaturePermission.destroy({
    where: { role_id: roleId, feature_id: featureId, user_id: null },
  });

  return affectedRows > 0;
};

export const checkRoleFeaturePermission = async (roleId, featureId, permission) => {
  const normalizedPermission = normalizePermissionName(permission);
  if (!normalizedPermission) {
    return false;
  }

  const permissionRecord = await FeaturePermission.findOne({
    where: {
      role_id: roleId,
      feature_id: featureId,
      user_id: null,
      permission_name: normalizedPermission,
      is_enabled: true,
    },
    attributes: ["id"],
  });

  return !!permissionRecord;
};

export const bulkCreateFeaturePermissions = async (permissionsData, userId = null, options = {}) => {
  const now = new Date();
  const rows = permissionsData.flatMap((permissionData) => {
    return normalizePermissionRows(permissionData).map((row) => ({
      role_id: permissionData.role_id ?? null,
      user_id: permissionData.user_id ?? null,
      feature_id: permissionData.feature_id,
      ...row,
      created_by: userId,
      updated_by: userId,
      created_at: now,
      updated_at: now,
    }));
  });

  if (!rows.length) {
    return [];
  }

  const savedRows = [];

  for (const row of rows) {
    const where = {
      role_id: row.role_id,
      user_id: row.user_id,
      feature_id: row.feature_id,
      permission_name: row.permission_name,
    };

    const existing = await FeaturePermission.findOne({ where, transaction: options.transaction });

    if (existing) {
      await existing.update(
        {
          permission_display_name: row.permission_display_name,
          permission_description: row.permission_description,
          is_enabled: row.is_enabled,
          updated_by: row.updated_by,
          updated_at: row.updated_at,
        },
        { transaction: options.transaction }
      );
      savedRows.push(existing);
      continue;
    }

    const created = await FeaturePermission.create(row, { transaction: options.transaction });
    savedRows.push(created);
  }

  return savedRows;
};

export const bulkUpdateFeaturePermissions = async (permissionsData, userId = null, options = {}) => {
  return bulkCreateFeaturePermissions(permissionsData, userId, options);
};

export const getRolesWithPermissionForFeature = async (featureId, permission) => {
  const normalizedPermission = normalizePermissionName(permission);
  if (!normalizedPermission) {
    return [];
  }

  return await FeaturePermission.findAll({
    where: {
      user_id: null,
      feature_id: featureId,
      permission_name: normalizedPermission,
      is_enabled: true,
    },
    include: [
      {
        model: Role,
        as: "featureRole",
        attributes: ["role_id", "role_name", "description"],
      },
    ],
    order: [["role_id", "ASC"]],
  });
};

export const getFeaturesWithPermissionForRole = async (roleId, permission) => {
  const normalizedPermission = normalizePermissionName(permission);
  if (!normalizedPermission) {
    return [];
  }

  return await FeaturePermission.findAll({
    where: {
      role_id: roleId,
      user_id: null,
      permission_name: normalizedPermission,
      is_enabled: true,
    },
    include: [
      {
        model: Feature,
        as: "feature",
        attributes: ["feature_id", "feature_name", "description", "category_id"],
      },
    ],
    order: [["feature_id", "ASC"]],
  });
};

export const getPermissionsMatrix = async () => {
  const roles = await Role.findAll({
    attributes: ["role_id", "role_name"],
    order: [["role_id", "ASC"]],
  });

  const features = await Feature.findAll({
    attributes: ["feature_id", "feature_name", "category_id"],
    where: { is_deleted: false },
    order: [["category_id", "ASC"], ["feature_name", "ASC"]],
  });

  const rows = await FeaturePermission.findAll({ where: { user_id: null } });
  const matrix = {};

  roles.forEach((role) => {
    matrix[role.role_id] = {
      role_name: role.role_name,
      features: {},
    };
  });

  rows.forEach((row) => {
    if (!matrix[row.role_id]) return;
    if (!matrix[row.role_id].features[row.feature_id]) {
      matrix[row.role_id].features[row.feature_id] = {};
    }

    matrix[row.role_id].features[row.feature_id][row.permission_name] = row.is_enabled === true;
  });

  return {
    roles,
    features,
    matrix,
  };
};

export const getEffectiveFeaturePermission = async (userId, roleId, featureId, permission) => {
  const normalizedPermission = normalizePermissionName(permission);
  if (!normalizedPermission || !featureId) {
    return null;
  }

  if (userId) {
    const userOverride = await FeaturePermission.findOne({
      where: {
        user_id: userId,
        feature_id: featureId,
        permission_name: normalizedPermission,
      },
    });

    if (userOverride) {
      return userOverride;
    }
  }

  if (!roleId) {
    return null;
  }

  return await FeaturePermission.findOne({
    where: {
      role_id: roleId,
      user_id: null,
      feature_id: featureId,
      permission_name: normalizedPermission,
    },
  });
};

export const checkEffectiveFeaturePermission = async (userId, roleId, featureId, permission) => {
  const permissionRecord = await getEffectiveFeaturePermission(userId, roleId, featureId, permission);
  if (!permissionRecord) {
    return false;
  }

  return permissionRecord.is_enabled === true;
};

// Single-tenant app: no per-organization feature entitlement table anymore
// (org-feature/ was removed along with the rest of org-structure) — a
// trailing organizationId argument, if a caller still passes one, is
// accepted for backward call-signature compatibility but no longer does
// anything; permission is purely role/user-based now.
export const checkUserFeaturePermission = async (...args) => {
  let userId = null;
  let roleId;
  let featureName;
  let permissionType;

  if (args.length >= 4) {
    [userId, roleId, featureName, permissionType] = args;
  } else if (args.length === 3) {
    [roleId, featureName, permissionType] = args;
  } else {
    [featureName, permissionType] = args;
  }

  const feature = await Feature.findOne({
    where: { feature_name: featureName, is_deleted: false },
    attributes: ["feature_id"],
  });

  if (!feature) {
    return false;
  }

  return await checkEffectiveFeaturePermission(userId, roleId, feature.feature_id, permissionType);
};
