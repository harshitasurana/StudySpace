import {
  getPreferenceByKeyService,
  getModulePreferencesService,
  savePreferenceService,
  bulkToggleAllPreferencesService,

  resetPreferenceService,
  resetAllPreferencesService,
  getAllPreferencesService,
  getAllPreferencesWithDefaultsService,
  togglePreferenceService
} from "./user_preferences_service.js";
import { validationResult } from "express-validator";
import { logDebug, logError } from '../../common/utils/logger.js';

/**
 * GET /api/user-preferences?key=theme
 * Get user preference for a specific key
 * Returns saved preference or default if not found
 */
export const getPreferenceByKeyController = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.user_id; // From JWT middleware
    const { key } = req.query;

    logDebug('Getting user preference by key', { userId, key, service: 'user_preferences' });

    const preference = await getPreferenceByKeyService(userId, key);

    return res.status(200).json({
      message: preference.isDefault ? 'Default preference returned' : 'User preference found',
      preference: preference,
    });
  } catch (error) {
    logError('Error getting user preference by key', error, { service: 'user_preferences' });
    return res.status(500).json({
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * PATCH /api/user-preferences/toggle
 * Toggle a user preference on/off
 * Body: { key, is_enabled }
 */
export const togglePreferenceController = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.user_id; // From JWT middleware
    const { key, is_enabled } = req.body;

    logDebug('Toggling user preference', { userId, key, is_enabled, service: 'user_preferences' });

    const updatedPreference = await togglePreferenceService(userId, key, is_enabled);

    return res.status(200).json({
      message: "Preference updated successfully",
      preference: updatedPreference,
    });
  } catch (error) {
    logError('Error toggling user preference', error, { service: 'user_preferences' });
    if (error.message === 'Preference not found') {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * GET /api/user-preferences?module=appointments
 * Get all preferences for a specific module
 * Returns saved preferences or defaults for the module
 */
export const getPreferenceByModuleController = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.user_id; // From JWT middleware
    const { module } = req.query;

    logDebug('Getting user preferences by module', { userId, module, service: 'user_preferences' });

    const result = await getModulePreferencesService(userId, module);

    return res.status(200).json({
      message: result.isDefault ? 'Default preferences returned' : 'User preferences found',
      module,
      preferences: result.preferences,
      isDefault: result.isDefault,
    });
  } catch (error) {
    logError('Error getting user preferences by module', error, { service: 'user_preferences' });
    return res.status(500).json({
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * POST /api/user-preferences
 * Save or update single user preference
 * Body: { preference_key, preference_value }
 */
export const savePreferenceController = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.user_id; // From JWT middleware
    const { preference_key, preference_value } = req.body;

    logDebug('Saving user preference', { userId, preference_key, service: 'user_preferences' });

    const savedPreference = await savePreferenceService(
      userId,
      preference_key,
      preference_value
    );

    return res.status(200).json({
      message: `Preference ${savedPreference.action} successfully`,
      preference: savedPreference,
    });
  } catch (error) {
    logError('Error saving user preference', error, { service: 'user_preferences' });
    return res.status(500).json({
      message: error.message || 'Internal server error',
    });
  }
};


/**
 * DELETE /api/user-preferences?preference_key=ui_preferences
 * Reset (delete) user preference by key
 * User will get defaults on next request
 */
export const resetPreferenceByKeyController = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.user_id; // From JWT middleware
    const { preference_key } = req.query;

    logDebug('Resetting user preference by key', { userId, preference_key, service: 'user_preferences' });

    const deleted = await resetPreferenceService(userId, preference_key);

    return res.status(200).json({
      success: true,
      message: deleted ? 'Preference reset successfully' : 'Preference was already using defaults',
    });
  } catch (error) {
    logError('Error resetting user preference by key', error, { service: 'user_preferences' });
    return res.status(500).json({
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * DELETE /api/user-preferences/batch
 * Reset (delete) ALL user preferences
 * User will get defaults on next request
 */
export const resetAllPreferencesController = async (req, res) => {
  try {
    const userId = req.user.user_id; // From JWT middleware

    logDebug('Resetting all user preferences to default (batch)', { userId, service: 'user_preferences' });

    const deletedCount = await resetAllPreferencesService(userId);

    return res.status(200).json({
      success: true,
      message: 'All preferences reset to defaults successfully',
      deletedCount
    });
  } catch (error) {
    logError('Error resetting all user preferences', error, { service: 'user_preferences' });
    return res.status(500).json({
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * PATCH /api/user-preferences/global-toggle
 * Global toggle ALL user preferences enable/disable
 * Body: { "is_enabled": false }
 */
export const globalToggleController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { is_enabled } = req.body;

    logDebug('Global toggle user preferences', { userId, is_enabled, service: 'user_preferences' });

    const result = await bulkToggleAllPreferencesService(userId, is_enabled);

    return res.status(200).json({
      message: `All preferences ${is_enabled ? 'enabled' : 'disabled'} successfully`,
      affectedCount: result.affectedCount
    });
  } catch (error) {
    logError('Error global toggling user preferences', error, { service: 'user_preferences' });
    return res.status(500).json({
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * GET /api/user-preferences
 * Get all preferences for authenticated user
 * Optionally include defaults with ?include_defaults=true
 */
export const getAllPreferencesController = async (req, res) => {
  try {
    const userId = req.user.user_id; // From JWT middleware
    const includeDefaults = req.query.include_defaults === 'true';

    logDebug('Getting all user preferences', { userId, includeDefaults, service: 'user_preferences' });

    let result;
    if (includeDefaults) {
      result = await getAllPreferencesWithDefaultsService(userId);
      return res.status(200).json({
        message: 'All user preferences retrieved (with defaults)',
        savedCount: result.savedCount,
        defaultCount: result.defaultCount,
        preferences: result.preferences,
      });
    } else {
      result = await getAllPreferencesService(userId);
      return res.status(200).json(result);

    }
  } catch (error) {
    logError('Error getting all user preferences', error, { service: 'user_preferences' });
    return res.status(500).json({
      message: error.message || 'Internal server error',
    });
  }
};
