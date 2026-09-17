import * as profileModel from './profile_model.js';
import bcrypt from 'bcryptjs';
import { logInfo, logError, logWarn } from '../../common/utils/logger.js';

// Helper function to format date
const formatDate = (date) => {
  if (!date) return 'Never';
  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / (1000 * 60 * 60 * 24)); // days

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
  if (diff < 365) return `${Math.floor(diff / 30)} months ago`;
  return `${Math.floor(diff / 365)} years ago`;
};

export const getMyProfile = async (userId) => {
  try {
    logInfo('🔍 SERVICE: Fetching profile for user:', { userId });
    
    // Get all data in parallel for better performance
    const [profile, activities, security, notifications] = await Promise.all([
      profileModel.getMyProfile(userId).catch(err => {
        logError('❌ Failed to get profile:', err);
        throw err;
      }),
      profileModel.getUserActivities(userId).catch(err => {
        logWarn('⚠️ Failed to get activities, returning empty array:', { error: err.message });
        return [];
      }),
      profileModel.getUserSecurity(userId).catch(err => {
        logWarn('⚠️ Failed to get security, returning empty array:', { error: err.message });
        return [];
      }),
      profileModel.getUserNotifications(userId).catch(err => {
        logWarn('⚠️ Failed to get notifications, returning empty array:', { error: err.message });
        return [];
      })
    ]);
    
    logInfo('✅ SERVICE: Profile data received');
    logInfo('✅ SERVICE: Activities count:', { count: activities?.length || 0 });
    logInfo('✅ SERVICE: Security count:', { count: security?.length || 0 });
    logInfo('✅ SERVICE: Notifications count:', { count: notifications?.length || 0 });
    logInfo('✅ SERVICE: Avatar value:', { avatar: profile.avatar });

    // Create the complete response object with updated structure
    const profileObject = {
      id: profile.user_id,
      initials: profile.initials || (profile.first_name ? profile.first_name.substring(0, 2).toUpperCase() : ''),
      avatar: profile.avatar,
      first_name: profile.first_name,
      last_name: profile.last_name,
      role: profile.role,
      title: profile.title || '',
      email: profile.email,
      phone: profile.phone || '',
      location: profile.location || null,
      department: profile.department || 'N/A',
      departmentId: profile.department_id || null,
      is_active: profile.is_active || false,
      security: {
        twoFA: profile.two_fa || false,
        lastPasswordChange: profile.last_password_change ? formatDate(profile.last_password_change) : 'Never',
        score: profile.security_score || 0
      }
    };

    const result = {
      profile: [profileObject]
    };
    
    logInfo('📦 SERVICE: Result has profile?', { hasProfile: result.profile.length > 0 });
    
    return result;
    
  } catch (err) {
    logError('❌ SERVICE: Profile Service Error:', err);
    throw err;
  }
};

export const updateMyProfile = async (userId, updateData) => {
  try {
    const updatedProfile = await profileModel.updateMyProfile(userId, updateData);
    return updatedProfile;
  } catch (err) {
    logError('❌ Update Profile Error:', err);
    throw err;
  }
};

export const updateAvatar = async (userId, file) => {
  try {
    const avatarUrl = await profileModel.updateAvatar(userId, file);
    return avatarUrl;
  } catch (err) {
    logError('❌ Update Avatar Error:', err);
    throw err;
  }
};

export const updateSecurity = async (userId, { currentPassword, newPassword }) => {
  try {
    // Fetch the current user data including password
    const user = await profileModel.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password || '');
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    await profileModel.updatePassword(userId, hashedNewPassword);

    return {
      success: true,
      message: 'Password updated successfully',
    };
  } catch (err) {
    logError('❌ Update Security Error:', err);
    throw err;
  }
};

export const generateDownloadData = async (userId) => {
  try {
    logInfo('🔍 SERVICE: Generating download data for user:', { userId });
    
    // Reuse existing getMyProfile to fetch all data
    const profileData = await getMyProfile(userId);
    
    // Add export metadata
    const downloadData = {
      ...profileData,
      export_metadata: {
        exported_by: userId,
        export_timestamp: new Date().toISOString(),
        export_format: 'json',
        version: '1.0'
      }
    };
    
    // Convert to JSON string for download
    const jsonString = JSON.stringify(downloadData, null, 2);
    
    logInfo('✅ SERVICE: Download data generated, size:', { size: jsonString.length });
    
    return jsonString;
  } catch (err) {
    logError('❌ SERVICE: Generate Download Data Error:', err);
    throw err;
  }
};
