import Joi from "joi";

export const classesQuerySchema = Joi.object({
  board_id: Joi.number().integer().optional(),
});

export const subjectsQuerySchema = Joi.object({
  board_id: Joi.number().integer().optional(),
  class_id: Joi.number().integer().optional(),
  // Student-facing callers never set this (default false = active only).
  // The admin Curriculum screen sets it true so a deactivated subject
  // doesn't disappear from its own management UI along with the
  // student-facing selectors it also feeds.
  include_inactive: Joi.boolean().default(false),
});

export const createBoardSchema = Joi.object({
  name: Joi.string().max(150).required(),
  code: Joi.string().max(30).optional().allow(null, ""),
  description: Joi.string().max(255).optional().allow(null, ""),
});

export const createClassSchema = Joi.object({
  name: Joi.string().max(50).required(),
  grade_level: Joi.number().integer().optional().allow(null),
  board_id: Joi.number().integer().optional().allow(null),
});

export const createSubjectSchema = Joi.object({
  name: Joi.string().max(100).required(),
  code: Joi.string().max(30).optional().allow(null, ""),
  board_id: Joi.number().integer().optional().allow(null),
  class_id: Joi.number().integer().optional().allow(null),
  description: Joi.string().max(255).optional().allow(null, ""),
});

// Just the active/inactive toggle for now — the admin Curriculum
// screen's only subject-editing action today. Not a general subject
// editor (name/code/board/class stay create-time-only, same as before).
export const updateSubjectSchema = Joi.object({
  is_active: Joi.boolean().required(),
});
