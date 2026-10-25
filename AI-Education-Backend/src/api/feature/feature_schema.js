import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

/**
 * GLOBAL TABLE — features
 * System-wide feature catalog shared across ALL organizations.
 * Do NOT add organization_id. Per-org feature visibility is controlled
 * via feature_custom_permissions. See docs/architecture.md.
 */

const Feature = sequelize.define(
  "Feature",
  {
    feature_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    feature_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    parent_feature_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "features",
        key: "feature_id",
      },
    },
    show_in_menu: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    menu_label: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    menu_icon: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    router_link: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    menu_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "categories",
        key: "category_id",
      },
    },
    permissions: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: ["create", "read", "update", "delete"],
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
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
    tableName: "features",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["feature_name"],
      },
      {
        fields: ["parent_feature_id"],
      },
      {
        fields: ["category_id"],
      },
      {
        fields: ["is_active"],
      },
      {
        fields: ["is_deleted"],
      },
    ],
  }
);

// Define associations
Feature.associate = (models) => {
  Feature.hasMany(models.FeaturePermission, {
    foreignKey: 'feature_id',
    as: 'featurePermissions',
  });
  Feature.hasMany(models.FeaturePermission, {
    foreignKey: 'feature_id',
    as: 'featurePermissionsList',
  });
  Feature.belongsTo(models.Category, {
    foreignKey: 'category_id',
    as: 'category',
  });
  // Many-to-many via junction table feature_availability_types
  Feature.hasMany(models.FeatureAvailability, {
    foreignKey: 'feature_id',
    as: 'availabilityLinks',
  });
  Feature.belongsToMany(models.AvailabilityType, {
    through: models.FeatureAvailability,
    foreignKey: 'feature_id',
    otherKey: 'availability_type_id',
    as: 'availabilityTypesList',
  });
  Feature.belongsTo(models.User, {
    foreignKey: 'created_by',
    as: 'creator',
    targetKey: 'user_id'
  });
  Feature.belongsTo(models.User, {
    foreignKey: 'updated_by',
    as: 'updater',
    targetKey: 'user_id'
  });
};


Feature.searchConfig = {
  key: "features",
  label: "Feature",
  category: "operations",
  permissionFeatures: ["Feature"],
  activeFilter: { is_active: true },
  display: { title: "name", subtitle: "status", description: "description" },
  route: (row) => `/api/features/${row.feature_id ?? row.id ?? ""}`,
  order: [["name", "ASC"]],
};

export default Feature;
