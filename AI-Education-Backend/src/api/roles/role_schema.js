import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";


const Role = sequelize.define(
  "Role",
  {
    role_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    role_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "categories",
        key: "category_id",
      },
    },
    status: {
      type: DataTypes.ENUM("Active", "Inactive"),
      allowNull: false,
      defaultValue: "Active",
    },
    system_flag: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    permissions: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    // Marks roles a regular (non-admin) authenticated user is allowed to
    // view via GET /api/roles/public and set on themselves via
    // PUT /api/users/me/role. Defaults false so existing roles
    // (super_admin, hospital_admin, doctor, patient, etc.) stay admin-only
    // unless explicitly opted in. Education roles (Student, ...) should be
    // seeded/updated with this set to true.
    is_self_assignable: {
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
    tableName: "roles",
    underscored: true,
    paranoid: false,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['role_name'],
        where: {
          is_deleted: false,
        },
      },
    ],
    defaultScope: {
      where: { is_deleted: false },
      attributes: { exclude: ['is_deleted'] },
    },
    scopes: {
      withDeleted: {
        where: {},
      },
      deleted: {
        where: { is_deleted: true },
      },
    },
  }
);

// Define associations
Role.associate = (models) => {
  Role.hasMany(models.User, {
    foreignKey: 'role_id',
    as: 'users',
  });

  Role.hasMany(models.FeaturePermission, {
    foreignKey: 'role_id',
    as: 'featurePermissions',
  });

  Role.belongsTo(models.Category, {
    foreignKey: 'category_id',
    as: 'category',
  });

  Role.belongsTo(models.User, {
    foreignKey: 'created_by',
    as: 'creator',
    targetKey: 'user_id'
  });
  Role.belongsTo(models.User, {
    foreignKey: 'updated_by',
    as: 'updater',
    targetKey: 'user_id'
  });
};


Role.searchConfig = {
  key: "roles",
  label: "Role",
  category: "operations",
  permissionFeatures: ["Role"],
  activeFilter: { is_active: true },
  display: { title: "name", subtitle: "status", description: "description" },
  route: (row) => `/api/roles/${row.role_id ?? row.id ?? ""}`,
  order: [["name", "ASC"]],
};

export default Role;