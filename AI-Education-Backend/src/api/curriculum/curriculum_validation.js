import Joi from "joi";

// class_id is intentionally optional here — a student caller never sends
// it (the controller derives it server-side from their own profile); a
// staff caller must send it, which the controller enforces at runtime
// since that requirement depends on who's calling, not just the shape.
export const chaptersQuerySchema = Joi.object({
  subject_id: Joi.number().integer().required(),
  class_id: Joi.number().integer().optional(),
  // Opt-in — checking NCERT Notes/Solutions availability makes one live
  // HTTP call to RAGProductionApp PER CHAPTER (see
  // getChaptersService). Only LearningPath.jsx actually shows those
  // cards; every other caller (Quiz/Flashcards/MockTests/PreAssessment/
  // chapter dropdowns, etc.) just needs id/name/order and was paying
  // that cost for nothing, which is what made "chapters" feel slow to
  // populate everywhere else.
  include_ncert_availability: Joi.boolean().default(false),
});

// NULL/omitted for every subject with no prose/poetry split — only
// English (so far) actually uses this. See the migration's own comment.
const contentTypeSchema = Joi.string().valid("prose", "poetry").optional().allow(null);

export const createChapterSchema = Joi.object({
  subject_id: Joi.number().integer().required(),
  class_id: Joi.number().integer().required(),
  name: Joi.string().max(200).required(),
  chapter_order: Joi.number().integer().required(),
  // Used to be required — the admin typed a filename by hand for the old
  // manual ingest_books.py script to resolve on disk. Now auto-generated
  // server-side (see createChapterService) when omitted, since the real
  // ingestion pipeline no longer needs an admin-supplied filename.
  source_file: Joi.string().max(150).optional().allow(null, ""),
  icon: Joi.string().max(50).optional().allow(null, ""),
  academic_year: Joi.string().max(20).optional().allow(null, ""),
  content_type: contentTypeSchema,
});

export const updateChapterSchema = Joi.object({
  subject_id: Joi.number().integer().optional(),
  class_id: Joi.number().integer().optional(),
  name: Joi.string().max(200).optional(),
  chapter_order: Joi.number().integer().optional(),
  source_file: Joi.string().max(150).optional().allow(null, ""),
  icon: Joi.string().max(50).optional().allow(null, ""),
  is_active: Joi.boolean().optional(),
  academic_year: Joi.string().max(20).optional().allow(null, ""),
  content_type: contentTypeSchema,
});

export const updateProgressSchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
  progress_percent: Joi.number().min(0).max(100).optional(),
  status: Joi.string().valid("not_started", "in_progress", "completed").optional(),
  last_page_index: Joi.number().integer().min(0).optional(),
  // true = "I explicitly skipped ahead and unlocked this chapter" — the
  // server sets its own timestamp and never trusts a client-supplied one;
  // sending false/omitting never clears an existing unlock.
  manually_unlocked: Joi.boolean().optional(),
});
