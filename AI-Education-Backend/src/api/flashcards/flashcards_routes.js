import express from "express";
import {
  generateFlashcardsController,
  getFlashcardSetStatusController,
  flashcardGenerationCallbackController,
  listFlashcardSetsController,
} from "./flashcards_controller.js";
import { authenticate, requireStudentProfile, requireWithinUsageLimit, requireChapterUnlocked } from "../../common/middlewares/auth_middleware.js";
import { validateBody, validateParams } from "../../common/middlewares/validate.js";
import { generateFlashcardsSchema, flashcardSetParamsSchema } from "./flashcards_validation.js";

// Verifies calls actually come from RAGProductionApp (the FastAPI
// service / its Celery worker), not a browser — same shared secret
// already used to verify Node's own calls to it (ai_service_client.js),
// just checked in the reverse direction. Identical to
// quiz_routes.js/mindmap_routes.js's own verifyServiceKey.
const verifyServiceKey = (req, res, next) => {
  const expected = process.env.AI_SERVICE_KEY;
  const provided = req.headers["x-service-key"];
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, message: "Invalid or missing service key" });
  }
  return next();
};

const router = express.Router();

router.post("/sets/:setId/callback", verifyServiceKey, flashcardGenerationCallbackController);

router.use(authenticate);

router.post(
  "/generate",
  requireStudentProfile,
  requireChapterUnlocked,
  requireWithinUsageLimit("flashcards"),
  validateBody(generateFlashcardsSchema),
  generateFlashcardsController
);
router.get("/sets", listFlashcardSetsController);
router.get("/sets/:setId/status", validateParams(flashcardSetParamsSchema), getFlashcardSetStatusController);

export default router;
