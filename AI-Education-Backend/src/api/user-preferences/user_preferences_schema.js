import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
import User from "../user/user_schema.js";

const UserPreference = sequelize.define(
  "UserPreference",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'user_id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    preference_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Preference key (e.g., "theme", "appointments.view", "general.language")',
    },
    preference_value: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Preference value (any type: string, number, boolean, object)',
    },
    is_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    tableName: 'user_preferences',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
        name: 'idx_user_preferences_user_id',
      },
      {
        fields: ['preference_key'],
        name: 'idx_user_preferences_key',
      },
      {
        fields: ['user_id', 'preference_key'],
        unique: true,
        name: 'idx_user_preferences_user_key_unique',
      },
    ],
  }
);

// Associations
UserPreference.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
  onDelete: 'CASCADE'
});

UserPreference.belongsTo(User, { foreignKey: 'created_by', as: 'creator', targetKey: 'user_id' });
UserPreference.belongsTo(User, { foreignKey: 'updated_by', as: 'updater', targetKey: 'user_id' });

User.hasMany(UserPreference, {
  foreignKey: 'user_id',
  as: 'preferences'
});


UserPreference.searchConfig = {
  key: "user_preferences",
  label: "User Preference",
  category: "operations",
  permissionFeatures: ["User Preference"],
  display: { title: "name", subtitle: "status", description: "description" },
  route: (row) => `/api/user_preferences/${row.id ?? row.id ?? ""}`,
  order: [["name", "ASC"]],
};

export default UserPreference;
