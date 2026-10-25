import express from "express";
import {
  getAvailabilityTypesController,
  getAvailabilityTypeByIdController,
  createAvailabilityTypeController,
  updateAvailabilityTypeController,
  deleteAvailabilityTypeController,
  seedAvailabilityTypesController,
} from "./feature_availability_controller.js";
import { authenticate } from "../../common/middlewares/auth_middleware.js";
import { checkPermission } from "../../common/middlewares/rbac_middleware.js";
import { rejectOrgScope } from "../../common/middlewares/organization_scope_guard.js";

const router = express.Router();

// Apply authentication and org-scope guard to all routes
router.use(authenticate);
router.use(rejectOrgScope);

/**
 * @swagger
 * tags:
 *   name: Feature Availability
 *   description: Manage dynamic feature availability type definitions
 */

/**
 * @swagger
 * /api/feature-availability-types:
 *   get:
 *     summary: Get all active availability types
 *     tags: [Feature Availability]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Availability types retrieved successfully
 */
router.get("/", checkPermission("Features", "read"), getAvailabilityTypesController);

/**
 * @swagger
 * /api/feature-availability-types/seed:
 *   post:
 *     summary: Seed default availability types (idempotent utility)
 *     tags: [Feature Availability]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Default types seeded successfully
 */
// NOTE: /seed must be declared before /:id to avoid Express matching "seed" as an id param
router.post("/seed", checkPermission("Features", "create"), seedAvailabilityTypesController);

/**
 * @swagger
 * /api/feature-availability-types/{id}:
 *   get:
 *     summary: Get availability type by ID (includes associated features)
 *     tags: [Feature Availability]
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
 *         description: Availability type retrieved successfully
 *       404:
 *         description: Availability type not found
 */
router.get("/:id", checkPermission("Features", "read"), getAvailabilityTypeByIdController);

/**
 * @swagger
 * /api/feature-availability-types:
 *   post:
 *     summary: Create a new availability type
 *     tags: [Feature Availability]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - name
 *             properties:
 *               code:
 *                 type: string
 *                 example: "MOBILE"
 *               name:
 *                 type: string
 *                 example: "Mobile App"
 *               description:
 *                 type: string
 *                 example: "Features available in mobile application"
 *               display_order:
 *                 type: integer
 *                 example: 4
 *     responses:
 *       201:
 *         description: Availability type created successfully
 *       409:
 *         description: Code already exists
 */
router.post("/", checkPermission("Features", "create"), createAvailabilityTypeController);

/**
 * @swagger
 * /api/feature-availability-types/{id}:
 *   put:
 *     summary: Update an existing availability type
 *     tags: [Feature Availability]
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               display_order:
 *                 type: integer
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Availability type updated successfully
 *       404:
 *         description: Availability type not found
 */
router.put("/:id", checkPermission("Features", "update"), updateAvailabilityTypeController);

/**
 * @swagger
 * /api/feature-availability-types/{id}:
 *   delete:
 *     summary: Soft-delete an availability type (blocked if features reference it)
 *     tags: [Feature Availability]
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
 *         description: Availability type deleted successfully
 *       400:
 *         description: Cannot delete — type is in use by features
 */
router.delete("/:id", checkPermission("Features", "delete"), deleteAvailabilityTypeController);

export default router;
