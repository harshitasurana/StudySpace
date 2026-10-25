import { SamplePaper, SamplePaperSection, SamplePaperQuestion } from "./sample_paper_schema.js";
import { SamplePaperAttempt, SamplePaperResponse } from "./sample_paper_attempt_schema.js";
import { resolveStudentClassId } from "../curriculum/curriculum_service.js";
import { buildStorageKey, uploadStoredFile, downloadStoredFile, STORAGE_CATEGORIES, FILE_VISIBILITY } from "../../common/services/fileStorage.service.js";
import { triggerSamplePaperGrading } from "../../common/services/ai_service_client.js";
import { createEducationError } from "../education_errors.js";

// Strips model_answer/rubric_criteria — never sent to the client while an
// attempt is in progress (mirrors quiz_service.js's toPublicQuestion).
const toPublicQuestion = (q) => ({
  question_id: q.question_id,
  section_id: q.section_id,
  question_order: q.question_order,
  question_text: q.question_text,
  question_type: q.question_type,
  question_media: q.question_media,
  question_media_key: q.question_media_key,
  input_type: q.input_type,
  max_marks: q.max_marks,
});

export const listPublishedSamplePapersService = async (userId, { subjectId } = {}) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const where = { status: "published", class_id: studentScope.classId };
  if (subjectId) where.subject_id = subjectId;

  return SamplePaper.findAll({ where, order: [["created_at", "DESC"]] });
};

export const getSamplePaperForStudentService = async (userId, samplePaperId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const paper = await SamplePaper.findOne({
    where: { sample_paper_id: samplePaperId, status: "published", class_id: studentScope.classId },
    include: [
      { model: SamplePaperSection, as: "sections", order: [["order_index", "ASC"]] },
      { model: SamplePaperQuestion, as: "questions" },
    ],
  });
  if (!paper) throw createEducationError("Sample paper not found", 404, "SAMPLE_PAPER_NOT_FOUND");

  const questions = [...(paper.questions || [])]
    .sort((a, b) => a.question_order - b.question_order)
    .map(toPublicQuestion);

  return {
    sample_paper_id: paper.sample_paper_id,
    title: paper.title,
    subject_id: paper.subject_id,
    class_id: paper.class_id,
    paper_type: paper.paper_type,
    total_marks: paper.total_marks,
    duration_minutes: paper.duration_minutes,
    sections: paper.sections,
    questions,
  };
};

// Resumes an existing in_progress attempt for this student+paper if one
// exists, rather than always creating a new one — the attempt page's load
// effect calls this on every mount, and without this check, a page
// refresh (or React StrictMode's dev-only double-invoke) would silently
// create an orphaned duplicate attempt.
//
// The find-then-create below is NOT atomic on its own against two
// near-simultaneous requests — verified directly (StrictMode's double
// mount produced two real in_progress rows 14ms apart, both having passed
// the findOne check before either INSERT committed). The real guarantee
// is the partial unique index added in
// 20260818c_sample_paper_attempt_race_fix.sql; a second concurrent
// request's INSERT fails with a unique-violation, caught below and
// resolved to the row that actually won.
export const startAttemptService = async (userId, samplePaperId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const paper = await SamplePaper.findOne({
    where: { sample_paper_id: samplePaperId, status: "published", class_id: studentScope.classId },
  });
  if (!paper) throw createEducationError("Sample paper not found", 404, "SAMPLE_PAPER_NOT_FOUND");

  const existing = await SamplePaperAttempt.findOne({
    where: { student_profile_id: studentScope.studentProfileId, sample_paper_id: samplePaperId, status: "in_progress" },
  });
  if (existing) return existing;

  try {
    return await SamplePaperAttempt.create({
      student_profile_id: studentScope.studentProfileId,
      sample_paper_id: samplePaperId,
      total_marks: paper.total_marks || 0,
      status: "in_progress",
    });
  } catch (err) {
    if (err.name !== "SequelizeUniqueConstraintError") throw err;
    const winner = await SamplePaperAttempt.findOne({
      where: { student_profile_id: studentScope.studentProfileId, sample_paper_id: samplePaperId, status: "in_progress" },
    });
    if (winner) return winner;
    throw err;
  }
};

const getOwnedInProgressAttempt = async (userId, attemptId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }
  const attempt = await SamplePaperAttempt.findOne({
    where: { attempt_id: attemptId, student_profile_id: studentScope.studentProfileId },
  });
  if (!attempt) throw createEducationError("Attempt not found", 404, "ATTEMPT_NOT_FOUND");
  if (attempt.status !== "in_progress") {
    throw createEducationError("This attempt is no longer in progress", 400, "ATTEMPT_NOT_IN_PROGRESS");
  }
  return attempt;
};

// The student writes every answer on paper (organized by question number)
// and uploads ONE consolidated PDF for the whole attempt — replaces the
// old per-question typed/photo submission entirely. Re-uploading before
// submission overwrites the previous PDF (the old storage key is simply
// abandoned, same as every other "resubmit before final submit" flow in
// this codebase — nothing reads it once replaced).
export const uploadAnswerPdfService = async (userId, attemptId, file) => {
  const attempt = await getOwnedInProgressAttempt(userId, attemptId);

  const key = buildStorageKey({
    category: STORAGE_CATEGORIES.SAMPLE_PAPER_ANSWER,
    attemptId: attempt.attempt_id,
    originalName: file.originalname,
  });
  await uploadStoredFile({ file, key, visibility: FILE_VISIBILITY.PRIVATE });

  await attempt.update({ answer_pdf_key: key });
  return attempt;
};

// Submitting hands the answer PDF off to FastAPI for grading (mirrors
// sample_paper_admin_service.js's startExtractionService hand-off shape):
// job/attempt transitions to 'grading' first, and a hand-off failure fails
// it immediately rather than leaving it stuck with nothing to ever update
// it. The real grading result arrives later via the grading-callback route
// (sample_paper_grading_service.js).
export const submitPaperService = async (userId, attemptId) => {
  const attempt = await getOwnedInProgressAttempt(userId, attemptId);
  if (!attempt.answer_pdf_key) {
    throw createEducationError("Upload your answer PDF before submitting", 400, "ANSWER_PDF_REQUIRED");
  }

  const paper = await SamplePaper.findOne({
    where: { sample_paper_id: attempt.sample_paper_id },
    include: [{ model: SamplePaperQuestion, as: "questions" }],
  });
  const questions = (paper?.questions || []).map((q) => ({
    question_id: q.question_id,
    question_number: q.question_order,
    question_text: q.question_text,
    max_marks: q.max_marks,
    model_answer: q.model_answer,
    rubric_criteria: q.rubric_criteria || [],
    grading_strategy: q.grading_strategy,
  }));

  const buffer = await downloadStoredFile(attempt.answer_pdf_key, { visibility: FILE_VISIBILITY.PRIVATE });
  const filename = attempt.answer_pdf_key.split("/").pop() || "answers.pdf";

  await attempt.update({ status: "submitted", submitted_at: new Date() });

  try {
    await triggerSamplePaperGrading({
      pdfBuffer: buffer,
      pdfFilename: filename,
      attemptId: attempt.attempt_id,
      questions,
    });
    await attempt.update({ status: "grading" });
  } catch (err) {
    await attempt.update({ status: "failed", grading_error: err.message || "Failed to reach the grading service" });
  }

  return attempt;
};

export const getAttemptService = async (userId, attemptId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }
  const attempt = await SamplePaperAttempt.findOne({
    where: { attempt_id: attemptId, student_profile_id: studentScope.studentProfileId },
    include: [
      { model: SamplePaper, as: "samplePaper" },
      {
        model: SamplePaperResponse,
        as: "responses",
        include: [{ model: SamplePaperQuestion, as: "question" }],
        // grading_internal_notes is never selected here — omitted at the
        // query level, not just stripped afterward, so it can never leak
        // through this route by accident.
        attributes: { exclude: ["grading_internal_notes"] },
      },
    ],
  });
  if (!attempt) throw createEducationError("Attempt not found", 404, "ATTEMPT_NOT_FOUND");

  return {
    ...attempt.toJSON(),
    // .toJSON() each response (not a bare spread — a Sequelize model
    // instance only exposes its real columns via getters, not as own
    // enumerable properties, so `{...r}` silently drops every real field
    // and keeps only internal bookkeeping like `dataValues`) before
    // reshaping which question fields are visible.
    responses: (attempt.responses || []).map((r) => {
      const plain = r.toJSON();
      return {
        ...plain,
        // Model answer/rubric stay hidden until this specific response has
        // actually been graded — matches Quiz's post-answer explanation
        // pattern, just gated per-response instead of per-attempt.
        question: plain.graded_at
          ? plain.question
          : { ...plain.question, model_answer: undefined, rubric_criteria: undefined },
      };
    }),
  };
};

export const listAttemptsService = async (userId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }
  return SamplePaperAttempt.findAll({
    where: { student_profile_id: studentScope.studentProfileId },
    include: [{ model: SamplePaper, as: "samplePaper", attributes: ["title", "subject_id", "paper_type"] }],
    order: [["started_at", "DESC"]],
  });
};
