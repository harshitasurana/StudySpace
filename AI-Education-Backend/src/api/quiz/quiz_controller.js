import {
  generateQuizService,
  submitAnswerService,
  listAttemptsService,
  listMistakesService,
  getTestReviewService,
  getQuizStatusService,
  recordQuizGenerationCallbackService,
} from "./quiz_service.js";

export const generateController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { chapter_id, num_questions, attempt_type, mode, source_text } = req.body;

    const result = await generateQuizService(userId, {
      chapterId: chapter_id,
      numQuestions: num_questions,
      attemptType: attempt_type,
      mode,
      sourceText: source_text,
      addedByUserId: req.user.acting_as_parent_user_id || null,
    });
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to generate quiz" });
  }
};

export const getQuizStatusController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const attemptId = Number(req.params.attemptId);
    const result = await getQuizStatusService(userId, attemptId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to fetch quiz status" });
  }
};

// Called by RAGProductionApp's Celery worker (core/quiz_tasks.py), not
// the browser — see verifyServiceKey in quiz_routes.js for the auth
// check.
export const quizGenerationCallbackController = async (req, res) => {
  try {
    const attempt = await recordQuizGenerationCallbackService(req.params.attemptId, req.body);
    return res.status(200).json({ success: true, data: attempt });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to record callback" });
  }
};

export const listAttemptsController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const result = await listAttemptsService(userId, {
      attemptType: req.query.attempt_type,
      // validateQuery (common/middlewares/validate.js) now applies Joi's
      // coerced/defaulted value back onto req.query, so this is a real
      // boolean here, not the raw query string.
      includeGenerating: req.query.include_generating === true,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load attempts" });
  }
};

export const listMistakesController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const result = await listMistakesService(userId, {
      subjectId: req.query.subject_id ? Number(req.query.subject_id) : undefined,
      attemptType: req.query.attempt_type,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load mistakes" });
  }
};

export const getTestReviewController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const result = await getTestReviewService(userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to load test review" });
  }
};

export const submitAnswerController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const attemptId = Number(req.params.attemptId);
    const { question_index, selected_answer } = req.body;

    const result = await submitAnswerService(userId, attemptId, {
      questionIndex: question_index,
      selectedAnswer: selected_answer,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to submit answer" });
  }
};
