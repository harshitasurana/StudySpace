import { getOnboardingConfigService } from "./onboarding_service.js";

export const getOnboardingConfigController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const roleId = req.query?.role_id ? Number(req.query.role_id) : null;
    const learningMode = req.query?.learning_mode || null;
    const config = await getOnboardingConfigService(userId, roleId, learningMode);
    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load onboarding config" });
  }
};
