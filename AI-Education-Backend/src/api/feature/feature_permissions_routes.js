
import express from "express";
import {
  getAllFeaturePermissions,
  getFeaturePermissionsByRole,
  getFeaturePermissionsByUser,
  getFeaturePermissionsByFeature,
  getFeaturePermission,
  createFeaturePermission,
  updateFeaturePermission,
  deleteFeaturePermission,
  checkRoleFeaturePermission,
  bulkCreateFeaturePermissions,
  bulkUpdateFeaturePermissions,
  getRolesWithPermissionForFeature,
  getFeaturesWithPermissionForRole,
  clonePermissionsFromRoleController,
  clonePermissionsFromRoleToUserController,
  getModulesWithPermissions,
  getModulePermissionsById,
  getAllPermissionNames,
} from "./feature_permissions_controller.js";

import { authenticate } from "../../common/middlewares/auth_middleware.js";
import { rejectOrgScope } from "../../common/middlewares/organization_scope_guard.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Global table — reject organization_id on all feature_permissions routes
router.use(rejectOrgScope);

// ==================== MASTER PERMISSIONS API ====================

/**
 * @swagger
 * /api/feature-permissions/modules:
 *   get:
 *     summary: Get all features with permissions and category info
 *     description: Returns features with feature_id, feature_name, category_id, category_name, and permissions
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Features and permissions retrieved successfully
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
 *                   example: "Features and permissions retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       feature_id:
 *                         type: integer
 *                         example: 40
 *                       feature_name:
 *                         type: string
 *                         example: "Add Doctor"
 *                       category_id:
 *                         type: integer
 *                         example: 13
 *                       category_name:
 *                         type: string
 *                         example: "Settings"
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["can_create", "can_read", "can_update", "can_delete"]
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
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
router.get("/modules", getModulesWithPermissions);

/**
 * @swagger
 * /api/feature-permissions/modules/{featureId}:
 *   get:
 *     summary: Get single feature with permissions and category info
 *     description: Returns feature with feature_id, feature_name, category_id, category_name, and permissions
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Feature permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     feature_id:
 *                       type: integer
 *                     feature_name:
 *                       type: string
 *                     category_id:
 *                       type: integer
 *                     category_name:
 *                       type: string
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *       404:
 *         description: Feature not found
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
router.get("/modules/:featureId", getModulePermissionsById);

/**
 * @swagger
 * /api/feature-permissions/permission-names:
 *   get:
 *     summary: Get all unique permission names
 *     description: Returns all unique permission names across the system
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permission names retrieved successfully
 */
router.get("/permission-names", getAllPermissionNames);

/**
 * @swagger
 * components:
 *   schemas:
 *     PermissionRow:
 *       type: object
 *       required:
 *         - permission_name
 *         - is_enabled
 *       properties:
 *         permission_name:
 *           type: string
 *           pattern: ^can_[a-z0-9_]+$
 *           description: Permission key
 *           example: can_read
 *         permission_display_name:
 *           type: string
 *           nullable: true
 *           maxLength: 120
 *           description: Human-readable permission label
 *           example: Read
 *         permission_description:
 *           type: string
 *           nullable: true
 *           maxLength: 255
 *           description: Optional description of what the permission allows
 *           example: Read access to this feature
 *         is_enabled:
 *           type: boolean
 *           description: Whether this permission is granted
 *           example: true
 *     FeaturePermission:
 *       type: object
 *       properties:
 *         role_id:
 *           type: integer
 *           nullable: true
 *           description: ID of the role (null for user-specific override)
 *         user_id:
 *           type: integer
 *           nullable: true
 *           description: ID of the user (null for role-based permission)
 *         feature_id:
 *           type: integer
 *           description: ID of the feature
 *         permissions:
 *           type: array
 *           description: Permission rows assigned for the role/user and feature
 *           items:
 *             $ref: '#/components/schemas/PermissionRow'
 *     CreateFeaturePermissionRequest:
 *       type: object
 *       required:
 *         - feature_id
 *         - permissions
 *       description: Either role_id or user_id is required.
 *       oneOf:
 *         - required: [role_id]
 *         - required: [user_id]
 *       properties:
 *         role_id:
 *           type: integer
 *           description: ID of the role
 *         user_id:
 *           type: integer
 *           description: ID of the user override target
 *         feature_id:
 *           type: integer
 *           description: ID of the feature
 *         permissions:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: '#/components/schemas/PermissionRow'
 *       example:
 *         role_id: 1
 *         feature_id: 69
 *         permissions:
 *           - permission_name: can_read
 *             permission_display_name: Read
 *             permission_description: Read access
 *             is_enabled: true
 *           - permission_name: can_create
 *             permission_display_name: Create
 *             permission_description: Create access
 *             is_enabled: true
 *     UpdateFeaturePermissionRequest:
 *       type: object
 *       required:
 *         - permissions
 *       properties:
 *         permissions:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: '#/components/schemas/PermissionRow'
 *       example:
 *         permissions:
 *           - permission_name: can_update
 *             permission_display_name: Update
 *             permission_description: Update access
 *             is_enabled: true
 *     BulkFeaturePermissionsRequest:
 *       type: object
 *       required:
 *         - permissions
 *       properties:
 *         permissions:
 *           type: array
 *           items:
 *             type: object
 *             description: Either role_id or user_id is required.
 *             oneOf:
 *               - required: [role_id]
 *               - required: [user_id]
 *             required:
 *               - feature_id
 *               - permissions
 *             properties:
 *               role_id:
 *                 type: integer
 *                 description: ID of the role
 *               user_id:
 *                 type: integer
 *                 description: ID of the user override target
 *               feature_id:
 *                 type: integer
 *                 description: ID of the feature
 *               permissions:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   $ref: '#/components/schemas/PermissionRow'
 *       example:
 *         permissions:
 *           - role_id: 1
 *             feature_id: 69
 *             permissions:
 *               - permission_name: can_read
 *                 permission_display_name: Read
 *                 permission_description: Read access
 *                 is_enabled: true
 *               - permission_name: can_delete
 *                 permission_display_name: Delete
 *                 permission_description: Delete access
 *                 is_enabled: false
 *     PermissionCheckResponse:
 *       type: object
 *       properties:
 *         role_id:
 *           type: integer
 *         feature_id:
 *           type: integer
 *         permission:
 *           type: string
 *           pattern: ^can_[a-z0-9_]+$
 *           example: can_read
 *         hasPermission:
 *           type: boolean
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           type: object
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
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



/**
 * @swagger
 * /api/feature-permissions:
 *   get:
 *     summary: Get all feature permissions
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feature permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FeaturePermission'
 */
router.get("/", getAllFeaturePermissions);

/**
 * @swagger
 * /api/feature-permissions/role/{roleId}:
 *   get:
 *     summary: Get feature permissions for a specific role
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the role
 *     responses:
 *       200:
 *         description: Feature permissions for role retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FeaturePermission'
 *       400:
 *         description: Validation failed
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/role/:roleId", getFeaturePermissionsByRole);

/**
 * @swagger
 * /api/feature-permissions/user/{userId}:
 *   get:
 *     summary: Get feature permissions by user ID
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user
 *     responses:
 *       200:
 *         description: Feature permissions for user retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FeaturePermission'
 *       400:
 *         description: Validation failed
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/user/:userId", getFeaturePermissionsByUser);

/**
 * @swagger
 * /api/feature-permissions/feature/{featureId}:
 *   get:
 *     summary: Get feature permissions for a specific feature
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the feature
 *     responses:
 *       200:
 *         description: Feature permissions for feature retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FeaturePermission'
 *       400:
 *         description: Validation failed
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/feature/:featureId", getFeaturePermissionsByFeature);

/**
 * @swagger
 * /api/feature-permissions/check/{roleId}/{featureId}/{permission}:
 *   get:
 *     summary: Check if a role has a specific permission for a feature
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the role
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the feature
 *       - in: path
 *         name: permission
 *         required: true
 *         schema:
 *           type: string
 *           pattern: ^can_[a-z0-9_]+$
 *           example: can_read
 *         description: Permission type to check
 *     responses:
 *       200:
 *         description: Permission check completed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/PermissionCheckResponse'
 *       400:
 *         description: Validation failed
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/check/:roleId/:featureId/:permission",
  checkRoleFeaturePermission
);

/**
 * @swagger
 * /api/feature-permissions/roles-with-permission/{featureId}/{permission}:
 *   get:
 *     summary: Get roles that have a specific permission for a feature
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the feature
 *       - in: path
 *         name: permission
 *         required: true
 *         schema:
 *           type: string
 *           pattern: ^can_[a-z0-9_]+$
 *           example: can_read
 *         description: Permission type
 *     responses:
 *       200:
 *         description: Roles with permission retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           role_id:
 *                             type: integer
 *                           role_name:
 *                             type: string
 *       400:
 *         description: Validation failed
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/roles-with-permission/:featureId/:permission",
  getRolesWithPermissionForFeature
);

/**
 * @swagger
 * /api/feature-permissions/features-with-permission/{roleId}/{permission}:
 *   get:
 *     summary: Get features that a role has a specific permission for
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the role
 *       - in: path
 *         name: permission
 *         required: true
 *         schema:
 *           type: string
 *           pattern: ^can_[a-z0-9_]+$
 *           example: can_read
 *         description: Permission type
 *     responses:
 *       200:
 *         description: Features with permission retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           feature_id:
 *                             type: integer
 *                           feature_name:
 *                             type: string
 *       400:
 *         description: Validation failed
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/features-with-permission/:roleId/:permission",
  getFeaturesWithPermissionForRole
);

/**
 * @swagger
 * /api/feature-permissions/{roleId}/{featureId}:
 *   get:
 *     summary: Get a specific feature permission
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the role
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the feature
 *     responses:
 *       200:
 *         description: Feature permission retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/FeaturePermission'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Permission not found
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:roleId/:featureId", getFeaturePermission);

/**
 * @swagger
 * /api/feature-permissions:
 *   post:
 *     summary: Create a new feature permission
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFeaturePermissionRequest'
 *     responses:
 *       201:
 *         description: Feature permission created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/FeaturePermission'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Duplicate resource
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", createFeaturePermission);

/**
 * @swagger
 * /api/feature-permissions/{roleId}/{featureId}:
 *   put:
 *     summary: Update an existing feature permission
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the role
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the feature
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateFeaturePermissionRequest'
 *     responses:
 *       200:
 *         description: Feature permission updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/FeaturePermission'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Permission not found
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  "/:roleId/:featureId",
  updateFeaturePermission
);

/**
 * @swagger
 * /api/feature-permissions/{roleId}/{featureId}:
 *   delete:
 *     summary: Delete a feature permission
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the role
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the feature
 *     responses:
 *       200:
 *         description: Feature permission deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: null
 *       400:
 *         description: Validation failed
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:roleId/:featureId", deleteFeaturePermission);

/**
 * @swagger
 * /api/feature-permissions/bulk:
 *   post:
 *     summary: Bulk create feature permissions
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkFeaturePermissionsRequest'
 *     responses:
 *       201:
 *         description: Bulk feature permissions creation completed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         created:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/FeaturePermission'
 *       400:
 *         description: Validation failed
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/bulk", bulkCreateFeaturePermissions);

/**
 * @swagger
 * /api/feature-permissions/bulk:
 *   put:
 *     summary: Bulk update feature permissions
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkFeaturePermissionsRequest'
 *     responses:
 *       200:
 *         description: Bulk feature permissions update completed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         updated:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/FeaturePermission'
 *       400:
 *         description: Validation failed
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/bulk", bulkUpdateFeaturePermissions);

/**
 * @swagger
 * /api/feature-permissions/clone/{sourceRoleId}/{targetRoleId}:
 *   post:
 *     summary: Clone permissions from one role to another
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sourceRoleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the source role
 *       - in: path
 *         name: targetRoleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the target role
 *     responses:
 *       201:
 *         description: Permissions cloned successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FeaturePermission'
 *       400:
 *         description: Validation failed
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/clone/:sourceRoleId/:targetRoleId", clonePermissionsFromRoleController);

/**
 * @swagger
 * /api/feature-permissions/clone-role/{sourceRoleId}/user/{targetUserId}:
 *   post:
 *     summary: Clone permissions from a role to a user
 *     tags: [Feature Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sourceRoleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the source role
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the target user
 *     responses:
 *       201:
 *         description: Role permissions cloned to user successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FeaturePermission'
 *       400:
 *         description: Validation failed
 *         content:
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/clone-role/:sourceRoleId/user/:targetUserId", clonePermissionsFromRoleToUserController);

export default router;
