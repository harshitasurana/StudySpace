import { Notification, UserNotification } from './notification_schema.js';
import { Op } from 'sequelize';

/**
 * Notification Model
 * 
 * Handles all database operations for the notification system
 */

// Get all notifications for a user with pagination
export const getUserNotifications = async (userId, options = {}) => {
  const { limit = 20, offset = 0, unreadOnly = false } = options;
  
  const whereClause = { user_id: userId };
  if (unreadOnly) {
    whereClause.is_read = false;
  } 

  return await UserNotification.findAll({
    where: whereClause,
    include: [{
      model: Notification,
      as: 'notification',
      attributes: ['notification_id', 'type', 'title', 'message', 'channel', 'createdAt']
    }],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });
};

export const getUserNotificationsPaginated = async (userId, queryOptions) => {
  let limit, offset, sort, search, filters;

  if (queryOptions && queryOptions.limit !== undefined) {
    ({ limit = 20, offset = 0, sort = [['createdAt', 'DESC']], search, filters = {} } = queryOptions);
  } else {
    const { page = 1, limit: lim = 20, search: s = '' } = queryOptions || {};
    limit = lim;
    offset = (page - 1) * limit;
    search = s;
    sort = [['createdAt', 'DESC']];
    filters = {};
  }

  const whereCondition = { 
    user_id: userId,
    ...filters,
  };

  if (search) {
    whereCondition[Op.or] = [
      { '$notification.title$': { [Op.iLike]: `%${search}%` } },
      { '$notification.message$': { [Op.iLike]: `%${search}%` } },
    ];
  }

  const validSortFields = ['user_notification_id', 'is_read', 'read_at', 'createdAt'];
  const [sortFieldArray, sortDirection] = sort[0] || ['createdAt', 'DESC'];
  const sortField = Array.isArray(sortFieldArray) ? sortFieldArray[0] : sortFieldArray;
  const finalSortField = validSortFields.includes(sortField) ? sortField : 'createdAt';
  const finalSortDirection = ['ASC', 'DESC'].includes(sortDirection.toUpperCase()) ? sortDirection.toUpperCase() : 'DESC';

  const { count, rows } = await UserNotification.findAndCountAll({
    where: whereCondition,
    attributes: ['user_notification_id', 'user_id', 'is_read', 'read_at', 'createdAt'],
    include: [{
      model: Notification,
      as: 'notification',
      attributes: ['notification_id', 'type', 'title', 'message', 'channel', 'createdAt'],
      required: true
    }],
    order: [[finalSortField, finalSortDirection]],
    limit,
    offset,
    distinct: true,
    col: 'user_notification_id'
  });

  const notifications = rows.map(un => ({
    id: un.user_notification_id,
    user_id: un.user_id,
    is_read: un.is_read,
    read_at: un.read_at,
    created_at: un.createdAt,
    notification: {
      id: un.notification.notification_id,
      type: un.notification.type,
      title: un.notification.title,
      message: un.notification.message,
      channel: un.notification.channel,
      created_at: un.notification.createdAt
    }
  }));

  const totalPages = Math.ceil(count / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return {
    notifications,
    pagination: {
      currentPage,
      totalPages,
      totalItems: count,
      itemsPerPage: limit,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
  };
};

// Get unread count for a user
export const getUnreadCount = async (userId) => {
  const count = await UserNotification.count({
    where: { user_id: userId, is_read: false }
  });
  return count;
};

// Mark single notification as read
export const markAsRead = async (userNotificationId, userId) => {
  const [updated] = await UserNotification.update(
    { is_read: true, read_at: new Date() },
    { 
      where: { 
        user_notification_id: userNotificationId, 
        user_id: userId 
      } 
    }
  );
  return updated > 0;
};

// Mark all notifications as read for a user
export const markAllAsRead = async (userId) => {
  const result = await UserNotification.update(
    { is_read: true, read_at: new Date() },
    { 
      where: { 
        user_id: userId, 
        is_read: false 
      } 
    }
  );
  return result[0]; // Returns number of affected rows
};

// Delete a notification for a user
export const deleteNotification = async (userNotificationId, userId) => {
  const deleted = await UserNotification.destroy({
    where: { 
      user_notification_id: userNotificationId, 
      user_id: userId 
    }
  });
  return deleted > 0;
};

// Create notification template
export const createNotificationTemplate = async (notificationData) => {
  return await Notification.create(notificationData);
};

// Create notification for single user
export const createNotificationForUser = async (notificationData, userId) => {
  const notification = await Notification.create(notificationData);
  
  const userNotification = await UserNotification.create({
    user_id: userId,
    notification_id: notification.notification_id
  });
  
  return {
    notification,
    userNotification
  };
};

// Create notification for multiple users (bulk)
export const createNotificationForUsers = async (notificationData, userIds) => {
  const notification = await Notification.create(notificationData);
  
  const userNotifications = userIds.map(userId => ({
    user_id: userId,
    notification_id: notification.notification_id
  }));
  
  const created = await UserNotification.bulkCreate(userNotifications);
  
  return {
    notification,
    count: created.length
  };
};

// Create a broadcast/announcement notification (single-tenant app: for all users)
export const createNotificationForOrganization = async (notificationData) => {
  const notification = await Notification.create({
    ...notificationData,
    type: 'ANNOUNCEMENT'
  });
  
  return notification;
};

// Get notification by ID
export const getNotificationById = async (notificationId) => {
  return await Notification.findByPk(notificationId);
};

// Delete notification template (soft delete)
export const deleteNotificationTemplate = async (notificationId) => {
  const [updated] = await Notification.update(
    { is_active: false },
    { where: { notification_id: notificationId } }
  );
  return updated > 0;
};

// Get user's notification by user_notification_id
export const getUserNotificationById = async (userNotificationId, userId) => {
  return await UserNotification.findOne({
    where: {
      user_notification_id: userNotificationId,
      user_id: userId
    },
    include: [{
      model: Notification,
      as: 'notification'
    }]
  });
};

export default {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotificationTemplate,
  createNotificationForUser,
  createNotificationForUsers,
  createNotificationForOrganization,
  getNotificationById,
  deleteNotificationTemplate,
  getUserNotificationById
};

