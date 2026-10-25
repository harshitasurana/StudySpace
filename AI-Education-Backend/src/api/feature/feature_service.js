import Feature from "./feature_schema.js";
import FeaturePermission from "./feature_permissions_schema.js";
import FeatureAvailability from "./feature_availability_model.js";
import Role from "../roles/role_schema.js";
import AvailabilityType from "./feature_availability_schema.js";
import User from "../user/user_schema.js";
import { buildWhere } from "../../common/utils/buildWhere.js";
import { list as commonList } from "../../common/services/commonList.service.js";
import { FEATURE_FILTER_SCHEMA } from "./feature.filter.schema.js";
import { Category } from "../metadata/category/category_schema.js";
import { bulkCreateFeaturePermissionsService, bulkUpdateFeaturePermissionsService } from "./feature_permissions_service.js";
import { Op } from "sequelize";
import sequelize from "../../config/database.js";
import { CATEGORY_TYPES } from "../../common/constants/category_types.js";

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

const STANDARD_PERMISSION_KEYS = ['can_read', 'can_create', 'can_update', 'can_delete'];

const toPermissionRows = (permissions = []) => {
  return [...new Set(permissions)]
    .filter(Boolean)
    .map((permissionName) => ({
      permission_name: permissionName,
      permission_display_name: permissionName.replace(/^can_/, '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      permission_description: null,
      is_enabled: true,
    }));
};

const buildRolePermissionSeed = (roleId, featureId, permissions = null) => {
  const effectivePermissions = Array.isArray(permissions) && permissions.length > 0
    ? permissions
    : STANDARD_PERMISSION_KEYS;

  return {
    role_id: roleId,
    feature_id: featureId,
    permissions: toPermissionRows(effectivePermissions),
  };
};

const buildCreatorInclude = () => ({
  model: User,
  as: 'creator',
  attributes: ['user_id', 'first_name', 'last_name'],
  required: false,
});

/**
 * Build the Sequelize include block for fetching availability types via junction table.
 * Optionally filters by a clientType code (e.g. "REACT", "ANGULAR", "MOBILE").
 */
const buildAvailabilityInclude = () => ({
  model: AvailabilityType,
  as: 'availabilityTypesList',
  attributes: ['availability_type_id', 'code', 'name'],
  through: { attributes: [] },
  required: false,
});

/**
 * Sync junction rows for a feature's availability types.
 * Deletes existing rows then bulk-inserts the new set.
 * @param {number} featureId
 * @param {number[]} availabilityTypeIds - array of IDs, may be empty
 * @param {Object} [transaction] - optional Sequelize transaction
 */
const syncAvailabilityLinks = async (featureId, availabilityTypeIds, transaction = null) => {
  const opts = transaction ? { transaction } : {};

  // Remove all existing links for this feature
  await FeatureAvailability.destroy({ where: { feature_id: featureId }, ...opts });

  if (!Array.isArray(availabilityTypeIds) || availabilityTypeIds.length === 0) return;

  const rows = [...new Set(availabilityTypeIds)].map((id) => ({
    feature_id: featureId,
    availability_type_id: id,
    created_at: new Date(),
  }));

  await FeatureAvailability.bulkCreate(rows, { ...opts, ignoreDuplicates: true });
};

/**
 * Transform incoming feature data.
 * Validates availability_type_ids array and category_id.
 */
const transformFeatureData = async (featureData) => {
  const transformed = { ...featureData };

  // Validate all provided availability_type_ids
  if (
    Array.isArray(transformed.availability_type_ids) &&
    transformed.availability_type_ids.length > 0
  ) {
    const ids = [...new Set(transformed.availability_type_ids)];
    const found = await AvailabilityType.findAll({
      where: { availability_type_id: { [Op.in]: ids }, is_active: true },
      attributes: ['availability_type_id'],
    });
    if (found.length !== ids.length) {
      throw new Error('One or more availability type IDs are invalid or inactive');
    }
    transformed._availabilityTypeIds = ids;
  } else {
    transformed._availabilityTypeIds = [];
  }

  // VALIDATE against metadata category_id
  if (transformed.category_id !== undefined && transformed.category_id !== null) {
    const { Category, CategoryType } = await import("../metadata/category/category_schema.js");
    const categoryExists = await Category.findOne({
      where: { category_id: transformed.category_id },
      include: [{
        model: CategoryType,
        where: { code: CATEGORY_TYPES.FEATURE } // Ensure it's strictly a Feature category
      }]
    });
    if (!categoryExists) throw new Error('Invalid Feature Category');
  }

  // Handle permissions - the new API sends simple array like ["CREATE", "READ", "UPDATE", "DELETE", "EXPORT"]
  // Transform each permission to DB format (can_create, can_read, etc.)
  if (transformed.permissions !== undefined && Array.isArray(transformed.permissions)) {
    transformed._simplePermissions = transformed.permissions.map(p => transformPermissionToDbFormat(p));
  }

  return transformed;
};


// Helper function to get merged standard + custom permissions for a feature
const getMergedPermissions = async (feature) => {
  const featureJson = typeof feature.toJSON === "function" ? feature.toJSON() : feature;
  const basePermissions =
    featureJson.permissions && Array.isArray(featureJson.permissions) && featureJson.permissions.length > 0
      ? featureJson.permissions
      : ["create", "read", "update", "delete"];

  const permissionRecords = await FeaturePermission.findAll({
    where: {
      feature_id: featureJson.feature_id,
    },
    attributes: ["permission_name", "is_enabled"],
    raw: true,
  });

  const assignedPermissionNames = permissionRecords
    .filter((permissionRecord) => permissionRecord.is_enabled === true)
    .map((permissionRecord) => permissionRecord.permission_name)
    .filter(Boolean);

  return [...new Set([...basePermissions, ...assignedPermissionNames])];
};

/**
 * Map a raw Feature instance (with availabilityTypesList included) to API response shape.
 */
const mapFeature = async (f) => {
  const json = typeof f.toJSON === 'function' ? f.toJSON() : f;
  const { category, availabilityTypesList, availabilityType, creator, ...rest } = json;
  return {
    ...rest,
    category_name: category?.name || null,
    availability_types: Array.isArray(availabilityTypesList) ? availabilityTypesList : [],
    permissions: await getMergedPermissions(f),
    created_by_name: creator ? `${creator.first_name} ${creator.last_name}`.trim() : null,
  };
};

export const deriveFeatureNamesFromKeys = (featureKeys = []) => {
  return featureKeys
    .filter((key) => typeof key === 'string' && key.length > 0)
    .map((key) => key
      .trim()
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
    );
};

// Per-org/per-subscription feature entitlement gating has been removed —
// this deployment is fully local and unpaywalled, so every feature is
// available to every organization. These are kept as no-op pass-throughs
// (rather than deleted) so call sites below don't need to change shape.
export const applyOrgFeatureExclusions = async (where) => where;

export const filterFeaturesByOrg = async (features) => features;

export const getAllFeaturesService = async (clientType = null) => {
  const where = await applyOrgFeatureExclusions({ is_deleted: false, is_active: true });

  const features = await Feature.findAll({
    where,
    attributes: [
      "feature_id",
      "feature_name",
      "category_id",
      "description",
      "is_active",
      "parent_feature_id",
      "show_in_menu",
      "menu_label",
      "menu_icon",
      "router_link",
      "menu_order",
      "permissions",
      "created_at",
      "updated_at",
    ],
    include: [
      {
        model: Category,
        as: 'category',
        attributes: ['name']
      },
      buildAvailabilityInclude(),
      buildCreatorInclude(),
    ],
    order: [["menu_order", "ASC"], ["feature_name", "ASC"]],
  });

  return await filterFeaturesByOrg(await Promise.all(features.map(mapFeature)));
};

export const getFeaturesList = async (options, _clientType = null) => {
  const { limit, offset, sort, search, filters } = options;

  const where = await applyOrgFeatureExclusions(buildWhere({
    baseWhere: filters.is_active !== undefined ? {} : { is_deleted: false },
    search,
    filters,
    schema: FEATURE_FILTER_SCHEMA,
  }));

  const result = await commonList({
    model: Feature,
    where,
    limit,
    offset,
    order: sort,
    include: [
      {
        model: Category,
        as: 'category',
        attributes: ['name']
      },
      buildAvailabilityInclude(),
      buildCreatorInclude(),
    ]
  });

  if (Array.isArray(result)) {
    const mapped = await Promise.all(result.map(mapFeature));
    return await filterFeaturesByOrg(mapped);
  }

  // Map records - now consistently in result.data after commonList fix
  const records = result.data || result.staff;
  if (records && Array.isArray(records)) {
    result.data = await filterFeaturesByOrg(await Promise.all(records.map(mapFeature)));
    delete result.staff; // Clean up old field
  }
  return result;
};

export const getFeatureByIdService = async (id) => {
  const feature = await Feature.findOne({
    where: { feature_id: id, is_deleted: false },
    attributes: [
      "feature_id",
      "feature_name",
      "description",
      "category_id",
      "is_active",
      "parent_feature_id",
      "show_in_menu",
      "menu_label",
      "menu_icon",
      "router_link",
      "menu_order",
      "permissions",
      "created_at",
      "updated_at",
    ],
    include: [
      {
        model: Category,
        as: 'category',
        attributes: ['name']
      },
      buildAvailabilityInclude(),
      buildCreatorInclude(),
    ]
  });

  if (!feature) {
    throw new Error("Feature not found");
  }

  return await mapFeature(feature);
};

export const createFeatureService = async (featureData, userId = null) => {
  const now = new Date();
  const transformedData = await transformFeatureData(featureData);

  let createdFeatureId;

  await sequelize.transaction(async (transaction) => {
    const roles = await Role.findAll({
      attributes: ["role_id"],
      where: { is_deleted: false },
      transaction,
    });

    // Strip internal helpers before creating the Feature row
    const { _simplePermissions, _availabilityTypeIds, availability_type_ids, ...featureFields } = transformedData;

    const created = await Feature.create(
      {
        ...featureFields,
        created_by: userId,
        updated_by: userId,
        created_at: now,
        updated_at: now,
      },
      { transaction }
    );

    createdFeatureId = created.feature_id;

    // Sync junction rows
    await syncAvailabilityLinks(createdFeatureId, _availabilityTypeIds, transaction);

    const permissionsToCreate = roles.map((role) =>
      buildRolePermissionSeed(role.role_id, createdFeatureId, _simplePermissions)
    );
    await bulkCreateFeaturePermissionsService(permissionsToCreate, userId, { transaction });
  });

  return await getFeatureByIdService(createdFeatureId);
};

export const updateFeatureService = async (id, updateData, userId = null) => {
  const transformedData = await transformFeatureData(updateData);

  const { _simplePermissions, _availabilityTypeIds, availability_type_ids, ...featureFields } = transformedData;

  const [affectedRows] = await Feature.update(
    {
      ...featureFields,
      updated_by: userId,
      updated_at: new Date(),
    },
    {
      where: { feature_id: id, is_deleted: false },
    }
  );

  if (affectedRows === 0) {
    throw new Error("Feature not found");
  }

  // Sync junction rows if availability_type_ids was provided in the payload
  if (updateData.availability_type_ids !== undefined) {
    await syncAvailabilityLinks(id, _availabilityTypeIds);
  }

  if (_simplePermissions && Array.isArray(_simplePermissions)) {
    const roles = await Role.findAll({
      attributes: ["role_id"],
      where: { is_deleted: false }
    });

    const permissionsToUpdate = roles.map((role) =>
      buildRolePermissionSeed(role.role_id, id, _simplePermissions)
    );

    await bulkUpdateFeaturePermissionsService(permissionsToUpdate, userId);
  }

  return await getFeatureByIdService(id);
};

export const deleteFeatureService = async (id, { userRole = null, userId = null } = {}) => {
  const isSuperAdmin = userRole === 'super_admin';

  if (isSuperAdmin) {
    const [affectedRows] = await Feature.update(
      {
        is_deleted: true,
        is_active: false,
        updated_by: userId,
        updated_at: new Date(),
      },
      {
        where: { feature_id: id, is_deleted: false },
      }
    );

    if (affectedRows === 0) {
      throw new Error("Feature not found");
    }

    await FeatureAvailability.destroy({ where: { feature_id: id } });
    return;
  }

  // Per-org feature disabling was implemented via subscription-scoped
  // overrides, which no longer exist in this unpaywalled deployment —
  // feature deletion is a global, super_admin-only operation now.
  throw new Error("Only super_admin can delete features");
};

export const bulkDeleteFeature = async (featureIds, { userRole = null, userId = null } = {}) => {
  const isSuperAdmin = userRole === 'super_admin';

  if (isSuperAdmin) {
    const transaction = await sequelize.transaction();
    try {
      const [affectedRows] = await Feature.update(
        {
          is_deleted: true,
          is_active: false,
          updated_by: userId,
          updated_at: new Date()
        },
        {
          where: {
            feature_id: { [Op.in]: featureIds },
            is_deleted: false
          },
          transaction
        }
      );

      if (affectedRows === 0) {
        await transaction.rollback();
        throw new Error("No features found to delete");
      }

      await FeatureAvailability.destroy({
        where: { feature_id: { [Op.in]: featureIds } },
        transaction
      });

      await transaction.commit();
      return affectedRows;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Per-org feature disabling was implemented via subscription-scoped
  // overrides, which no longer exist in this unpaywalled deployment —
  // feature deletion is a global, super_admin-only operation now.
  throw new Error("Only super_admin can delete features");
};

export const getFeaturesStatistics = async () => {
  const allFeatures = await Feature.findAll({
    where: { is_deleted: false },
    attributes: ["feature_id", "feature_name", "category_id", "is_active"],
  });

  const totalFeatures = allFeatures.length;
  const activeFeatures = allFeatures.filter((f) => f.is_active).length;
  const inactiveFeatures = totalFeatures - activeFeatures;

  const permissionCounts = await FeaturePermission.findAll({
    attributes: [
      "feature_id",
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
    ],
    group: ["feature_id"],
  });

  const countsMap = {};
  permissionCounts.forEach((row) => {
    const fid = row.feature_id;
    countsMap[fid] = parseInt(row.get("count"), 10);
  });

const categoryIds = [...new Set(allFeatures.map(f => f.category_id).filter(Boolean))];
  const categoryMap = {};
  
  if (categoryIds.length > 0) {
    const { CategoryType, Category } = await import("../metadata/category/category_schema.js");
    const categories = await Category.findAll({
      where: { category_id: { [Op.in]: categoryIds } },
      attributes: ['category_id', 'name'],
      include: [{
        model: CategoryType,
        attributes: ['code']
      }]
    });
    
    categories.forEach(cat => {
      categoryMap[cat.category_id] = {
        name: cat.name,
        type_code: cat.CategoryType?.code || 'UNKNOWN'
      };
    });
  }

  const categories = {};
  allFeatures.forEach((feature) => {
    const categoryId = feature.category_id;
    const category = categoryId && categoryMap[categoryId]
      ? categoryMap[categoryId].name
      : "Uncategorized";
    
    if (!categories[category]) {
      categories[category] = {
        category_id: categoryId || null,
        category,
        total: 0,
        active: 0,
        inactive: 0,
        features: [],
      };
    }
    categories[category].total += 1;
    if (feature.is_active) {
      categories[category].active += 1;
    } else {
      categories[category].inactive += 1;
    }
    categories[category].features.push({
      feature_id: feature.feature_id,
      feature_name: feature.feature_name,
      is_active: feature.is_active,
      permissions_count: countsMap[feature.feature_id] || 0,
    });
  });

  const by_category = Object.values(categories);

  return {
    total_features: totalFeatures,
    active_features: activeFeatures,
    inactive_features: inactiveFeatures,
    categories: by_category,
  };
};

export const getCategoriesList = async (queryOptions = {}) => {
  const { CategoryType, Category } = await import('../metadata/category/category_schema.js');

  const { page = 1, limit = 100 } = queryOptions;
  const offset = (page - 1) * limit;

  const categories = await Category.findAll({
    include: [{
      model: CategoryType,
      where: { is_active: true },
      attributes: [
        ['code', 'category_type_code'],
        ['name', 'category_type_name']
      ]
    }],
    where: { is_active: true },
    order: [
      [{ model: CategoryType }, 'code', 'ASC'],
      ['display_order', 'ASC'],
      ['name', 'ASC']
    ],
    limit,
    offset
  });

  const totalCount = await Category.count({
    include: [{
      model: CategoryType,
      where: { is_active: true }
    }],
    where: { is_active: true }
  });

  const formatted = categories.map(cat => ({
    category_type_code: cat.CategoryType.category_type_code,
    category_type_name: cat.CategoryType.category_type_name,
    category_code: cat.code,
    category_name: cat.name,
    display_order: cat.display_order
  }));

  return {
    data: formatted,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
};

/**
 * Activate a feature service
 * @param {number} id - The feature ID
 * @param {number} userId - The user ID updating the feature
 * @returns {Promise<Object>} The activated feature
 */
export const activateFeatureService = async (id, userId = null) => {
  if (!id || id <= 0) {
    throw new Error("Valid feature ID is required");
  }

  // Check if feature exists
  const existingFeature = await Feature.findOne({
    where: { feature_id: id, is_deleted: false }
  });

  if (!existingFeature) {
    throw new Error("Feature not found");
  }

  // Check if already active
  if (existingFeature.is_active === true) {
    throw new Error("Feature is already active");
  }

  // Activate the feature
  const { activateFeature } = await import("./feature_model.js");
  const activated = await activateFeature(id, userId);

  if (!activated) {
    throw new Error("Failed to activate feature");
  }

  return await getFeatureByIdService(id);
};

/**
 * Deactivate a feature service
 * @param {number} id - The feature ID
 * @param {number} userId - The user ID updating the feature
 * @returns {Promise<Object>} The deactivated feature
 */
export const deactivateFeatureService = async (id, userId = null) => {
  if (!id || id <= 0) {
    throw new Error("Valid feature ID is required");
  }

  // Check if feature exists
  const existingFeature = await Feature.findOne({
    where: { feature_id: id, is_deleted: false }
  });

  if (!existingFeature) {
    throw new Error("Feature not found");
  }

  // Check if already inactive
  if (existingFeature.is_active === false) {
    throw new Error("Feature is already inactive");
  }

  // Deactivate the feature
  const { deactivateFeature } = await import("./feature_model.js");
  const deactivated = await deactivateFeature(id, userId);

  if (!deactivated) {
    throw new Error("Failed to deactivate feature");
  }

  return await getFeatureByIdService(id);
};
