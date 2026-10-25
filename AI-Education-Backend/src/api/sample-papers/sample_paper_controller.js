import {
  listPublishedSamplePapersService,
  getSamplePaperForStudentService,
  startAttemptService,
  uploadAnswerPdfService,
  submitPaperService,
  getAttemptService,
  listAttemptsService,
} from "./sample_paper_service.js";
import { recordGradingCallbackService } from "./sample_paper_grading_service.js";

export const listSamplePapersController = async (req, res) => {
  try {
    const subjectId = req.query?.subject_id ? Number(req.query.subject_id) : undefined;
    const papers = await listPublishedSamplePapersService(req.user?.user_id, { subjectId });
    return res.status(200).json({ success: true, data: papers });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch sample papers" });
  }
};

export const getSamplePaperController = async (req, res) => {
  try {
    const paper = await getSamplePaperForStudentService(req.user?.user_id, req.params.samplePaperId);
    return res.status(200).json({ success: true, data: paper });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch sample paper" });
  }
};

export const startAttemptController = async (req, res) => {
  try {
    const attempt = await startAttemptService(req.user?.user_id, req.params.samplePaperId);
    return res.status(201).json({ success: true, data: attempt });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to start attempt" });
  }
};

export const uploadAnswerPdfController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "A PDF file is required" });
    }
    const attempt = await uploadAnswerPdfService(req.user?.user_id, req.params.attemptId, req.file);
    return res.status(200).json({ success: true, data: attempt });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to upload answer PDF" });
  }
};

export const submitPaperController = async (req, res) => {
  try {
    const attempt = await submitPaperService(req.user?.user_id, req.params.attemptId);
    return res.status(200).json({ success: true, data: attempt });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to submit paper" });
  }
};

export const getAttemptController = async (req, res) => {
  try {
    const attempt = await getAttemptService(req.user?.user_id, req.params.attemptId);
    return res.status(200).json({ success: true, data: attempt });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch attempt" });
  }
};

export const listAttemptsController = async (req, res) => {
  try {
    const attempts = await listAttemptsService(req.user?.user_id);
    return res.status(200).json({ success: true, data: attempts });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch attempts" });
  }
};

export const gradingCallbackController = async (req, res) => {
  try {
    const attempt = await recordGradingCallbackService(req.params.attemptId, req.body);
    return res.status(200).json({ success: true, data: attempt });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to record grading callback" });
  }
};
