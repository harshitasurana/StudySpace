import UserPreference from "./user_preferences_schema.js";

/**
 * Create a new user preference
 * @param {number} userId - User ID
 * @param {string} preferenceKey - Preference key (e.g., "theme", "appointments.view")
 * @param {any} preferenceValue - Preference value (string, number, boolean, object)
 * @returns {Promise<UserPreference>}
 */
export const createUserPreference = async (userId, preferenceKey, preferenceValue, createdBy = null) => {
  return await UserPreference.create({
    user_id: userId,
    preference_key: preferenceKey,
    preference_value: preferenceValue,
    created_by: createdBy,
  });
};

/**
 * Find user preference by userId and preference key
 * @param {number} userId - User ID
 * @param {string} preferenceKey - Preference key
 * @returns {Promise<UserPreference|null>}
 */
export const findUserPreferenceByKey = async (userId, preferenceKey) => {
  return await UserPreference.findOne({
    where: {
      user_id: userId,
      preference_key: preferenceKey,
    },
  });
};

/**
 * Update or Create user preference (upsert pattern)
 * @param {number} userId - User ID
 * @param {string} preferenceKey - Preference key
 * @param {any} preferenceValue - Preference value
 * @returns {Promise<{UserPreference, created: boolean}>}
 */
export const upsertUserPreference = async (userId, preferenceKey, preferenceValue, createdBy = null, updatedBy = null) => {
  const [preference, created] = await UserPreference.findOrCreate({
    where: {
      user_id: userId,
      preference_key: preferenceKey,
    },
    defaults: {
      preference_value: preferenceValue,
      created_by: createdBy,
    },
  });

  // If already exists, update it
  if (!created) {
    await preference.update({
      preference_value: preferenceValue,
      updated_by: updatedBy,
    });
  }

  return { preference, created };
};

/**
 * Update user preference (only if exists)
 * @param {number} userId - User ID
 * @param {string} preferenceKey - Preference key
 * @param {any} preferenceValue - Preference value
 * @returns {Promise<UserPreference|null>}
 */
export const updateUserPreference = async (userId, preferenceKey, preferenceValue, updatedBy = null) => {
  const preference = await UserPreference.findOne({
    where: {
      user_id: userId,
      preference_key: preferenceKey,
    },
  });

  if (preference) {
    await preference.update({
      preference_value: preferenceValue,
      updated_by: updatedBy,
    });
  }

  return preference;
};

/**
 * Delete user preference by key
 * @param {number} userId - User ID
 * @param {string} preferenceKey - Preference key
 * @returns {Promise<number>} - Number of rows destroyed
 */
export const deleteUserPreferenceByKey = async (userId, preferenceKey) => {
  return await UserPreference.destroy({
    where: {
      user_id: userId,
      preference_key: preferenceKey,
    },
  });
};

/**
 * Find all preferences for a user
 * @param {number} userId - User ID
 * @returns {Promise<UserPreference[]>}
 */
export const findAllUserPreferences = async (userId) => {
  return await UserPreference.findAll({
    where: {
      user_id: userId,
      is_enabled: true
    },
  });
};

/**
 * Find preferences by key prefix (for module-based queries)
 * Example: prefix "appointments" matches "appointments.view", "appointments.sort", etc.
 * @param {number} userId - User ID
 * @param {string} prefix - Key prefix (e.g., "appointments")
 * @returns {Promise<UserPreference[]>}
 */
export const findPreferencesByPrefix = async (userId, prefix) => {
  return await UserPreference.findAll({
    where: {
      user_id: userId,
      preference_key: {
        [require('sequelize').Op.like]: `${prefix}%`,
      },
    },
  });
};

/**
 * Delete all preferences for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>} - Number of rows destroyed
 */
export const deleteAllUserPreferences = async (userId) => {
  return await UserPreference.destroy({
    where: {
      user_id: userId,
    },
  });
};

/**
 * Find preference with user details
 * @param {number} userId - User ID
 * @param {string} preferenceKey - Preference key
 * @returns {Promise<UserPreference|null>}
 */
export const findUserPreferenceWithUser = async (userId, preferenceKey) => {
  return await UserPreference.findOne({
    where: {
      user_id: userId,
      preference_key: preferenceKey,
    },
    include: [
      {
        association: 'user',
        attributes: ['user_id', 'first_name', 'last_name', 'account_email'],
      },
    ],
  });
};

/**
 * Bulk create or update preferences
 * @param {number} userId - User ID
 * @param {object} preferences - Object with key-value pairs
 * @returns {Promise<UserPreference[]>}
 */
export const bulkUpsertPreferences = async (userId, preferences) => {
  const results = [];
  
  for (const [key, value] of Object.entries(preferences)) {
    const { preference } = await upsertUserPreference(userId, key, value);
    results.push(preference);
  }
  
  return results;
};

/**
 * Update the is_enabled toggle for a specific user preference
 * @param {number} userId - User ID
 * @param {string} preferenceKey - Preference key
 * @param {boolean} isEnabled - Toggle state
 * @returns {Promise<UserPreference|null>}
 */
export const updateUserPreferenceToggle = async (userId, preferenceKey, isEnabled, updatedBy = null) => {
  const preference = await UserPreference.findOne({
    where: { user_id: userId, preference_key: preferenceKey },
  });
  
  if (!preference) return null;
  
  preference.is_enabled = isEnabled;
  preference.updated_by = updatedBy;
  await preference.save();
  return preference;
};

/**
 * Bulk update is_enabled for all user preferences
 * @param {number} userId - User ID
 * @param {boolean} isEnabled - Toggle state for all preferences
 * @returns {Promise<{affectedCount: number}>}
 */
export const bulkUpdateUserPreferencesToggle = async (userId, isEnabled, updatedBy = null) => {
  const [affectedCount] = await UserPreference.update(
    { is_enabled: isEnabled, updated_by: updatedBy },
    {
      where: { user_id: userId },
    }
  );
  
  return { affectedCount };
};
