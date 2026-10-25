import * as profileService from './profile_service.js';
import { validateBody } from '../../common/middlewares/validate.js';
import {
  updateProfileSchema,
  updateSecuritySchema
} from './profile_validation.js';
import { logDebug, logError, logInfo } from '../../common/utils/logger.js';
import { uploadAvatar } from '../../common/utils/fileUpload.js';
import {
  STORAGE_CATEGORIES,
  FILE_VISIBILITY,
  buildStorageKey,
  uploadStoredFile,
} from '../../common/services/fileStorage.service.js';

export const upload = uploadAvatar;

// ============ CONTROLLERS ============

export const getMyProfile = async (req, res, next) => {
  try {
    logDebug('Starting getMyProfile', { userId: req.user.user_id, service: 'profile' });

    const profileData = await profileService.getMyProfile(req.user.user_id);

    // Debug what we received
    logDebug('Profile data received', {
      userId: req.user.user_id,
      dataType: typeof profileData,
      dataKeys: Object.keys(profileData),
      hasActivities: 'activities' in profileData,
      activitiesLength: profileData.activities?.length || 0,
      hasNotifications: 'notification_preferences' in profileData,
      notificationsLength: profileData.notification_preferences?.length || 0,
      service: 'profile'
    });

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: profileData,
    });
  } catch (err) {
    logError('Get profile error', err, { userId: req.user.user_id, service: 'profile' });
    next(err);
  }
};

export const getMyProfileById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    logDebug('Starting getMyProfileById', {
      targetUserId: userId,
      requestedBy: req.user.user_id,
      service: 'profile'
    });

    const profileData = await profileService.getMyProfile(userId);

    // Debug what we received
    logDebug('Profile data received for user', {
      targetUserId: userId,
      requestedBy: req.user.user_id,
      dataType: typeof profileData,
      dataKeys: Object.keys(profileData),
      service: 'profile'
    });

    res.status(200).json({
      success: true,
      message: "User profile fetched successfully",
      data: profileData,
    });
  } catch (err) {
    logError('Get profile by ID error', err, {
      targetUserId: req.params.userId,
      requestedBy: req.user.user_id,
      service: 'profile'
    });
    next(err);
  }
};

export const updateMyProfile = [
  validateBody(updateProfileSchema),
  async (req, res, next) => {
    try {
      const updatedProfile = await profileService.updateMyProfile(req.user.user_id, req.body);
      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: updatedProfile,
      });
    } catch (err) {
      next(err);
    }
  }
];

export const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const key = buildStorageKey({
      category: STORAGE_CATEGORIES.AVATAR,
      userId: req.user.user_id,
      originalName: req.file.originalname,
    });

    await uploadStoredFile({
      file: req.file,
      key,
      visibility: FILE_VISIBILITY.PUBLIC,
      metadata: {
        userId: String(req.user.user_id),
      },
    });

    const avatarUrl = await profileService.updateAvatar(req.user.user_id, key);
    res.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      data: {
        avatar_url: avatarUrl,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateSecurity = [
  validateBody(updateSecuritySchema),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const result = await profileService.updateSecurity(req.user.user_id, {
        currentPassword,
        newPassword,
      });

      res.status(200).json(result);
    } catch (err) {
      if (err.message === "Current password is incorrect") {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      next(err);
    }
  }
];

export const downloadData = async (req, res, next) => {
  try {
    logDebug('Starting downloadData', { userId: req.user.user_id, service: 'profile' });

    const jsonString = await profileService.generateDownloadData(req.user.user_id);

    const filename = `profile_data_${req.user.user_id}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Length', jsonString.length);

    logDebug('Download headers set, sending file', {
      userId: req.user.user_id,
      filename,
      dataSize: jsonString.length,
      service: 'profile'
    });

    res.status(200).send(jsonString);
  } catch (err) {
    logError('Download data error', err, { userId: req.user.user_id, service: 'profile' });
    next(err);
  }
};
