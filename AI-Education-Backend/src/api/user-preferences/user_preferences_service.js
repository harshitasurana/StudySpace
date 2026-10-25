import { Op } from 'sequelize';
import UserPreference from "./user_preferences_schema.js";
import {
  findUserPreferenceByKey,
  upsertUserPreference,
  deleteUserPreferenceByKey,
  findAllUserPreferences,
  deleteAllUserPreferences,
  findPreferencesByPrefix,
  updateUserPreferenceToggle,
  bulkUpdateUserPreferencesToggle
} from "./user_preferences_model.js";

/**
 * Default preferences (Key-Value pattern)
 * These are returned when user has no saved preferences
 */
const DEFAULT_PREFERENCES = {
  'ui_preferences': {},  // Empty object for UI config
  // Notification Preferences (NEW)
  'notification_email_security_alerts': true,
  'notification_email_account_updates': true,
  'notification_email_newsletter': false,
  'notification_push_login_alerts': true,
  'notification_push_critical_updates': true,
  'notification_push_reminders': false,
  'notification_system_task_updates': true,
  'notification_system_comments': true,
  'notification_system_mentions': true,
  'notification_appointment_reschedule_email': true,
  'notification_appointment_reschedule_push': true,
  'notification_appointment_reschedule_sms': false,
  'notification_appointment_reminders_email': true,
  'notification_appointment_reminders_push': false,
  // General Settings
  'general.theme': 'light',
  'general.language': 'en',
  'general.timezone': 'UTC',
  'general.notification_email': true,
  'general.notification_sms': false,
  'general.notification_push': true,

  // Appointments Module
  'appointments.view': 'list',
  'appointments.sort.field': 'scheduled_date',
  'appointments.sort.order': 'ASC',
  'appointments.filters.status': ['scheduled', 'confirmed'],
  'appointments.filters.dateRange': null,
  'appointments.pageSize': 10,
  'appointments.columns': ['patient_name', 'doctor_name', 'date', 'time', 'status'],

  // Staff Module
  'staff.view': 'table',
  'staff.sort.field': 'first_name',
  'staff.sort.order': 'ASC',
  'staff.filters.department': null,
  'staff.filters.status': null,
  'staff.pageSize': 20,
  'staff.columns': ['name', 'department', 'specialization', 'status', 'email'],

  // Patients Module
  'patients.view': 'list',
  'patients.sort.field': 'created_at',
  'patients.sort.order': 'DESC',
  'patients.filters.is_active': true,
  'patients.filters.search': null,
  'patients.pageSize': 10,
  'patients.columns': ['name', 'email', 'phone', 'dob', 'status'],

  // Doctors Module
  'doctors.view': 'list',
  'doctors.sort.field': 'first_name',
  'doctors.sort.order': 'ASC',
  'doctors.filters.is_active': true,
  'doctors.filters.department': null,
  'doctors.filters.specialization': null,
  'doctors.pageSize': 15,
  'doctors.columns': ['name', 'department', 'specialization', 'rating', 'availability'],

  // Department Module
  'department.view': 'list',
  'department.sort.field': 'name',
  'department.sort.order': 'ASC',
  'department.pageSize': 20,
  'department.columns': ['name', 'head', 'doctor_count', 'staff_count', 'status'],

  // Billing Module
  'billing.view': 'table',
  'billing.sort.field': 'created_at',
  'billing.sort.order': 'DESC',
  'billing.filters.status': null,
  'billing.filters.dateRange': null,
  'billing.pageSize': 25,
  'billing.columns': ['invoice_id', 'patient', 'amount', 'status', 'date', 'due_date'],

  // Dashboard Module
  'dashboard.view': 'board',
  'dashboard.widgets': ['recent_appointments', 'pending_tasks', 'statistics'],
  'dashboard.refreshInterval': 30000,
  'dashboard.layout': 'default',

  // Admin Module
  'admin.view': 'table',
  'admin.sort.field': 'created_at',
  'admin.sort.order': 'DESC',
  'admin.pageSize': 20,
  'admin.columns': ['name', 'email', 'hospital', 'role', 'status', 'last_login'],

  // Organization Module
  'hospital.view': 'list',
  'hospital.sort.field': 'name',
  'hospital.sort.order': 'ASC',
  'hospital.filters.status': null,
  'hospital.pageSize': 15,
  'hospital.columns': ['name', 'address', 'phone', 'email', 'departments', 'status'],

  // Roles Module
  'roles.view': 'list',
  'roles.sort.field': 'role_name',
  'roles.sort.order': 'ASC',
  'roles.pageSize': 20,
  'roles.columns': ['role_name', 'description', 'permissions_count', 'users_count'],

  // Feature Module
  'feature.view': 'list',
  'feature.sort.field': 'name',
  'feature.sort.order': 'ASC',
  'feature.pageSize': 20,
  'feature.columns': ['name', 'category', 'description', 'permissions'],

  // Menu Module
  'menu.view': 'tree',
  'menu.expandAll': true,
  'menu.selectedMenu': null,

  // Metadata Module
  'metadata.view': 'table',
  'metadata.sort.field': 'name',
  'metadata.sort.order': 'ASC',
  'metadata.pageSize': 25,
  'metadata.columns': ['name', 'type', 'code', 'country', 'status'],

  // Profile Module
  'profile.viewMode': 'edit',
  'profile.avatarSize': 'medium',
  'profile.showActivity': true,

  // Specialization Module
  'specialization.view': 'list',
  'specialization.sort.field': 'name',
  'specialization.sort.order': 'ASC',
  'specialization.pageSize': 20,
  'specialization.columns': ['name', 'description', 'doctors_count'],

  // User Module
  'user.view': 'table',
  'user.sort.field': 'created_at',
  'user.sort.order': 'DESC',
  'user.filters.role': null,
  'user.filters.status': null,
  'user.pageSize': 20,
  'user.columns': ['name', 'email', 'role', 'hospital', 'department', 'status', 'last_login'],

  // Audit Module
  'audit.view': 'table',
  'audit.sort.field': 'created_at',
  'audit.sort.order': 'DESC',
  'audit.filters.action': null,
  'audit.filters.user': null,
  'audit.filters.dateRange': null,
  'audit.pageSize': 25,
  'audit.columns': ['action', 'user', 'ip_address', 'timestamp', 'details'],
};

/**
 * Check if ALL user preferences are disabled
 * @param {number} user_id - User ID
 * @returns {Promise<boolean>}
 */
export const isAllPreferencesDisabled = async (user_id) => {
  const totalPrefs = await UserPreference.count({ where: { user_id } });
  if (totalPrefs === 0) return false;
  const disabledPrefs = await UserPreference.count({ where: { user_id, is_enabled: false } });
  return disabledPrefs === totalPrefs;
};

/**
 * Get user preference for a specific key
 * Returns saved preference or default if not found
 * @param {number} user_id - User ID
 * @param {string} preferenceKey - Preference key (e.g., "appointments.view")
 * @returns {Promise<object>} - Preference object
 */
export const getPreferenceByKeyService = async (user_id, preferenceKey) => {
  const globallyDisabled = await isAllPreferencesDisabled(user_id);
  try {
    const savedPreference = await findUserPreferenceByKey(user_id, preferenceKey);

    if (savedPreference) {
      return {
        id: savedPreference.id,
        user_id: savedPreference.user_id,
        preference_key: savedPreference.preference_key,
        preference_value: savedPreference.preference_value,
        createdAt: savedPreference.created_at,
        updatedAt: savedPreference.updated_at,
        isDefault: false,
      };
    }

    // Return default if not found
    const defaultValue = DEFAULT_PREFERENCES[preferenceKey] !== undefined 
      ? DEFAULT_PREFERENCES[preferenceKey] 
      : null;

    return {
      user_id,
      preference_key: preferenceKey,
      preference_value: defaultValue,
      isDefault: true,
      globallyDisabled
    };
  } catch (error) {
    console.error(`Error getting preference for user ${user_id}, key ${preferenceKey}:`, error);
    throw error;
  }
};

/**
 * Get all preferences for a module (by prefix)
 * Returns saved preferences or defaults for the module
 * @param {number} user_id - User ID
 * @param {string} modulePrefix - Module prefix (e.g., "appointments")
 * @returns {Promise<object>} - Object with all preferences for the module
 */
export const getModulePreferencesService = async (user_id, modulePrefix) => {
  const globallyDisabled = await isAllPreferencesDisabled(user_id);
  try {
    const savedPreferences = await findPreferencesByPrefix(user_id, modulePrefix);
    
    // Convert saved preferences to object
    const savedPrefsObj = {};
    savedPreferences.forEach(pref => {
      savedPrefsObj[pref.preference_key] = pref.preference_value;
    });

    // Get all default keys for this module
    const moduleDefaults = {};
    const modulePrefixWithDot = `${modulePrefix}.`;
    
    Object.keys(DEFAULT_PREFERENCES).forEach(key => {
      if (key.startsWith(modulePrefixWithDot)) {
        moduleDefaults[key] = DEFAULT_PREFERENCES[key];
      }
    });

    // Merge: saved preferences override defaults
    const mergedPreferences = { ...moduleDefaults, ...savedPrefsObj };

    return {
      preferences: mergedPreferences,
      isDefault: savedPreferences.length === 0,
      globallyDisabled
    };
  } catch (error) {
    console.error(`Error getting module preferences for user ${user_id}, module ${modulePrefix}:`, error);
    throw error;
  }
};

/**
 * Save or update user preference
 * @param {number} user_id - User ID
 * @param {string} preferenceKey - Preference key
 * @param {any} preferenceValue - Preference value
 * @returns {Promise<object>} - Saved preference
 */
export const savePreferenceService = async (user_id, preferenceKey, preferenceValue) => {
  try {
    const { preference, created } = await upsertUserPreference(
      user_id,
      preferenceKey,
      preferenceValue,
      user_id,
      user_id
    );

    return {
      id: preference.id,
      user_id: preference.user_id,
      preference_key: preference.preference_key,
      preference_value: preference.preference_value,
      createdAt: preference.created_at,
      updatedAt: preference.updated_at,
      action: created ? 'created' : 'updated',
    };
  } catch (error) {
    console.error(`Error saving preference for user ${user_id}, key ${preferenceKey}:`, error);
    throw error;
  }
};

/**
 * Toggle user preference enable/disable status
 * @param {number} user_id - User ID
 * @param {string} preferenceKey - Preference key
 * @param {boolean} isEnabled - Enable or disable flag
 * @returns {Promise<object>} - Updated preference
 */
export const togglePreferenceService = async (user_id, preferenceKey, isEnabled) => {
  try {
    const updatedPreference = await updateUserPreferenceToggle(user_id, preferenceKey, isEnabled, user_id);
    
    if (!updatedPreference) {
      throw new Error('Preference not found');
    }

    return {
      id: updatedPreference.id,
      user_id: updatedPreference.user_id,
      preference_key: updatedPreference.preference_key,
      preference_value: updatedPreference.preference_value,
      is_enabled: updatedPreference.is_enabled,
      createdAt: updatedPreference.created_at,
      updatedAt: updatedPreference.updatedAt,
    };
  } catch (error) {
    console.error(`Error toggling preference for user ${user_id}, key ${preferenceKey}:`, error);
    throw error;
  }
};

/**
 * Bulk toggle all user preferences enable/disable
 * @param {number} user_id - User ID
 * @param {boolean} isEnabled - Enable or disable all preferences
 * @returns {Promise<object>} - Result with affected count
 */
export const bulkToggleAllPreferencesService = async (user_id, isEnabled) => {
  try {
    const result = await bulkUpdateUserPreferencesToggle(user_id, isEnabled, user_id);
    
    return {
      affectedCount: result.affectedCount,
      is_enabled: isEnabled
    };
  } catch (error) {
    console.error(`Error bulk toggling preferences for user ${user_id}:`, error);
    throw error;
  }
};


/**
 * Save multiple preferences at once (batch)
 * @param {number} user_id - User ID
 * @param {object} preferences - Object with key-value pairs
 * @returns {Promise<object>} - Saved preferences
 */


/**
 * Reset (delete) user preference
 * Next request will return defaults
 * @param {number} user_id - User ID
 * @param {string} preferenceKey - Preference key
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
export const resetPreferenceService = async (user_id, preferenceKey) => {
  try {
    const deletedRows = await deleteUserPreferenceByKey(user_id, preferenceKey);
    return deletedRows > 0;
  } catch (error) {
    console.error(`Error resetting preference for user ${user_id}, key ${preferenceKey}:`, error);
    throw error;
  }
};

/**
 * Reset (delete) all user preferences
 * Next request will return defaults
 * @param {number} user_id - User ID
 * @returns {Promise<number>} - Number of deleted rows
 */
export const resetAllPreferencesService = async (user_id) => {
  try {
    return await deleteAllUserPreferences(user_id);
  } catch (error) {
    console.error(`Error resetting all preferences for user ${user_id}:`, error);
    throw error;
  }
};

/**
 * Get all preferences for a user
 * @param {number} user_id - User ID
 * @returns {Promise<object[]>} - Array of all preferences
 */
export const getAllPreferencesService = async (user_id) => {
  const globallyDisabled = await isAllPreferencesDisabled(user_id);
  try {
    const preferences = await findAllUserPreferences(user_id);

    const isEnable = preferences.length > 0;
    return {
      message: "All user preferences retrieved",
      count: preferences.length,
      is_enable: isEnable,
      preferences: preferences.map((pref) => ({
        id: pref.id,
        user_id: pref.user_id,
        preference_key: pref.preference_key,
        preference_value: pref.preference_value,
        is_enabled: pref.is_enabled,
        createdAt: pref.created_at,
        updatedAt: pref.updated_at,
      })),
    };
  } catch (error) {
    console.error(`Error getting all preferences for user ${user_id}:`, error);
    throw error;
  }
};

/**
 * Get all preferences with defaults merged
 * @param {number} user_id - User ID
 * @returns {Promise<object>} - Object with all preferences (saved + defaults)
 */
export const getAllPreferencesWithDefaultsService = async (user_id) => {
  const globallyDisabled = await isAllPreferencesDisabled(user_id);
  try {
    const savedPreferences = await findAllUserPreferences(user_id);

    // Convert saved preferences to object
    const savedPrefsObj = {};
    savedPreferences.forEach(pref => {
      savedPrefsObj[pref.preference_key] = pref.preference_value;
    });

    // Merge: saved preferences override defaults
    const mergedPreferences = { ...DEFAULT_PREFERENCES, ...savedPrefsObj };

    return {
      preferences: mergedPreferences,
      savedCount: savedPreferences.length,
      defaultCount: Object.keys(DEFAULT_PREFERENCES).length,
      globallyDisabled
    };
  } catch (error) {
    console.error(`Error getting all preferences with defaults for user ${user_id}:`, error);
    throw error;
  }
};

/**
 * Get default preference for a key
 * @param {string} preferenceKey - Preference key
 * @returns {any} - Default value
 */
export const getDefaultPreference = (preferenceKey) => {
  return DEFAULT_PREFERENCES[preferenceKey];
};

/**
 * Get all default preferences
 * @returns {object} - All default preferences
 */
export const getAllDefaults = () => {
  return { ...DEFAULT_PREFERENCES };
};

/**
 * Check if preference key is valid (has a default)
 * @param {string} preferenceKey - Preference key
 * @returns {boolean}
 */
export const isValidPreferenceKey = (preferenceKey) => {
  return DEFAULT_PREFERENCES.hasOwnProperty(preferenceKey);
};

/**
 * Get all preference keys for a module
 * @param {string} modulePrefix - Module prefix
 * @returns {string[]} - Array of preference keys
 */
export const getPreferenceKeysForModule = (modulePrefix) => {
  const modulePrefixWithDot = `${modulePrefix}.`;
  return Object.keys(DEFAULT_PREFERENCES).filter(key => 
    key.startsWith(modulePrefixWithDot)
  );
};

/**
 * Merge custom preferences with defaults
 * @param {string} preferenceKey - Preference key
 * @param {any} customValue - Custom value to merge
 * @returns {any} - Merged value
 */
export const mergeWithDefault = (preferenceKey, customValue) => {
  const defaultValue = DEFAULT_PREFERENCES[preferenceKey];
  
  // If default is an object and custom is an object, merge them
  if (typeof defaultValue === 'object' && defaultValue !== null && 
      typeof customValue === 'object' && customValue !== null) {
    return { ...defaultValue, ...customValue };
  }
  
  // Otherwise return custom value (overrides default)
  return customValue !== undefined ? customValue : defaultValue;
};
