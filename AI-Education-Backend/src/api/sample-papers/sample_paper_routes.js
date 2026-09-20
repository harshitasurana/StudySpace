import express from "express";
import {
  listSamplePapersController,
  getSamplePaperController,
  startAttemptController,
  uploadAnswerPdfController,
  submitPaperController,
  getAttemptController,
  listAttemptsController,
  gradingCallbackController,
} from "./sample_paper_controller.js";
import { authenticate } from "../../common/middlewares/auth_middleware.js";
import { uploadSamplePaperAnswerPdf } from "../../common/utils/fileUpload.js";

// Self-mode gating (isSelfStudent) is frontend-only here — same
// convention Help Center's own backend already uses (space_key just
// defaults to self_student, no server-side mode check either).

// Verifies calls actually come from RAGProductionApp, not a browser —
// same shared secret pattern as sample_paper_admin_routes.js's own
// verifyServiceKey for the extraction callback.
const verifyServiceKey = (req, res, next) => {
  const expected = process.env.AI_SERVICE_KEY;
  const provided = req.headers["x-service-key"];
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, message: "Invalid or missing service key" });
  }
  return next();
};

const router = express.Router();

router.post("/grading-callback/:attemptId", verifyServiceKey, gradingCallbackController);

router.use(authenticate);

router.get("/", listSamplePapersController);
router.get("/attempts", listAttemptsController);
router.get("/:samplePaperId", getSamplePaperController);
router.post("/:samplePaperId/attempts", startAttemptController);
router.post("/attempts/:attemptId/answer-pdf", uploadSamplePaperAnswerPdf, uploadAnswerPdfController);
router.post("/attempts/:attemptId/submit", submitPaperController);
router.get("/attempts/:attemptId", getAttemptController);

export default router;
