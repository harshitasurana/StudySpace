import Role from "../roles/role_schema.js";
import { EducationOnboardingSession } from "./onboarding_schema.js";
import { createEducationError } from "../education_errors.js";

// Metadata-driven step manifests, keyed by role_name (lowercased) and, for
// Student, further split by learning_mode. This is what lets the frontend
// onboarding engine stay generic (per the architecture plan section 4 —
// "UI renders steps dynamically, without hardcoded role logic"): the
// wizard just walks whatever `steps` array comes back here.
//
// Only the Student persona has real steps in Sprint 1. Non-student
// personas (teacher/parent/school/coaching) are Sprint 4 stubs — they get
// an empty step list rather than a 404, so the frontend can render
// "coming soon" instead of erroring.
const STUDENT_STEP_MANIFEST = {
  self: [
    { step_key: "class", label: "Class", required: true },
    { step_key: "board", label: "Board", required: true },
    { step_key: "subjects", label: "Subjects", required: true },
    { step_key: "preferences", label: "Preferences", required: true },
    { step_key: "summary", label: "Code", required: false },
  ],
  school: [
    { step_key: "school_search", label: "School", required: true },
    { step_key: "verify", label: "Verify Details", required: true },
    { step_key: "class", label: "Class", required: true },
    { step_key: "section", label: "Section", required: true },
    { step_key: "preferences", label: "Preferences", required: true },
    { step_key: "summary", label: "Code", required: false },
  ],
};

const buildManifestForRole = (roleName, learningMode) => {
  if (roleName === "student") {
    const mode = learningMode === "school" ? "school" : "self";
    return { persona: "student", learning_mode: mode, steps: STUDENT_STEP_MANIFEST[mode] };
  }
  // Sprint 4 will replace this with real per-persona manifests.
  return { persona: roleName, learning_mode: null, steps: [] };
};

/**
 * Returns the step manifest for the given role, and opportunistically
 * records/updates an onboarding session row for the user so progress can
 * be resumed. Session tracking here is best-effort — a failure to write it
 * should never block onboarding, so it's swallowed rather than thrown.
 */
export const getOnboardingConfigService = async (userId, roleId, learningMode) => {
  if (!roleId) {
    throw createEducationError("role_id is required", 400, "ROLE_ID_REQUIRED");
  }

  const role = await Role.findOne({ where: { role_id: roleId, is_active: true } });
  if (!role) {
    throw createEducationError("Role not found", 404, "ROLE_NOT_FOUND");
  }

  const manifest = buildManifestForRole(role.role_name?.toLowerCase(), learningMode);

  try {
    const [session] = await EducationOnboardingSession.findOrCreate({
      where: { user_id: userId, status: "in_progress" },
      defaults: {
        user_id: userId,
        role_id: roleId,
        persona: manifest.persona,
        current_step: manifest.steps[0]?.step_key || null,
      },
    });
    await session.update({
      role_id: roleId,
      persona: manifest.persona,
      payload: { ...session.payload, learning_mode: manifest.learning_mode },
    });
  } catch (err) {
    // Non-fatal — the config response itself is still correct even if
    // session bookkeeping fails.
  }

  return {
    role_id: role.role_id,
    role_name: role.role_name,
    ...manifest,
  };
};
