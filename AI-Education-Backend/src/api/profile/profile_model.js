import User from "./profile_schema.js";
import Role from "../roles/role_schema.js";
import { logInfo } from '../../common/utils/logger.js';
import { FILE_VISIBILITY, resolveStoredFileUrl } from '../../common/services/fileStorage.service.js';

// Main functions
export const createUser = async (userData) => {
  return await User.create(userData);
};

export const findUserByEmail = async (email) => {
  return await User.findOne({ where: { email } });
};

export const findUserById = async (id) => {
  return await User.findByPk(id, {
    attributes: {
      exclude: ['refresh_token', 'created_by']
    },
    include: [
      { model: Role, as: 'userRole', attributes: ['role_id', 'role_name'], required: false }
    ]
  });
};

export const saveUserRefreshToken = async (userId, token) => {
  await User.update({ refresh_token: token }, { where: { user_id: userId } });
};

export const removeUserRefreshToken = async (refreshToken) => {
  const [updated] = await User.update(
    { refresh_token: null },
    { where: { refresh_token: refreshToken } }
  );
  return updated > 0;
};

export const findUserByRefreshToken = async (token) => {
  return await User.findOne({ where: { refresh_token: token } });
};

export const getMyProfile = async (userId) => {
  logInfo('📊 MODEL: Fetching profile for user:', { userId });
  
  const user = await User.findByPk(userId, {
    attributes: {
      exclude: ['refresh_token', 'created_by', 'password']
    },
    include: [
      { model: Role, as: 'userRole', attributes: ['role_id', 'role_name'], required: false }
    ]
  });

  if (!user) throw new Error('User not found');

  logInfo('📊 MODEL: User found:', { firstName: user.first_name, lastName: user.last_name });
  logInfo('📊 MODEL: Raw avatar value:', { avatar: user.avatar });
  
  return {
    user_id: user.user_id,
    initials: user.initials || (user.first_name ? user.first_name.substring(0, 2).toUpperCase() : ''),
    avatar: await resolveStoredFileUrl(user.avatar, { visibility: FILE_VISIBILITY.PUBLIC }),
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.userRole?.role_name || 'N/A',
    title: user.title || '',
    email: user.account_email,
    phone: user.phone || '',
    location: user.location || null,
    is_active: user.is_active || false,
    two_fa: user.two_fa || false,
    last_password_change: user.last_password_change || null,
    security_score: user.security_score || 0,
  };
};

export const updateMyProfile = async (userId, updateData) => {
  // Filter allowed fields only (expanded to include more fields)
const allowedFields = ['first_name','last_name' ,'title', 'email', 'phone', 'two_fa', 'location'];
  const filteredData = Object.keys(updateData)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = updateData[key];
      return obj;
    }, {});

  const [updated] = await User.update(filteredData, { where: { user_id: userId } });
  if (!updated) throw new Error('Profile update failed');

  return await getMyProfile(userId);
};

export const updateAvatar = async (userId, filename) => {
  const [updated] = await User.update({ avatar: filename }, { where: { user_id: userId } });
  
  if (!updated) throw new Error('Avatar update failed');
  
  return resolveStoredFileUrl(filename, { visibility: FILE_VISIBILITY.PUBLIC });
};

export const updatePassword = async (userId, hashedPassword) => {
  const [updated] = await User.update(
    { 
      password: hashedPassword,
      last_password_change: new Date()
    }, 
    { where: { user_id: userId } }
  );
  if (!updated) throw new Error('Password update failed');
};

export const getUserActivities = async (userId) => {
  logInfo('🔍 MODEL: Getting activities for user:', { userId });
  
  // Mock activities data
  const activities = [
    {
      id: '553d',
      icon: 'pi pi-key',
      color: 'bg-green-100 text-green-600',
      title: 'Password changed',
      description: 'Changed from web browser (Chrome)',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleString()
    },
    {
      id: '8dd2',
      icon: 'pi pi-user',
      color: 'bg-yellow-100 text-yellow-600',
      title: 'Login from new device',
      description: 'Chrome on Windows',
      date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toLocaleString()
    },
    {
      id: 'c4b2',
      icon: 'pi pi-envelope',
      color: 'bg-blue-100 text-blue-600',
      title: 'Email address updated',
      description: 'Profile information changed',
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toLocaleString()
    },
    {
      id: 'ebfe',
      icon: 'pi pi-cog',
      color: 'bg-gray-100 text-gray-600',
      title: 'Profile settings updated',
      description: 'Updated profile information',
      date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toLocaleString()
    }
  ];
  
  logInfo('🔍 MODEL: Returning activities:', { count: activities.length });
  return activities;
};

export const getUserSecurity = async (userId) => {
  logInfo('🔒 MODEL: Getting security for user:', { userId });
  
  const user = await User.findByPk(userId, { attributes: ['two_fa', 'security_score'] });
  
  // Mock security settings
  const securitySettings = [
    {
      id: 'cc3c',
      icon: 'pi pi-shield',
      bg: user?.two_fa ? 'bg-green-500/20 text-green-600' : 'bg-yellow-500/20 text-yellow-600',
      title: 'Two-Factor Authentication',
      desc: 'Add an extra layer of security to your account',
      badge: {
        text: user?.two_fa ? 'Enabled' : 'Disabled',
        severity: user?.two_fa ? 'success' : 'warning'
      },
      action: 'Configure'
    },
    {
      id: '2e0b',
      icon: 'pi pi-key',
      bg: 'bg-green-500/20 text-green-600',
      title: 'Password Settings',
      desc: 'Manage your password and security preferences',
      badge: { text: 'Enabled', severity: 'success' },
      action: 'Update'
    },
    {
      id: 'c52e',
      icon: 'pi pi-user',
      bg: 'bg-yellow-500/20 text-yellow-600',
      title: 'Active Sessions',
      desc: 'View and manage your active login sessions',
      badge: { text: '1 Active', severity: 'info' },
      action: 'View All'
    },
    {
      id: '428b',
      icon: 'pi pi-clock',
      bg: 'bg-green-500/20 text-green-600',
      title: 'Login History',
      desc: 'Review your recent login activity',
      badge: { text: 'Enabled', severity: 'success' },
      action: 'View'
    },
    {
      id: 'ffa6',
      icon: 'pi pi-bell',
      bg: 'bg-green-500/20 text-green-600',
      title: 'Security Notifications',
      desc: 'Configure your security alert preferences',
      badge: { text: 'Enabled', severity: 'success' },
      action: 'Settings'
    }
  ];
  
  logInfo('🔒 MODEL: Returning security settings:', { count: securitySettings.length });
  return securitySettings;
};

export const getUserNotifications = async (userId) => {
  logInfo('🔔 MODEL: Getting notifications for user:', { userId });
  
  // Mock notification preferences
  const notifications = [
    {
      id: 'c6e5',
      heading: 'Email Notifications',
      desc: 'Receive important updates via email',
      items: [
        { label: 'Security Alerts', value: true },
        { label: 'Account Updates', value: false },
        { label: 'Newsletter', value: false }
      ]
    },
    {
      id: '796c',
      heading: 'Push Notifications',
      desc: 'Get instant notifications on your devices',
      items: [
        { label: 'Login Alerts', value: true },
        { label: 'Critical Updates', value: true },
        { label: 'Reminders', value: false }
      ]
    },
    {
      id: '81e8',
      heading: 'System Notifications',
      desc: 'In-app notification preferences',
      items: [
        { label: 'Task Updates', value: true },
        { label: 'Comments', value: true },
        { label: 'Mentions', value: true }
      ]
    }
  ];
  
  logInfo('🔔 MODEL: Returning notification groups:', { count: notifications.length });
  return notifications;
};

// Update notification preferences
export const updateUserNotifications = async (userId, notificationData) => {
  logInfo('🔔 MODEL: Updating notifications for user:', { userId });
  
  // In a real implementation, you would save this to the database
  // For now, we'll just return the updated data
  
  // Here you would typically:
  // 1. Validate the notification data
  // 2. Update the database
  // 3. Return the updated notifications
  
  // Mock implementation:
  const notifications = await getUserNotifications(userId);
  
  // Find and update the matching notification group
  const updatedNotifications = notifications.map(notification => {
    if (notification.id === notificationData.id) {
      return {
        ...notification,
        items: notificationData.items
      };
    }
    return notification;
  });
  
  logInfo('🔔 MODEL: Notifications updated');
  return updatedNotifications;
};

// Export all functions
export default {
  createUser,
  findUserByEmail,
  findUserById,
  saveUserRefreshToken,
  removeUserRefreshToken,
  findUserByRefreshToken,
  getMyProfile,
  updateMyProfile,
  updateAvatar,
  updatePassword,
  getUserActivities,
  getUserSecurity,
  getUserNotifications,
  updateUserNotifications
};
