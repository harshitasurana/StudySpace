import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

/**
 * GLOBAL TABLE — feature_availability_types
 * Stores dynamic availability type definitions for features.
 * Replaces the static feature_availability enum (REACT | ANGULAR | BOTH).
 */
const AvailabilityType = sequelize.define(
  "AvailabilityType",
  {
    availability_type_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "user_id",
      },
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_by_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    updated_by_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "feature_availability_types",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["code"],
      },
      {
        fields: ["is_active"],
      },
    ],
  }
);

// Define associations
AvailabilityType.associate = (models) => {
  // Many-to-many via junction table feature_availability_types
  AvailabilityType.hasMany(models.FeatureAvailability, {
    foreignKey: 'availability_type_id',
    as: 'availabilityLinks',
  });
  AvailabilityType.belongsToMany(models.Feature, {
    through: models.FeatureAvailability,
    foreignKey: 'availability_type_id',
    otherKey: 'feature_id',
    as: 'features',
  });
  AvailabilityType.belongsTo(models.User, {
    foreignKey: 'created_by',
    as: 'creator',
    targetKey: 'user_id'
  });
  AvailabilityType.belongsTo(models.User, {
    foreignKey: 'updated_by',
    as: 'updater',
    targetKey: 'user_id'
  });
};



AvailabilityType.searchConfig = {
  key: "availability-types",
  label: "Availability Type",
  category: "operations",
  permissionFeatures: ["Availability Type"],
  activeFilter: { is_active: true },
  display: { title: "name", subtitle: "status", description: "description" },
  route: (row) => `/api/availability-types/${row.availability_type_id ?? row.id ?? ""}`,
  order: [["name", "ASC"]],
};
export default AvailabilityType;
