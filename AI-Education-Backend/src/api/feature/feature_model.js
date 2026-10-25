import Feature from "./feature_schema.js";
import { Op } from "sequelize";

export const getAllFeatures = async () => {
  return await Feature.findAll({
    where: {
      is_deleted: false,
    },
    order: [
      ["category_id", "ASC"],
      ["feature_name", "ASC"],
    ],
  });
};

export const getFeatureById = async (featureId) => {
  if (!featureId || featureId <= 0) {
    throw new Error("Valid feature ID is required");
  }

  return await Feature.findOne({
    where: {
      feature_id: featureId,
      is_deleted: false,
    },
  });
};

export const createFeature = async (featureData, userId = null) => {
  const now = new Date();

  return await Feature.create({
    ...featureData,
    created_by: userId,
    updated_by: userId,
    created_at: now,
    updated_at: now,
  });
};

export const updateFeature = async (featureId, updateData, userId = null) => {
  if (!featureId || featureId <= 0) {
    throw new Error("Valid feature ID is required");
  }

  const [affectedRows] = await Feature.update(
    {
      ...updateData,
      updated_by: userId,
      updated_at: new Date(),
    },
    {
      where: {
        feature_id: featureId,
        is_deleted: false,
      },
    }
  );

  if (affectedRows === 0) {
    return null;
  }

  return await getFeatureById(featureId);
};

export const deleteFeature = async (featureId, userId = null) => {
  if (!featureId || featureId <= 0) {
    throw new Error("Valid feature ID is required");
  }

  const [affectedRows] = await Feature.update(
    {
      is_deleted: true,
      updated_by: userId,
      updated_at: new Date(),
    },
    {
      where: {
        feature_id: featureId,
        is_deleted: false,
      },
    }
  );

  return affectedRows > 0;
};

// Removed getFeaturesByCategory - use metadata/category API


/**
 * Activate a feature (set is_active to true)
 * @param {number} featureId - The feature ID
 * @returns {Promise<Object|null>} The updated feature or null
 */
export const activateFeature = async (featureId, userId = null) => {
  if (!featureId || featureId <= 0) {
    throw new Error("Valid feature ID is required");
  }

  const [affectedRows] = await Feature.update(
    {
      is_active: true,
      updated_by: userId,
      updated_at: new Date(),
    },
    {
      where: {
        feature_id: featureId,
        is_deleted: false,
      },
    }
  );

  if (affectedRows === 0) {
    return null;
  }

  return await getFeatureById(featureId);
};

/**
 * Deactivate a feature (set is_active to false)
 * @param {number} featureId - The feature ID
 * @returns {Promise<Object|null>} The updated feature or null
 */
export const deactivateFeature = async (featureId, userId = null) => {
  if (!featureId || featureId <= 0) {
    throw new Error("Valid feature ID is required");
  }

  const [affectedRows] = await Feature.update(
    {
      is_active: false,
      updated_by: userId,
      updated_at: new Date(),
    },
    {
      where: {
        feature_id: featureId,
        is_deleted: false,
      },
    }
  );

  if (affectedRows === 0) {
    return null;
  }

  return await getFeatureById(featureId);
};
