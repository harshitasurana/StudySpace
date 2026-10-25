import { listUserActivityService, getUserActivityDetailService } from "./user_activity_service.js";

export const listUserActivityController = async (req, res) => {
  try {
    const data = await listUserActivityService({ ...req.query });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load user activity" });
  }
};

export const getUserActivityDetailController = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const data = await getUserActivityDetailService(userId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load user activity detail" });
  }
};
