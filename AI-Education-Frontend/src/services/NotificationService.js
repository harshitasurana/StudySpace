import apiClient from './apiClient';

// Talks to api/profile/notification_routes.js (mounted at
// /api/profile/notifications). Goes through the shared apiClient - unlike
// the raw fetch() calls this replaces, every request here carries the
// Authorization header apiClient's interceptor attaches, and a 401 gets a
// silent token refresh + retry instead of just failing.
const NotificationService = {
  // Returns { success, message, data: { notifications: [{ id, user_id,
  // is_read, read_at, created_at, notification: { id, type, title,
  // message, channel, created_at } }], pagination } }
  async list(params = {}) {
    const { data } = await apiClient.get('/api/profile/notifications', { params });
    return data;
  },

  async markAsRead(id) {
    const { data } = await apiClient.patch(`/api/profile/notifications/${id}/read`);
    return data;
  },

  async markAllAsRead() {
    const { data } = await apiClient.patch('/api/profile/notifications/read-all');
    return data;
  },

  // Returns { success, message, data: { email_security_alerts, email_account_updates,
  // email_newsletter, push_login_alerts, push_critical_updates, push_reminders,
  // system_task_updates, system_comments, system_mentions } } — system_task_updates
  // is the one that actually gates quiz/mock-test/streak notifications
  // server-side (see quiz_service.js's isTaskUpdatesEnabled).
  async getPreferences() {
    const { data } = await apiClient.get('/api/profile/notifications/preferences');
    return data;
  },

  async togglePreference(key, value) {
    const { data } = await apiClient.patch(`/api/profile/notifications/preferences/${key}`, { value });
    return data;
  },
};

export default NotificationService;