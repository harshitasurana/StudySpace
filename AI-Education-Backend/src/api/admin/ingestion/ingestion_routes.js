import express from "express";
import multer from "multer";
import {
  startIngestionController,
  processChapterController,
  listIngestionJobsController,
  getIngestionJobController,
  ingestionCallbackController,
  ingestionProgressController,
  getGenerationStatusController,
  getChapterProcessingOverviewController,
  pauseIngestionJobController,
  getPauseStatusController,
  resumeIngestionJobController,
  retryIngestionJobController,
  getSystemResourcesController,
} from "./ingestion_controller.js";
import { authenticate, authorizeFeature } from "../../../common/middlewares/auth_middleware.js";

const CURRICULUM_MANAGEMENT_FEATURE = "Curriculum Management";

// Chapter PDFs only — same memoryStorage pattern as
// common/utils/fileUpload.js, sized for a full textbook chapter rather than
// that file's smaller document limits.
const uploadChapterPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    return cb(new Error("Only PDF files are accepted"));
  },
}).single("file");

// Verifies calls actually come from RAGProductionApp (the FastAPI service),
// not a browser — same shared secret it already uses to verify Node's own
// calls to it (ai_service_client.js), just checked in the reverse direction.
const verifyServiceKey = (req, res, next) => {
  const expected = process.env.AI_SERVICE_KEY;
  const provided = req.headers["x-service-key"];
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, message: "Invalid or missing service key" });
  }
  return next();
};

const router = express.Router();

router.post("/callback/:jobId", verifyServiceKey, ingestionCallbackController);
router.post("/progress/:jobId", verifyServiceKey, ingestionProgressController);
// Polled by the running Celery images task once per page (see
// image_ingestion_tasks.py's _check_pause_requested) — same
// service-key posture as callback/progress above, since it's FastAPI
// calling in, not a browser.
router.get("/:jobId/pause-status", verifyServiceKey, getPauseStatusController);

router.use(authenticate);

router.post(
  "/chapters/:chapterId/ingest",
  authorizeFeature(CURRICULUM_MANAGEMENT_FEATURE, "can_update"),
  uploadChapterPdf,
  startIngestionController
);
// The admin checklist's single entrypoint — any combination of
// text/images/enrich/mindmap/slidedeck/infographic. File is optional here
// (enforced server-side in processChapterService, not by multer) since
// enrich/mindmap/slidedeck/infographic-only requests never carry one.
router.post(
  "/chapters/:chapterId/process",
  authorizeFeature(CURRICULUM_MANAGEMENT_FEATURE, "can_update"),
  uploadChapterPdf,
  processChapterController
);
// Mind map / slide deck / infographic status for one chapter — read
// alongside listIngestionJobsController's text/images/enrich rows to
// build the admin screen's combined "what's happening" view.
router.get("/chapters/:chapterId/generation-status", getGenerationStatusController);
// The Ingestion Monitor's default, chapter-grouped view — must be
// registered before GET /:jobId below or Express would try to match
// "chapters-overview" as a job id instead.
router.get("/chapters-overview", getChapterProcessingOverviewController);
router.post(
  "/:jobId/pause",
  authorizeFeature(CURRICULUM_MANAGEMENT_FEATURE, "can_update"),
  pauseIngestionJobController
);
// Same PDF re-upload requirement as the initial /chapters/:chapterId/ingest
// call — this pipeline never persists the original upload anywhere Node
// can hand back on its own (see resumeIngestionJobService's own comment).
router.post(
  "/:jobId/resume",
  authorizeFeature(CURRICULUM_MANAGEMENT_FEATURE, "can_update"),
  uploadChapterPdf,
  resumeIngestionJobController
);
// Restarts a 'failed' or 'pending' job of any type. File is always
// required for images (same re-upload constraint as resume above); for
// text it's optional — retryIngestionJobService falls back to the PDF
// already sitting in MinIO from the original attempt when one isn't
// given. Not needed for enrich. All enforced server-side.
router.post(
  "/:jobId/retry",
  authorizeFeature(CURRICULUM_MANAGEMENT_FEATURE, "can_update"),
  uploadChapterPdf,
  retryIngestionJobController
);
router.get("/system-resources", getSystemResourcesController);
router.get("/", listIngestionJobsController);
router.get("/:jobId", getIngestionJobController);

export default router;
