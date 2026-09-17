import { saveLearningPreferencesService } from "./preferences_service.js";

export const savePreferencesController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const preferences = await saveLearningPreferencesService(userId, req.body);
    return res.status(200).json({ success: true, message: "Preferences saved successfully", data: preferences });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to save preferences" });
  }
};
