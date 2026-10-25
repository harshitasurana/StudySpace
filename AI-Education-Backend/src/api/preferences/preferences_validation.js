import Joi from "joi";

export const savePreferencesSchema = Joi.object({
  // Optional cross-check against the caller's own profile — see
  // preferences_service.js. Not required because the profile is always
  // resolved from the session regardless.
  student_profile_id: Joi.number().integer().optional(),
  preferred_language: Joi.string().max(50).optional().allow(null, ""),
  learning_goal: Joi.string().max(150).optional().allow(null, ""),
  difficulty_level: Joi.string().max(30).optional().allow(null, ""),
  subject_interests: Joi.array().items(Joi.string()).optional().allow(null),
  learning_style: Joi.string().max(50).optional().allow(null, ""),
  content_preferences: Joi.object().optional().allow(null),
  allow_parent_tracking: Joi.boolean().optional(),
});
