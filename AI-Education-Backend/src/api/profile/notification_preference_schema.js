import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import User from '../user/user_schema.js';

/**
 * Notification Preference Schema
 * Industry-standard key-value preferences table
 */

const UserNotificationPreference = sequelize.define('UserNotificationPreference', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'user_id'
    },
    onDelete: 'CASCADE',
  },
  preference_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Notification preference key (email_security_alerts, push_login_alerts, etc.)'
  },
  preference_value: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
,
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
  }, {
  tableName: 'user_notification_preferences',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id', 'preference_key'],
      unique: true,
      name: 'idx_user_notification_prefs_unique'
    },
    {
      fields: ['user_id'],
      name: 'idx_user_notification_prefs_user_id'
    }
  ]
});

// Associations
UserNotificationPreference.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
  onDelete: 'CASCADE'
});

User.hasMany(UserNotificationPreference, {
  foreignKey: 'user_id',
  as: 'notificationPreferences'
});

export default UserNotificationPreference;

