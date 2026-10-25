import express from "express";
import {
  getAllFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  deleteFeature,
  getFeaturesByCategory,
  getCategoriesListController,
  bulkDeleteFeatureController,
  getFeatureCategoryById,
  getFeaturesStatsController,
  activateFeature,
  deactivateFeature
} from "./feature_controller.js";


import {
  validateCreateFeature,
  validateUpdateFeature,
  validateFeatureId,
  validateCategory,
} from "./feature_validation.js";

import { getCategoryDropdownController } from "./feature_category_controller.js";



import { authenticate, authorize } from "../../common/middlewares/auth_middleware.js";
import { checkPermission } from "../../common/middlewares/rbac_middleware.js";
import queryParser from "../../common/middlewares/queryParser.js";
import { rejectOrgScope } from "../../common/middlewares/organization_scope_guard.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Global table — reject organization_id on all feature routes
router.use(rejectOrgScope);

/**
 * @swagger
 * /api/features:
 *   get:
 *     summary: Get all features with pagination, filtering and sorting
 *     description: |
 *       Retrieve features with optional pagination, filtering, and sorting.
 *       If no query parameters are provided, returns all active features without pagination.
 *       With query parameters, returns paginated results with filtering and sorting capabilities.
 *       Each feature includes a permissions array defining available actions.
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-organization-id
 *         schema:
 *           type: integer
 *         description: |
 *           Organization ID. When set, features that have been explicitly disabled for this
 *           organization via org subscription feature overrides are filtered out from the response.
 *           This is used by the Angular/React UI to hide features disabled by the admin portal.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Global search across feature_name, description, and category (partial match)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort by field and order (e.g. `feature_name:asc` or `created_at:desc`). All feature fields are sortable.
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Fallback sort field when `sort` is not provided
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Fallback sort order when `sort` is not provided
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page (max 100)
 *       - in: query
 *         name: feature_name
 *         schema:
 *           type: string
 *         description: Filter by feature name (partial match)
 *       - in: query
 *         name: description
 *         schema:
 *           type: string
 *         description: Filter by description (partial match)
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *         description: Filter by category ID (exact match)
 *       - in: query
 *         name: parent_feature_id
 *         schema:
 *           type: integer
 *         description: Filter by parent feature ID (exact match)
 *       - in: query
 *         name: feature_availability
 *         schema:
 *           type: string
 *           enum: [REACT, ANGULAR, BOTH]
 *         description: Filter by portal availability
 *       - in: query
 *         name: show_in_menu
 *         schema:
 *           type: boolean
 *         description: Filter by show in menu status (exact match)
 *       - in: query
 *         name: menu_label
 *         schema:
 *           type: string
 *         description: Filter by menu label (partial match)
 *       - in: query
 *         name: menu_icon
 *         schema:
 *           type: string
 *         description: Filter by menu icon (partial match)
 *       - in: query
 *         name: router_link
 *         schema:
 *           type: string
 *         description: Filter by router link (partial match)
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status (exact match)
 *       - in: query
 *         name: is_deleted
 *         schema:
 *           type: boolean
 *         description: Filter by deleted status (exact match)
 *       - in: query
 *         name: created_by
 *         schema:
 *           type: integer
 *         description: Filter by creator user ID (exact match)
 *       - in: query
 *         name: created_at
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by created date (whole day, e.g. 2026-02-17)
 *       - in: query
 *         name: created_at_from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter created_at >= this date
 *       - in: query
 *         name: created_at_to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter created_at <= this date
 *       - in: query
 *         name: updated_at
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by updated date (whole day, e.g. 2026-02-17)
 *       - in: query
 *         name: updated_at_from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter updated_at >= this date
 *       - in: query
 *         name: updated_at_to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter updated_at <= this date
 *     responses:
 *       200:
 *         description: Features retrieved successfully
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
 *                   example: "Features retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       feature_id:
 *                         type: integer
 *                       feature_name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       category_id:
 *                         type: integer
 *                         nullable: true
 *                       parent_feature_id:
 *                         type: integer
 *                         nullable: true
 *                       availability_types:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             availability_type_id:
 *                               type: integer
 *                             code:
 *                               type: string
 *                             name:
 *                               type: string
 *                       show_in_menu:
 *                         type: boolean
 *                       menu_label:
 *                         type: string
 *                       menu_icon:
 *                         type: string
 *                       router_link:
 *                         type: string
 *                         nullable: true
 *                       menu_order:
 *                         type: integer
 *                       is_active:
 *                         type: boolean
 *                       is_deleted:
 *                         type: boolean
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["create", "read", "update", "delete"]
 *                         description: Available permissions for the feature
 *                       created_by:
 *                         type: integer
 *                         nullable: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Validation error for query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", queryParser, checkPermission('Features', 'read'), getAllFeatures);

/**
 * @swagger
 * /api/features/category/{categoryId}:
 *   get:
 *     summary: Get features by category
 *     description: Retrieve all active features that belong to a specific category ID
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Feature category ID to filter by
 *         example: 1
 *     responses:
 *       200:
 *         description: Features retrieved successfully
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
 *                   example: "Features retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       feature_id:
 *                         type: integer
 *                       feature_name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       category_id:
 *                         type: integer
 *                         nullable: true
 *                       availability_types:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             availability_type_id:
 *                               type: integer
 *                             code:
 *                               type: string
 *                             name:
 *                               type: string
 *                       is_active:
 *                         type: boolean
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["create", "read", "update", "delete"]
 *                         description: Available permissions for the feature
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *             example:
 *               success: true
 *               message: "Features retrieved successfully"
 *               data:
 *                 - feature_id: 1
 *                   feature_name: "Billing"
 *                   description: "Handles billing operations"
 *                   category_id: 1
 *                   is_active: true
 *                   permissions: ["create", "read", "update", "delete", "can_export"]
 *                   created_at: "2023-01-01T00:00:00.000Z"
 *                   updated_at: "2023-01-01T00:00:00.000Z"
 *       400:
 *         description: Validation error for category parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/category/:categoryId", checkPermission('Features', 'read'), getFeaturesByCategory);

/**
 * @swagger
 * /api/features/stats:
 *   get:
 *     summary: Get feature statistics
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feature statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/stats", checkPermission('Features', 'read'), getFeaturesStatsController);

/**
 * @swagger
 * /api/features/categories-list:
 *   get:
 *     summary: Get all feature categories
 *     description: Retrieve all feature categories with optional pagination and filtering
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by category name (partial match)
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Feature categories retrieved successfully
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
 *                   example: "Feature categories retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category_id:
 *                         type: integer
 *                       category_name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       is_active:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       400:
 *         description: Validation error for query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/categories-list", queryParser, checkPermission('Features', 'read'), getCategoriesListController);
router.get("/categories/dropdown", checkPermission('Features', 'read'), getCategoryDropdownController);


/**
 * @swagger
 * /api/features/{id}:
 *   get:
 *     summary: Get feature by ID
 *     description: Retrieve a single feature by its unique identifier
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Unique identifier of the feature
 *         example: 1
 *     responses:
 *       200:
 *         description: Feature retrieved successfully
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
 *                   example: "Feature retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     feature_id:
 *                       type: integer
 *                     feature_name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     category_id:
 *                       type: integer
 *                       nullable: true
 *                     is_active:
 *                       type: boolean
 *                     parent_feature_id:
 *                       type: integer
 *                       nullable: true
 *                     show_in_menu:
 *                       type: boolean
 *                     menu_label:
 *                       type: string
 *                     menu_icon:
 *                       type: string
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["view", "create", "edit", "delete", "can_export"]
 *                       description: Available permissions for the feature
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *             example:
 *               success: true
 *               message: "Feature retrieved successfully"
 *               data:
 *                 feature_id: 1
 *                 feature_name: "Billing"
 *                 description: "Handles billing operations"
 *                 category_id: 1
 *                 parent_feature_id: null
 *                 show_in_menu: true
 *                 menu_label: "Billing Management"
 *                 menu_icon: "billing-icon"
 *                 is_active: true
 *                 permissions: ["create", "read", "update", "delete", "can_export"]
 *                 created_at: "2023-01-01T00:00:00.000Z"
 *                 updated_at: "2023-01-01T00:00:00.000Z"
 *       400:
 *         description: Validation error for ID parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Feature not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Feature not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:id", checkPermission('Features', 'read'), getFeatureById);

/**
 * @swagger
 * /api/features:
 *   post:
 *     summary: Create a new feature
 *     description: |
 *       Create a new feature with optional permissions configuration.
 *       The `permissions` array defines which actions all roles will have
 *       on this feature. Values are case-insensitive and automatically
 *       normalised to `can_<name>` format (e.g. READ → can_read, EXPORT → can_export).
 *       Defaults to [READ, CREATE, UPDATE, DELETE] when omitted.
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - feature_name
 *             properties:
 *               feature_name:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Doctor Management"
 *               availability_type_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2]
 *                 description: Array of availability type IDs for multi-platform support
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Manage doctors"
 *               category_id:
 *                 type: integer
 *                 example: 2
 *               parent_id:
 *                 example: 13
 *               parent_feature_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *               show_in_menu:
 *                 type: boolean
 *                 default: false
 *                 example: true
 *               menu_label:
 *                 type: string
 *                 maxLength: 100
 *                 nullable: true
 *                 example: "Doctors"
 *               menu_icon:
 *                 type: string
 *                 maxLength: 200
 *                 nullable: true
 *                 example: "pi pi-users"
 *               router_link:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 example: "/doctors"
 *               menu_order:
 *                 type: integer
 *                 default: 0
 *                 example: 18
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *               permissions:
 *                 type: array
 *                 description: |
 *                   Permission names to assign to all roles for this feature.
 *                   Values are normalised automatically (READ → can_read, APPROVE → can_approve).
 *                 items:
 *                   type: string
 *                 example: ["READ", "CREATE", "UPDATE", "DELETE", "APPROVE"]
 *     responses:
 *       201:
 *         description: Feature created successfully
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
 *                   example: "Feature created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     feature_id:
 *                       type: integer
 *                     feature_name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     category_id:
 *                       type: integer
 *                       nullable: true
 *                     feature_availability:
 *                       type: string
 *                       enum: [REACT, ANGULAR, BOTH]
 *                     parent_feature_id:
 *                       type: integer
 *                       nullable: true
 *                     show_in_menu:
 *                       type: boolean
 *                     menu_label:
 *                       type: string
 *                     menu_icon:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *             example:
 *               success: true
 *               message: "Feature created successfully"
 *               data:
 *                 feature_id: 1
 *                 feature_name: "Billing"
 *                 description: "Handles billing operations"
 *                 category_id: 1
 *                 availability_types:
 *                   - availability_type_id: 1
 *                     code: "REACT"
 *                     name: "React Web App"
 *                   - availability_type_id: 2
 *                     code: "ANGULAR"
 *                     name: "Angular Web App"
 *                 parent_feature_id: null
 *                 show_in_menu: true
 *                 menu_label: "menu.doctor"
 *                 menu_icon: "pi pi-users"
 *                 is_active: true
 *                 permissions: ["READ", "CREATE", "UPDATE", "DELETE"]
 *                 created_at: "2023-01-01T00:00:00.000Z"
 *                 updated_at: "2023-01-01T00:00:00.000Z"
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Feature already exists (duplicate feature_name)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Feature already exists"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", checkPermission('Features', 'create'), createFeature);

/**
 * @swagger
 * /api/features/{id}:
 *   put:
 *     summary: Update a feature
 *     description: |
 *       Update an existing feature with optional permissions configuration.
 *       Providing `permissions` replaces the allowed action set for all roles
 *       on this feature. Values are normalised to `can_<name>` format automatically.
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Unique identifier of the feature to update
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               feature_name:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Doctor Management"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Manage doctors"
 *               category_id:
 *                 type: integer
 *                 example: 2
 *               availability_type_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2]
 *                 description: Array of availability type IDs for multi-platform support
 *               parent_id:
 *                 example: 13
 *               parent_feature_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *               show_in_menu:
 *                 type: boolean
 *                 example: true
 *               menu_label:
 *                 type: string
 *                 maxLength: 100
 *                 nullable: true
 *                 example: "Doctors"
 *               menu_icon:
 *                 type: string
 *                 maxLength: 200
 *                 nullable: true
 *                 example: "pi pi-users"
 *               router_link:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 example: "/doctors"
 *               menu_order:
 *                 type: integer
 *                 example: 18
 *               is_active:
 *                 type: boolean
 *                 example: true
 *               permissions:
 *                 type: array
 *                 description: |
 *                   New permission names to apply to all roles for this feature.
 *                   Values are normalised automatically (READ → can_read, EXPORT → can_export).
 *                 items:
 *                   type: string
 *                 example: ["READ", "CREATE", "UPDATE", "DELETE"]
 *     responses:
 *       200:
 *         description: Feature updated successfully
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
 *                   example: "Feature updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     feature_id:
 *                       type: integer
 *                     feature_name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     category_id:
 *                       type: integer
 *                       nullable: true
 *                     feature_availability:
 *                       type: string
 *                       enum: [REACT, ANGULAR, BOTH]
 *                     parent_feature_id:
 *                       type: integer
 *                       nullable: true
 *                     show_in_menu:
 *                       type: boolean
 *                     menu_label:
 *                       type: string
 *                     menu_icon:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *             example:
 *               success: true
 *               message: "Feature updated successfully"
 *               data:
 *                 feature_id: 1
 *                 feature_name: "Advanced Billing"
 *                 description: "Advanced billing operations with enhanced features"
 *                 category_id: 1
 *                 availability_types:
 *                   - availability_type_id: 1
 *                     code: "REACT"
 *                     name: "React Web App"
 *                   - availability_type_id: 2
 *                     code: "ANGULAR"
 *                     name: "Angular Web App"
 *                 parent_feature_id: null
 *                 show_in_menu: true
 *                 menu_label: "Advanced Billing Management"
 *                 menu_icon: "advanced-billing-icon"
 *                 is_active: true
 *                 permissions: ["create", "read", "update", "delete", "can_export", "can_approve"]
 *                 created_at: "2023-01-01T00:00:00.000Z"
 *                 updated_at: "2023-01-02T00:00:00.000Z"
 *       400:
 *         description: Invalid input data or ID parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Feature not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Feature not found"
 *       409:
 *         description: Feature name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Feature name already exists"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:id", checkPermission('Features', 'update'), updateFeature);

/**
 * @swagger
 * /api/features/bulk-delete:
 *   delete:
 *     summary: Bulk delete features
 *     description: |
 *       Bulk delete features. Behavior depends on user role:
 *       - **super_admin**: Performs global soft delete (is_deleted=true) for all listed features.
 *       - **hospital_admin**: Disables all listed features for the requesting user's organization only (via subscription overrides).
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - feature_ids
 *             properties:
 *               feature_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 minItems: 1
 *                 uniqueItems: true
 *                 example: [1, 2, 3]
 *                 description: Array of feature IDs to delete
 *     responses:
 *       200:
 *         description: Features deleted successfully
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
 *                   example: "Features deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_requested:
 *                       type: integer
 *                       example: 3
 *                       description: Number of feature IDs requested for deletion
 *                     total_deleted:
 *                       type: integer
 *                       example: 3
 *                       description: Number of features actually deleted
 *       400:
 *         description: Validation error or invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: No features found to delete
 *       500:
 *         description: Internal server error
 */
router.delete("/bulk-delete", checkPermission('Features', 'delete'), bulkDeleteFeatureController);

/**
 * @swagger
 * /api/features/{id}:
 *   delete:
 *     summary: Delete a feature
 *     description: |
 *       Delete a feature. Behavior depends on user role:
 *       - **super_admin**: Performs a global soft delete (is_deleted=true). The feature is removed for ALL organizations.
 *       - **hospital_admin**: Disables the feature for the requesting user's organization only (via subscription override). The global feature remains intact for other organizations.
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Unique identifier of the feature to delete
 *         example: 1
 *     responses:
 *       200:
 *         description: Feature deleted successfully
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
 *                   example: "Feature deleted successfully"
 *       400:
 *         description: Validation error for ID parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Feature not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Feature not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:id", checkPermission('Features', 'delete'), deleteFeature);

/**
 * @swagger
 * /api/features/categories/{categoryId}:
 *   get:
 *     summary: Get feature category by ID
 *     description: Retrieve a single feature category by its unique identifier
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Unique identifier of the feature category
 *         example: 1
 *     responses:
 *       200:
 *         description: Feature category retrieved successfully
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
 *                   example: "Feature category retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     category_id:
 *                       type: integer
 *                     category_name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error for ID parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Feature category not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Resource not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/categories/:categoryId", checkPermission('Features', 'read'), getFeatureCategoryById);

/**
 * @swagger
 * /api/features/categories:
 *   post:
 *     summary: Create a new feature category
 *     description: Create a new feature category with a name and optional description
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category_name
 *             properties:
 *               category_name:
 *                 type: string
 *                 maxLength: 50
 *                 example: "Finance"
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Finance related features"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Feature category created successfully
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
 *                   example: "Feature category created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     category_id:
 *                       type: integer
 *                     category_name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Feature category already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Duplicate resource"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// router.post("/categories", checkPermission('Features', 'create'), createFeatureCategory); // REMOVED - Legacy CRUD

/**
 * @swagger
 * /api/features/categories/{categoryId}:
 *   put:
 *     summary: Update a feature category
 *     description: Update an existing feature category with new data
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Unique identifier of the feature category to update
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category_name:
 *                 type: string
 *                 maxLength: 50
 *                 example: "Finance"
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Updated finance related features"
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Feature category updated successfully
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
 *                   example: "Feature category updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     category_id:
 *                       type: integer
 *                     category_name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid input data or ID parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Feature category not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Resource not found"
 *       409:
 *         description: Feature category name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Duplicate resource"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// router.put("/categories/:categoryId", checkPermission('Features', 'update'), updateFeatureCategory); // REMOVED - Legacy CRUD

/**
 * @swagger
 * /api/features/categories/{categoryId}:
 *   delete:
 *     summary: Delete a feature category
 *     description: Delete a feature category by marking it as deleted
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Unique identifier of the feature category to delete
 *         example: 1
 *     responses:
 *       200:
 *         description: Feature category deleted successfully
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
 *                   example: "Feature category deleted successfully"
 *       400:
 *         description: Validation error for ID parameter or cannot delete
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Feature category not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Resource not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// router.delete("/categories/:categoryId", checkPermission('Features', 'delete'), deleteFeatureCategory); // REMOVED - Legacy CRUD

/**
 * @swagger
 * /api/features/{id}/activate:
 *   patch:
 *     summary: Activate a feature
 *     description: Set is_active to true for a specific feature
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Unique identifier of the feature to activate
 *         example: 1
 *     responses:
 *       200:
 *         description: Feature activated successfully
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
 *                   example: "Feature activated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     feature_id:
 *                       type: integer
 *                     is_active:
 *                       type: boolean
 *       400:
 *         description: Feature already active
 *       404:
 *         description: Feature not found
 */
router.patch("/:id/activate", checkPermission('Features', 'update'), activateFeature);

/**
 * @swagger
 * /api/features/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a feature
 *     description: Set is_active to false for a specific feature
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Unique identifier of the feature to deactivate
 *         example: 1
 *     responses:
 *       200:
 *         description: Feature deactivated successfully
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
 *                   example: "Feature deactivated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     feature_id:
 *                       type: integer
 *                     is_active:
 *                       type: boolean
 *       400:
 *         description: Feature already inactive
 *       404:
 *         description: Feature not found
 */
router.patch("/:id/deactivate", checkPermission('Features', 'update'), deactivateFeature);

export default router;
