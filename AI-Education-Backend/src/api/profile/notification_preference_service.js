import * as notificationPreferenceModel from './notification_preference_model.js';
import { logInfo, logError } from '../../common/utils/logger.js';

/**
 * Notification Preference Service
 * Industry-standard business logic layer
 */

const ALLOWED_NOTIFICATION_PREFERENCES = [
  "email_security_alerts",
  "email_account_updates",
  "email_newsletter",
  "push_login_alerts",
  "push_critical_updates",
  "push_reminders",
  "system_task_updates",
  "system_comments",
  "system_mentions"
];

const DEFAULT_NOTIFICATION_PREFERENCES = {
  email_security_alerts: true,
  email_account_updates: true,
  email_newsletter: false,
  push_login_alerts: true,
  push_critical_updates: true,
  push_reminders: false,
  system_task_updates: true,
  system_comments: true,
  system_mentions: true
};

/**
 * Get all notification preferences with defaults
 */
export const getNotificationPreferences = async (userId) => {
  try {
    logInfo('🔍 SERVICE: Getting notification preferences', { userId });
    
    const dbPrefs = await notificationPreferenceModel.getNotificationPreferencesByUser(userId);
    
    // Merge DB preferences with defaults (DB overrides defaults)
    const preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };
    Object.entries(dbPrefs).forEach(([key, value]) => {
      if (ALLOWED_NOTIFICATION_PREFERENCES.includes(key)) {
        preferences[key] = value;
      }
    });
    
    logInfo('✅ SERVICE: Notification preferences loaded', { 
      userId, 
      overriddenCount: Object.keys(dbPrefs).length 
    });
    
    return preferences;
  } catch (error) {
    logError('❌ SERVICE: Get notification preferences error', error);
    throw error;
  }
};

/**
 * Bulk update notification preferences
 */
export const updateNotificationPreferences = async (userId, preferences) => {
  try {
    logInfo('🔍 SERVICE: Updating notification preferences', { userId, count: Object.keys(preferences).length });
    
    const validPreferences = {};
    Object.entries(preferences).forEach(([key, value]) => {
      if (ALLOWED_NOTIFICATION_PREFERENCES.includes(key)) {
        validPreferences[key] = Boolean(value);
      }
    });
    
    if (Object.keys(validPreferences).length === 0) {
      throw new Error('No valid preferences provided');
    }
    
    await notificationPreferenceModel.bulkUpsertNotificationPreferences(userId, validPreferences);
    
    logInfo('✅ SERVICE: Notification preferences updated', { userId, updatedCount: Object.keys(validPreferences).length });
    
    // Return updated preferences with defaults
    return await getNotificationPreferences(userId);
  } catch (error) {
    logError('❌ SERVICE: Update notification preferences error', error);
    throw error;
  }
};

/**
 * Update single notification preference (toggle)
 */
export const toggleNotificationPreference = async (userId, preferenceKey, value) => {
  try {
    logInfo('🔍 SERVICE: Toggling notification preference', { userId, preferenceKey, value });
    
    if (!ALLOWED_NOTIFICATION_PREFERENCES.includes(preferenceKey)) {
      throw new Error(`Invalid preference key: ${preferenceKey}`);
    }
    
    await notificationPreferenceModel.upsertNotificationPreference(
      userId, 
      preferenceKey, 
      Boolean(value)
    );
    
    logInfo('✅ SERVICE: Notification preference toggled', { userId, preferenceKey });
    
    return await getNotificationPreferences(userId);
  } catch (error) {
    logError('❌ SERVICE: Toggle notification preference error', error);
    throw error;
  }
};

/**
 * Reset single notification preference to default
 */
export const resetNotificationPreference = async (userId, preferenceKey) => {
  try {
    logInfo('🔍 SERVICE: Resetting notification preference', { userId, preferenceKey });
    
    if (!ALLOWED_NOTIFICATION_PREFERENCES.includes(preferenceKey)) {
      throw new Error(`Invalid preference key: ${preferenceKey}`);
    }
    
    const deleted = await notificationPreferenceModel.deleteNotificationPreference(userId, preferenceKey);
    
    if (!deleted) {
      throw new Error('Preference not found or already default');
    }
    
    logInfo('✅ SERVICE: Notification preference reset', { userId, preferenceKey });
    
    return await getNotificationPreferences(userId);
  } catch (error) {
    logError('❌ SERVICE: Reset notification preference error', error);
    throw error;
  }
};

/**
 * Reset all notification preferences to defaults
 */
export const resetAllNotificationPreferences = async (userId) => {
  try {
    logInfo('🔍 SERVICE: Resetting all notification preferences', { userId });
    
    await notificationPreferenceModel.deleteAllNotificationPreferences(userId);
    
    logInfo('✅ SERVICE: All notification preferences reset', { userId });
    
    return DEFAULT_NOTIFICATION_PREFERENCES;
  } catch (error) {
    logError('❌ SERVICE: Reset all notification preferences error', error);
    throw error;
  }
};

/**
 * Get allowed preference keys (for frontend validation)
 */
export const getAllowedPreferences = () => {
  return ALLOWED_NOTIFICATION_PREFERENCES;
};

/**
 * Get default preferences (for initial UI state)
 */
export const getDefaultPreferences = () => {
  return DEFAULT_NOTIFICATION_PREFERENCES;
};

export default {
  getNotificationPreferences,
  updateNotificationPreferences,
  toggleNotificationPreference,
  resetNotificationPreference,
  resetAllNotificationPreferences,
  getAllowedPreferences,
  getDefaultPreferences
};

