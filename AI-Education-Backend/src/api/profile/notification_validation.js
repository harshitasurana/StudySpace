import Joi from "joi";

/**
 * Notification Validation Schemas
 * 
 * Joi validation schemas for notification API endpoints
 */

// Schema for querying notifications
export const getNotificationsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(500).default(20),
  offset: Joi.number().integer().min(0).default(0),
  unreadOnly: Joi.boolean().default(false)
});

// Schema for marking as read
export const markAsReadSchema = Joi.object({
  id: Joi.number().integer().required()
});

// ================= NOTIFICATION PREFERENCES VALIDATION =================

// GET /notifications/preferences - No body validation needed
export const notificationPreferencesGetSchema = Joi.object({}).unknown(true);

// PUT /notifications/preferences - Bulk update (object of key-value)
export const notificationPreferencesUpdateSchema = Joi.object({
  email_security_alerts: Joi.boolean().optional(),
  email_account_updates: Joi.boolean().optional(),
  email_newsletter: Joi.boolean().optional(),
  push_login_alerts: Joi.boolean().optional(),
  push_critical_updates: Joi.boolean().optional(),
  push_reminders: Joi.boolean().optional(),
  system_task_updates: Joi.boolean().optional(),
  system_comments: Joi.boolean().optional(),
  system_mentions: Joi.boolean().optional(),
  appointment_reschedule_email: Joi.boolean().optional(),
  appointment_reschedule_push: Joi.boolean().optional(),
  appointment_reschedule_sms: Joi.boolean().optional(),
  appointment_reminders_email: Joi.boolean().optional(),
  appointment_reminders_push: Joi.boolean().optional(),
}).min(1).messages({
  'object.min': 'At least one preference must be provided'
});

// PATCH /notifications/preferences/:key - Single toggle
export const notificationPreferencesToggleSchema = Joi.object({
  value: Joi.boolean().required()
}).messages({
  'boolean.base': 'Value must be true or false',
  'any.required': 'Value is required'
});

// Schema for creating notification (used by admin/system)
export const createNotificationSchema = Joi.object({
  type: Joi.string().valid(
    'SYSTEM', 
    'ORDER', 
    'MESSAGE', 
    'SECURITY', 
    'ANNOUNCEMENT',
    'APPOINTMENT',
    'STAFF',
    'PATIENT'
  ).default('SYSTEM'),
  title: Joi.string().max(255).required(),
  message: Joi.string().required(),
  channel: Joi.string().valid('IN_APP', 'EMAIL', 'SMS', 'PUSH').default('IN_APP'),
  userIds: Joi.array().items(Joi.number().integer()).optional()
});

// Schema for bulk notification
export const bulkNotificationSchema = Joi.object({
  type: Joi.string().valid(
    'SYSTEM', 
    'ORDER', 
    'MESSAGE', 
    'SECURITY', 
    'ANNOUNCEMENT'
  ).default('SYSTEM'),
  title: Joi.string().max(255).required(),
  message: Joi.string().required(),
  channel: Joi.string().valid('IN_APP', 'EMAIL', 'SMS', 'PUSH').default('IN_APP'),
  userIds: Joi.array().items(Joi.number().integer()).min(1).required()
});

export default {
  getNotificationsSchema,
  markAsReadSchema,
  notificationPreferencesUpdateSchema,
  notificationPreferencesToggleSchema,
  createNotificationSchema,
  bulkNotificationSchema
};
