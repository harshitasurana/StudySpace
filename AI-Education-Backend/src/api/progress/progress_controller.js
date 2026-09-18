import {
  getProgressOverviewService,
  getSubjectProgressService,
  getAchievementsService,
  getGameStatsService,
} from "./progress_service.js";

export const getOverviewController = async (req, res) => {
  try {
    const result = await getProgressOverviewService(req.user.user_id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load progress overview" });
  }
};

export const getSubjectsController = async (req, res) => {
  try {
    const result = await getSubjectProgressService(req.user.user_id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load subject progress" });
  }
};

export const getAchievementsController = async (req, res) => {
  try {
    const result = await getAchievementsService(req.user.user_id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load achievements" });
  }
};

export const getGameStatsController = async (req, res) => {
  try {
    const result = await getGameStatsService(req.user.user_id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load game stats" });
  }
};
