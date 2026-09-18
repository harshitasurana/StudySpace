import express from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth_middleware.js';
import queryParser from "../../common/middlewares/queryParser.js";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  toggleNotificationPreference,
  resetNotificationPreference,
  resetAllNotificationPreferences
} from './notification_controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: Profile Notifications
 *     description: User notification management and preferences (Healthcare Industry Standard)
 *
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       description: Notification message template
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *           description: Unique notification template ID
 *         type:
 *           type: string
 *           enum: [SYSTEM, ORDER, MESSAGE, SECURITY, ANNOUNCEMENT, APPOINTMENT, STAFF, PATIENT]
 *           example: APPOINTMENT
 *           description: Type of notification
 *         title:
 *           type: string
 *           example: "New Appointment Scheduled"
 *           description: Notification title
 *         message:
 *           type: string
 *           example: "Your appointment with Dr. Smith on 2024-12-01 at 10:00 AM has been confirmed."
 *           description: Notification message content
 *         channel:
 *           type: string
 *           enum: [IN_APP, EMAIL, SMS, PUSH]
 *           example: IN_APP
 *           description: Delivery channel
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-11-15T10:30:00Z"
 *           description: Notification creation timestamp
 *
 *     UserNotification:
 *       type: object
 *       description: User-specific notification record with read status
 *       properties:
 *         id:
 *           type: integer
 *           example: 123
 *           description: User notification relationship ID
 *         user_id:
 *           type: integer
 *           example: 456
 *           description: User ID
 *         is_read:
 *           type: boolean
 *           example: false
 *           description: Read status
 *         read_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2024-11-15T10:35:00Z"
 *           description: Timestamp when notification was marked as read
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-11-15T10:30:00Z"
 *           description: Notification creation timestamp
 *         notification:
 *           $ref: '#/components/schemas/Notification'
 *
 *     NotificationPreferences:
 *       type: object
 *       description: User notification preferences/settings
 *       properties:
 *         email_security_alerts:
 *           type: boolean
 *           example: true
 *           description: Enable email notifications for security alerts
 *         email_account_updates:
 *           type: boolean
 *           example: true
 *           description: Enable email notifications for account updates
 *         email_newsletter:
 *           type: boolean
 *           example: false
 *           description: Enable email newsletter
 *         push_login_alerts:
 *           type: boolean
 *           example: true
 *           description: Enable push notifications for login alerts
 *         push_critical_updates:
 *           type: boolean
 *           example: true
 *           description: Enable push notifications for critical updates
 *         push_reminders:
 *           type: boolean
 *           example: false
 *           description: Enable push notification reminders
 *         system_task_updates:
 *           type: boolean
 *           example: true
 *           description: Enable in-app system notifications for task updates
 *         system_comments:
 *           type: boolean
 *           example: true
 *           description: Enable in-app system notifications for comments
 *         system_mentions:
 *           type: boolean
 *           example: true
 *           description: Enable in-app system notifications for mentions
 *
 *     PaginationInfo:
 *       type: object
 *       description: Pagination metadata
 *       properties:
 *         totalItems:
 *           type: integer
 *           example: 50
 *           description: Total number of items
 *         totalPages:
 *           type: integer
 *           example: 5
 *           description: Total number of pages
 *         currentPage:
 *           type: integer
 *           example: 1
 *           description: Current page number
 *         itemsPerPage:
 *           type: integer
 *           example: 10
 *           description: Items per page limit
 *         hasNextPage:
 *           type: boolean
 *           example: true
 *           description: Whether next page exists
 *         hasPrevPage:
 *           type: boolean
 *           example: false
 *           description: Whether previous page exists
 *
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Operation successful"
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Error message"
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
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Bearer token (JWT) for authentication
 */

// ======================== NOTIFICATIONS API ========================

/**
 * @swagger
 * /api/profile/notifications:
 *   get:
 *     summary: Get user notifications with pagination & filters
 *     description: |
 *       Retrieve paginated notifications for the logged-in user with advanced search, filtering, and sorting capabilities.
 *       
 *       **Healthcare-Specific Features:**
 *       - Filter by notification type (APPOINTMENT, SECURITY, STAFF, PATIENT, etc.)
 *       - Filter by read status
 *       - Full-text search across title and message
 *       - Customizable sorting and pagination
 *     tags:
 *       - Profile Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: "appointment"
 *         description: Search term to filter notifications by title and message (case-insensitive)
 *       - in: query
 *         name: is_read
 *         schema:
 *           type: boolean
 *           example: false
 *         description: Filter by read status (true = read, false = unread)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [SYSTEM, ORDER, MESSAGE, SECURITY, ANNOUNCEMENT, APPOINTMENT, STAFF, PATIENT]
 *           example: APPOINTMENT
 *         description: Filter by notification type
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           example: "createdAt:DESC"
 *         description: Sort field and direction (format:field:ASC/DESC). Valid fields:createdAt, is_read, type, title
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *           example: 1
 *         description: Page number (1-based indexing)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 200
 *           example: 10
 *         description: Number of items per page
 *     responses:
 *       '200':
 *         description: Notifications retrieved successfully
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
 *                   example: "Notifications fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     notifications:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/UserNotification'
 *                       description: Array of user notifications
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationInfo'
 *       '400':
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized - No valid bearer token provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
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
 *     x-codeSamples:
 *       - lang: curl
 *         source: |
 *           curl -X GET "http://localhost:3000/api/profile/notifications?page=1&limit=10&sort=createdAt:DESC" \
 *             -H "Authorization: Bearer your_jwt_token" \
 *             -H "Content-Type: application/json"
 *       - lang: javascript
 *         source: |
 *           const response = await fetch('/api/profile/notifications?page=1&limit=10', {
 *             headers: { 'Authorization': 'Bearer token' }
 *           });
 *           const data = await response.json();
 */
router.get(
  '/',
  authorize(['super_admin', 'hospital_admin', 'doctor', 'staff', 'patient', 'student', 'Student', 'School Student']),
  queryParser,
  getNotifications
);

/**
 * @swagger
 * /api/profile/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count (badge count)
 *     description: |
 *       Returns the total count of unread notifications for the logged-in user.
 *       
 *       **Use Cases:**
 *       - Display notification badge count in UI header
 *       - Real-time notification counters
 *       - Health dashboard indicators
 *     tags:
 *       - Profile Notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Unread count retrieved successfully
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
 *                   example: "Unread count fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 5
 *                       description: Total unread notifications count
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
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
  '/unread-count',
  authorize(['super_admin', 'hospital_admin', 'doctor', 'staff', 'patient', 'student', 'Student', 'School Student']),
  getUnreadCount
);

/**
 * @swagger
 * /api/profile/notifications/{id}/read:
 *   patch:
 *     summary: Mark single notification as read
 *     description: |
 *       Mark a specific notification as read by its ID.
 *       
 *       **Healthcare Context:**
 *       - Update read status for appointment confirmations
 *       - Mark security alerts as acknowledged
 *       - Track which critical updates user has seen
 *     tags:
 *       - Profile Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "123"
 *         description: User notification ID
 *     responses:
 *       '200':
 *         description: Notification marked as read successfully
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
 *                   example: "Notification marked as read"
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Notification not found or already read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
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
router.patch(
  '/:id/read',
  authorize(['super_admin', 'hospital_admin', 'doctor', 'staff', 'patient', 'student', 'Student', 'School Student']),
  markAsRead
);

/**
 * @swagger
 * /api/profile/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     description: |
 *       Mark all unread notifications as read for the logged-in user.
 *       
 *       **Use Cases:**
 *       - "Mark all as read" button in notification center
 *       - Clear all unread indicators
 *       - Archive old notifications
 *     tags:
 *       - Profile Notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: All notifications marked as read successfully
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
 *                   example: "All notifications marked as read"
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 15
 *                       description: Number of notifications marked as read
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
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
router.patch(
  '/read-all',
  authorize(['super_admin', 'hospital_admin', 'doctor', 'staff', 'patient', 'student', 'Student', 'School Student']),
  markAllAsRead
);

/**
 * @swagger
 * /api/profile/notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     description: |
 *       Permanently delete a specific notification for the logged-in user.
 *       
 *       **Security:**
 *       - Only the notification owner can delete their own notifications
 *       - Deletion is permanent and cannot be undone
 *     tags:
 *       - Profile Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "123"
 *         description: User notification ID to delete
 *     responses:
 *       '200':
 *         description: Notification deleted successfully
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
 *                   example: "Notification deleted"
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
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
router.delete(
  '/:id',
  authorize(['super_admin', 'hospital_admin', 'doctor', 'staff', 'patient', 'student', 'Student', 'School Student']),
  deleteNotification
);

// ======================== NOTIFICATION PREFERENCES API ========================

/**
 * @swagger
 * /api/profile/notifications/preferences:
 *   get:
 *     summary: Get user notification preferences
 *     description: |
 *       Retrieve all notification preferences for the logged-in user.
 *       
 *       Returns current preference settings for:
 *       - Email notifications (security alerts, account updates, newsletter)
 *       - Push notifications (login alerts, critical updates, reminders)
 *       - System notifications (task updates, comments, mentions)
 *       
 *       Any preference not explicitly set will use the system default value.
 *     tags:
 *       - Profile Notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Preferences retrieved successfully
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
 *                   example: "Notification preferences fetched successfully"
 *                 data:
 *                   $ref: '#/components/schemas/NotificationPreferences'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
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
  '/preferences',
  authorize(['super_admin', 'hospital_admin', 'doctor', 'staff', 'patient', 'student', 'Student', 'School Student']),
  getNotificationPreferences
);

/**
 * @swagger
 * /api/profile/notifications/preferences:
 *   put:
 *     summary: Bulk update notification preferences
 *     description: |
 *       Update multiple notification preferences at once.
 *       
 *       **Features:**
 *       - Update any combination of preferences in a single request
 *       - Only provided preferences are updated; others remain unchanged
 *       - Perfect for settings page with multiple checkboxes
 *       - Returns updated preferences with defaults applied
 *     tags:
 *       - Profile Notifications
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       description: Preferences object with fields to update
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationPreferences'
 *           examples:
 *             updateEmailPrefs:
 *               summary: Update email preferences
 *               value:
 *                 email_security_alerts: true
 *                 email_account_updates: false
 *                 email_newsletter: false
 *             updateAllChannels:
 *               summary: Disable all notifications
 *               value:
 *                 email_security_alerts: false
 *                 email_account_updates: false
 *                 email_newsletter: false
 *                 push_login_alerts: false
 *                 push_critical_updates: false
 *                 push_reminders: false
 *                 system_task_updates: false
 *                 system_comments: false
 *                 system_mentions: false
 *     responses:
 *       '200':
 *         description: Preferences updated successfully
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
 *                   example: "Notification preferences updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/NotificationPreferences'
 *       '400':
 *         description: Invalid request (no preferences provided or invalid keys)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
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
  '/preferences',
  authorize(['super_admin', 'hospital_admin', 'doctor', 'staff', 'patient', 'student', 'Student', 'School Student']),
  updateNotificationPreferences
);

/**
 * @swagger
 * /api/profile/notifications/preferences/{key}:
 *   patch:
 *     summary: Toggle single notification preference
 *     description: |
 *       Update a specific notification preference by key.
 *       
 *       **Healthcare Use Cases:**
 *       - Quick toggle switches for each notification type
 *       - Individual preference changes without affecting others
 *       - Real-time preference updates in UI
 *     tags:
 *       - Profile Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - email_security_alerts
 *             - email_account_updates
 *             - email_newsletter
 *             - push_login_alerts
 *             - push_critical_updates
 *             - push_reminders
 *             - system_task_updates
 *             - system_comments
 *             - system_mentions
 *           example: email_security_alerts
 *         description: Notification preference key to toggle
 *     requestBody:
 *       required: true
 *       description: New value for the preference
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               value:
 *                 type: boolean
 *                 example: false
 *                 description: Desired preference value (true to enable, false to disable)
 *             required:
 *               - value
 *           example:
 *             value: false
 *     responses:
 *       '200':
 *         description: Preference toggled successfully
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
 *                   example: "Notification preference toggled successfully"
 *                 data:
 *                   $ref: '#/components/schemas/NotificationPreferences'
 *       '400':
 *         description: Invalid request (missing value or invalid type)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Invalid preference key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
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
router.patch(
  '/preferences/:key',
  authorize(['super_admin', 'hospital_admin', 'doctor', 'staff', 'patient', 'student', 'Student', 'School Student']),
  toggleNotificationPreference
);

/**
 * @swagger
 * /api/profile/notifications/preferences/{key}:
 *   delete:
 *     summary: Reset single preference to default
 *     description: |
 *       Reset a specific notification preference back to its system default value.
 *       
 *       **Use Cases:**
 *       - "Reset to default" button for individual preferences
 *       - Undo user changes without affecting other settings
 *       - Restore healthcare compliance defaults for specific preference
 *     tags:
 *       - Profile Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - email_security_alerts
 *             - email_account_updates
 *             - email_newsletter
 *             - push_login_alerts
 *             - push_critical_updates
 *             - push_reminders
 *             - system_task_updates
 *             - system_comments
 *             - system_mentions
 *           example: email_newsletter
 *         description: Preference key to reset to default
 *     responses:
 *       '200':
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
 *                   example: "Notification preference reset to default"
 *                 data:
 *                   $ref: '#/components/schemas/NotificationPreferences'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Invalid preference key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
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
router.delete(
  '/preferences/:key',
  authorize(['super_admin', 'hospital_admin', 'doctor', 'staff', 'patient', 'student', 'Student', 'School Student']),
  resetNotificationPreference
);

/**
 * @swagger
 * /api/profile/notifications/preferences:
 *   delete:
 *     summary: Reset all preferences to system defaults
 *     description: |
 *       Reset ALL notification preferences for the user back to system default values.
 *       
 *       **Warning:** This action affects all notification preferences at once.
 *       
 *       **Use Cases:**
 *       - "Reset all to defaults" button in settings
 *       - Restore healthcare compliance settings
 *       - Clean up user preferences after import/migration
 *       - Recommended to show confirmation dialog in UI
 *     tags:
 *       - Profile Notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
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
 *                   example: "All notification preferences reset to defaults"
 *                 data:
 *                   $ref: '#/components/schemas/NotificationPreferences'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
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
router.delete(
  '/preferences',
  authorize(['super_admin', 'hospital_admin', 'doctor', 'staff', 'patient', 'student', 'Student', 'School Student']),
  resetAllNotificationPreferences
);

export default router;