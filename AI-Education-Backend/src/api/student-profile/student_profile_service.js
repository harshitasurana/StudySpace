import crypto from "crypto";
import { EducationStudentProfile, EducationStudentSubject } from "./student_profile_schema.js";
import { EducationAcademicBoard, EducationAcademicClass, EducationAcademicSubject } from "../academic/academic_schema.js";
import User from "../user/user_schema.js";
import { createEducationError } from "../education_errors.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

const randomSegment = (length) => {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
};

// Generates a STU-XXXXX-XXXX style code and retries on the rare unique
// collision. A handful of attempts is more than enough at this key space.
const generateUniqueStudentCode = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `STU-${randomSegment(5)}-${randomSegment(4)}`;
    // eslint-disable-next-line no-await-in-loop
    const existing = await EducationStudentProfile.findOne({ where: { student_code: candidate } });
    if (!existing) return candidate;
  }
  throw createEducationError("Could not generate a unique student code", 500, "STUDENT_CODE_GENERATION_FAILED");
};

const assertReferencedRowsExist = async ({ board_id, class_id, subject_ids }) => {
  if (board_id) {
    const board = await EducationAcademicBoard.findOne({ where: { board_id, is_active: true } });
    if (!board) throw createEducationError("Invalid board_id", 400, "INVALID_BOARD");
  }
  if (class_id) {
    const klass = await EducationAcademicClass.findOne({ where: { class_id, is_active: true } });
    if (!klass) throw createEducationError("Invalid class_id", 400, "INVALID_CLASS");
  }
  if (subject_ids && subject_ids.length) {
    const found = await EducationAcademicSubject.findAll({
      where: { subject_id: subject_ids, is_active: true },
      attributes: ["subject_id"],
    });
    if (found.length !== new Set(subject_ids).size) {
      throw createEducationError("One or more subject_ids are invalid", 400, "INVALID_SUBJECTS");
    }
  }
};

/**
 * Create-or-update the CALLING user's student profile.
 *
 * userId always comes from the authenticated session (req.user.user_id) in
 * the controller — never from the request body — so this can only ever
 * write the caller's own profile, matching the same self-service pattern
 * used by updateOwnRole() in api/user/user_service.js.
 */
export const upsertStudentProfileService = async (userId, roleId, payload) => {
  const {
    board_id = null,
    class_id = null,
    subject_ids = [],
    learning_mode = "self",
    academic_year = null,
    school_name = null,
    section = null,
    roll_number = null,
  } = payload;

  await assertReferencedRowsExist({ board_id, class_id, subject_ids });

  // roleId is a best-effort hint from the session token. If it isn't
  // present there (token shape varies across auth middleware versions),
  // fall back to looking the user's current role_id up directly rather
  // than silently writing a null role onto the profile.
  let resolvedRoleId = roleId || null;
  if (!resolvedRoleId) {
    const user = await User.findOne({ where: { user_id: userId }, attributes: ["role_id"] });
    resolvedRoleId = user?.role_id || null;
  }

  let profile = await EducationStudentProfile.findOne({ where: { user_id: userId } });

  if (!profile) {
    const student_code = await generateUniqueStudentCode();
    profile = await EducationStudentProfile.create({
      user_id: userId,
      role_id: resolvedRoleId,
      board_id,
      class_id,
      learning_mode,
      academic_year,
      school_name,
      section,
      roll_number,
      student_code,
      status: "in_progress",
    });
  } else {
    await profile.update({
      role_id: resolvedRoleId || profile.role_id,
      board_id,
      class_id,
      learning_mode,
      academic_year,
      school_name,
      section,
      roll_number,
    });
  }

  // Replace the subject set on every save — simpler and safer for an
  // onboarding wizard (where the user can go back and change subjects)
  // than trying to diff add/remove.
  await EducationStudentSubject.destroy({ where: { student_profile_id: profile.student_profile_id } });
  if (subject_ids.length) {
    await EducationStudentSubject.bulkCreate(
      subject_ids.map((subject_id) => ({ student_profile_id: profile.student_profile_id, subject_id }))
    );
  }

  return getStudentProfileForUserService(userId);
};

export const getStudentProfileForUserService = async (userId) => {
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
    ],
  });
  return profile;
};

/**
 * Marks the calling user's student profile onboarding as complete.
 * Idempotent — calling it again after completion just re-confirms status.
 */
export const completeStudentProfileService = async (userId) => {
  const profile = await EducationStudentProfile.findOne({ where: { user_id: userId } });
  if (!profile) {
    throw createEducationError(
      "No student profile found to complete — create one first",
      404,
      "STUDENT_PROFILE_NOT_FOUND"
    );
  }

  if (profile.status !== "completed") {
    await profile.update({ status: "completed", completed_at: new Date() });
  }

  return getStudentProfileForUserService(userId);
};

/**
 * Marks the calling user's Guided Walkthrough as seen — fired once the
 * tour finishes OR is skipped/dismissed, since either way the student has
 * now seen it and it shouldn't reappear. Idempotent: calling it again
 * just re-confirms the existing timestamp rather than overwriting it, so
 * a retried request never resets "when it was first seen".
 */
export const markGuidedWalkthroughSeenService = async (userId) => {
  const profile = await EducationStudentProfile.findOne({ where: { user_id: userId } });
  if (!profile) {
    throw createEducationError("No student profile found", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  if (!profile.guided_walkthrough_seen_at) {
    await profile.update({ guided_walkthrough_seen_at: new Date() });
  }

  return getStudentProfileForUserService(userId);
};