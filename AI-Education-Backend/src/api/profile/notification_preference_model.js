import UserNotificationPreference from './notification_preference_schema.js';
import { Op } from 'sequelize';

/**
 * Notification Preference Model
 * CRUD operations for user notification preferences
 */

export const upsertNotificationPreference = async (userId, preferenceKey, preferenceValue) => {
  const [preference, created] = await UserNotificationPreference.findOrCreate({
    where: {
      user_id: userId,
      preference_key: preferenceKey,
    },
    defaults: {
      preference_value: preferenceValue,
    },
  });

  if (!created) {
    await preference.update({ preference_value: preferenceValue });
  }

  return { preference, created };
};

export const bulkUpsertNotificationPreferences = async (userId, preferences) => {
  const results = [];
  for (const [key, value] of Object.entries(preferences)) {
    const { preference } = await upsertNotificationPreference(userId, key, value);
    results.push(preference);
  }
  return results;
};

export const getNotificationPreferencesByUser = async (userId) => {
  const preferences = await UserNotificationPreference.findAll({
    where: { user_id: userId },
  });

  const prefsObj = {};
  preferences.forEach(pref => {
    prefsObj[pref.preference_key] = pref.preference_value;
  });

  return prefsObj;
};

export const getNotificationPreference = async (userId, preferenceKey) => {
  const preference = await UserNotificationPreference.findOne({
    where: {
      user_id: userId,
      preference_key: preferenceKey,
    },
  });

  return preference ? preference.preference_value : null;
};

export const deleteNotificationPreference = async (userId, preferenceKey) => {
  const deleted = await UserNotificationPreference.destroy({
    where: {
      user_id: userId,
      preference_key: preferenceKey,
    },
  });
  return deleted > 0;
};

export const deleteAllNotificationPreferences = async (userId) => {
  return await UserNotificationPreference.destroy({
    where: { user_id: userId },
  });
};

/**
 * Get all notification preferences with defaults
 */
export const getNotificationPreferencesWithDefaults = async (userId) => {
  const dbPrefs = await getNotificationPreferencesByUser(userId);
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

  // Merge: DB preferences override defaults
  const mergedPrefs = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  Object.entries(dbPrefs).forEach(([key, value]) => {
    mergedPrefs[key] = value;
  });

  return mergedPrefs;
};

export const getAllowedPreferenceKeys = () => {
  return [
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
};

export default {
  upsertNotificationPreference,
  bulkUpsertNotificationPreferences,
  getNotificationPreferencesByUser,
  getNotificationPreference,
  deleteNotificationPreference,
  deleteAllNotificationPreferences,
  getNotificationPreferencesWithDefaults,
  getAllowedPreferenceKeys
};

