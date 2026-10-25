import { getStudyPlanService } from "./study_plan_service.js";

export const getStudyPlanController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const plan = await getStudyPlanService(userId);
    return res.status(200).json({ success: true, data: plan });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to build your study plan" });
  }
};
