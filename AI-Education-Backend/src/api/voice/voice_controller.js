import { handleVoiceTurnService } from "./voice_service.js";
import { createEducationError } from "../education_errors.js";

export const voiceTurnController = async (req, res) => {
  try {
    if (!req.file) {
      throw createEducationError("An audio recording is required", 400, "AUDIO_REQUIRED");
    }

    const userId = req.user.user_id;
    const { chapter_id, conversation_id } = req.body;

    const result = await handleVoiceTurnService(userId, {
      chapterId: chapter_id,
      conversationId: conversation_id || null,
      audioBuffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to process voice turn" });
  }
};
