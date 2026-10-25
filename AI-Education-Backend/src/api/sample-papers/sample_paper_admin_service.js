import { SamplePaper, SamplePaperSection, SamplePaperQuestion } from "./sample_paper_schema.js";
import { SamplePaperExtractionJob } from "./sample_paper_extraction_schema.js";
import { EducationAcademicSubject } from "../academic/academic_schema.js";
import { buildStorageKey, uploadStoredFile, STORAGE_CATEGORIES, FILE_VISIBILITY } from "../../common/services/fileStorage.service.js";
import { triggerSamplePaperExtraction, draftSamplePaperAnswer } from "../../common/services/ai_service_client.js";
import { createEducationError } from "../education_errors.js";
import sequelize from "../../config/database.js";

export const createSamplePaperService = async (userId, { title, subjectId, classId, paperType }) => {
  return SamplePaper.create({
    title,
    subject_id: subjectId,
    class_id: classId,
    paper_type: paperType,
    status: "draft",
    created_by: userId || null,
  });
};

export const listSamplePapersAdminService = async ({ status } = {}) => {
  const where = status ? { status } : {};
  return SamplePaper.findAll({
    where,
    include: [
      { model: SamplePaperQuestion, as: "questions", attributes: ["question_id", "review_status"] },
    ],
    order: [["created_at", "DESC"]],
  });
};

export const getSamplePaperAdminService = async (samplePaperId) => {
  const paper = await SamplePaper.findOne({
    where: { sample_paper_id: samplePaperId },
    include: [
      { model: SamplePaperSection, as: "sections", order: [["order_index", "ASC"]] },
      { model: SamplePaperQuestion, as: "questions" },
    ],
  });
  if (!paper) throw createEducationError("Sample paper not found", 404, "SAMPLE_PAPER_NOT_FOUND");
  paper.questions?.sort?.((a, b) => a.question_order - b.question_order);
  return paper;
};

/**
 * Uploads both real source PDFs (Paper + Solution — extraction needs both
 * to match questions to their real answers, see
 * core/sample_paper_extraction.py), creates the job row, and hands off to
 * FastAPI. Mirrors ingestion_service.js's startIngestionService shape:
 * job created first, hand-off failure fails the job immediately rather
 * than leaving it stuck at "pending" with nothing to ever update it.
 */
export const startExtractionService = async (samplePaperId, paperFile, solutionFile, userId) => {
  const paper = await SamplePaper.findOne({ where: { sample_paper_id: samplePaperId } });
  if (!paper) throw createEducationError("Sample paper not found", 404, "SAMPLE_PAPER_NOT_FOUND");

  const paperKey = buildStorageKey({
    category: STORAGE_CATEGORIES.SAMPLE_PAPER_SOURCE,
    samplePaperId,
    originalName: paperFile.originalname,
  });
  const solutionKey = buildStorageKey({
    category: STORAGE_CATEGORIES.SAMPLE_PAPER_SOLUTION,
    samplePaperId,
    originalName: solutionFile.originalname,
  });
  await uploadStoredFile({ file: paperFile, key: paperKey, visibility: FILE_VISIBILITY.PRIVATE });
  await uploadStoredFile({ file: solutionFile, key: solutionKey, visibility: FILE_VISIBILITY.PRIVATE });
  await paper.update({ source_pdf_key: paperKey, source_solution_pdf_key: solutionKey });

  const job = await SamplePaperExtractionJob.create({
    sample_paper_id: samplePaperId,
    status: "pending",
    source_filename: paperFile.originalname,
    solution_filename: solutionFile.originalname,
    requested_by: userId || null,
  });

  try {
    await triggerSamplePaperExtraction({
      paperBuffer: paperFile.buffer,
      paperFilename: paperFile.originalname,
      solutionBuffer: solutionFile.buffer,
      solutionFilename: solutionFile.originalname,
      jobId: job.id,
      paperType: paper.paper_type,
    });
    await job.update({ status: "processing" });
  } catch (err) {
    await job.update({ status: "failed", error_message: err.message || "Failed to reach the extraction service" });
  }

  return job;
};

/**
 * Idempotent: only bulk-creates questions if the job is still
 * pending/processing (checked and flipped to completed/failed in the
 * same pass) — a retried callback for a job already settled is a no-op,
 * not a second set of duplicate questions.
 *
 * Wrapped in a real DB transaction — question inserts, the paper's
 * total_marks update, and the job's completed/questions_extracted update
 * all commit or roll back together. Previously these were sequential
 * unwrapped awaits: a real interruption partway through (a server
 * restart mid-callback, which this dev environment hit more than once)
 * left all 31 real extracted questions successfully inserted but the
 * paper's total_marks and the job's status never updated — the job sat
 * in "processing" forever even though the extraction had genuinely
 * succeeded. A transaction makes that specific half-done state
 * impossible going forward: either everything here lands, or none of it
 * does, and a retried callback picks it up cleanly.
 */
export const recordExtractionCallbackService = async (jobId, { status, questions, error_message }) => {
  return sequelize.transaction(async (t) => {
    const job = await SamplePaperExtractionJob.findOne({ where: { id: jobId }, transaction: t, lock: t.LOCK.UPDATE });
    if (!job) throw createEducationError("Extraction job not found", 404, "EXTRACTION_JOB_NOT_FOUND");

    if (job.status === "completed" || job.status === "failed") {
      return job; // already settled — retried callback, no-op
    }

    if (status === "failed") {
      await job.update({ status: "failed", error_message: error_message || "Extraction failed" }, { transaction: t });
      return job;
    }

    const rows = Array.isArray(questions) ? questions : [];
    let created = 0;
    for (const q of rows) {
      if (!q.text || !q.question_type || !q.input_type || !q.grading_strategy || !q.marks) continue;
      await SamplePaperQuestion.create(
        {
          sample_paper_id: job.sample_paper_id,
          question_order: q.question_number,
          question_text: q.text,
          question_type: q.question_type,
          question_media: q.question_media || "none",
          input_type: q.input_type,
          grading_strategy: q.grading_strategy,
          max_marks: q.marks,
          model_answer: q.answer_text || null,
          rubric_criteria: q.rubric_criteria && q.rubric_criteria.length > 0 ? q.rubric_criteria : null,
          answer_source: q.answer_source || "unmatched",
          review_status: "ai_extracted",
        },
        { transaction: t }
      );
      created += 1;
    }

    const paper = await SamplePaper.findOne({ where: { sample_paper_id: job.sample_paper_id }, transaction: t });
    if (paper && !paper.total_marks) {
      const totalMarks = rows.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
      await paper.update({ total_marks: totalMarks }, { transaction: t });
    }

    await job.update({ status: "completed", questions_extracted: created }, { transaction: t });
    return job;
  });
};

export const listExtractionJobsService = async (samplePaperId = null) => {
  const where = samplePaperId ? { sample_paper_id: samplePaperId } : {};
  return SamplePaperExtractionJob.findAll({ where, order: [["created_at", "DESC"]] });
};

const rubricSumMatchesMarks = (question) => {
  if (!question.rubric_criteria || question.rubric_criteria.length === 0) return true;
  const sum = question.rubric_criteria.reduce((s, c) => s + (Number(c.marks) || 0), 0);
  return sum === question.max_marks;
};

export const updateSamplePaperQuestionService = async (questionId, updates) => {
  const question = await SamplePaperQuestion.findOne({ where: { question_id: questionId } });
  if (!question) throw createEducationError("Question not found", 404, "SAMPLE_PAPER_QUESTION_NOT_FOUND");

  const allowed = [
    "question_text", "question_type", "question_media", "question_media_key",
    "input_type", "grading_strategy", "max_marks", "model_answer",
    "rubric_criteria", "rubric_notes", "chapter_id",
  ];
  const patch = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) patch[key] = updates[key];
  }
  patch.review_status = "admin_edited";

  const merged = { ...question.toJSON(), ...patch };
  if (!rubricSumMatchesMarks(merged)) {
    throw createEducationError(
      "Rubric criteria marks must sum to the question's max_marks",
      400,
      "RUBRIC_MARKS_MISMATCH"
    );
  }

  await question.update(patch);
  return question;
};

/**
 * Fallback only — for a question extraction couldn't match to its real
 * Solution entry (answer_source: 'unmatched'). Never overwrites a
 * solution-sourced or already-admin-edited answer; the draft still lands
 * at review_status: 'ai_extracted' and answer_source: 'rag_drafted' so
 * the review UI keeps flagging it as AI-drafted, not from the teacher's
 * solution, until an admin reviews/edits and approves it like anything
 * else.
 */
export const draftAnswerForQuestionService = async (questionId) => {
  const question = await SamplePaperQuestion.findOne({
    where: { question_id: questionId },
    include: [{ model: SamplePaper, as: "samplePaper", include: [{ model: EducationAcademicSubject, as: "subject" }] }],
  });
  if (!question) throw createEducationError("Question not found", 404, "SAMPLE_PAPER_QUESTION_NOT_FOUND");
  if (question.answer_source === "solution_matched") {
    throw createEducationError(
      "This question already has a real solution-sourced answer",
      400,
      "ALREADY_SOLUTION_MATCHED"
    );
  }

  const draft = await draftSamplePaperAnswer({
    questionText: question.question_text,
    maxMarks: question.max_marks,
    subject: question.samplePaper?.subject?.name || "",
  });

  if (!draft.model_answer) {
    throw createEducationError("The AI draft came back empty — try again or fill in the answer manually", 502, "DRAFT_EMPTY");
  }

  await question.update({
    model_answer: draft.model_answer,
    rubric_criteria: draft.rubric_criteria && draft.rubric_criteria.length > 0 ? draft.rubric_criteria : null,
    answer_source: "rag_drafted",
    review_status: "ai_extracted",
  });
  return question;
};

export const approveSamplePaperQuestionService = async (questionId) => {
  const question = await SamplePaperQuestion.findOne({ where: { question_id: questionId } });
  if (!question) throw createEducationError("Question not found", 404, "SAMPLE_PAPER_QUESTION_NOT_FOUND");

  if (!rubricSumMatchesMarks(question)) {
    throw createEducationError(
      "Rubric criteria marks must sum to the question's max_marks before approval",
      400,
      "RUBRIC_MARKS_MISMATCH"
    );
  }
  if (!question.model_answer) {
    throw createEducationError("A model answer is required before approval", 400, "MODEL_ANSWER_REQUIRED");
  }

  await question.update({ review_status: "approved" });
  return question;
};

export const publishSamplePaperService = async (samplePaperId, userId) => {
  const paper = await SamplePaper.findOne({
    where: { sample_paper_id: samplePaperId },
    include: [{ model: SamplePaperQuestion, as: "questions" }],
  });
  if (!paper) throw createEducationError("Sample paper not found", 404, "SAMPLE_PAPER_NOT_FOUND");

  if (!paper.questions || paper.questions.length === 0) {
    throw createEducationError("This paper has no questions to publish", 400, "NO_QUESTIONS");
  }
  const unapproved = paper.questions.filter((q) => q.review_status !== "approved");
  if (unapproved.length > 0) {
    throw createEducationError(
      `${unapproved.length} question(s) are not yet approved`,
      400,
      "QUESTIONS_NOT_APPROVED",
      { unapproved_question_ids: unapproved.map((q) => q.question_id) }
    );
  }

  await paper.update({ status: "published", approved_by: userId || null, approved_at: new Date() });
  return paper;
};
