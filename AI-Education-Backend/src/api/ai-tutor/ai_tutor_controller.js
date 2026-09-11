import {
  chatWithTutorService,
  chatWithTutorImageService,
  getConversationHistoryService,
  startNewConversationService,
  listConversationsService,
} from "./ai_tutor_service.js";

export const chatController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { chapter_id, subject_id, question, conversation_id } = req.body;

    const result = await chatWithTutorService(userId, {
      chapterId: chapter_id || null,
      subjectId: subject_id,
      question,
      conversationId: conversation_id,
      addedByUserId: req.user.acting_as_parent_user_id || null,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to get a tutor response" });
  }
};

export const chatImageController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    const userId = req.user.user_id;
    const { chapter_id, subject_id, question, conversation_id } = req.body;

    const result = await chatWithTutorImageService(userId, {
      chapterId: chapter_id || null,
      subjectId: subject_id,
      question,
      conversationId: conversation_id,
      imageBuffer: req.file.buffer,
      imageMimeType: req.file.mimetype,
      imageOriginalName: req.file.originalname,
      addedByUserId: req.user.acting_as_parent_user_id || null,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to get a tutor response" });
  }
};

export const getHistoryController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const chapterId = Number(req.params.chapterId);
    const conversationId = req.query.conversation_id ? Number(req.query.conversation_id) : null;

    const result = await getConversationHistoryService(userId, chapterId, conversationId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load conversation history" });
  }
};

export const startNewConversationController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const chapterId = Number(req.params.chapterId);

    const result = await startNewConversationService(userId, chapterId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to start a new chat" });
  }
};

export const listConversationsController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const result = await listConversationsService(userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load your AI Tutor sessions" });
  }
};
