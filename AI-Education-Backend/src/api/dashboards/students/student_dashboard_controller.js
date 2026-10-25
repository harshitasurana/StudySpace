import { getStudentDashboardService } from "./student_dashboard_service.js";

export const getStudentDashboardController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const dashboard = await getStudentDashboardService(userId);
    return res.status(200).json({ success: true, data: dashboard });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load dashboard" });
  }
};