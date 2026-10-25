import express from "express";
import {
  generateController,
  submitAnswerController,
  listAttemptsController,
  listMistakesController,
  getTestReviewController,
  getQuizStatusController,
  quizGenerationCallbackController,
} from "./quiz_controller.js";
import { authenticate, requireStudentProfile, requireWithinUsageLimit, requireChapterUnlocked } from "../../common/middlewares/auth_middleware.js";
import { validateBody, validateParams, validateQuery } from "../../common/middlewares/validate.js";
import {
  generateQuizSchema,
  submitAnswerSchema,
  attemptParamsSchema,
  attemptsQuerySchema,
  mistakesQuerySchema,
} from "./quiz_validation.js";

// Verifies calls actually come from RAGProductionApp (the FastAPI
// service / its Celery worker), not a browser — same shared secret
// already used to verify Node's own calls to it (ai_service_client.js),
// just checked in the reverse direction. Identical to
// mindmap_routes.js/slide_deck_routes.js's own verifyServiceKey.
const verifyServiceKey = (req, res, next) => {
  const expected = process.env.AI_SERVICE_KEY;
  const provided = req.headers["x-service-key"];
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, message: "Invalid or missing service key" });
  }
  return next();
};

const router = express.Router();

router.post("/attempts/:attemptId/callback", verifyServiceKey, quizGenerationCallbackController);

router.use(authenticate);

// generateQuizSchema's actual field is attempt_type ('quiz' | 'mock_test'
// | 'pre_assessment'), not the 'type':'practice'|'mock_test' the original
// plan assumed — verified directly against quiz_validation.js. Only
// 'mock_test' maps to the gated mock_test ProductFeature; both 'quiz'
// (Practice's regular generation) and 'pre_assessment' (onboarding
// calibration, not a monetized generation feature at all) map to
// 'practice', which every plan tier sets to "Unlimited" — so those two
// stay effectively ungated while still going through the same check.
router.post(
  "/generate",
  requireStudentProfile,
  requireChapterUnlocked,
  requireWithinUsageLimit((req) => (req.body?.attempt_type === "mock_test" ? "mock_test" : "practice")),
  validateBody(generateQuizSchema),
  generateController
);
router.post("/:attemptId/submit", validateParams(attemptParamsSchema), validateBody(submitAnswerSchema), submitAnswerController);
router.get("/attempts", validateQuery(attemptsQuerySchema), listAttemptsController);
router.get("/attempts/:attemptId/status", validateParams(attemptParamsSchema), getQuizStatusController);
router.get("/mistakes", validateQuery(mistakesQuerySchema), listMistakesController);
router.get("/test-review", getTestReviewController);

export default router;
