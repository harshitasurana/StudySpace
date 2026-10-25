import Joi from "joi";

export const generateQuizSchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
  num_questions: Joi.number().integer().min(1).max(20).default(10),
  attempt_type: Joi.string().valid("quiz", "mock_test", "pre_assessment").default("quiz"),
  // "standard" (default) | "formula" | "concept" | "challenge" — changes
  // what the AI service is asked to emphasize when generating questions
  // (see quiz_service.js's buildQuizFocus). "timed" (Practice's other mode)
  // doesn't need a distinct backend mode - it's the same standard
  // generation with just a client-side countdown timer.
  mode: Joi.string().valid("standard", "formula", "concept", "challenge").default("standard"),
  // Convert-a-note-to-quiz — when set, generation is grounded in this
  // exact text instead of the chapter's RAG content.
  source_text: Joi.string().trim().min(1).max(8000).allow(null).optional(),
});

export const attemptsQuerySchema = Joi.object({
  attempt_type: Joi.string().valid("quiz", "mock_test", "pre_assessment").optional(),
  // Opt-in — pages that actually generate quizzes/mock tests (Quiz.jsx,
  // MockTests.jsx) pass this to also see their own in-flight
  // (processing/failed) generations, so a student who navigated away
  // mid-generation can find their way back. Defaults to false so
  // review-only pages (TestHistory.jsx) keep seeing exactly what they
  // always have — every attempt here is already-completed generation,
  // which their score-trend/duration/mistake-review logic assumes.
  include_generating: Joi.boolean().optional(),
});

export const mistakesQuerySchema = Joi.object({
  subject_id: Joi.number().integer().optional(),
  attempt_type: Joi.string().valid("quiz", "mock_test", "pre_assessment").optional(),
});

export const submitAnswerSchema = Joi.object({
  question_index: Joi.number().integer().min(0).required(),
  selected_answer: Joi.string().trim().min(1).max(10).required(),
});

export const attemptParamsSchema = Joi.object({
  attemptId: Joi.number().integer().required(),
});
