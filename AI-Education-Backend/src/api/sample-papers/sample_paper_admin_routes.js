import express from "express";
import multer from "multer";
import {
  createSamplePaperController,
  listSamplePapersController,
  getSamplePaperController,
  startExtractionController,
  listExtractionJobsController,
  extractionCallbackController,
  updateSamplePaperQuestionController,
  draftAnswerForQuestionController,
  approveSamplePaperQuestionController,
  publishSamplePaperController,
} from "./sample_paper_admin_controller.js";
import { validateBody } from "../../common/middlewares/validate.js";
import { createSamplePaperSchema, updateSamplePaperQuestionSchema } from "./sample_paper_admin_validation.js";
import { authenticate, authorizeFeature } from "../../common/middlewares/auth_middleware.js";

const SAMPLE_PAPERS_MANAGEMENT_FEATURE = "Sample Papers Management";

// Paper + Solution PDFs — same memoryStorage/50MB pattern as
// ingestion_routes.js's uploadChapterPdf, sized for two full exam PDFs
// rather than common/utils/fileUpload.js's smaller document limits.
const uploadPaperAndSolution = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    return cb(new Error("Only PDF files are accepted"));
  },
}).fields([
  { name: "paper_file", maxCount: 1 },
  { name: "solution_file", maxCount: 1 },
]);

// Verifies calls actually come from RAGProductionApp (the FastAPI
// service), not a browser — same shared secret pattern as
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

router.post("/extraction-callback/:jobId", verifyServiceKey, extractionCallbackController);

router.use(authenticate);

router.post(
  "/",
  authorizeFeature(SAMPLE_PAPERS_MANAGEMENT_FEATURE, "can_create"),
  validateBody(createSamplePaperSchema),
  createSamplePaperController
);
router.get("/", authorizeFeature(SAMPLE_PAPERS_MANAGEMENT_FEATURE, "can_read"), listSamplePapersController);
router.get("/extraction-jobs", authorizeFeature(SAMPLE_PAPERS_MANAGEMENT_FEATURE, "can_read"), listExtractionJobsController);
router.get("/:samplePaperId", authorizeFeature(SAMPLE_PAPERS_MANAGEMENT_FEATURE, "can_read"), getSamplePaperController);
router.post(
  "/:samplePaperId/extract",
  authorizeFeature(SAMPLE_PAPERS_MANAGEMENT_FEATURE, "can_update"),
  uploadPaperAndSolution,
  startExtractionController
);
router.post(
  "/:samplePaperId/publish",
  authorizeFeature(SAMPLE_PAPERS_MANAGEMENT_FEATURE, "can_update"),
  publishSamplePaperController
);
router.put(
  "/questions/:questionId",
  authorizeFeature(SAMPLE_PAPERS_MANAGEMENT_FEATURE, "can_update"),
  validateBody(updateSamplePaperQuestionSchema),
  updateSamplePaperQuestionController
);
router.post(
  "/questions/:questionId/draft-answer",
  authorizeFeature(SAMPLE_PAPERS_MANAGEMENT_FEATURE, "can_update"),
  draftAnswerForQuestionController
);
router.post(
  "/questions/:questionId/approve",
  authorizeFeature(SAMPLE_PAPERS_MANAGEMENT_FEATURE, "can_update"),
  approveSamplePaperQuestionController
);

export default router;
