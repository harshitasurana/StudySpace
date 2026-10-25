import {
  loginUser,
  verifyUserToken,
  findUserByRefreshToken,
  removeUserRefreshToken,
  registerUser,
  forgotPassword,
  resetPassword,
  updateUserActiveStatus,
  listUsers,
  getUserByIdForManagement,
  createUserByAdmin,
  updateUserByAdmin,
  updateOwnRole,
  deleteUser,
  bulkDeleteUsers,
  adminResetPassword,
  getUserStats,
  getMyProfileService,
  updateMyProfileService,
  changeMyPasswordService,
} from "./user_service.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "./user_schema.js";
import Role from "../roles/role_schema.js";

// ── httpOnly cookie helpers ────────────────────────────────────────────────
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE !== 'false',
  sameSite: process.env.COOKIE_SAME_SITE || 'None',
  path: '/',
};

const setAuthCookies = (res, accessToken, refreshToken, expiresIn) => {
  res.cookie('accessToken', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: expiresIn * 1000,
  });
  res.cookie('refreshToken', refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', { ...COOKIE_OPTIONS });
  res.clearCookie('refreshToken', { ...COOKIE_OPTIONS });
};

// ============ CONTROLLERS ============

export const loginUserController = async (req, res) => {
  try {
    const result = await loginUser(req.body);

    const { accessToken, refreshToken, expiresIn, user } = result;
    setAuthCookies(res, accessToken, refreshToken, expiresIn);
    res.status(200).json({
      success: true,
      message: "Login successful",
      expiresIn,
      accessToken,
      refreshToken,
      user,
    });
  } catch (err) {
    res.status(err.statusCode || 401).json({
      success: false,
      message: err.message || "Authentication failed",
      code: err.code || "AUTHENTICATION_FAILED",
      locked_until: err.locked_until || null,
    });
  }
};

export const registerUserController = async (req, res) => {
  try {
    const result = await registerUser(req.body);
    const { accessToken, refreshToken, expiresIn, user } = result;
    setAuthCookies(res, accessToken, refreshToken, expiresIn);
    res.status(201).json({
      success: true,
      message: "Account created successfully",
      expiresIn,
      accessToken,
      refreshToken,
      user,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || "Registration failed",
    });
  }
};

export const verifyUserTokenController = async (req, res) => {
  try {
    const user = req.user;
    if (!user) throw new Error("No token provided");
    res.json({ success: true, user });
  } catch (err) {
    res.status(401).json({
      success: false,
      message: err.message || "Invalid token",
    });
  }
};

export const refreshUserTokenController = async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
    if (!refreshToken) throw new Error("Refresh token missing");

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await findUserByRefreshToken(refreshToken);

    if (!user || user.user_id !== decoded.id)
      throw new Error("Invalid refresh token");

    if (!user.is_active) throw new Error("Account is deactivated");

    const expiresIn = 900;
    // Must match issueUserTokens() in user_service.js: role has to be the
    // role NAME (e.g. "student"), not role_id. The frontend's
    // defaultRouteForRole() switches on this string to route new users into
    // /education/onboarding/role - a numeric role_id doesn't match any case,
    // silently falls through to the student-portal default, and skips
    // onboarding entirely.
    const newAccessToken = jwt.sign(
      { id: user.user_id, email: user.account_email, role: user.userRole?.role_name },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    const newRefreshToken = jwt.sign(
      { id: user.user_id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    await user.update({ refresh_token: newRefreshToken });

    setAuthCookies(res, newAccessToken, newRefreshToken, expiresIn);

    res.json({ 
      success: true, 
      expiresIn,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    res.status(403).json({
      success: false,
      message: err.message || "Invalid refresh token",
    });
  }
};

export const logoutUserController = async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
    if (refreshToken) {
      await removeUserRefreshToken(refreshToken);
    }

    clearAuthCookies(res);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    res.status(400).json({ success: false, message: "Logout failed" });
  }
};

export const forgotPasswordController = async (req, res) => {
  try {
    const result = await forgotPassword(req.body.email);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Failed to process forgot password request",
    });
  }
};

export const resetPasswordController = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const result = await resetPassword(token, newPassword);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || "Failed to reset password",
    });
  }
};

export const updateUserActiveStatusController = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;
    const result = await updateUserActiveStatus(userId, is_active);
    if (!result) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({
      success: true,
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || "Failed to update user status",
    });
  }
};

// ============ USER MANAGEMENT CONTROLLERS ============

export const listUsersController = async (req, res) => {
  try {
    const result = await listUsers(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to list users" });
  }
};

export const getUserByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getUserByIdForManagement(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch user" });
  }
};

export const createUserByAdminController = async (req, res) => {
  try {
    const user = await createUserByAdmin(req.body, req.user.user_id);
    res.status(201).json({ success: true, message: "User created successfully", data: user });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message || "Failed to create user" });
  }
};

export const updateUserByAdminController = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await updateUserByAdmin(id, req.body, req.user.user_id);
    res.status(200).json({ success: true, message: "User updated successfully", data: user });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message || "Failed to update user" });
  }
};

// Self-service: a user setting their OWN role (e.g. onboarding role
// selection). The user id is taken ONLY from the authenticated session —
// never from req.params or req.body — so this can never be used to change
// someone else's role. The service layer additionally rejects any role_id
// that isn't flagged is_self_assignable.
export const updateOwnRoleController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { role_id } = req.body;
    const user = await updateOwnRole(userId, role_id);
    res.status(200).json({ success: true, message: "Role updated successfully", data: user });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message || "Failed to update role" });
  }
};

export const getMyProfileController = async (req, res) => {
  try {
    const profile = await getMyProfileService(req.user.user_id);
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to fetch profile" });
  }
};

export const updateMyProfileController = async (req, res) => {
  try {
    const profile = await updateMyProfileService(req.user.user_id, req.body);
    res.status(200).json({ success: true, message: "Profile updated successfully", data: profile });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to update profile" });
  }
};

export const changeMyPasswordController = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await changeMyPasswordService(req.user.user_id, currentPassword, newPassword);
    res.status(200).json({ success: true, message: "Password changed successfully", data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to change password" });
  }
};

export const deleteUserController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteUser(id);
    res.status(200).json({ success: true, message: "User deleted successfully", data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message || "Failed to delete user" });
  }
};

export const bulkDeleteUsersController = async (req, res) => {
  try {
    const { user_ids } = req.body;
    const result = await bulkDeleteUsers(user_ids);
    res.status(200).json({ success: true, message: "Users deleted successfully", data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to bulk delete users" });
  }
};

export const adminResetPasswordController = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const result = await adminResetPassword(id, newPassword, req.user.user_id);
    res.status(200).json({ success: true, message: "Password reset successfully", data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: error.message || "Failed to reset password" });
  }
};

export const getUserStatsController = async (req, res) => {
  try {
    const stats = await getUserStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch user stats" });
  }
};

export const activateUserController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateUserActiveStatus(id, true);
    if (!result) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, message: "User activated successfully" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Failed to activate user" });
  }
};

export const deactivateUserController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateUserActiveStatus(id, false);
    if (!result) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, message: "User deactivated successfully" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Failed to deactivate user" });
  }
};