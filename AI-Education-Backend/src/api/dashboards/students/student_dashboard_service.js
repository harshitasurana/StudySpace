import { EducationStudentProfile } from "../../student-profile/student_profile_schema.js";
import { EducationAcademicBoard, EducationAcademicClass, EducationAcademicSubject } from "../../academic/academic_schema.js";
import { EducationLearningPreference } from "../../preferences/preferences_schema.js";
import { createEducationError } from "../../education_errors.js";

/**
 * Aggregates the CALLING user's student profile + preferences for the
 * dashboard landing page.
 *
 * Deliberately does NOT include mastery %, streaks, weak-concepts, or
 * per-chapter progress — none of that has a backing table in this plan
 * (education_student_profiles / academic tables / learning_preferences
 * only cover onboarding data). Returning fabricated numbers here would
 * look real but have no source of truth. The frontend's existing static
 * fallback covers that until a real assessment/progress system is
 * designed.
 *
 * Per Sprint 3 acceptance criteria ("Dashboard is visible to completed
 * students only"), this throws a 403 if onboarding isn't finished yet
 * rather than returning a half-empty profile.
 */
export const getStudentDashboardService = async (userId) => {
  const profile = await EducationStudentProfile.findOne({
    where: { user_id: userId },
    include: [
      { model: EducationAcademicBoard, as: "board", attributes: ["board_id", "name"] },
      { model: EducationAcademicClass, as: "class", attributes: ["class_id", "name"] },
      {
        model: EducationAcademicSubject,
        as: "subjects",
        attributes: ["subject_id", "name"],
        through: { attributes: [] },
      },
      { model: EducationLearningPreference, as: "preferences" },
    ],
  });

  if (!profile) {
    throw createEducationError(
      "No student profile found — complete onboarding first",
      404,
      "STUDENT_PROFILE_NOT_FOUND"
    );
  }

  if (profile.status !== "completed") {
    throw createEducationError(
      "Onboarding isn't complete yet — dashboard isn't available until it is",
      403,
      "ONBOARDING_INCOMPLETE"
    );
  }

  return {
    student_code: profile.student_code,
    learning_mode: profile.learning_mode,
    academic_year: profile.academic_year,
    board: profile.board ? { board_id: profile.board.board_id, name: profile.board.name } : null,
    class: profile.class ? { class_id: profile.class.class_id, name: profile.class.name } : null,
    subjects: (profile.subjects || []).map((s) => ({ subject_id: s.subject_id, name: s.name })),
    school_name: profile.school_name || null,
    section: profile.section || null,
    roll_number: profile.roll_number || null,
    preferences: profile.preferences
      ? {
          preferred_language: profile.preferences.preferred_language,
          learning_goal: profile.preferences.learning_goal,
          difficulty_level: profile.preferences.difficulty_level,
          allow_parent_tracking: profile.preferences.allow_parent_tracking,
        }
      : null,
  };
};