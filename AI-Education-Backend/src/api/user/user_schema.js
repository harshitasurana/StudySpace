import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import Role from "../roles/role_schema.js";

/**
 * GLOBAL TABLE — users
 * User accounts are NOT organization-scoped. Organization membership is resolved
 * through user_structure_assignments (is_current=true, status='Active').
 * Migration 20260611_migrate_user_org_to_assignments_and_drop_column.sql dropped
 * the legacy users.organization_id column. Do NOT re-add it. See docs/architecture.md.
 */

const User = sequelize.define(
  "User",
  {
    user_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    is_main_user: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Nullable at the DB level (confirmed: information_schema shows
    // is_nullable=YES) — this model was out of sync with that, enforcing
    // NOT NULL only at the Sequelize validation layer. That mismatch is
    // exactly why registerUser() (user_service.js) couldn't set role_id:
    // null for a self-registered education account with no role yet: it
    // was previously wired to role_id: 4 instead, which happens to be the
    // shared roles table's "patient" role from this backend's other
    // (healthcare) vertical — silently mislabeling every new student.
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    account_email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: { isEmail: true },
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    initials: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email_verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_password_change: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    security_score: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    staff_id: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    last_failed_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_login: {
      type: DataTypes.DATE,
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    password_reset_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password_reset_expires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    user_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Internal",
      validate: { isIn: [["Internal", "External"]] },
    },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
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
    tableName: "users",
    timestamps: true,
    underscored: true,
  }
);

User.associate = (models) => {
  // Check if associations already exist before defining them
  if (!User.associations || !User.associations.userRole) {
    // User -> Role association (ONLY HERE)
    User.belongsTo(models.Role, {
      foreignKey: 'role_id',
      as: 'userRole'
    });

    // User -> Creator (self-referential)
    User.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator',
      targetKey: 'user_id'
    });

    // User -> Updater (self-referential)
    User.belongsTo(models.User, {
      foreignKey: 'updated_by',
      as: 'updater',
      targetKey: 'user_id'
    });

  }
};



User.searchConfig = {
  key: "users",
  label: "User",
  category: "operations",
  permissionFeatures: ["User"],
  activeFilter: { is_active: true },
  display: { title: "title", subtitle: "status", description: "description" },
  route: (row) => `/api/users/${row.user_id ?? row.id ?? ""}`,
  order: [["title", "ASC"]],
};
export default User;
