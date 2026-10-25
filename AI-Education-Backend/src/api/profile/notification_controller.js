import * as notificationService from './notification_service.js';
import { validateBody } from '../../common/middlewares/validate.js';
import * as notificationPreferenceService from './notification_preference_service.js';
import {
  notificationPreferencesUpdateSchema, 
  notificationPreferencesToggleSchema 
} from './notification_validation.js';
import { updateNotifications } from './notification_service.js';

import {
  getNotificationsSchema, 
  markAsReadSchema
} from './notification_validation.js';
import { logInfo, logError } from '../../common/utils/logger.js';

/**
 * Notification Controller
 * 
 * HTTP request handlers for notification operations
 */

// GET /api/profile/notifications - Get all notifications for logged-in user
export const getNotifications = async (req, res, next) => {
  try {
    logInfo('🔥 CONTROLLER: Starting getNotifications with queryParser for user ID:', { 
      userId: req.user.user_id, 
      queryOptions: req.queryOptions 
    });

    const result = await notificationService.getNotificationsPaginated(req.user.user_id, req.queryOptions);

    logInfo('🔥 CONTROLLER: Retrieved notifications with pagination:', { 
      count: result.notifications?.length || 0,
      total: result.pagination?.totalItems || 0 
    });

    res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: result,
    });
  } catch (err) {
    logError("❌ CONTROLLER: Get Notifications Error:", err);
    next(err);
  }
};

// GET /api/profile/notifications/unread-count - Get unread notification count
export const getUnreadCount = async (req, res, next) => {
  try {
    logInfo('🔥 CONTROLLER: Starting getUnreadCount for user ID:', { userId: req.user.user_id });

    const result = await notificationService.getUnreadCount(req.user.user_id);

    logInfo('🔥 CONTROLLER: Retrieved unread count:', { count: result.count });

    res.status(200).json({
      success: true,
      message: "Unread count fetched successfully",
      data: result,
    });
  } catch (err) {
    logError("❌ CONTROLLER: Get Unread Count Error:", err);
    next(err);
  }
};

// PATCH /api/profile/notifications/:id/read - Mark single notification as read
export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    logInfo('🔥 CONTROLLER: Starting markAsRead for user ID:', { 
      userId: req.user.user_id, 
      notificationId: id 
    });

    const result = await notificationService.markAsRead(req.user.user_id, id);

    logInfo('🔥 CONTROLLER: Notification marked as read');

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    logError("❌ CONTROLLER: Mark As Read Error:", err);
    if (err.message === 'Notification not found or already read') {
      return res.status(404).json({
        success: false,
        message: err.message
      });
    }
    next(err);
  }
};

// PATCH /api/profile/notifications/read-all - Mark all notifications as read
export const markAllAsRead = async (req, res, next) => {
  try {
    logInfo('🔥 CONTROLLER: Starting markAllAsRead for user ID:', { userId: req.user.user_id });

    const result = await notificationService.markAllAsRead(req.user.user_id);

    logInfo('🔥 CONTROLLER: All notifications marked as read');

    res.status(200).json({
      success: true,
      message: result.message,
      data: { count: result.count },
    });
  } catch (err) {
    logError("❌ CONTROLLER: Mark All As Read Error:", err);
    next(err);
  }
};

// DELETE /api/profile/notifications/:id - Delete a notification
export const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    logInfo('🔥 CONTROLLER: Starting deleteNotification for user ID:', { 
      userId: req.user.user_id, 
      notificationId: id 
    });

    const result = await notificationService.deleteNotification(req.user.user_id, id);

    logInfo('🔥 CONTROLLER: Notification deleted');

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    logError("❌ CONTROLLER: Delete Notification Error:", err);
    if (err.message === 'Notification not found') {
      return res.status(404).json({
        success: false,
        message: err.message
      });
    }
    next(err);
  }
};

// ================= NOTIFICATION PREFERENCES API =================

// GET /api/profile/notifications/preferences - Get all notification preferences
export const getNotificationPreferences = async (req, res, next) => {
  try {
    logInfo('🔥 CONTROLLER: Getting notification preferences', { userId: req.user.user_id });

    const preferences = await notificationPreferenceService.getNotificationPreferences(req.user.user_id);

    res.status(200).json({
      success: true,
      message: "Notification preferences fetched successfully",
      data: preferences
    });
  } catch (err) {
    logError("❌ CONTROLLER: Get notification preferences error", err);
    next(err);
  }
};

// PUT /api/profile/notifications/preferences - Bulk update preferences
export const updateNotificationPreferences = [
  validateBody(notificationPreferencesUpdateSchema),
  async (req, res, next) => {
    try {
      logInfo('🔥 CONTROLLER: Updating notification preferences', { 
        userId: req.user.user_id, 
        count: Object.keys(req.body).length 
      });

      const preferences = await notificationPreferenceService.updateNotificationPreferences(
        req.user.user_id, 
        req.body
      );

      res.status(200).json({
        success: true,
        message: "Notification preferences updated successfully",
        data: preferences
      });
    } catch (err) {
      logError("❌ CONTROLLER: Update notification preferences error", err);
      next(err);
    }
  }
];

// PATCH /api/profile/notifications/preferences/:key - Toggle single preference
export const toggleNotificationPreference = [
  validateBody(notificationPreferencesToggleSchema),
  async (req, res, next) => {
    try {
      const { key } = req.params;
      const { value } = req.body;

      logInfo('🔥 CONTROLLER: Toggling notification preference', { 
        userId: req.user.user_id, 
        key, 
        value 
      });

      const preferences = await notificationPreferenceService.toggleNotificationPreference(
        req.user.user_id, 
        key, 
        value
      );

      res.status(200).json({
        success: true,
        message: "Notification preference toggled successfully",
        data: preferences
      });
    } catch (err) {
      logError("❌ CONTROLLER: Toggle notification preference error", err);
      next(err);
    }
  }
];

// DELETE /api/profile/notifications/preferences/:key - Reset single preference to default
export const resetNotificationPreference = async (req, res, next) => {
  try {
    const { key } = req.params;

    logInfo('🔥 CONTROLLER: Resetting notification preference', { 
      userId: req.user.user_id, 
      key 
    });

    const preferences = await notificationPreferenceService.resetNotificationPreference(
      req.user.user_id, 
      key
    );

    res.status(200).json({
      success: true,
      message: "Notification preference reset to default",
      data: preferences
    });
  } catch (err) {
    logError("❌ CONTROLLER: Reset notification preference error", err);
    next(err);
  }
};

// DELETE /api/profile/notifications/preferences - Reset all preferences to defaults
export const resetAllNotificationPreferences = async (req, res, next) => {
  try {
    logInfo('🔥 CONTROLLER: Resetting all notification preferences', { userId: req.user.user_id });

    const preferences = await notificationPreferenceService.resetAllNotificationPreferences(
      req.user.user_id
    );

    res.status(200).json({
      success: true,
      message: "All notification preferences reset to defaults",
      data: preferences
    });
  } catch (err) {
    logError("❌ CONTROLLER: Reset all notification preferences error", err);
    next(err);
  }
};

