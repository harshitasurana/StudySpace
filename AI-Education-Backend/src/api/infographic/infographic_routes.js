import express from "express";
import { generateInfographicController, infographicStatusController, infographicCallbackController } from "./infographic_controller.js";
import { authenticate, requireStudentProfile, requireWithinUsageLimit, requireChapterUnlocked } from "../../common/middlewares/auth_middleware.js";
import { validateBody, validateQuery } from "../../common/middlewares/validate.js";
import { generateInfographicSchema, infographicStatusSchema } from "./infographic_validation.js";

// Verifies calls actually come from RAGProductionApp (the FastAPI
// service / its Celery worker), not a browser — identical to
// slide_deck_routes.js's own verifyServiceKey.
const verifyServiceKey = (req, res, next) => {
  const expected = process.env.AI_SERVICE_KEY;
  const provided = req.headers["x-service-key"];
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, message: "Invalid or missing service key" });
  }
  return next();
};

const router = express.Router();

router.post("/callback/:infographicId", verifyServiceKey, infographicCallbackController);

router.use(authenticate);

router.post(
  "/generate",
  requireStudentProfile,
  requireChapterUnlocked,
  requireWithinUsageLimit("infographic"),
  validateBody(generateInfographicSchema),
  generateInfographicController
);
router.get("/status", validateQuery(infographicStatusSchema), infographicStatusController);

export default router;
