import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const RoleTemplate = sequelize.define(
  "RoleTemplate",
  {
    template_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    permissions: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'active',
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
        model: 'users',
        key: 'user_id',
      },
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id',
      },
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
    tableName: "role_templates",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

RoleTemplate.associate = (models) => {
  RoleTemplate.belongsTo(models.Category, {
    foreignKey: 'category_id',
    as: 'category',
  });

  RoleTemplate.belongsTo(models.User, {
    foreignKey: 'created_by',
    as: 'creator',
    targetKey: 'user_id'
  });

  RoleTemplate.belongsTo(models.User, {
    foreignKey: 'updated_by',
    as: 'updater',
    targetKey: 'user_id'
  });
};


RoleTemplate.searchConfig = {
  key: "role_templates",
  label: "Role Template",
  category: "operations",
  permissionFeatures: ["Role Template"],
  display: { title: "name", subtitle: "status", description: "description" },
  route: (row) => `/api/role_templates/${row.template_id ?? row.id ?? ""}`,
  order: [["name", "ASC"]],
};

export default RoleTemplate;
