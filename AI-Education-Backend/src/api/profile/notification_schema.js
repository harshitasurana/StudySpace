import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import User from '../user/user_schema.js';
/**
 * Notification Schema
 * 
 * Industry-standard notification system with two tables:
 * 1. notifications - stores message templates/event info
 * 2. user_notifications - connects notifications to users with read status
 */

// Notification Template Table
export const Notification = sequelize.define('Notification', {
  notification_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM(
      'SYSTEM', 'ORDER', 'MESSAGE', 'SECURITY', 'ANNOUNCEMENT',
      'QUIZ_RESULT', 'MOCK_TEST_RESULT', 'STREAK_MILESTONE', 'STREAK_REMINDER', 'EXAM_REMINDER', 'STUDY_REMINDER',
      'CHAPTER_UNLOCKED', 'ACHIEVEMENT_UNLOCKED'
    ),
    allowNull: false,
    defaultValue: 'SYSTEM'
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  channel: {
    type: DataTypes.ENUM('IN_APP', 'EMAIL', 'SMS', 'PUSH'),
    defaultValue: 'IN_APP'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
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
  tableName: 'notifications',
  timestamps: true,
  underscored: true
});

// User Notifications Table
export const UserNotification = sequelize.define('UserNotification', {
  user_notification_id: {
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
    }
  },
  notification_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'notifications',
      key: 'notification_id'
    }
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true
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
  tableName: 'user_notifications',
  timestamps: true,
  underscored: true
});

// Define Associations
Notification.hasMany(UserNotification, {
  foreignKey: 'notification_id',
  as: 'userNotifications'
});

UserNotification.belongsTo(Notification, {
  foreignKey: 'notification_id',
  as: 'notification'
});

export default { Notification, UserNotification };

