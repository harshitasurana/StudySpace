import express from "express";
import {
  getRolesController,
  getRoleByIdController,
  createRoleController,
  updateRoleController,
  deleteRoleController,
  bulkDeleteRolesController,
  updateRolePermissionsController,
  restoreRoleController,
  getDeletedRolesController,
  getOrganizationStaffRolesController,
  getRolesStatsController,
  bulkActionController,
  assignFeatureToRoleController,
  removeFeatureFromRoleController,
  getRoleFeaturesController,
  getAvailableFeaturesForRoleController,
  getRoleCategoriesController,
  activateRoleController,
  deactivateRoleController,
  getPublicRolesController,
} from "./role_controller.js";
import { authenticate, authorize } from "../../common/middlewares/auth_middleware.js";
import { checkPermission } from "../../common/middlewares/rbac_middleware.js";
import queryParser from "../../common/middlewares/queryParser.js";
import {
  getAllRoleTemplates,
  getRoleTemplatesWithPagination,
  getRoleTemplateById,
  createRoleTemplate,
  updateRoleTemplate,
  deleteRoleTemplate
} from "./role_template_controller.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Self-service: any authenticated user can list roles flagged
// is_self_assignable (e.g. Student under the Education category). Used by
// onboarding's role-selection step.
//
// IMPORTANT: this MUST be declared here, before router.use(checkPermission(...))
// below. router.use() applies to every route registered AFTER it on this
// router, regardless of that route's own middleware — so if this line were
// moved below checkPermission (as it originally was), every call would get
// rejected with "User role not found or invalid" / 403, because a fresh
// self-registered user has no 'Roles:read' feature permission and isn't
// meant to need one just to see the self-assignable role list.
//
// Do not add authorize()/checkPermission() to this route, and do not merge
// it with GET "/" below (admin-only, full role data). Also keep it above
// GET "/:id" and other param routes so "/public" isn't swallowed by them.
router.get("/public", getPublicRolesController);

// Apply authorization to all remaining routes below this point
router.use(checkPermission('Roles', 'read'));

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
 *           example: can_read
 *         permission_display_name:
 *           type: string
 *           example: Read
 *         permission_description:
 *           type: string
 *           example: Read access
 *         is_enabled:
 *           type: boolean
 *           example: true
 *     FeaturePermissionObject:
 *       type: object
 *       required:
 *         - feature_id
 *         - permissions
 *       properties:
 *         feature_id:
 *           type: integer
 *           description: ID of the feature
 *         permissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PermissionRow'
 *     CreateRoleRequest:
 *       type: object
 *       required:
 *         - role_name
 *         - category_id
 *       properties:
 *         role_name:
 *           type: string
 *         category_id:
 *           type: integer
 *           description: ID referencing the central category metadata
 *         description:
 *           type: string
 *         permissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FeaturePermissionObject'
 *         created_by:
 *           type: integer
 *     UpdateRoleRequest:
 *       type: object
 *       properties:
 *         role_name:
 *           type: string
 *         category_id:
 *           type: integer
 *           description: ID referencing the central category metadata
 *         description:
 *           type: string
 *         permissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FeaturePermissionObject'
 *         updated_by:
 *           type: integer
 *     UpdatePermissionsRequest:
 *       type: object
 *       required:
 *         - permissions
 *       properties:
 *         permissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FeaturePermissionObject'
 *     CreateRoleTemplateRequest:
 *       type: object
 *       required:
 *         - name
 *         - category_id
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the role template
 *         category_id:
 *           type: integer
 *           description: ID referencing the central category metadata
 *         description:
 *           type: string
 *           description: Description of the role template
 *         permissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FeaturePermissionObject'
 *           description: List of permissions for the template
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Status of the template
 *     UpdateRoleTemplateRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the role template
 *         category_id:
 *           type: integer
 *           description: ID referencing the central category metadata
 *         description:
 *           type: string
 *           description: Description of the role template
 *         permissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FeaturePermissionObject'
 *           description: List of permissions for the template
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Status of the template
 *     Role:
 *       type: object
 *       properties:
 *         role_id:
 *           type: integer
 *         role_name:
 *           type: string
 *         description:
 *           type: string
 *         category_id:
 *           type: integer
 *         is_active:
 *           type: boolean
 *         permissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PermissionObject'
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
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
 *           example: "Admin User"
 *           description: "Full name of the user who created the record"
 *         updated_by_name:
 *           type: string
 *           example: "Admin User"
 *           description: "Full name of the user who last updated the record"
 *     RoleListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           oneOf:
 *             - type: array
 *               items:
 *                 $ref: '#/components/schemas/Role'
 *             - type: object
 *               properties:
 *                 roles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Role'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                     itemsPerPage:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPrevPage:
 *                       type: boolean
 *     RoleResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Role retrieved successfully
 *         data:
 *           $ref: '#/components/schemas/Role'
 *     RoleMutationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           $ref: '#/components/schemas/Role'
 *     RoleDeleteResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Role deleted successfully
 *     BulkDeleteRolesResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: 2 role(s) deleted successfully
 *         data:
 *           type: object
 *           properties:
 *             deleted_count:
 *               type: integer
 *               example: 2
 *     BulkRoleActionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Bulk delete completed
 *         data:
 *           type: object
 *           properties:
 *             processed:
 *               type: integer
 *             successful:
 *               type: integer
 *             failed:
 *               type: integer
 *             results:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   roleId:
 *                     type: integer
 *                   action:
 *                     type: string
 *                   success:
 *                     type: boolean
 *             errors:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   roleId:
 *                     type: integer
 *                   error:
 *                     type: string
 *     RoleTemplate:
 *       type: object
 *       properties:
 *         template_id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: "Hospital Admin"
 *         description:
 *           type: string
 *           example: "Template for hospital administrators"
 *         category_id:
 *           type: integer
 *           nullable: true
 *           example: 36
 *         category_name:
 *           type: string
 *           nullable: true
 *           example: "Administration"
 *         status:
 *           type: string
 *           example: "active"
 *         permissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PermissionObject'
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-02-20T06:13:25.502Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-06-25T11:11:45.580Z"
 */



// Role Template API routes
/**
 * @swagger
 * /api/roles/templates:
 *   get:
 *     summary: Get all role templates with pagination, filtering, and sorting
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Global search across name and description fields
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort by field and order (field:asc or field:desc). Sortable fields - template_id, name, description, category_id, status, created_at, updated_at. Default is template_id:asc
 *       - in: query
 *         name: template_id
 *         schema:
 *           type: integer
 *         description: Filter by template ID (exact match)
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by template name (partial match)
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
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (exact match, e.g. active, inactive)
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
 *         description: Filter by exact creation date (YYYY-MM-DD)
 *       - in: query
 *         name: created_at_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by creation date range - start date
 *       - in: query
 *         name: created_at_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by creation date range - end date
 *       - in: query
 *         name: updated_at
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by exact update date (YYYY-MM-DD)
 *       - in: query
 *         name: updated_at_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by update date range - start date
 *       - in: query
 *         name: updated_at_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by update date range - end date
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 templates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RoleTemplate'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                     itemsPerPage:
 *                       type: integer
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
router.get("/templates", authorize(['super_admin', 'hospital_admin']), queryParser, getRoleTemplatesWithPagination);

/**
 * @swagger
 * /api/roles/templates/all:
 *   get:
 *     summary: Get all role templates (no pagination)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RoleTemplate'
 *       500:
 *         description: Server error
 */
router.get("/templates/all", authorize(['super_admin', 'hospital_admin']), getAllRoleTemplates);

/**
 * @swagger
 * /api/roles/templates/{id}:
 *   get:
 *     summary: Get role template by ID
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleTemplate'
 *       404:
 *         description: Template not found
 *       500:
 *         description: Server error
 */
router.get("/templates/:id", authorize(['super_admin', 'hospital_admin']), getRoleTemplateById);

/**
 * @swagger
 * /api/roles/templates:
 *   post:
 *     summary: Create a new role template
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRoleTemplateRequest'
 *           example:
 *             name: "Nurse Template"
 *             category_id: 1
 *             description: "Template for nursing roles with basic patient care permissions"
 *             permissions:
 *               - feature_id: 1
 *                 permissions:
 *                   - permission_name: "can_read"
 *                     permission_display_name: "Read"
 *                     permission_description: "Read access"
 *                     is_enabled: true
 *               - feature_id: 2
 *                 permissions:
 *                   - permission_name: "can_read"
 *                     permission_display_name: "Read"
 *                     permission_description: "Read access"
 *                     is_enabled: true
 *                   - permission_name: "can_create"
 *                     permission_display_name: "Create"
 *                     permission_description: "Create access"
 *                     is_enabled: true
 *             status: "active"
 *     responses:
 *       201:
 *         description: Template created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleTemplate'
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Template already exists
 *       500:
 *         description: Server error
 */
router.post("/templates", authorize(['super_admin', 'hospital_admin']), createRoleTemplate);

/**
 * @swagger
 * /api/roles/templates/{id}:
 *   put:
 *     summary: Update a role template
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRoleTemplateRequest'
 *           example:
 *             name: "Updated Nurse Template"
 *             description: "Updated template for nursing roles with additional permissions"
 *             permissions:
 *               - feature_id: 1
 *                 permissions:
 *                   - permission_name: "can_read"
 *                     permission_display_name: "Read"
 *                     permission_description: "Read access"
 *                     is_enabled: true
 *                   - permission_name: "can_update"
 *                     permission_display_name: "Update"
 *                     permission_description: "Update access"
 *                     is_enabled: true
 *               - feature_id: 2
 *                 permissions:
 *                   - permission_name: "can_read"
 *                     permission_display_name: "Read"
 *                     permission_description: "Read access"
 *                     is_enabled: true
 *                   - permission_name: "can_create"
 *                     permission_display_name: "Create"
 *                     permission_description: "Create access"
 *                     is_enabled: true
 *                   - permission_name: "can_update"
 *                     permission_display_name: "Update"
 *                     permission_description: "Update access"
 *                     is_enabled: true
 *             status: "active"
 *     responses:
 *       200:
 *         description: Template updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleTemplate'
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Template not found
 *       409:
 *         description: Template name already exists
 *       500:
 *         description: Server error
 */
router.put("/templates/:id", authorize(['super_admin', 'hospital_admin']), updateRoleTemplate);

/**
 * @swagger
 * /api/roles/templates/{id}:
 *   delete:
 *     summary: Delete a role template (soft delete)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template deleted successfully
 *       404:
 *         description: Template not found
 *       500:
 *         description: Server error
 */
router.delete("/templates/:id", authorize(['super_admin', 'hospital_admin']), deleteRoleTemplate);

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Get all roles with advanced filtering, search, sorting and pagination
 *     description: |
 *       Retrieve roles with optional advanced filtering, search, sorting, and pagination.
 *       If no query parameters are provided, returns all active roles with default pagination.
 *       With query parameters, returns paginated results with filtering, search, and sorting capabilities.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Global search across role_name and description (partial match)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort by field and order (e.g. `role_name:asc` or `created_at:desc`). All role fields are sortable.
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
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 200
 *         description: Items per page (max 200)
 *       - in: query
 *         name: role_name
 *         schema:
 *           type: string
 *         description: Filter by role name (partial match)
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
 *         name: permissions
 *         schema:
 *           type: string
 *         description: Filter by permissions (partial match)
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
 *         description: Roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleListResponse'
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
router.get("/", authorize(['super_admin','hospital_admin']), queryParser, getRolesController);

/**
 * @swagger
 * /api/roles/hospital-staff:
 *   get:
 *     summary: Get hospital staff roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organization staff roles retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/hospital-staff",authorize(['super_admin', 'hospital_admin']), getOrganizationStaffRolesController);

// Categories endpoint must come before ":id" route
/**
 * @swagger
 * /api/roles/categories:
 *   get:
 *     summary: Get all role categories
 *     description: Retrieve all role categories with optional pagination and filtering
 *     tags: [Roles]
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
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category_id:
 *                         type: integer
 *                       category_type_id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       code:
 *                         type: string
 *                       description:
 *                         type: string
 *                       display_order:
 *                         type: integer
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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
router.get("/categories", authorize(['super_admin', 'hospital_admin']), queryParser, getRoleCategoriesController);

/**
 * @swagger
 * /api/roles/stats:
 *   get:
 *     summary: Get role statistics by category
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_roles:
 *                       type: integer
 *                     active_roles:
 *                       type: integer
 *                     inactive_roles:
 *                       type: integer
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category_id:
 *                             type: integer
 *                           category_name:
 *                             type: string
 *                           total_roles:
 *                             type: integer
 *                           active_roles:
 *                             type: integer
 *                           inactive_roles:
 *                             type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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
router.get("/stats", authorize(['super_admin','hospital_admin']), getRolesStatsController);

/**
 * @swagger
 * /api/roles/deleted:
 *   get:
 *     summary: Get all deleted roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deleted roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Role'
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
router.get("/deleted", authorize(['super_admin', 'hospital_admin']), getDeletedRolesController);

/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleResponse'
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.get("/:id", getRoleByIdController);

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRoleRequest'
 *           example:
 *             role_name: "nurse"
 *             category_id: 1
 *             description: "Responsible for patient care"
 *             permissions:
 *               - feature_id: 1
 *                 permissions:
 *                   - permission_name: "can_read"
 *                     permission_display_name: "Read"
 *                     permission_description: "Read access"
 *                     is_enabled: true
 *               - feature_id: 5
 *                 permissions:
 *                   - permission_name: "can_read"
 *                     permission_display_name: "Read"
 *                     permission_description: "Read access"
 *                     is_enabled: true
 *                   - permission_name: "can_create"
 *                     permission_display_name: "Create"
 *                     permission_description: "Create access"
 *                     is_enabled: true
 *             created_by: 1
 *     responses:
 *       201:
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleMutationResponse'
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Role already exists
 *       500:
 *         description: Server error
 */
router.post("/", authorize(['super_admin', 'hospital_admin']), createRoleController);

/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     summary: Update a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRoleRequest'
 *           example:
 *             role_name: "senior_nurse"
 *             category_id: 1
 *             description: "Senior nurse with additional responsibilities"
 *             permissions:
 *               - feature_id: 1
 *                 permissions:
 *                   - permission_name: "can_read"
 *                     permission_display_name: "Read"
 *                     permission_description: "Read access"
 *                     is_enabled: true
 *                   - permission_name: "can_create"
 *                     permission_display_name: "Create"
 *                     permission_description: "Create access"
 *                     is_enabled: true
 *                   - permission_name: "can_update"
 *                     permission_display_name: "Update"
 *                     permission_description: "Update access"
 *                     is_enabled: true
 *               - feature_id: 12
 *                 permissions:
 *                   - permission_name: "can_read"
 *                     permission_display_name: "Read"
 *                     permission_description: "Read access"
 *                     is_enabled: true
 *             updated_by: 1
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleMutationResponse'
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Role not found
 *       409:
 *         description: Role name already exists
 *       500:
 *         description: Server error
 */
router.put("/:id", authorize(['super_admin','hospital_admin']), updateRoleController);

/**
 * @swagger
 * /api/roles/{id}:
 *   delete:
 *     summary: Delete a role
 *     description: |
 *       Delete a role (single-tenant app: always a global soft-delete, is_deleted=true).
 *       System roles (super_admin, hospital_admin, doctor, nurse, lab_tech, receptionist, billing_staff) cannot be deleted by anyone.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleDeleteResponse'
 *       403:
 *         description: Cannot delete system role
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.delete("/bulk-delete", authorize(['super_admin', 'hospital_admin']), bulkDeleteRolesController);
router.delete("/:id", authorize(['super_admin','hospital_admin']), deleteRoleController);

/**
 * @swagger
 * /api/roles/{id}/restore:
 *   patch:
 *     summary: Restore a deleted role
 *     description: |
 *       Restore a globally soft-deleted role (is_deleted=false).
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role restored successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleMutationResponse'
 *       403:
 *         description: Cannot restore globally deleted role (hospital_admin)
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.patch("/:id/restore", authorize(['super_admin', 'hospital_admin']), restoreRoleController);

/**
 * @swagger
 * /api/roles/{id}/permissions:
 *   put:
 *     summary: Update role permissions
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePermissionsRequest'
 *     responses:
 *       200:
 *         description: Role permissions updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleMutationResponse'
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.put("/:id/permissions", authorize(['super_admin', 'hospital_admin']), updateRolePermissionsController);

/**
 * @swagger
 * /api/roles/bulk-action:
 *   post:
 *     summary: Perform bulk actions on roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role_ids
 *               - action
 *             properties:
 *               role_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of role IDs
 *               action:
 *                 type: string
 *                 enum: [delete, restore]
 *                 description: Action to perform
 *           example:
 *             role_ids: [1, 2, 3]
 *             action: "delete"
 *     responses:
 *       200:
 *         description: Bulk action completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkRoleActionResponse'
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */
router.post("/bulk-action", authorize(['super_admin', 'hospital_admin']), bulkActionController);

/**
 * @swagger
 * /api/roles/bulk-delete:
 *   delete:
 *     summary: Bulk delete roles
 *     description: |
 *       Bulk delete roles (single-tenant app: always a global soft-delete, is_deleted=true).
 *       System roles (super_admin, hospital_admin, doctor, nurse, lab_tech, receptionist, billing_staff) cannot be deleted.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role_ids
 *             properties:
 *               role_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of role IDs to delete
 *           example:
 *             role_ids: [1, 2, 3]
 *     responses:
 *       200:
 *         description: Roles deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkDeleteRolesResponse'
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Cannot delete system roles
 *       404:
 *         description: No roles found to delete
 *       500:
 *         description: Server error
 */
router.delete("/bulk-delete", authorize(['super_admin', 'hospital_admin']), bulkDeleteRolesController);

/**
 * @swagger
 * /api/roles/{roleId}/features/{featureId}:
 *   post:
 *     summary: Assign a feature to a role with specific permissions
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Feature ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissions
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/PermissionRow'
 *           example:
 *             permissions:
 *               - permission_name: "can_read"
 *                 permission_display_name: "Read"
 *                 permission_description: "Read access"
 *                 is_enabled: true
 *               - permission_name: "can_update"
 *                 permission_display_name: "Update"
 *                 permission_description: "Update access"
 *                 is_enabled: true
 *     responses:
 *       201:
 *         description: Feature assigned to role successfully
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
 *                   example: Feature assigned to role successfully
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Feature already assigned to role
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
router.post("/:roleId/features/:featureId", authorize(['super_admin', 'hospital_admin']), assignFeatureToRoleController);

/**
 * @swagger
 * /api/roles/{roleId}/features/{featureId}:
 *   delete:
 *     summary: Remove a feature from a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Feature ID
 *     responses:
 *       200:
 *         description: Feature removed from role successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleDeleteResponse'
 *       404:
 *         description: Feature not assigned to role
 *       500:
 *         description: Server error
 */
router.delete("/:roleId/features/:featureId", authorize(['super_admin', 'hospital_admin']), removeFeatureFromRoleController);

/**
 * @swagger
 * /api/roles/{roleId}/features:
 *   get:
 *     summary: Get all features assigned to a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Features retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/:roleId/features", authorize(['super_admin', 'hospital_admin']), getRoleFeaturesController);

/**
 * @swagger
 * /api/roles/{roleId}/available-features:
 *   get:
 *     summary: Get features available for assignment to a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Available features retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/:roleId/available-features", authorize(['super_admin', 'hospital_admin']), getAvailableFeaturesForRoleController);

/**
 * @swagger
 * /api/roles/{id}/activate:
 *   patch:
 *     summary: Activate a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleMutationResponse'
 *       400:
 *         description: Role is already active
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.patch("/:id/activate", authorize(['super_admin', 'hospital_admin']), checkPermission('Roles', 'update'), activateRoleController);

/**
 * @swagger
 * /api/roles/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleMutationResponse'
 *       400:
 *         description: Role is already inactive
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.patch("/:id/deactivate", authorize(['super_admin', 'hospital_admin']), checkPermission('Roles', 'update'), deactivateRoleController);

export default router;