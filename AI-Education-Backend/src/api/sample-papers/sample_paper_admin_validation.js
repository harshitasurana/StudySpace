import Joi from "joi";

export const createSamplePaperSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  subject_id: Joi.number().integer().required(),
  class_id: Joi.number().integer().required(),
  paper_type: Joi.string().valid("major_test", "semi_major").required(),
});

const rubricCriterionSchema = Joi.object({
  criterion: Joi.string().trim().min(1).required(),
  marks: Joi.number().min(0).required(),
});

export const updateSamplePaperQuestionSchema = Joi.object({
  question_text: Joi.string().trim().min(1).optional(),
  question_type: Joi.string().valid("short_answer", "long_answer", "numerical", "diagram_based").optional(),
  question_media: Joi.string().valid("none", "image").optional(),
  question_media_key: Joi.string().trim().max(500).allow(null).optional(),
  input_type: Joi.string().valid("typed", "photo", "typed_or_photo").optional(),
  grading_strategy: Joi.string()
    .valid("exact", "numeric", "rubric", "handwriting_rubric", "diagram_rubric", "graph_rubric")
    .optional(),
  max_marks: Joi.number().integer().min(1).optional(),
  model_answer: Joi.string().trim().allow(null, "").optional(),
  rubric_criteria: Joi.array().items(rubricCriterionSchema).allow(null).optional(),
  rubric_notes: Joi.string().trim().allow(null, "").optional(),
  chapter_id: Joi.number().integer().allow(null).optional(),
});
