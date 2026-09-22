import Joi from "joi";

const VALID_VIEW_TYPES = ['list', 'board', 'calendar', 'table', 'tree', 'grid', 'form', 'default'];

const userPreferenceValidation = {
  /**
   * Validation for saving/updating single user preference - ANY JSON accepted
   */
  savePreference: Joi.object({
    preference_key: Joi.string().required().messages({
      'string.base': 'Preference key must be a string',
      'any.required': 'Preference key is required'
    }),
    preference_value: Joi.any().required().messages({
      'any.required': 'Preference value is required'
    }),
    created_by: Joi.number().integer().allow(null).optional(),
    updated_by: Joi.number().integer().allow(null).optional(),
    created_at: Joi.date().optional(),
    updated_at: Joi.date().optional(),
  }).unknown(true),

  /**
   * Validation for saving multiple preferences (batch) - ANY keys/JSON accepted
   */


  /**
   * Validation for query parameters (get/delete by key) - ANY key accepted
   */
  queryKey: Joi.object({
    key: Joi.string().required().messages({
      'string.base': 'Key must be a string',
      'any.required': 'Key is required'
    }),
  }),

  /**
   * Validation for deleting by specific preference_key
   */
  deleteQuery: Joi.object({
    preference_key: Joi.string().required().messages({
      'string.base': 'Preference key must be a string',
      'any.required': 'Preference key is required'
    }),
  }),

  /**
   * Validation for query parameters (get by module - legacy support)
   */
  queryModule: Joi.object({
    module: Joi.string().required().messages({
      'string.base': 'Module must be a string',
      'any.required': 'Module is required'
    }),
  }),

  /**
   * Validation for getting all preferences
   */
  getAllPreferences: Joi.object({
    include_defaults: Joi.boolean().optional().default(false),
  }),

  /**
   * Validation for toggling a preference
   */
  togglePreference: Joi.object({
    key: Joi.string().required().messages({
      'any.required': 'Preference key is required'
    }),
    is_enabled: Joi.boolean().required().messages({
      'any.required': 'is_enabled boolean flag is required'
    })
  }),
  /**
   * Validation for global toggle - just is_enabled boolean
   */
  globalToggle: Joi.object({
    is_enabled: Joi.boolean().required().messages({
      'any.required': 'is_enabled boolean is required'
    })
  }),
};

// Export individual schemas for backward compatibility
export const savePreferenceSchema = userPreferenceValidation.savePreference;
export const saveBatchPreferencesSchema = userPreferenceValidation.saveBatchPreferences;
export const queryKeySchema = userPreferenceValidation.queryKey;
export const queryModuleSchema = userPreferenceValidation.queryModule;
export const deleteQuerySchema = userPreferenceValidation.deleteQuery;
export const getAllPreferencesSchema = userPreferenceValidation.getAllPreferences;
export const togglePreferenceSchema = userPreferenceValidation.togglePreference;

export { VALID_VIEW_TYPES };

export default userPreferenceValidation;
