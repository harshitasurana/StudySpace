import { EducationLearningPreference } from "./preferences_schema.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { createEducationError } from "../education_errors.js";

/**
 * Saves (create-or-update) the learning preferences for the CALLING user's
 * student profile.
 *
 * student_profile_id is accepted in the body (the frontend has it from the
 * create-profile response), but ownership is always re-verified against
 * the authenticated user before writing — a caller can never save
 * preferences against someone else's profile by guessing an id.
 */
export const saveLearningPreferencesService = async (userId, payload) => {
  const profile = await EducationStudentProfile.findOne({ where: { user_id: userId } });
  if (!profile) {
    throw createEducationError(
      "No student profile found — create one before saving preferences",
      404,
      "STUDENT_PROFILE_NOT_FOUND"
    );
  }

  if (payload.student_profile_id && Number(payload.student_profile_id) !== profile.student_profile_id) {
    throw createEducationError("student_profile_id does not belong to the current user", 403, "PROFILE_MISMATCH");
  }

  const FIELDS = [
    "preferred_language",
    "learning_goal",
    "difficulty_level",
    "subject_interests",
    "learning_style",
    "content_preferences",
    "allow_parent_tracking",
  ];

  const [preference, created] = await EducationLearningPreference.findOrCreate({
    where: { student_profile_id: profile.student_profile_id },
    defaults: {
      student_profile_id: profile.student_profile_id,
      preferred_language: payload.preferred_language ?? null,
      learning_goal: payload.learning_goal ?? null,
      difficulty_level: payload.difficulty_level ?? null,
      subject_interests: payload.subject_interests ?? null,
      learning_style: payload.learning_style ?? null,
      content_preferences: payload.content_preferences ?? null,
      allow_parent_tracking: payload.allow_parent_tracking ?? false,
    },
  });

  // A partial payload (e.g. just { allow_parent_tracking }, from the
  // Parent Portal opt-in toggle) only touches the fields it actually
  // sent — a field simply absent from the body must never be treated the
  // same as "clear this", or a later unrelated save would silently wipe
  // out preferences set during onboarding.
  if (!created) {
    const updates = {};
    for (const field of FIELDS) {
      if (Object.prototype.hasOwnProperty.call(payload, field)) {
        updates[field] = payload[field];
      }
    }
    if (Object.keys(updates).length > 0) {
      await preference.update(updates);
    }
  }

  return preference;
};
