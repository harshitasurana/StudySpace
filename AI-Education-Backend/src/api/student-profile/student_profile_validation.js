import Joi from "joi";

export const createStudentProfileSchema = Joi.object({
  board_id: Joi.number().integer().required(),
  class_id: Joi.number().integer().required(),
  subject_ids: Joi.array().items(Joi.number().integer()).min(1).required(),
  learning_mode: Joi.string().valid("self", "school").default("self"),
  academic_year: Joi.string().trim().max(20).optional().allow(null, ""),
  school_name: Joi.string().trim().max(255).optional().allow(null, ""),
  section: Joi.string().trim().max(20).optional().allow(null, ""),
  roll_number: Joi.string().trim().max(50).optional().allow(null, ""),
});
