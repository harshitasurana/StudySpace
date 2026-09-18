import express from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth_middleware.js';
import { getActivities } from './activity_controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Profile Activities
 *   description: User activity logs management
 */

/**
 * @swagger
 * /api/profile/activities:
 *   get:
 *     summary: Get logged-in user activities
 *     tags: [Profile Activities]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activities fetched successfully
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
 *                   example: "Activities fetched successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "553d"
 *                       icon:
 *                         type: string
 *                         example: "pi pi-key"
 *                       color:
 *                         type: string
 *                         example: "bg-green-100 text-green-600"
 *                       title:
 *                         type: string
 *                         example: "Password changed"
 *                       description:
 *                         type: string
 *                         example: "Changed from web browser (Chrome)"
 *                       date:
 *                         type: string
 *                         example: "2024-12-01T10:00:00.000Z"
 *       401:
 *         description: Unauthorized - No valid token provided
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/', authorize(['super_admin', 'hospital_admin', 'doctor', 'staff']), getActivities);

export default router;
