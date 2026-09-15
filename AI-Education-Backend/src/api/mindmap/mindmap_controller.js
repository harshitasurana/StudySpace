import { generateMindMapService, getMindMapStatusService, recordMindMapCallbackService, listMindMapsService } from "./mindmap_service.js";

export const generateMindMapController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { chapter_id, variant, generation_group_id } = req.body;

    const result = await generateMindMapService(userId, { chapterId: chapter_id, variant, generationGroupId: generation_group_id });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to generate a mind map" });
  }
};

export const mindMapStatusController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const chapterId = Number(req.query.chapter_id);
    const generationGroupId = req.query.generation_group_id;

    const result = await getMindMapStatusService(userId, { chapterId, generationGroupId });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch mind map status" });
  }
};

// "My Mind Maps" — see MyMindMaps.jsx.
export const listMindMapsController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const result = await listMindMapsService(userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch your mind maps" });
  }
};

// Called by RAGProductionApp's Celery worker (core/mindmap_tasks.py), not
// the browser — see verifyServiceKey in mindmap_routes.js for the auth
// check.
export const mindMapCallbackController = async (req, res) => {
  try {
    const row = await recordMindMapCallbackService(req.params.mindMapId, req.body);
    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to record callback" });
  }
};
