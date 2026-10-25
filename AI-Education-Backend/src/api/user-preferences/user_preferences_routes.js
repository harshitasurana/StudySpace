import express from "express";
import {
  getPreferenceByKeyController,
  getPreferenceByModuleController,
  savePreferenceController,
  globalToggleController,

  resetPreferenceByKeyController,
  resetAllPreferencesController,
  getAllPreferencesController,
  togglePreferenceController
} from "./user_preferences_controller.js";
import { authenticate } from "../../common/middlewares/auth_middleware.js";
import { validateBody, validateQuery } from "../../common/middlewares/validate.js";
import userPreferenceValidation from "./user_preferences_validation.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * Handler for GET /
 * - ?key=theme → get single preference
 * - ?module=appointments → get all preferences for module
 * - nothing → get all preferences
 */
const handleGetPreferences = (req, res) => {
  // If key is provided, get single preference
  if (req.query.key) {
    const { error } = userPreferenceValidation.queryKey.validate(req.query, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: 'Query validation failed',
        details: error.details.map(detail => detail.message)
      });
    }
    return getPreferenceByKeyController(req, res);
  }
  
  // If module is provided, get all preferences for that module
  if (req.query.module) {
    const { error } = userPreferenceValidation.queryModule.validate(req.query, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: 'Query validation failed',
        details: error.details.map(detail => detail.message)
      });
    }
    return getPreferenceByModuleController(req, res);
  }
  
  // Otherwise, get all preferences
  return getAllPreferencesController(req, res);
};

/**
 * @swagger
 * components:
 *   schemas:
 *     AnyJSON:
 *       type: object
 *       additionalProperties: true
 *       description: Any JSON object
 *
 * /api/user-preferences:
 *   get:
 *     summary: Get user preferences (ANY key supported)
 *     tags: [User Preferences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: key
 *         required: false
 *         schema:
 *           type: string
 *         description: Specific preference key (e.g., "ui_preferences")
 *       - in: query
 *         name: module
 *         required: false
 *         schema:
 *           type: string
 *         description: Module name (legacy support)
 *       - in: query
 *         name: include_defaults
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Include default preferences
 *     responses:
 *       200:
 *         description: Preference(s) retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 preference:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                     user_id:
 *                       type: number
 *                     preference_key:
 *                       type: string
 *                     preference_value:
 *                       $ref: '#/components/schemas/AnyJSON'
 *                     is_enabled:
 *                       type: boolean
 *                     isDefault:
 *                       type: boolean
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         created_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         updated_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         created_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 *         updated_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 */
router.get("/", handleGetPreferences);


/**
 * @swagger
 * /api/user-preferences:
 *   post:
 *     summary: Save or update single user preference (ANY JSON accepted)
 *     tags: [User Preferences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - preference_key
 *               - preference_value
 *             properties:
 *               preference_key:
 *                 type: string
 *                 example: "ui_preferences"
 *               preference_value:
 *                 type: object
 *                 description: Any JSON object (layout, filters, sidebar, etc.)
 *                 example: {
 *                   "layout": {"preset": "Aura", "primary": "sky"},
 *                   "language": "en",
 *                   "filters": {"feature-table": {"global": "Staff"}},
 *                   "tableColumns": {},
 *                   "sidebar": {"collapsed": false}
 *                 }
 *     responses:
 *       200:
 *         description: Preference saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 preference:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                     user_id:
 *                       type: number
 *                     preference_key:
 *                       type: string
 *                     preference_value:
 *                       $ref: '#/components/schemas/AnyJSON'
 *                     is_enabled:
 *                       type: boolean
 *                     action:
 *                       type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         created_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         updated_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         created_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 *         updated_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 */
router.post(
  "/",
  validateBody(userPreferenceValidation.savePreference),
  savePreferenceController
);

/**
 * @swagger
 * /api/user-preferences/toggle:
 *   patch:
 *     summary: Enable or disable a user preference
 *     tags: [User Preferences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - is_enabled
 *             properties:
 *               key:
 *                 type: string
 *                 example: "ui_preferences"
 *               is_enabled:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Preference updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 preference:
 *                   type: object
 *                   properties:
 *                     preference_key:
 *                       type: string
 *                     preference_value:
 *                       $ref: '#/components/schemas/AnyJSON'
 *                     is_enabled:
 *                       type: boolean
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Preference not found
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         created_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         updated_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         created_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 *         updated_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 */
router.patch(
  "/toggle",
  validateBody(userPreferenceValidation.togglePreference),
  togglePreferenceController
);

/**
 * @swagger
 * /api/user-preferences/global-toggle:
 *   patch:
 *     summary: Global toggle ALL user preferences
 *     tags: [User Preferences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_enabled
 *             properties:
 *               is_enabled:
 *                 type: boolean
 *                 example: false
 *                 description: Enable (true) or disable (false) ALL preferences
 *     responses:
 *       200:
 *         description: All preferences toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 affectedCount:
 *                   type: integer
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         created_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         updated_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         created_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 *         updated_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 */
router.patch(
  "/global-toggle",
  validateBody(userPreferenceValidation.globalToggle),
  globalToggleController
);




/**
 * @swagger
 * /api/user-preferences:
 *   delete:
 *     summary: Reset user preference to default
 *     tags: [User Preferences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: preference_key
 *         required: true
 *         schema:
 *           type: string
 *           example: "ui_preferences"
 *         description: Preference key to reset
 *     responses:
 *       200:
 *         description: Preference reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Preference reset successfully"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         created_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         updated_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         created_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 *         updated_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 */
router.delete(
  "/",
  validateQuery(userPreferenceValidation.deleteQuery),
  resetPreferenceByKeyController
);

/**
 * @swagger
 * /api/user-preferences/batch:
 *   delete:
 *     summary: Reset all user preferences to default
 *     description: Resets (deletes) all user-specific preference overrides for the authenticated user. The next time preferences are requested, the system defaults will be returned.
 *     tags: [User Preferences]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All preferences reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "All preferences reset to defaults successfully"
 *                 deletedCount:
 *                   type: integer
 *                   example: 5
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         created_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         updated_by:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         created_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 *         updated_by_name:
 *           type: string
 *           nullable: true
 *           example: "Admin User"
 */
router.delete(
  "/batch",
  resetAllPreferencesController
);

export default router;
