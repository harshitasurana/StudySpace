import { generateInfographicService, getInfographicStatusService, recordInfographicCallbackService } from "./infographic_service.js";

export const generateInfographicController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { chapter_id } = req.body;

    const result = await generateInfographicService(userId, { chapterId: chapter_id });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to generate an infographic" });
  }
};

export const infographicStatusController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const chapterId = Number(req.query.chapter_id);

    const result = await getInfographicStatusService(userId, { chapterId });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch infographic status" });
  }
};

// Called by RAGProductionApp's Celery worker (core/infographic_tasks.py),
// not the browser — see verifyServiceKey in infographic_routes.js.
export const infographicCallbackController = async (req, res) => {
  try {
    const row = await recordInfographicCallbackService(req.params.infographicId, req.body);
    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to record callback" });
  }
};
