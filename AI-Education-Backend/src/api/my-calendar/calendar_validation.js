import Joi from "joi";
import { EVENT_TYPES, EXAM_TYPES } from "./calendar_constants.js";

// EXAM is deliberately excluded here — exams go through createExamSchema
// (POST /events/exam) instead, since they need exam_type/total_marks/
// chapter_ids that a plain event never has.
const NON_EXAM_EVENT_TYPES = EVENT_TYPES.filter((t) => t !== "EXAM");

export const listEventsQuerySchema = Joi.object({
  start: Joi.date().iso().optional(),
  end: Joi.date().iso().optional(),
  event_type: Joi.string().valid(...EVENT_TYPES).optional(),
  subject_id: Joi.number().integer().optional(),
});

export const createEventSchema = Joi.object({
  event_type: Joi.string().valid(...NON_EXAM_EVENT_TYPES).required(),
  title: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(2000).optional().allow(null, ""),
  start_datetime: Joi.date().iso().required(),
  end_datetime: Joi.date().iso().min(Joi.ref("start_datetime")).required(),
  all_day: Joi.boolean().optional(),
  subject_id: Joi.number().integer().optional().allow(null),
  chapter_id: Joi.number().integer().optional().allow(null),
  notes: Joi.string().trim().max(2000).optional().allow(null, ""),
  color: Joi.string().trim().max(20).optional().allow(null, ""),
});

export const createExamSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(2000).optional().allow(null, ""),
  start_datetime: Joi.date().iso().required(),
  end_datetime: Joi.date().iso().min(Joi.ref("start_datetime")).required(),
  all_day: Joi.boolean().optional(),
  subject_id: Joi.number().integer().required(),
  exam_type: Joi.string().valid(...EXAM_TYPES).required(),
  total_marks: Joi.number().integer().min(0).optional().allow(null),
  chapter_ids: Joi.array().items(Joi.number().integer()).min(1).required(),
  notes: Joi.string().trim().max(2000).optional().allow(null, ""),
  color: Joi.string().trim().max(20).optional().allow(null, ""),
});

export const updateEventSchema = Joi.object({
  event_type: Joi.string().valid(...EVENT_TYPES).optional(),
  title: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(2000).optional().allow(null, ""),
  start_datetime: Joi.date().iso().optional(),
  end_datetime: Joi.date().iso().optional(),
  all_day: Joi.boolean().optional(),
  subject_id: Joi.number().integer().optional().allow(null),
  chapter_id: Joi.number().integer().optional().allow(null),
  status: Joi.string().valid("scheduled", "completed", "cancelled").optional(),
  notes: Joi.string().trim().max(2000).optional().allow(null, ""),
  color: Joi.string().trim().max(20).optional().allow(null, ""),
  // Exam-only fields — accepted on update too, so editing an exam's marks/
  // chapters doesn't require a separate endpoint.
  exam_type: Joi.string().valid(...EXAM_TYPES).optional(),
  total_marks: Joi.number().integer().min(0).optional().allow(null),
  chapter_ids: Joi.array().items(Joi.number().integer()).min(1).optional(),
});

export const eventParamsSchema = Joi.object({
  id: Joi.number().integer().required(),
});

export const upcomingQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).optional(),
});
