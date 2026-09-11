import {
  startIngestionService,
  processChapterService,
  recordIngestionCallbackService,
  recordIngestionProgressService,
  getGenerationStatusService,
  getChapterProcessingOverviewService,
  listIngestionJobsService,
  getIngestionJobService,
  pauseIngestionJobService,
  getPauseStatusService,
  resumeIngestionJobService,
  retryIngestionJobService,
  getSystemResourcesService,
} from "./ingestion_service.js";
import { createEducationError } from "../../education_errors.js";

export const startIngestionController = async (req, res) => {
  try {
    if (!req.file) {
      throw createEducationError("A PDF file is required", 400, "FILE_REQUIRED");
    }

    const chapterId = Number(req.params.chapterId);
    const job = await startIngestionService(chapterId, req.file, req.user?.user_id);

    return res.status(202).json({ success: true, message: "Ingestion started", data: job });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to start ingestion" });
  }
};

// Ticks any combination of text/images/enrich/mindmap/slidedeck for one
// chapter — the single entrypoint the admin checklist UI submits to.
// steps arrives as a JSON string in the multipart body (multer only
// gives plain string fields), same as any other multipart form field.
export const processChapterController = async (req, res) => {
  try {
    const chapterId = Number(req.params.chapterId);
    let steps;
    try {
      steps = JSON.parse(req.body?.steps || "[]");
    } catch {
      throw createEducationError("steps must be a JSON array", 400, "INVALID_STEPS");
    }

    // Always force — this endpoint is only ever an explicit admin click,
    // never the automatic post-ingestion chaining in
    // recordIngestionCallbackService (which calls the pregenerate*
    // services directly and keeps the normal cooldown). An admin retrying
    // a failed mind map/slide deck/infographic right after seeing it fail
    // shouldn't silently no-op because STUCK_ROW_THRESHOLD_MS hasn't
    // elapsed yet.
    const result = await processChapterService(chapterId, req.file || null, steps, req.user?.user_id, { force: true });
    return res.status(202).json({ success: true, message: "Processing started", data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to start processing" });
  }
};

export const getChapterProcessingOverviewController = async (req, res) => {
  try {
    const subjectId = req.query?.subject_id ? Number(req.query.subject_id) : null;
    const data = await getChapterProcessingOverviewService(subjectId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch chapter processing overview" });
  }
};

export const listIngestionJobsController = async (req, res) => {
  try {
    const chapterId = req.query?.chapter_id ? Number(req.query.chapter_id) : null;
    const subjectId = req.query?.subject_id ? Number(req.query.subject_id) : null;
    const jobs = await listIngestionJobsService(chapterId, subjectId);
    return res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch ingestion jobs" });
  }
};

export const getIngestionJobController = async (req, res) => {
  try {
    const job = await getIngestionJobService(req.params.jobId);
    return res.status(200).json({ success: true, data: job });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch ingestion job" });
  }
};

export const pauseIngestionJobController = async (req, res) => {
  try {
    const job = await pauseIngestionJobService(req.params.jobId);
    return res.status(200).json({ success: true, message: "Pause requested", data: job });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to pause ingestion job" });
  }
};

// Polled by the AI service itself (verifyServiceKey) — see
// ingestion_routes.js. Not admin-authenticated.
export const getPauseStatusController = async (req, res) => {
  try {
    const result = await getPauseStatusService(req.params.jobId);
    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch pause status" });
  }
};

export const resumeIngestionJobController = async (req, res) => {
  try {
    const job = await resumeIngestionJobService(req.params.jobId, req.file || null, req.user?.user_id);
    return res.status(202).json({ success: true, message: "Resumed", data: job });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to resume ingestion job" });
  }
};

export const retryIngestionJobController = async (req, res) => {
  try {
    const job = await retryIngestionJobService(req.params.jobId, req.file || null, req.user?.user_id);
    return res.status(202).json({ success: true, message: "Retrying", data: job });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to retry ingestion job" });
  }
};

// Mind map / slide deck / infographic status for one chapter — the
// admin-facing counterpart to listIngestionJobsController's text/images/
// enrich rows, read from their own tables since they never got a
// job_type row here (see getGenerationStatusService).
export const getGenerationStatusController = async (req, res) => {
  try {
    const chapterId = Number(req.params.chapterId);
    const result = await getGenerationStatusService(chapterId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch generation status" });
  }
};

// Called by RAGProductionApp (FastAPI), not the browser — see
// verifyServiceKey in ingestion_routes.js for the auth check.
export const ingestionCallbackController = async (req, res) => {
  try {
    const job = await recordIngestionCallbackService(req.params.jobId, req.body);
    return res.status(200).json({ success: true, data: job });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to record callback" });
  }
};

// Same caller/auth as the completion callback above, but fires many
// times over a job's lifetime instead of once at the end — see
// recordIngestionProgressService for why it never touches `status`.
export const ingestionProgressController = async (req, res) => {
  try {
    const job = await recordIngestionProgressService(req.params.jobId, req.body);
    return res.status(200).json({ success: true, data: job });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to record progress" });
  }
};

export const getSystemResourcesController = async (req, res) => {
  try {
    const data = await getSystemResourcesService();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch system resources" });
  }
};
