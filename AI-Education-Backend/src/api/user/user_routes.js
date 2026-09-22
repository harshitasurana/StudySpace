import express from "express";
import {
  loginUserController,
  registerUserController,
  forgotPasswordController,
  logoutUserController,
  resetPasswordController,
  updateUserActiveStatusController,
  verifyUserTokenController,
  refreshUserTokenController,
  listUsersController,
  getUserByIdController,
  createUserByAdminController,
  updateUserByAdminController,
  updateOwnRoleController,
  deleteUserController,
  bulkDeleteUsersController,
  adminResetPasswordController,
  getUserStatsController,
  activateUserController,
  deactivateUserController,
  getMyProfileController,
  updateMyProfileController,
  changeMyPasswordController,
} from "./user_controller.js";
import { validateBody as validate, validateQuery } from "../../common/middlewares/validate.js";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  logoutSchema,
  createUserSchema,
  updateUserSchema,
  selfAssignRoleSchema,
  userListQuerySchema,
  adminResetPasswordSchema,
  bulkDeleteSchema,
  updateMyProfileSchema,
  changeMyPasswordSchema,
} from "./user_validation.js";
import { authenticate, authorize } from "../../common/middlewares/auth_middleware.js";
import queryParser from "../../common/middlewares/queryParser.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: User
 *   description: User authentication, registration, and administrative management
 */

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: User Login
 *     tags: [User]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             anyOf:
 *               - required: [email]
 *               - required: [account_email]
 *               - required: [username]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Login email address alias for account_email
 *               account_email:
 *                 type: string
 *                 format: email
 *                 description: User account email address
 *               username:
 *                 type: string
 *                 description: User username
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User password
 *             example:
 *               email: test@app.com
 *               password: hello@123
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: integer
 *                 user:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     first_name:
 *                       type: string
 *                     last_name:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *                     role:
 *                       type: string
 *             examples:
 *               loginSuccess:
 *                 summary: Login success
 *                 value:
 *                   success: true
 *                   message: Login successful
 *                   accessToken: jwt_access_token
 *                   refreshToken: jwt_refresh_token
 *                   expiresIn: 900
 *                   user:
 *                     user_id: 1
 *                     first_name: John
 *                     last_name: Doe
 *                     role: hospital_admin
 *       400:
 *         description: Invalid account email, username, or password
 *       500:
 *         description: Internal server error
 */
router.post("/login", validate(loginSchema), loginUserController);
/**
 * @swagger
 * /api/users/logout:
 *   post:
 *     summary: User Logout
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token to invalidate
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Internal server error
 */
router.post("/logout", authenticate, validate(logoutSchema), logoutUserController);

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: User Registration
 *     tags: [User]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - first_name
 *               - last_name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: User password (minimum 8 characters)
 *               first_name:
 *                 type: string
 *                 description: User first name
 *               last_name:
 *                 type: string
 *                 description: User last name
 *               phone:
 *                 type: string
 *                 description: User phone number (optional)
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     first_name:
 *                       type: string
 *                     last_name:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *       400:
 *         description: Validation error or user already exists
 *       500:
 *         description: Internal server error
 */
router.post("/register", validate(registerSchema), registerUserController);

/**
 * @swagger
 * /api/users/forgot-password:
 *   post:
 *     summary: Forgot Password
 *     tags: [User]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset link sent
 */
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPasswordController);

/**
 * @swagger
 * /api/users/reset-password:
 *   post:
 *     summary: Reset Password
 *     tags: [User]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post("/reset-password", validate(resetPasswordSchema), resetPasswordController);

/**
 * @swagger
 * /api/users/refresh-token:
 *   post:
 *     summary: Refresh Access Token
 *     tags: [User]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token generated
 */
router.post("/refresh-token", refreshUserTokenController);

// ============ PROTECTED ROUTES ============

router.use(authenticate);

/**
 * @swagger
 * /api/users/verify:
 *   get:
 *     summary: Verify Access Token
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 */
// Verifying a token's validity is not a role-specific action - it's how
// AuthContext establishes "is anyone logged in" on every page load, for
// ANY role. Restricting it to a hardcoded hospital-domain role list meant
// any non-hospital role (Student, Teacher, ...) got 403'd here and the
// whole frontend treated them as logged out, even with a perfectly valid
// token. Only authenticate() (valid token required) belongs here.
router.get("/verify", verifyUserTokenController);

/**
 * @swagger
 * /api/users/verify:
 *   get:
 *     summary: Verify Access Token
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *       401:
 *         description: Invalid or expired token
 */
// NOTE: this is a duplicate registration of GET "/verify" (see the first
// one above, near line 381) - Express uses whichever matches first, so
// this second one is currently dead code. Left functionally consistent
// with the fix above rather than removed, in case route registration order
// changes later; worth deleting one of the two during cleanup.
router.get("/verify", authenticate, verifyUserTokenController);

/**
 * @swagger
 * /api/users/refresh-token:
 *   post:
 *     summary: Refresh Access Token
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token received during login
 *     responses:
 *       200:
 *         description: New access token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: integer
 *       403:
 *         description: Invalid refresh token
 */
router.post("/refresh-token", refreshUserTokenController);
/**
 * @swagger
 * /api/users/forgot-password:
 *   post:
 *     summary: Forgot Password
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *     responses:
 *       200:
 *         description: Password reset link sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPasswordController);

/**
 * @swagger
 * /api/users/reset-password:
 *   post:
 *     summary: Reset Password
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: New password (minimum 6 characters)
 *               confirmPassword:
 *                 type: string
 *                 description: Confirm new password
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error or invalid token
 *       500:
 *         description: Internal server error
 */
router.post("/reset-password", validate(resetPasswordSchema), resetPasswordController);

/**
 * @swagger
 * /api/users/{userId}/status:
 *   put:
 *     summary: Update User Active Status
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_active
 *             properties:
 *               is_active:
 *                 type: boolean
 *                 description: User active status
 *     responses:
 *       200:
 *         description: User status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put("/:userId/status", authorize(["super_admin", "hospital_admin"]), updateUserActiveStatusController);
// ============ USER MANAGEMENT ROUTES ============
// Static routes first (before parameterized routes)

/**
 * @swagger
 * /api/users/get-all-users:
 *   get:
 *     summary: List all users with pagination, search, and filters
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, username, phone, or staff_id
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [first_name, last_name, account_email, created_at, last_login, is_active, user_type]
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: role_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: user_type
 *         schema:
 *           type: string
 *           enum: [Internal, External]
 *       - in: query
 *         name: department_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 limit:
 *                   type: integer
 */
router.get("/get-all-users", authorize(["super_admin", "hospital_admin"]), validateQuery(userListQuerySchema), listUsersController);

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Get user statistics (counts by status, type, and role)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     active:
 *                       type: integer
 *                     inactive:
 *                       type: integer
 *                     internal:
 *                       type: integer
 *                     external:
 *                       type: integer
 *                     by_role:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           role_id:
 *                             type: integer
 *                           role_name:
 *                             type: string
 *                           count:
 *                             type: integer
 */
router.get("/stats", authorize(["super_admin", "hospital_admin"]), getUserStatsController);

/**
 * @swagger
 * /api/users/bulk-delete:
 *   post:
 *     summary: Soft-delete multiple users at once
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_ids
 *             properties:
 *               user_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 minItems: 1
 *                 maxItems: 100
 *     responses:
 *       200:
 *         description: Users deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted_count:
 *                       type: integer
 *                     requested_count:
 *                       type: integer
 */
router.post("/bulk-delete", authorize(["super_admin"]), validate(bulkDeleteSchema), bulkDeleteUsersController);

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Register a new user (admin-created with role assignment)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - account_email
 *               - password
 *               - first_name
 *               - last_name
 *               - role_id
 *             properties:
 *               account_email:
 *                 type: string
 *                 format: email
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Alias for account_email (frontend compatibility)
 *               password:
 *                 type: string
 *                 minLength: 8
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               role_id:
 *                 type: integer
 *               department_id:
 *                 type: integer
 *                 nullable: true
 *               user_type:
 *                 type: string
 *                 enum: [Internal, External]
 *                 default: Internal
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 nullable: true
 *               is_active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: User created successfully
 *       409:
 *         description: User with this email or username already exists
 */
router.post("/register", authorize(["super_admin", "hospital_admin"]), validate(createUserSchema), createUserByAdminController);

// Parameterized routes — specific before generic

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get a single user by ID (management view)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
// Self-service "my profile" (Settings > Profile). Always targets
// req.user.user_id, never a URL param — see getMyProfileService/
// updateMyProfileService in user_service.js for why this is deliberately
// NOT the same code path as the admin-only PUT "/:id" below (whitelisted
// fields only, role/role_id/is_active are never accepted here). Fixes
// AI-Education-Frontend's ProfileService, which has been silently POSTing
// to a route that never existed (/api/user/profile/update) — this was
// masked by UserContext.jsx's optimistic local update, so the Edit
// Profile modal looked like it worked while never actually persisting.
// Declared before GET "/:id" so "/me" isn't shadowed by it (same reason
// "/me/role" is declared before PUT "/:id" above).
router.get("/me", authenticate, getMyProfileController);
router.patch("/me", authenticate, validate(updateMyProfileSchema), updateMyProfileController);
router.post("/change-password", authenticate, validate(changeMyPasswordSchema), changeMyPasswordController);

router.get("/:id", authorize(["super_admin", "hospital_admin"]), getUserByIdController);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update a user by ID (admin)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               account_email:
 *                 type: string
 *                 format: email
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Alias for account_email
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               role_id:
 *                 type: integer
 *               department_id:
 *                 type: integer
 *                 nullable: true
 *               user_type:
 *                 type: string
 *                 enum: [Internal, External]
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 nullable: true
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *       409:
 *         description: Email or username already in use
 */
// Self-service: a user sets their OWN role (e.g. picking "Student" during
// onboarding). Only authenticate() — deliberately NOT authorize(), and
// deliberately NOT reusing PUT "/:id" below, which is admin-only and takes
// the target user id from the URL. Here the target is always req.user.user_id,
// and the service layer (updateOwnRole) rejects any role_id that isn't
// flagged is_self_assignable, so this can never be used to grant admin roles.
// Declared before PUT "/:id" so "/me/role" isn't shadowed by it.
router.put("/me/role", authenticate, validate(selfAssignRoleSchema), updateOwnRoleController);

router.put("/:id", authorize(["super_admin", "hospital_admin"]), validate(updateUserSchema), updateUserByAdminController);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Soft-delete a user by ID
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete("/:id", authorize(["super_admin"]), deleteUserController);

/**
 * @swagger
 * /api/users/{id}/activate:
 *   put:
 *     summary: Activate a user account
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User activated successfully
 *       404:
 *         description: User not found
 */
router.put("/:id/activate", authorize(["super_admin", "hospital_admin"]), activateUserController);

/**
 * @swagger
 * /api/users/{id}/deactivate:
 *   put:
 *     summary: Deactivate a user account
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deactivated successfully
 *       404:
 *         description: User not found
 */
router.put("/:id/deactivate", authorize(["super_admin", "hospital_admin"]), deactivateUserController);

/**
 * @swagger
 * /api/users/{id}/reset-password:
 *   post:
 *     summary: Admin reset a user's password
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       404:
 *         description: User not found
 */
router.post("/:id/reset-password", authorize(["super_admin"]), validate(adminResetPasswordSchema), adminResetPasswordController);

export default router;
