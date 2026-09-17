import express from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth_middleware.js';
import {
  getMyProfile,
  getMyProfileById,
  updateMyProfile,
  updateAvatar,
  updateSecurity,
  upload,
  downloadData,
} from './profile_controller.js';

// Import sub-routes
import activityRoutes from './activity_routes.js';
import notificationRoutes from './notification_routes.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: Logged-in user profile management
 */

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get logged-in user profile with activities, security settings, and notifications
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully with all related data
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
 *                   example: "Profile fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     profile:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           initials:
 *                             type: string
 *                             example: "JD"
 *                           avatar:
 *                             type: string
 *                             example: "data:image/png"
 *                           first_name:
 *                             type: string
 *                             example: "John"
 *                           last_name:
 *                             type: string
 *                             example: "Doe"
 *                           role:
 *                             type: string
 *                             example: "Admin"
 *                           title:
 *                             type: string
 *                             example: "System Administrator"
 *                           email:
 *                             type: string
 *                             example: "admin@example.com"
 *                           phone:
 *                             type: string
 *                             example: "9875145673"
 *                           location:
 *                             type: string
 *                             example: "New York, USA"
 *                           department:
 *                             type: string
 *                             example: "IT Operations"
 *                           departmentId:
 *                             type: integer
 *                             example: 4
 *                           is_active:
 *                             type: boolean
 *                             example: true
 *                           security:
 *                             type: object
 *                             properties:
 *                               twoFA:
 *                                 type: boolean
 *                                 example: true
 *                               lastPasswordChange:
 *                                 type: string
 *                                 example: "7 days ago"
 *                               score:
 *                                 type: integer
 *                                 example: 95
 *       401:
 *         description: Unauthorized - No valid token provided
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 */
// Mount sub-routes first to avoid conflicts with wildcard routes
router.use('/activities', activityRoutes);
router.use('/notifications', notificationRoutes);

router.get('/', authorize(['super_admin', 'hospital_admin', 'doctor', 'staff']), getMyProfile);
/**
 * @swagger
 * /api/profile/download:
 *   get:
 *     summary: Download user profile data as JSON file
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data download initiated
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *               format: binary
 *               description: JSON file containing profile data, activities, security settings, and notifications
 *       401:
 *         description: Unauthorized - No valid token provided
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/download', authorize(['super_admin', 'hospital_admin', 'doctor', 'staff']), downloadData);
/**
 * @swagger
 * /api/profile/{userId}:
 *   get:
 *     summary: Get user profile by ID
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID to fetch profile for
 *         example: 1
 *     responses:
 *       200:
 *         description: User profile fetched successfully with all related data
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
 *                   example: "User profile fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: integer
 *                       example: 1
 *                     initials:
 *                       type: string
 *                       example: "JA"
 *                     avatar:
 *                       type: string
 *                       example: "http://localhost:3000/uploads/avatars/user_1_1765968798208-580597393.jpg"
 *                     first_name:
 *                       type: string
 *                       example: "John"
 *                     last_name:
 *                       type: string
 *                       example: "anderson"
 *                     role:
 *                       type: string
 *                       example: "hospital_admin"
 *                     title:
 *                       type: string
 *                       nullable: true
 *                     email:
 *                       type: string
 *                       example: "johnanderson@gmail.com"
 *                     phone:
 *                       type: string
 *                       example: "1234567890"
 *                     location:
 *                       type: string
 *                       nullable: true
 *                     department:
 *                       type: string
 *                       example: "N/A"
 *                     department_id:
 *                       type: integer
 *                       nullable: true
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     security:
 *                       type: object
 *                       properties:
 *                         twoFA:
 *                           type: boolean
 *                           example: false
 *                         lastPasswordChange:
 *                           type: string
 *                           nullable: true
 *                         score:
 *                           type: integer
 *                           example: 0
 *                     activities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           icon:
 *                             type: string
 *                           color:
 *                             type: string
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           date:
 *                             type: string
 *                     security_settings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           icon:
 *                             type: string
 *                           bg:
 *                             type: string
 *                           title:
 *                             type: string
 *                           desc:
 *                             type: string
 *                           badge:
 *                             type: object
 *                             properties:
 *                               text:
 *                                 type: string
 *                               severity:
 *                                 type: string
 *                           action:
 *                             type: string
 *                     notification_preferences:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           heading:
 *                             type: string
 *                           desc:
 *                             type: string
 *                           items:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 label:
 *                                   type: string
 *                                 value:
 *                                   type: boolean
 *       401:
 *         description: Unauthorized - No valid token provided
 *       403:
 *         description: Forbidden - insufficient permissions (requires super_admin or hospital_admin)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/:userId', authorize(['super_admin', 'hospital_admin','doctor', 'staff','patient']), getMyProfileById);

/**
 * @swagger
 * /api/profile:
 *   put:
 *     summary: Update logged-in user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *                 example: "John"
 *               last_name:
 *                 type: string
 *                 example: "Doe"
 *               title:
 *                 type: string
 *                 example: "Senior Doctor"
 *               email:
 *                 type: string
 *                 example: "john.doe@example.com"
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *               location:
 *                 type: string
 *                 example: "New York, USA"
 *               department_id:
 *                 type: integer
 *                 example: 4
 *               two_fa:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - No valid token provided
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.put('/', authorize(['super_admin', 'hospital_admin', 'doctor', 'staff']), updateMyProfile);

/**
 * @swagger
 * /api/profile/avatar:
 *   put:
 *     summary: Update profile avatar
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image file
 *     responses:
 *       200:
 *         description: Avatar updated successfully
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
 *                     avatar_url:
 *                       type: string
 *       400:
 *         description: Invalid file format
 *       401:
 *         description: Unauthorized - No valid token provided
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.put('/avatar', authorize(['super_admin', 'hospital_admin', 'doctor', 'staff']), upload.single('avatar'), updateAvatar);

/**
 * @swagger
 * /api/profile/security:
 *   put:
 *     summary: Update profile security (change password)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password for verification
 *               newPassword:
 *                 type: string
 *                 description: New password to set (minimum 6 characters)
 *               confirmPassword:
 *                 type: string
 *                 description: Confirmation of new password (must match newPassword)
 *     responses:
 *       200:
 *         description: Password updated successfully
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
 *         description: Validation error, incorrect current password, or passwords do not match
 *       401:
 *         description: Unauthorized - No valid token provided
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.put('/security', authorize(['super_admin', 'hospital_admin', 'doctor', 'staff']), updateSecurity);

export default router;
