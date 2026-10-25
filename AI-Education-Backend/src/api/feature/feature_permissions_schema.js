import { DataTypes, Op } from "sequelize";
import sequelize from "../../config/database.js";

/**
 * GLOBAL TABLE — feature_permissions
 * Role/user-level permission flags for system features.
 * Permissions are global (role-based), not org-scoped.
 * Do NOT add organization_id. See docs/architecture.md.
 */

const FeaturePermission = sequelize.define(
  "FeaturePermission",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "user_id",
      },
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "roles",
        key: "role_id",
      },
    },
    feature_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "features",
        key: "feature_id",
      },
    },
    permission_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    permission_display_name: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    permission_description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    tableName: "feature_permissions",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["role_id", "feature_id", "permission_name"],
        where: {
          user_id: null,
        },
      },
      {
        unique: true,
        fields: ["user_id", "feature_id", "permission_name"],
        where: {
          user_id: {
            [Op.ne]: null,
          },
        },
      },
      {
        fields: ["role_id"],
      },
      {
        fields: ["user_id"],
      },
      {
        fields: ["feature_id"],
      },
      {
        fields: ["permission_name"],
      },
      {
        fields: ["is_enabled"],
      },
      {
        fields: ["feature_id", "permission_name", "is_enabled"],
      },
    ],
  }
);

// Define associations
FeaturePermission.associate = (models) => {
  FeaturePermission.belongsTo(models.Role, {
    foreignKey: "role_id",
    as: "featureRole",
  });

  FeaturePermission.belongsTo(models.Feature, {
    foreignKey: "feature_id",
    as: "feature",
  });
  FeaturePermission.belongsTo(models.User, {
    foreignKey: 'created_by',
    as: 'creator',
    targetKey: 'user_id'
  });
  FeaturePermission.belongsTo(models.User, {
    foreignKey: 'updated_by',
    as: 'updater',
    targetKey: 'user_id'
  });
};



FeaturePermission.searchConfig = {
  key: "feature-permissions",
  label: "Feature Permission",
  category: "operations",
  permissionFeatures: ["Feature Permission"],
  display: { title: "name", subtitle: "status", description: "description" },
  route: (row) => `/api/feature-permissions/${row.id ?? row.id ?? ""}`,
  order: [["name", "ASC"]],
};
export default FeaturePermission;
