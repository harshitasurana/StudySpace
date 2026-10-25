import express from "express";
import { generateMindMapController, mindMapStatusController, mindMapCallbackController, listMindMapsController } from "./mindmap_controller.js";
import { authenticate, requireStudentProfile, requireWithinUsageLimit, requireChapterUnlocked } from "../../common/middlewares/auth_middleware.js";
import { validateBody, validateQuery } from "../../common/middlewares/validate.js";
import { generateMindMapSchema, mindMapStatusSchema } from "./mindmap_validation.js";

// Verifies calls actually come from RAGProductionApp (the FastAPI
// service / its Celery worker), not a browser — same shared secret
// already used to verify Node's own calls to it (ai_service_client.js),
// just checked in the reverse direction. Identical to
// ingestion_routes.js's own verifyServiceKey.
const verifyServiceKey = (req, res, next) => {
  const expected = process.env.AI_SERVICE_KEY;
  const provided = req.headers["x-service-key"];
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, message: "Invalid or missing service key" });
  }
  return next();
};

const router = express.Router();

router.post("/callback/:mindMapId", verifyServiceKey, mindMapCallbackController);

router.use(authenticate);

router.post(
  "/generate",
  requireStudentProfile,
  requireChapterUnlocked,
  requireWithinUsageLimit("mind_map"),
  validateBody(generateMindMapSchema),
  generateMindMapController
);
router.get("/status", validateQuery(mindMapStatusSchema), mindMapStatusController);
router.get("/list", listMindMapsController);

export default router;
