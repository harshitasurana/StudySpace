import express from "express";
import { generateSlideDeckController, slideDeckStatusController, slideDeckCallbackController, listSlideDecksController } from "./slide_deck_controller.js";
import { authenticate, requireStudentProfile, requireWithinUsageLimit, requireChapterUnlocked } from "../../common/middlewares/auth_middleware.js";
import { validateBody, validateQuery } from "../../common/middlewares/validate.js";
import { generateSlideDeckSchema, slideDeckStatusSchema } from "./slide_deck_validation.js";

// Verifies calls actually come from RAGProductionApp (the FastAPI
// service / its Celery worker), not a browser — identical to
// mindmap_routes.js's own verifyServiceKey.
const verifyServiceKey = (req, res, next) => {
  const expected = process.env.AI_SERVICE_KEY;
  const provided = req.headers["x-service-key"];
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, message: "Invalid or missing service key" });
  }
  return next();
};

const router = express.Router();

router.post("/callback/:slideDeckId", verifyServiceKey, slideDeckCallbackController);

router.use(authenticate);

router.post(
  "/generate",
  requireStudentProfile,
  requireChapterUnlocked,
  requireWithinUsageLimit("slide_deck"),
  validateBody(generateSlideDeckSchema),
  generateSlideDeckController
);
router.get("/status", validateQuery(slideDeckStatusSchema), slideDeckStatusController);
router.get("/list", listSlideDecksController);

export default router;
