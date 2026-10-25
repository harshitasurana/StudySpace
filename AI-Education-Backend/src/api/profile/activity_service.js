import * as profileModel from './profile_model.js';
import { logInfo, logError } from '../../common/utils/logger.js';

export const getActivities = async (userId) => {
  try {
    logInfo('🔍 SERVICE: Fetching activities for user:', { userId });

    const activities = await profileModel.getUserActivities(userId);

    logInfo('✅ SERVICE: Activities retrieved:', { count: activities?.length || 0 });

    return activities;
  } catch (err) {
    logError('❌ SERVICE: Get Activities Error:', err);
    throw err;
  }
};
