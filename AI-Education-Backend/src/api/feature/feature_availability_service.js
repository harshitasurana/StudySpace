import AvailabilityType from "./feature_availability_schema.js";
import Feature from "./feature_schema.js";
import FeatureAvailability from "./feature_availability_model.js";
import User from "../user/user_schema.js";

const mapCreatedByName = (record) => {
  if (!record) return record;
  const json = typeof record.toJSON === 'function' ? record.toJSON() : record;
  return { ...json, created_by_name: json.creator ? `${json.creator.first_name} ${json.creator.last_name}`.trim() : null, creator: undefined };
};

/**
 * Get all active availability types, ordered by display_order then name
 */
export const getAvailabilityTypes = async () => {
  const rows = await AvailabilityType.findAll({
    where: { is_active: true },
    include: [{
      model: User,
      as: 'creator',
      attributes: ['user_id', 'first_name', 'last_name'],
      required: false,
    }],
    order: [
      ["display_order", "ASC"],
      ["name", "ASC"],
    ],
  });
  return rows.map(mapCreatedByName);
};

/**
 * Get a single availability type by ID, including its associated features
 */
export const getAvailabilityTypeById = async (id) => {
  const record = await AvailabilityType.findOne({
    where: {
      availability_type_id: id,
      is_active: true,
    },
    include: [
      {
        model: Feature,
        as: "features",
        where: { is_deleted: false },
        required: false,
        attributes: ["feature_id", "feature_name", "description"],
      },
      {
        model: User,
        as: 'creator',
        attributes: ['user_id', 'first_name', 'last_name'],
        required: false,
      },
    ],
  });
  return mapCreatedByName(record);
};

/**
 * Get availability type by code (case-insensitive — code is always stored uppercase)
 */
export const getAvailabilityTypeByCode = async (code) => {
  return await AvailabilityType.findOne({
    where: {
      code: code.toUpperCase(),
      is_active: true,
    },
  });
};

/**
 * Create a new availability type
 */
export const createAvailabilityType = async (data, userId = null) => {
  const type = await AvailabilityType.create({
    ...data,
    code: data.code.toUpperCase(),
    created_by: userId,
    updated_by: userId,
    created_at: new Date(),
    updated_at: new Date(),
  });
  return await getAvailabilityTypeById(type.availability_type_id);
};

/**
 * Update an existing availability type by ID.
 * Returns the updated record, or null if not found.
 */
export const updateAvailabilityType = async (id, data, userId = null) => {
  const [affectedRows] = await AvailabilityType.update(
    {
      ...data,
      updated_by: userId,
      updated_at: new Date(),
    },
    {
      where: { availability_type_id: id },
    }
  );

  if (affectedRows === 0) {
    return null;
  }

  return await getAvailabilityTypeById(id);
};

/**
 * Soft-delete an availability type (sets is_active = false).
 * Throws if the type is still referenced by active features.
 */
export const deleteAvailabilityType = async (id, userId = null) => {
  // Guard: prevent deletion if any active features reference this type
  const links = await FeatureAvailability.findAll({
    where: { availability_type_id: id },
    include: [
      {
        model: Feature,
        as: "feature",
        where: { is_deleted: false },
        attributes: ["feature_id", "feature_name"],
        required: true,
      },
    ],
    raw: true,
    nest: true,
  });

  if (links.length > 0) {
    const names = links.map((l) => l.feature.feature_name).join(", ");
    throw new Error(
      `Cannot delete availability type. It is being used by ${links.length} feature(s): ${names}`
    );
  }

  const [affectedRows] = await AvailabilityType.update(
    {
      is_active: false,
      updated_by: userId,
      updated_at: new Date(),
    },
    {
      where: { availability_type_id: id },
    }
  );

  return affectedRows > 0;
};

/**
 * Seed the default set of availability types (idempotent — uses findOrCreate).
 * Returns an array of { type, isNew } objects.
 */
export const seedDefaultAvailabilityTypes = async (userId = null) => {
  const defaultTypes = [
    {
      code: "REACT",
      name: "React Web App",
      description: "Available in React web application",
      display_order: 1,
    },
    {
      code: "ANGULAR",
      name: "Angular Web App",
      description: "Available in Angular web application",
      display_order: 2,
    },
    {
      code: "BOTH",
      name: "Both Platforms",
      description: "Available in both React and Angular",
      display_order: 3,
    },
    {
      code: "MOBILE",
      name: "Mobile App",
      description: "Available in mobile application",
      display_order: 4,
    },
    {
      code: "DESKTOP",
      name: "Desktop App",
      description: "Available in desktop application",
      display_order: 5,
    },
    {
      code: "API",
      name: "API Only",
      description: "Available only via API",
      display_order: 6,
    },
  ];

  const results = [];
  for (const type of defaultTypes) {
    const [created, isNew] = await AvailabilityType.findOrCreate({
      where: { code: type.code },
      defaults: {
        ...type,
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
      },
    });
    results.push({ type: mapCreatedByName(created), isNew });
  }
  return results;
};
