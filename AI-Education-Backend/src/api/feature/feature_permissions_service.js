import {
  getAllFeaturePermissions,
  getFeaturePermissionsByRole,
  getFeaturePermissionsByUser,
  getFeaturePermissionsByFeature,
  getFeaturePermission,
  createFeaturePermission,
  updateFeaturePermission,
  deleteFeaturePermission,
  checkRoleFeaturePermission,
  bulkCreateFeaturePermissions,
  bulkUpdateFeaturePermissions,
  getRolesWithPermissionForFeature,
  getFeaturesWithPermissionForRole,
} from "./feature_permissions_model.js";
import User from "../user/user_schema.js";

const DEFAULT_FEATURE_PERMISSIONS = ["can_read", "can_create", "can_update", "can_delete"];

const normalizePermissionName = (permission) => {
  if (typeof permission !== "string") return null;
  const trimmed = permission.trim().toLowerCase();
  if (!trimmed) return null;

  if (["read", "create", "update", "delete"].includes(trimmed)) {
    return `can_${trimmed}`;
  }

  return trimmed.startsWith("can_") ? trimmed : `can_${trimmed}`;
};

const normalizeFeaturePermissions = (permissions) => {
  if (!permissions) {
    return DEFAULT_FEATURE_PERMISSIONS;
  }

  if (Array.isArray(permissions)) {
    return permissions.map((permission) => normalizePermissionName(permission)).filter(Boolean);
  }

  if (permissions && typeof permissions === "object") {
    if (Array.isArray(permissions.items)) {
      return permissions.items.map((permission) => normalizePermissionName(permission)).filter(Boolean);
    }

    if (Array.isArray(permissions.permissions)) {
      return permissions.permissions.map((permission) => normalizePermissionName(permission)).filter(Boolean);
    }

    return Object.entries(permissions)
      .filter(([, isEnabled]) => isEnabled === true)
      .map(([permissionName]) => normalizePermissionName(permissionName))
      .filter(Boolean);
  }

  if (typeof permissions === "string") {
    return [normalizePermissionName(permissions)].filter(Boolean);
  }

  return DEFAULT_FEATURE_PERMISSIONS;
};

const buildPermissionRows = (permissionNames = []) => {
  return [...new Set(permissionNames)]
    .map((permissionName) => normalizePermissionName(permissionName))
    .filter(Boolean)
    .map((permissionName) => ({
      permission_name: permissionName,
      permission_display_name: permissionName.replace(/^can_/, "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      permission_description: null,
      is_enabled: true,
    }));
};

const normalizePermissionPayload = (permissionData) => {
  if (Array.isArray(permissionData.permissions)) {
    return {
      ...permissionData,
      permissions: permissionData.permissions
        .map((permission) => ({
          ...permission,
          permission_name: normalizePermissionName(permission.permission_name),
        }))
        .filter((permission) => !!permission.permission_name),
    };
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
    return {
      ...permissionData,
      permissions: dynamicRows,
    };
  }

  if (permissionData.permission_name) {
    return {
      ...permissionData,
      permissions: [
        {
          permission_name: normalizePermissionName(permissionData.permission_name),
          permission_display_name: permissionData.permission_display_name || null,
          permission_description: permissionData.permission_description || null,
          is_enabled: permissionData.is_enabled !== false,
        },
      ],
    };
  }

  return {
    ...permissionData,
    permissions: [],
  };
};

export const getAllFeaturePermissionsService = async () => {
  return await getAllFeaturePermissions();
};

export const getFeaturePermissionsByRoleService = async (roleId) => {
  if (!roleId || roleId <= 0) {
    throw new Error("Valid role ID is required");
  }

  return await getFeaturePermissionsByRole(roleId);
};

export const getFeaturePermissionsByUserService = async (userId) => {
  if (!userId || userId <= 0) {
    throw new Error("Valid user ID is required");
  }

  return await getFeaturePermissionsByUser(userId);
};

export const getFeaturePermissionsByFeatureService = async (featureId) => {
  if (!featureId || featureId <= 0) {
    throw new Error("Valid feature ID is required");
  }

  return await getFeaturePermissionsByFeature(featureId);
};

export const getFeaturePermissionService = async (roleId, featureId) => {
  if (!roleId || !featureId || roleId <= 0 || featureId <= 0) {
    throw new Error("Valid role ID and feature ID are required");
  }

  return await getFeaturePermission(roleId, featureId);
};

export const createFeaturePermissionService = async (permissionData, userId = null) => {
  if ((!permissionData.role_id && !permissionData.user_id) || !permissionData.feature_id) {
    throw new Error("Feature ID and either role ID or user ID are required");
  }

  const normalizedPayload = normalizePermissionPayload(permissionData);
  if (!normalizedPayload.permissions.length) {
    throw new Error("At least one permission is required");
  }

  const existingPermission = normalizedPayload.role_id
    ? await getFeaturePermission(normalizedPayload.role_id, normalizedPayload.feature_id)
    : null;

  if (existingPermission) {
    throw new Error("Permission already exists for this role-feature combination");
  }

  return await createFeaturePermission(normalizedPayload, userId);
};

export const updateFeaturePermissionService = async (roleId, featureId, updateData, userId = null) => {
  if (!roleId || !featureId || roleId <= 0 || featureId <= 0) {
    throw new Error("Valid role ID and feature ID are required");
  }

  const existingPermission = await getFeaturePermission(roleId, featureId);
  if (!existingPermission) {
    throw new Error("Feature permission not found");
  }

  const normalizedPayload = normalizePermissionPayload(updateData);
  if (!normalizedPayload.permissions.length) {
    throw new Error("At least one permission is required");
  }

  return await updateFeaturePermission(roleId, featureId, normalizedPayload, userId);
};

export const deleteFeaturePermissionService = async (roleId, featureId) => {
  if (!roleId || !featureId || roleId <= 0 || featureId <= 0) {
    throw new Error("Valid role ID and feature ID are required");
  }

  const existingPermission = await getFeaturePermission(roleId, featureId);
  if (!existingPermission) {
    throw new Error("Feature permission not found");
  }

  const success = await deleteFeaturePermission(roleId, featureId);
  if (!success) {
    throw new Error("Failed to delete feature permission");
  }

  return true;
};

export const checkRoleFeaturePermissionService = async (roleId, featureId, permission) => {
  if (!roleId || !featureId || !permission) {
    return false;
  }

  return await checkRoleFeaturePermission(roleId, featureId, normalizePermissionName(permission));
};

export const bulkCreateFeaturePermissionsService = async (permissionsData, userId = null, options = {}) => {
  if (!Array.isArray(permissionsData) || permissionsData.length === 0) {
    throw new Error("Permissions data must be a non-empty array");
  }

  const normalizedData = permissionsData.map((permission) => normalizePermissionPayload(permission));
  return await bulkCreateFeaturePermissions(normalizedData, userId, options);
};

export const bulkUpdateFeaturePermissionsService = async (permissionsData, userId = null, options = {}) => {
  if (!Array.isArray(permissionsData) || permissionsData.length === 0) {
    throw new Error("Permissions data must be a non-empty array");
  }

  const normalizedData = permissionsData.map((permission) => normalizePermissionPayload(permission));
  return await bulkUpdateFeaturePermissions(normalizedData, userId, options);
};

export const getRolesWithPermissionForFeatureService = async (featureId, permission) => {
  if (!featureId || featureId <= 0) {
    throw new Error("Valid feature ID is required");
  }

  return await getRolesWithPermissionForFeature(featureId, normalizePermissionName(permission));
};

export const getFeaturesWithPermissionForRoleService = async (roleId, permission) => {
  if (!roleId || roleId <= 0) {
    throw new Error("Valid role ID is required");
  }

  return await getFeaturesWithPermissionForRole(roleId, normalizePermissionName(permission));
};

export const assignDefaultPermissionsToRole = async () => {
  return [];
};

export const clonePermissionsFromRole = async (sourceRoleId, targetRoleId, userId = null) => {
  if (sourceRoleId === targetRoleId) {
    throw new Error("Source and target roles cannot be the same");
  }

  const sourcePermissions = await getFeaturePermissionsByRole(sourceRoleId);
  const permissionRows = sourcePermissions.map((permissionGroup) => ({
    role_id: targetRoleId,
    feature_id: permissionGroup.feature_id,
    permissions: permissionGroup.permissions,
  }));

  return await bulkCreateFeaturePermissions(permissionRows, userId);
};

export const clonePermissionsFromRoleToUser = async (sourceRoleId, targetUserId, userId = null) => {
  if (!sourceRoleId || sourceRoleId <= 0 || !targetUserId || targetUserId <= 0) {
    throw new Error("Valid source role ID and target user ID are required");
  }

  const targetUser = await User.findByPk(targetUserId, {
    attributes: ["role_id"],
  });
  if (!targetUser || !targetUser.role_id || targetUser.role_id <= 0) {
    throw new Error("Target user does not have a valid role assigned");
  }

  const targetRoleId = targetUser.role_id;

  const sourcePermissions = await getFeaturePermissionsByRole(sourceRoleId);
  const permissionRows = sourcePermissions.map((permissionGroup) => ({
    role_id: targetRoleId,
    user_id: targetUserId,
    feature_id: permissionGroup.feature_id,
    permissions: permissionGroup.permissions,
  }));

  return await bulkCreateFeaturePermissions(permissionRows, userId);
};

const buildPermissionObjects = (permissionNames = []) => {
  return Array.from(new Set(permissionNames)).map((permissionName) => {
    const normalized = normalizePermissionName(permissionName);
    if (!normalized) return null;
    
    const displayName = normalized
      .replace(/^can_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    return {
      permission_name: normalized,
      permission_display_name: displayName,
      permission_description: `${displayName} access`,
      is_enabled: true,
    };
  }).filter(Boolean);
};

export const getModulesWithPermissionsService = async () => {
  const Feature = (await import("./feature_schema.js")).default;
  const { Category } = await import("../metadata/category/category_schema.js");

  const features = await Feature.findAll({
    where: { is_deleted: false, is_active: true },
    attributes: ["feature_id", "feature_name", "permissions"],
    include: [{
      model: Category,
      as: "category",
      required: false,
      where: { is_active: true },
      attributes: ["category_id", "name"],
    }],
    order: [[{ model: Category, as: "category" }, "category_id", "ASC"], ["feature_name", "ASC"]],
  });

  const assignedPermissions = await getAllFeaturePermissions();
  const assignedByFeature = assignedPermissions.reduce((accumulator, group) => {
    if (!accumulator[group.feature_id]) {
      accumulator[group.feature_id] = new Set();
    }

    group.permissions.forEach((permission) => {
      if (permission.is_enabled) {
        accumulator[group.feature_id].add(permission.permission_name);
      }
    });

    return accumulator;
  }, {});

  return features.map((feature) => {
    const featureData = feature.toJSON();
    const featurePermissions = normalizeFeaturePermissions(featureData.permissions);
    const assigned = Array.from(assignedByFeature[featureData.feature_id] || []);
    const allPermissionNames = [...new Set([...featurePermissions, ...assigned])];

    return {
      feature_id: featureData.feature_id,
      feature_name: featureData.feature_name,
      category_id: featureData.category?.category_id,
      category_name: featureData.category?.name || null,
      permissions: buildPermissionObjects(allPermissionNames),
    };
  });
};

export const getModulePermissionsByIdService = async (featureId) => {
  const Feature = (await import("./feature_schema.js")).default;
  const { Category } = await import("../metadata/category/category_schema.js");

  const feature = await Feature.findOne({
    where: { feature_id: featureId, is_deleted: false },
    attributes: ["feature_id", "feature_name", "permissions"],
    include: [{
      model: Category,
      as: "category",
      required: false,
      where: { is_active: true },
      attributes: ["category_id", "name"],
    }],
  });

  if (!feature) {
    return null;
  }

  const assignedPermissions = await getFeaturePermissionsByFeature(featureId);
  const assigned = assignedPermissions.flatMap((group) =>
    group.permissions.filter((permission) => permission.is_enabled).map((permission) => permission.permission_name)
  );
  const allPermissionNames = [...new Set([...normalizeFeaturePermissions(feature.permissions), ...assigned])];

  return {
    feature_id: feature.feature_id,
    feature_name: feature.feature_name,
    category_id: feature.category?.category_id,
    category_name: feature.category?.name || null,
    permissions: buildPermissionObjects(allPermissionNames),
  };
};

export const getAllPermissionNamesService = async () => {
  const Feature = (await import("./feature_schema.js")).default;

  const features = await Feature.findAll({
    where: { is_deleted: false },
    attributes: ["permissions"],
    raw: true,
  });

  const featurePermissions = features.flatMap((feature) => normalizeFeaturePermissions(feature.permissions));
  const assignedPermissions = (await getAllFeaturePermissions()).flatMap((group) =>
    group.permissions.filter((permission) => permission.is_enabled).map((permission) => permission.permission_name)
  );

  return [...new Set([...featurePermissions, ...assignedPermissions])].sort();
};
