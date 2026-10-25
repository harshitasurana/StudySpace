import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import User from "./user_schema.js";
import Role from "../roles/role_schema.js";

const creatorInclude = {
  model: User,
  as: "creator",
  attributes: ["user_id", "first_name", "last_name"],
  required: false,
};

import {
  findAllUsersPaginated,
  findUserByIdForManagement,
  getUserStats as getUserStatsModel,
  bulkDeleteUsers as bulkDeleteUsersModel,
} from "./user_model.js";
import { sendEmail } from "../../common/utils/emailService.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import {
  accountCreatedTemplate,
  accountStatusChangedTemplate,
  renderEmailTemplate,
} from "../../common/utils/emailTemplates.js";
import { getPreferenceByKeyService, savePreferenceService } from "../user-preferences/user_preferences_service.js";

const createAuthError = (message, statusCode, code, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  Object.assign(error, extra);
  return error;
};

const getUserAuthEmail = (user) => user.account_email || user.personal_email || user.email;

// Single-tenant app: no per-organization security settings table anymore.
// These lockout defaults used to be overridable per-organization via a
// SecuritySetting row; now they're just sane hardcoded constants.
const DEFAULT_SECURITY_SETTINGS = {
  max_login_attempts: 5,
  enable_account_lockout: true,
  lockout_duration_minutes: 15,
};

const resetUserLockoutState = async (user) => {
  await user.update({
    failed_login_attempts: 0,
    last_failed_login_at: null,
    locked_until: null,
  });
};

const buildUserProfile = async (user) => {
  const userRole = user.userRole?.role_name;

  const createdByName = user.creator
    ? `${user.creator.first_name} ${user.creator.last_name}`.trim()
    : null;

  return {
    user_id: user.user_id,
    initials: user.initials,
    avatar: user.avatar,
    first_name: user.first_name,
    last_name: user.last_name,
    role: userRole,
    role_id: user.role_id,
    title: user.title,
    email: getUserAuthEmail(user),
    phone: user.phone,
    location: user.location,
    created_by_name: createdByName,
    is_active: user.is_active,
    security: {
      lastPasswordChange: user.last_password_change ? `${Math.floor((new Date() - new Date(user.last_password_change)) / (1000 * 60 * 60 * 24))} days ago` : null,
      score: user.security_score,
    },
    activities: [],
    security_settings: [],
    notification_preferences: [],
  };
};

// Self-service "my profile" — GET/PATCH /api/users/me. Unlike the
// admin-only PUT "/:id" below (which trusts whatever fields the caller
// sends), this always targets req.user.user_id and only ever writes a
// small whitelist of self-editable fields — role/role_id/is_active/
// permissions are never accepted here even if a legacy client payload
// includes them (see ProfileService.js's old payload shape, which used to
// send `role` alongside name/email/language to an endpoint that never
// existed).
export const getMyProfileService = async (userId) => {
  const user = await User.findOne({
    where: { user_id: userId, deleted_at: null },
    include: [
      { model: Role, as: "userRole", attributes: ["role_name"], required: false },
      creatorInclude,
    ],
  });
  if (!user) throw createAuthError("User not found", 404, "USER_NOT_FOUND");

  const profile = await buildUserProfile(user);
  const languagePref = await getPreferenceByKeyService(userId, "general.language");

  return {
    ...profile,
    name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || null,
    language: languagePref.preference_value,
  };
};

export const updateMyProfileService = async (userId, changes) => {
  const user = await User.findOne({ where: { user_id: userId, deleted_at: null } });
  if (!user) throw createAuthError("User not found", 404, "USER_NOT_FOUND");

  const fieldUpdates = {};
  if (typeof changes.first_name === "string") fieldUpdates.first_name = changes.first_name.trim();
  if (typeof changes.last_name === "string") fieldUpdates.last_name = changes.last_name.trim();
  // Topbar.jsx's older Edit Profile modal sends a single combined `name`
  // field rather than first_name/last_name separately — split it the same
  // way rather than silently dropping it (an explicit first_name/last_name
  // pair, if also present, always wins).
  if (typeof changes.name === "string" && changes.name.trim() && fieldUpdates.first_name === undefined && fieldUpdates.last_name === undefined) {
    const [first, ...rest] = changes.name.trim().split(/\s+/);
    fieldUpdates.first_name = first;
    // last_name is non-nullable on the Sequelize model (even though the DB
    // column itself is nullable) - a single-word name (no last name given)
    // must fall back to "", not null, or User.update throws a notNull
    // Violation.
    fieldUpdates.last_name = rest.join(" ");
  }
  if (typeof changes.phone === "string") fieldUpdates.phone = changes.phone.trim() || null;

  if (typeof changes.email === "string" && changes.email.trim()) {
    const newEmail = changes.email.trim();
    if (newEmail !== user.account_email) {
      const existing = await User.findOne({ where: { account_email: newEmail, deleted_at: null } });
      if (existing) throw createAuthError("Email is already in use", 409, "EMAIL_TAKEN");
      fieldUpdates.account_email = newEmail;
    }
  }

  if (Object.keys(fieldUpdates).length > 0) await user.update(fieldUpdates);

  if (typeof changes.language === "string" && changes.language.trim()) {
    await savePreferenceService(userId, "general.language", changes.language.trim());
  }

  return getMyProfileService(userId);
};

export const changeMyPasswordService = async (userId, currentPassword, newPassword) => {
  const user = await User.findOne({ where: { user_id: userId, deleted_at: null } });
  if (!user) throw createAuthError("User not found", 404, "USER_NOT_FOUND");

  const isMatch = await bcrypt.compare(currentPassword, user.password || "");
  if (!isMatch) throw createAuthError("Current password is incorrect", 401, "INVALID_CURRENT_PASSWORD");

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await user.update({ password: hashedPassword, last_password_change: new Date() });

  return { success: true };
};

const issueUserTokens = async (user) => {
  const userRole = user.userRole?.role_name;
  const expiresIn = 900;
  const accessToken = jwt.sign(
    { id: user.user_id, role: userRole, email: getUserAuthEmail(user) },
    process.env.JWT_SECRET,
    { expiresIn }
  );

  const refreshToken = jwt.sign(
    { id: user.user_id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  await user.update({
    refresh_token: refreshToken,
    last_login: new Date(),
  });

  return {
    accessToken,
    refreshToken,
    expiresIn,
    user: await buildUserProfile(user),
  };
};

const findUserForLogin = async (identifier) => {
  if (!identifier) {
    return null;
  }

  return await User.findOne({
    where: {
      deleted_at: null,
      [Op.or]: [
        { account_email: identifier },
        { username: identifier },
      ],
    },
    include: [
      {
        model: Role,
        as: "userRole",
        attributes: ["role_name"],
        // Without required: false, Role's defaultScope where-clause
        // (is_deleted: false) turns this into an INNER JOIN, silently
        // dropping any user whose role_id has no matching active role
        // row (e.g. registerUser's hardcoded role_id: 4, if that role
        // is ever missing/soft-deleted) - login then fails with
        // "Invalid credentials" even for a real, correctly-typed login.
        required: false,
      },
      creatorInclude,
    ],
  });
};

export const registerUser = async ({ account_email, username, password, first_name, last_name, phone }) => {
  const existingUser = await User.findOne({ where: { account_email, deleted_at: null } });
  if (existingUser) throw new Error("User already exists");

  const hashedPassword = await bcrypt.hash(password, 10);

  // TEMP DEBUG - remove once the "Invalid credentials" issue is resolved.
  console.log("[register][debug] account_email:", JSON.stringify(account_email), "| password length:", password ? password.length : 0, "| generated hash prefix:", hashedPassword.slice(0, 7), "| hash length:", hashedPassword.length);

  const user = await User.create({
    account_email,
    username,
    password: hashedPassword,
    first_name,
    last_name,
    phone: phone || null,
    // Was hardcoded to 4, intending "no role yet" (see defaultRouteForRole's
    // and RoleSelectionPage's comments, both written assuming exactly that)
    // — but role_id 4 is actually the shared roles table's "patient" row
    // (this backend also serves an unrelated healthcare vertical off the
    // same roles table; see patient_model.js, which uses role_id: 4 on
    // purpose for that reason). Every self-registered education account was
    // silently being tagged "Patient", which RoleSelectionPage's
    // alreadyOnboarded check (Boolean(currentRole)) then treated as a real,
    // completed role — bouncing the user straight back out of onboarding to
    // "/", where defaultRouteForRole's default case for an unrecognized
    // role ("patient") sends them right back to onboarding: an infinite
    // redirect loop between the two. role_id is nullable on this table, and
    // a null role_id already resolves to no userRole association (see
    // issueUserTokens), i.e. a genuinely falsy role — exactly what the
    // frontend's onboarding-gate logic already expects.
    role_id: null,
    is_active: true,
    email_verified_at: new Date(),
  });

  try {
    await sendEmail({
      to: user.account_email,
      subject: "Account Created",
      html: accountCreatedTemplate(user.first_name),
    });
  } catch (emailError) {
    console.error("Welcome email failed:", emailError);
  }

  return await issueUserTokens(user);
};

export const loginUser = async ({ email, account_email, username, password }) => {
  const loginIdentifier = email || account_email || username;

  // TEMP DEBUG - remove once the "Invalid credentials" issue is resolved.
  console.log("[login][debug] identifier:", JSON.stringify(loginIdentifier));
  console.log("[login][debug] password received - length:", password ? password.length : 0, "type:", typeof password);

  const user = await findUserForLogin(loginIdentifier);

  console.log("[login][debug] user found:", !!user, user ? `(user_id=${user.user_id}, account_email=${JSON.stringify(user.account_email)}, has_password_hash=${!!user.password})` : "");

  if (!user) {
    throw createAuthError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  if (!user.is_active) {
    throw createAuthError("Account is deactivated", 403, "ACCOUNT_DEACTIVATED");
  }

  const securitySettings = DEFAULT_SECURITY_SETTINGS;
  const now = new Date();

  if (securitySettings.enable_account_lockout && user.locked_until && new Date(user.locked_until) > now) {
    throw createAuthError(
      "Account locked due to multiple failed attempts",
      423,
      "ACCOUNT_LOCKED",
      { locked_until: user.locked_until }
    );
  }

  if (user.locked_until && new Date(user.locked_until) <= now) {
    await resetUserLockoutState(user);
    user.failed_login_attempts = 0;
    user.locked_until = null;
  }

  const isMatch = await bcrypt.compare(password, user.password);

  // TEMP DEBUG - remove once the "Invalid credentials" issue is resolved.
  console.log("[login][debug] bcrypt.compare result:", isMatch, "| stored hash prefix:", user.password ? user.password.slice(0, 7) : "(none)", "| stored hash length:", user.password ? user.password.length : 0);

  if (!isMatch) {
    const nextFailedAttempts = (user.failed_login_attempts || 0) + 1;

    if (securitySettings.enable_account_lockout && nextFailedAttempts >= securitySettings.max_login_attempts) {
      const lockedUntil = new Date(now.getTime() + securitySettings.lockout_duration_minutes * 60 * 1000);

      await user.update({
        failed_login_attempts: nextFailedAttempts,
        last_failed_login_at: now,
        locked_until: lockedUntil,
      });

      throw createAuthError(
        "Account locked due to multiple failed attempts",
        423,
        "ACCOUNT_LOCKED",
        { locked_until: lockedUntil }
      );
    }

    await user.update({
      failed_login_attempts: nextFailedAttempts,
      last_failed_login_at: now,
    });

    throw createAuthError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  await user.update({
    failed_login_attempts: 0,
    last_failed_login_at: null,
    locked_until: null,
  });

  return await issueUserTokens(user);
};

export const verifyUserToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      where: { user_id: decoded.id, deleted_at: null },
      attributes: ["user_id", "first_name", "last_name", "account_email", "role_id"],
    });
    if (!user) throw new Error("User not found");
    return user;
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      throw new Error("Invalid or expired token");
    }
    throw error;
  }
};

export const findUserByRefreshToken = async (refreshToken) => {
  // Role include is required here: refreshUserTokenController reads
  // user.userRole?.role_name to re-sign the access token with the same
  // shape issueUserTokens() uses at login (role NAME, not role_id).
  // Without it, user.userRole is undefined on every refresh, so the new
  // access token gets signed with role: undefined - which JWT silently
  // drops from the payload entirely. That means every page reload (which
  // triggers a refresh via AuthContext's bootstrap effect) wipes out the
  // user's role, even after they've completed onboarding, sending them
  // straight back to /education/onboarding/role in a loop. required:
  // false so a user whose role_id doesn't match a live (non-deleted) role
  // row isn't silently dropped by Role's defaultScope INNER JOIN - same
  // reasoning as findUserForLogin above.
  return await User.findOne({
    where: { refresh_token: refreshToken, deleted_at: null },
    include: [{ model: Role, as: "userRole", attributes: ["role_id", "role_name"], required: false }],
  });
};

export const removeUserRefreshToken = async (refreshToken) => {
  const [updated] = await User.update(
    { refresh_token: null },
    { where: { refresh_token: refreshToken, deleted_at: null } }
  );
  return updated > 0;
};

export const forgotPassword = async (email) => {
  let user = await User.findOne({ where: { account_email: email, is_active: true, deleted_at: null } });

  if (!user) {
    user = await User.findOne({ where: { personal_email: email, is_active: true, deleted_at: null } });
  }

  if (!user) {
    return { success: true, message: "If the email exists, a reset link has been sent." };
  }

  const resetToken = jwt.sign(
    { id: user.user_id, email: getUserAuthEmail(user) },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await User.update(
    {
      password_reset_token: resetToken,
      password_reset_expires: expires,
    },
    { where: { user_id: user.user_id } }
  );

  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  try {
    // Admin-editable via Email Templates (template_key "forgot_password")
    // instead of the old hardcoded passwordResetTemplate — falls back to
    // the same content automatically if the row is ever missing/inactive
    // (see renderEmailTemplate's FALLBACK_TEMPLATES).
    const rendered = renderEmailTemplate("forgot_password", { reset_link: resetLink });
    await sendEmail({
      to: user.account_email,
      subject: rendered.subject,
      html: rendered.body_html,
    });
  } catch (emailError) {
    console.error("Password reset email failed:", emailError);
  }

  return {
    success: true,
    message: "If the email exists, a reset link has been sent.",
  };
};

export const resetPassword = async (token, newPassword) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findOne({
    where: {
      user_id: decoded.id,
      password_reset_token: token,
      password_reset_expires: { [Op.gt]: new Date() },
      deleted_at: null,
    },
  });

  if (!user) {
    throw new Error("Invalid or expired reset token");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await User.update(
    {
      password: hashedPassword,
      password_reset_token: null,
      password_reset_expires: null,
      last_password_change: new Date(),
      refresh_token: null,
      failed_login_attempts: 0,
      last_failed_login_at: null,
      locked_until: null,
    },
    { where: { user_id: user.user_id } }
  );

  return {
    success: true,
    message: "Password reset successfully",
  };
};

export const updateUserActiveStatus = async (userId, isActive) => {
  const [updated] = await User.update({ is_active: isActive }, { where: { user_id: userId } });
  if (updated > 0) {
    const user = await User.findByPk(userId);
    if (user) {
      try {
        await sendEmail({
          to: user.account_email,
          subject: "Account Status Updated",
          html: accountStatusChangedTemplate(isActive ? "activated" : "deactivated"),
        });
      } catch (emailError) {
        console.error("Status change email failed:", emailError);
      }
    }
  }
  return updated > 0;
};
// ============ USER MANAGEMENT FUNCTIONS (Admin CRUD) ============

export const listUsers = async (filters) => {
  return await findAllUsersPaginated(filters);
};

export const getUserByIdForManagement = async (userId) => {
  const user = await findUserByIdForManagement(userId);
  if (!user) return null;

  return user.toJSON();
};

export const createUserByAdmin = async (userData, createdByUserId) => {
  const { email, account_email, password, ...rest } = userData;
  const resolvedEmail = account_email || email;

  const existing = await User.findOne({
    where: {
      [Op.or]: [
        { account_email: resolvedEmail },
        ...(rest.username ? [{ username: rest.username }] : []),
      ],
      deleted_at: null,
    },
  });
  if (existing) {
    const field = existing.account_email === resolvedEmail ? "email" : "username";
    throw createAuthError(`A user with this ${field} already exists`, 409, "USER_EXISTS");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const adminUser = await User.findByPk(createdByUserId, { attributes: ['first_name', 'last_name'] });
  const createdByName = adminUser ? `${adminUser.first_name} ${adminUser.last_name}`.trim() : null;

  const newUser = await User.create({
    ...rest,
    account_email: resolvedEmail,
    password: hashedPassword,
    created_by: createdByUserId,
    updated_by: createdByUserId,
    created_by_name: createdByName,
    is_active: rest.is_active !== undefined ? rest.is_active : true,
    email_verified_at: rest.email_verified_at !== undefined ? rest.email_verified_at : new Date(),
  });

  const plain = newUser.toJSON();
  delete plain.password;
  delete plain.refresh_token;
  delete plain.two_fa_secret;
  delete plain.two_fa_backup_codes;
  delete plain.password_reset_token;
  delete plain.password_reset_expires;

  return plain;
};

export const updateUserByAdmin = async (userId, updateData, updatedByUserId) => {
  const user = await User.findOne({ where: { user_id: userId, deleted_at: null } });
  if (!user) throw createAuthError("User not found", 404, "USER_NOT_FOUND");

  const { email, account_email, password, ...rest } = updateData;
  const resolvedEmail = account_email || email;

  if (resolvedEmail && resolvedEmail !== user.account_email) {
    const emailTaken = await User.findOne({
      where: { account_email: resolvedEmail, user_id: { [Op.ne]: userId }, deleted_at: null },
    });
    if (emailTaken) throw createAuthError("Email is already in use", 409, "EMAIL_EXISTS");
  }

  if (rest.username && rest.username !== user.username) {
    const usernameTaken = await User.findOne({
      where: { username: rest.username, user_id: { [Op.ne]: userId }, deleted_at: null },
    });
    if (usernameTaken) throw createAuthError("Username is already in use", 409, "USERNAME_EXISTS");
  }

  const adminUser = await User.findByPk(updatedByUserId, { attributes: ['first_name', 'last_name'] });
  const updatedByName = adminUser ? `${adminUser.first_name} ${adminUser.last_name}`.trim() : null;

  const updateFields = { ...rest, updated_by: updatedByUserId, updated_by_name: updatedByName };
  if (resolvedEmail) updateFields.account_email = resolvedEmail;
  if (password) updateFields.password = await bcrypt.hash(password, 10);

  await user.update(updateFields);

  const updated = await findUserByIdForManagement(userId);
  const plain = updated.toJSON();
  delete plain.password;
  delete plain.refresh_token;
  delete plain.two_fa_secret;
  delete plain.two_fa_backup_codes;
  delete plain.password_reset_token;
  delete plain.password_reset_expires;
  return plain;
};

/**
 * Self-service role change — a user setting their OWN role, e.g. picking
 * "Student" during education onboarding.
 *
 * Deliberately separate from updateUserByAdmin:
 * - userId must come from the authenticated session (req.user.user_id) in
 *   the controller, never from a URL param, so a user can only ever change
 *   their own role.
 * - The target role_id must have is_self_assignable = true, or this throws.
 *   Admin-only roles (super_admin, hospital_admin, ...) cannot be reached
 *   this way even if a caller guesses the id.
 */
export const updateOwnRole = async (userId, roleId) => {
  const user = await User.findOne({ where: { user_id: userId, deleted_at: null } });
  if (!user) throw createAuthError("User not found", 404, "USER_NOT_FOUND");

  const role = await Role.findOne({
    where: { role_id: roleId, is_self_assignable: true, is_active: true },
  });
  if (!role) {
    throw createAuthError(
      "This role cannot be self-assigned",
      400,
      "ROLE_NOT_SELF_ASSIGNABLE"
    );
  }

  await user.update({ role_id: roleId });

  // Branded, admin-editable welcome email for the education roles only —
  // gated strictly by role_name so the unrelated healthcare side of this
  // shared platform (which never self-assigns one of these roles) is
  // completely unaffected. This is the real "a student registered" moment
  // product-wise: registerUser() itself has no role yet, so it's the only
  // point this can actually be told apart. Additive — registerUser()'s own
  // generic "Account Created" email is untouched. Best-effort: a failure
  // here must never fail role assignment itself.
  if (["Student", "School Student"].includes(role.role_name)) {
    try {
      const templateKey = "student_welcome";
      const variables = { first_name: user.first_name || "there" };
      if (templateKey === "student_welcome") {
        // Not yet created at role-selection time for a brand-new
        // student — EducationStudentProfile.create happens in a later,
        // separate onboarding step (student_profile_service.js), not
        // here. Falls back to a real, honest phrase rather than leaving
        // a raw unresolved {{student_code}} in the sent email.
        const profile = await EducationStudentProfile.findOne({ where: { user_id: userId } });
        variables.student_code = profile?.student_code || "available on your Dashboard once your profile is set up";
      }
      const rendered = renderEmailTemplate(templateKey, variables);
      await sendEmail({ to: user.account_email, subject: rendered.subject, html: rendered.body_html });
    } catch (emailError) {
      console.error("Role-specific welcome email failed:", emailError);
    }
  }

  const updated = await findUserByIdForManagement(userId);
  const plain = updated.toJSON();
  delete plain.password;
  delete plain.refresh_token;
  delete plain.two_fa_secret;
  delete plain.two_fa_backup_codes;
  delete plain.password_reset_token;
  delete plain.password_reset_expires;
  return plain;
};

export const deleteUser = async (userId) => {
  const user = await User.findOne({ where: { user_id: userId, deleted_at: null } });
  if (!user) throw createAuthError("User not found", 404, "USER_NOT_FOUND");

  await user.update({ deleted_at: new Date() });
  return { user_id: userId, deleted: true };
};

export const bulkDeleteUsers = async (userIds) => {
  const deletedCount = await bulkDeleteUsersModel(userIds);
  return { deleted_count: deletedCount, requested_count: userIds.length };
};

export const adminResetPassword = async (userId, newPassword, adminUserId) => {
  const user = await User.findOne({ where: { user_id: userId, deleted_at: null } });
  if (!user) throw createAuthError("User not found", 404, "USER_NOT_FOUND");

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await user.update({
    password: hashedPassword,
    password_reset_token: null,
    password_reset_expires: null,
    last_password_change: new Date(),
    refresh_token: null,
    failed_login_attempts: 0,
    last_failed_login_at: null,
    locked_until: null,
    updated_by: adminUserId,
  });

  try {
    await sendEmail({
      to: user.account_email,
      subject: "Your Password Has Been Reset",
      html: accountStatusChangedTemplate("reset"),
    });
  } catch (emailError) {
    console.error("Admin password reset email failed:", emailError);
  }

  return { user_id: userId, password_reset: true };
};

export const getUserStats = async () => {
  return await getUserStatsModel();
};
