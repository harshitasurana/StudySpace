import * as notificationModel from './notification_model.js';
import { logInfo, logError } from '../../common/utils/logger.js';
import { getIO } from '../../common/socket/socket.manager.js';

/**
 * Notification Service
 * 
 * Business logic layer for notification operations
 */

// Get notifications with pagination
export const getNotifications = async (userId, options = {}) => {
  try {
    logInfo('🔍 SERVICE: Fetching notifications for user:', { userId, options });
    
    const notifications = await notificationModel.getUserNotifications(userId, options);
    
    // Transform to desired format
    const formattedNotifications = notifications.map(un => ({
      id: un.user_notification_id,
      user_id: un.user_id,
      is_read: un.is_read,
      read_at: un.read_at,
      created_at: un.createdAt,
      notification: un.notification ? {
        id: un.notification.notification_id,
        type: un.notification.type,
        title: un.notification.title,
        message: un.notification.message,
        channel: un.notification.channel,
        created_at: un.notification.createdAt
      } : null
    }));
    
    logInfo('✅ SERVICE: Notifications retrieved:', { count: formattedNotifications.length });
    return formattedNotifications;
  } catch (err) {
    logError('❌ SERVICE: Get Notifications Error:', err);
    throw err;
  }
};

// Get unread count
export const getUnreadCount = async (userId) => {
  try {
    logInfo('🔍 SERVICE: Getting unread count for user:', { userId });
    
    const count = await notificationModel.getUnreadCount(userId);
    
    logInfo('✅ SERVICE: Unread count:', { count });
    return { count };
  } catch (err) {
    logError('❌ SERVICE: Get Unread Count Error:', err);
    throw err;
  }
};

// Mark single notification as read
export const markAsRead = async (userId, userNotificationId) => {
  try {
    logInfo('🔍 SERVICE: Marking notification as read:', { userId, userNotificationId });
    
    const success = await notificationModel.markAsRead(userNotificationId, userId);
    if (!success) {
      throw new Error('Notification not found or already read');
    }
    
    logInfo('✅ SERVICE: Notification marked as read');
    return { message: 'Notification marked as read', success: true };
  } catch (err) {
    logError('❌ SERVICE: Mark As Read Error:', err);
    throw err;
  }
};

// Mark all notifications as read
export const markAllAsRead = async (userId) => {
  try {
    logInfo('🔍 SERVICE: Marking all notifications as read:', { userId });
    
    const count = await notificationModel.markAllAsRead(userId);
    
    logInfo('✅ SERVICE: All notifications marked as read:', { count });
    return { message: 'All notifications marked as read', count };
  } catch (err) {
    logError('❌ SERVICE: Mark All As Read Error:', err);
    throw err;
  }
};

// Delete notification
export const deleteNotification = async (userId, userNotificationId) => {
  try {
    logInfo('🔍 SERVICE: Deleting notification:', { userId, userNotificationId });
    
    const success = await notificationModel.deleteNotification(userNotificationId, userId);
    if (!success) {
      throw new Error('Notification not found');
    }
    
    logInfo('✅ SERVICE: Notification deleted');
    return { message: 'Notification deleted', success: true };
  } catch (err) {
    logError('❌ SERVICE: Delete Notification Error:', err);
    throw err;
  }
};

// Create notification for a user (used by other services to trigger notifications)
export const createNotification = async (notificationData, userId) => {
  try {
    logInfo('🔍 SERVICE: Creating notification for user:', { userId, type: notificationData.type });
    
    const result = await notificationModel.createNotificationForUser(notificationData, userId);
    
    const notificationPayload = {
      id: result.notification.notification_id,
      user_notification_id: result.userNotification.user_notification_id,
      ...notificationData
    };
    
    try {
      const io = getIO();
      io.to(`user_${userId}`).emit('notification', notificationPayload);
    } catch (ioErr) {
      logError('❌ SOCKET: Error emitting notification:', ioErr);
    }
    
    logInfo('✅ SERVICE: Notification created:', { notificationId: result.notification.notification_id });
    return notificationPayload;
  } catch (err) {
    logError('❌ SERVICE: Create Notification Error:', err);
    throw err;
  }
};

// Create notification for multiple users (bulk)
export const createBulkNotification = async (notificationData, userIds) => {
  try {
    logInfo('🔍 SERVICE: Creating bulk notification:', { type: notificationData.type, userCount: userIds.length });
    
    const result = await notificationModel.createNotificationForUsers(notificationData, userIds);
    
    const notificationPayload = {
      notificationId: result.notification.notification_id,
      count: result.count
    };
    
    try {
      const io = getIO();
      userIds.forEach(userId => {
        io.to(`user_${userId}`).emit('notification', {
          ...notificationPayload,
          ...notificationData
        });
      });
    } catch (ioErr) {
      logError('❌ SOCKET: Error emitting bulk notification:', ioErr);
    }
    
    logInfo('✅ SERVICE: Bulk notification created:', { count: result.count });
    return notificationPayload;
  } catch (err) {
    logError('❌ SERVICE: Create Bulk Notification Error:', err);
    throw err;
  }
};

// Get notification preferences from user_preferences
export const getNotificationPreferences = async (userId) => {
  const userPrefs = await require('../user-preferences/user_preferences_service').getAllPreferencesWithDefaultsService(userId);
  
  const notificationPrefs = {};
  const notificationKeys = [
    'notification_email_security_alerts',
    'notification_email_account_updates',
    'notification_email_newsletter',
    'notification_push_login_alerts',
    'notification_push_critical_updates',
    'notification_push_reminders',
    'notification_system_task_updates',
    'notification_system_comments',
    'notification_system_mentions'
  ];
  
  notificationKeys.forEach(key => {
    const cleanKey = key.replace('notification_', '');
    notificationPrefs[cleanKey] = userPrefs.preferences[key] ?? false;
  });
  
  return notificationPrefs;
};

// Update notification preferences using user_preferences API
// Legacy method - kept for backward compatibility
export const updateNotifications = async (userId, preferences) => {
  // Map old format to new notification preferences
  const mappedPrefs = {};
  if (preferences.items && Array.isArray(preferences.items)) {
    preferences.items.forEach(item => {
      if (item.label && typeof item.value === 'boolean') {
        const key = item.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
        mappedPrefs[key] = item.value;
      }
    });
  }
  
  return await require('./notification_preference_service').updateNotificationPreferences(userId, mappedPrefs);
};

export const getNotificationsPaginated = async (userId, queryOptions) => {
  try {
    logInfo('🔍 SERVICE: Fetching paginated notifications with queryParser:', { userId, queryOptions });
    const result = await notificationModel.getUserNotificationsPaginated(userId, queryOptions);
    logInfo('✅ SERVICE: Paginated notifications retrieved:', { 
      count: result.notifications?.length || 0,
      total: result.pagination?.totalItems || 0 
    });
    return result;
  } catch (err) {
    logError('❌ SERVICE: GetNotificationsPaginated Error:', err);
    throw err;
  }
};

export default {
  getNotifications,
  getNotificationsPaginated,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  createBulkNotification
};


