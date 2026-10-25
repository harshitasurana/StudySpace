import { listHighlightsService, createHighlightService, deleteHighlightService } from "./highlights_service.js";

export const listController = async (req, res) => {
  try {
    const result = await listHighlightsService(req.user.user_id, { chapterId: req.query.chapter_id });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load highlights" });
  }
};

export const createController = async (req, res) => {
  try {
    const { chapter_id, page_index, text, color } = req.body;
    const result = await createHighlightService(req.user.user_id, { chapterId: chapter_id, pageIndex: page_index, text, color });
    return res.status(201).json({ success: true, message: "Highlight saved successfully", data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to save highlight" });
  }
};

export const deleteController = async (req, res) => {
  try {
    await deleteHighlightService(req.user.user_id, req.params.highlightId);
    return res.status(200).json({ success: true, message: "Highlight removed successfully" });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to remove highlight" });
  }
};
