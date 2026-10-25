import * as activityService from './activity_service.js';
import { logInfo, logError } from '../../common/utils/logger.js';

export const getActivities = async (req, res, next) => {
  try {
    logInfo('🔥 CONTROLLER: Starting getActivities for user ID:', { userId: req.user.user_id });

    const activities = await activityService.getActivities(req.user.user_id);

    logInfo('🔥 CONTROLLER: Retrieved activities count:', { count: activities?.length || 0 });

    res.status(200).json({
      success: true,
      message: "Activities fetched successfully",
      data: activities,
    });
  } catch (err) {
    logError('❌ CONTROLLER: Get Activities Error:', err);
    next(err);
  }
};
