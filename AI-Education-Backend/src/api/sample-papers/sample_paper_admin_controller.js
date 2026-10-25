import {
  createSamplePaperService,
  listSamplePapersAdminService,
  getSamplePaperAdminService,
  startExtractionService,
  recordExtractionCallbackService,
  listExtractionJobsService,
  updateSamplePaperQuestionService,
  draftAnswerForQuestionService,
  approveSamplePaperQuestionService,
  publishSamplePaperService,
} from "./sample_paper_admin_service.js";

export const createSamplePaperController = async (req, res) => {
  try {
    const paper = await createSamplePaperService(req.user?.user_id, {
      title: req.body.title,
      subjectId: req.body.subject_id,
      classId: req.body.class_id,
      paperType: req.body.paper_type,
    });
    return res.status(201).json({ success: true, data: paper });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to create sample paper" });
  }
};

export const listSamplePapersController = async (req, res) => {
  try {
    const papers = await listSamplePapersAdminService({ status: req.query?.status });
    return res.status(200).json({ success: true, data: papers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch sample papers" });
  }
};

export const getSamplePaperController = async (req, res) => {
  try {
    const paper = await getSamplePaperAdminService(req.params.samplePaperId);
    return res.status(200).json({ success: true, data: paper });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch sample paper" });
  }
};

export const startExtractionController = async (req, res) => {
  try {
    const paperFile = req.files?.paper_file?.[0];
    const solutionFile = req.files?.solution_file?.[0];
    if (!paperFile || !solutionFile) {
      return res.status(400).json({ success: false, message: "Both paper_file and solution_file are required" });
    }
    const job = await startExtractionService(req.params.samplePaperId, paperFile, solutionFile, req.user?.user_id);
    return res.status(202).json({ success: true, message: "Extraction started", data: job });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to start extraction" });
  }
};

export const listExtractionJobsController = async (req, res) => {
  try {
    const samplePaperId = req.query?.sample_paper_id || null;
    const jobs = await listExtractionJobsService(samplePaperId);
    return res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch extraction jobs" });
  }
};

// Called by RAGProductionApp (FastAPI), not the browser — see
// verifyServiceKey in sample_paper_admin_routes.js.
export const extractionCallbackController = async (req, res) => {
  try {
    const job = await recordExtractionCallbackService(req.params.jobId, req.body);
    return res.status(200).json({ success: true, data: job });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to record callback" });
  }
};

export const updateSamplePaperQuestionController = async (req, res) => {
  try {
    const question = await updateSamplePaperQuestionService(req.params.questionId, req.body);
    return res.status(200).json({ success: true, data: question });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to update question" });
  }
};

export const draftAnswerForQuestionController = async (req, res) => {
  try {
    const question = await draftAnswerForQuestionService(req.params.questionId);
    return res.status(200).json({ success: true, data: question });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to draft an answer" });
  }
};

export const approveSamplePaperQuestionController = async (req, res) => {
  try {
    const question = await approveSamplePaperQuestionService(req.params.questionId);
    return res.status(200).json({ success: true, data: question });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to approve question" });
  }
};

export const publishSamplePaperController = async (req, res) => {
  try {
    const paper = await publishSamplePaperService(req.params.samplePaperId, req.user?.user_id);
    return res.status(200).json({ success: true, data: paper });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to publish sample paper" });
  }
};
