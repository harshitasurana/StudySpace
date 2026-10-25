import express from "express";
import {
  chatController,
  chatImageController,
  getHistoryController,
  startNewConversationController,
  listConversationsController,
} from "./ai_tutor_controller.js";
import { authenticate, requireStudentProfile, requireWithinUsageLimit, requireChapterUnlocked } from "../../common/middlewares/auth_middleware.js";
import { validateBody, validateParams, validateQuery } from "../../common/middlewares/validate.js";
import { chatSchema, chatImageSchema, historyParamsSchema, historyQuerySchema } from "./ai_tutor_validation.js";
import { uploadChatImage } from "../../common/utils/fileUpload.js";

const router = express.Router();

router.use(authenticate);

router.post(
  "/chat",
  requireStudentProfile,
  requireChapterUnlocked,
  requireWithinUsageLimit("ai_tutor"),
  validateBody(chatSchema),
  chatController
);
// Multer runs first — it parses the multipart body into req.body (scalar
// fields, as strings) + req.file (the image), which requireChapterUnlocked
// and validateBody both then read exactly like a JSON /chat request.
// Reuses the same "ai_tutor" usage counter as text chat (Phase 1 — see
// the multimodal chat plan; no separate feature_key/limit yet).
router.post(
  "/chat/image",
  uploadChatImage,
  requireStudentProfile,
  requireChapterUnlocked,
  requireWithinUsageLimit("ai_tutor"),
  validateBody(chatImageSchema),
  chatImageController
);
router.get(
  "/history/:chapterId",
  validateParams(historyParamsSchema),
  validateQuery(historyQuerySchema),
  getHistoryController
);
// Starts a new conversation for this chapter (old messages are never
// deleted — see 20260816_ai_conversations_allow_multiple_per_chapter.sql).
// POST, not DELETE: this creates a row, it doesn't remove anything.
router.post("/history/:chapterId/new", validateParams(historyParamsSchema), startNewConversationController);
router.get("/conversations", listConversationsController);

export default router;
