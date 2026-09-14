import { EducationChapter } from "../curriculum/curriculum_schema.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationAcademicBoard, EducationAcademicClass, EducationAcademicSubject } from "../academic/academic_schema.js";
import { resolveStudentClassId } from "../curriculum/curriculum_service.js";
import { triggerInfographicGeneration } from "../../common/services/ai_service_client.js";
import { createEducationError } from "../education_errors.js";
import { EducationInfographic } from "./infographic_schema.js";

// Same threshold and reasoning as slide_deck_service.js's own
// STUCK_ROW_THRESHOLD_MS — generation normally finishes well under a
// minute; 3x that is a generous margin before treating a row as
// abandoned or worth retrying.
const STUCK_ROW_THRESHOLD_MS = 3 * 60 * 1000;

// force bypasses the cooldown for an explicit admin-triggered retry (see
// processChapterController) — passive auto-recovery on a student's poll
// still respects it so a persistently broken AI service isn't hammered.
const recoverStuckInfographic = async (row, { subject, chapterName, board, standard }, { force = false } = {}) => {
  if (!row) return;
  const staleCutoff = Date.now() - STUCK_ROW_THRESHOLD_MS;
  const isStuck = ["processing", "pending", "failed"].includes(row.status) && (force || new Date(row.updated_at).getTime() < staleCutoff);
  if (!isStuck) return;

  // Re-saving to "processing" refreshes updated_at even for a row
  // already at that status, so a stuck/failed row is only ever retried
  // once per STUCK_ROW_THRESHOLD_MS window, not on every request that
  // happens to poll in between.
  await row.update({ status: "processing", error_message: null });
  try {
    await triggerInfographicGeneration({
      infographicId: row.infographic_id,
      subject,
      chapter: chapterName,
      board,
      standard,
    });
  } catch (err) {
    await row.update({ status: "failed", error_message: err.message || "Failed to reach the AI service" });
  }
};

const resolveStudentAndChapter = async (userId, chapterId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const chapter = await EducationChapter.findOne({
    where: { chapter_id: chapterId, is_active: true },
    include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["name"] }],
  });
  if (!chapter) throw createEducationError("Chapter not found", 404, "CHAPTER_NOT_FOUND");
  if (chapter.class_id !== studentScope.classId) {
    throw createEducationError("Chapter does not belong to your class", 403, "CHAPTER_CLASS_MISMATCH");
  }

  const profile = await EducationStudentProfile.findOne({
    where: { student_profile_id: studentScope.studentProfileId },
    include: [
      { model: EducationAcademicBoard, as: "board", attributes: ["name"] },
      { model: EducationAcademicClass, as: "class", attributes: ["name"] },
    ],
  });

  return {
    chapter,
    board: profile?.board?.name || "CBSE",
    standard: profile?.class?.name ? `Standard ${profile.class.name}` : "Standard 9",
  };
};

// Get-or-create core, shared by the student-facing path below (resolves
// scope from the student's own profile) and the admin pregeneration path
// (pregenerateInfographicService, resolves scope from the chapter's own
// subject/class -> board relation instead — an admin has no student
// profile). The first caller for a given chapter+scope with nothing
// cached creates a "pending" row and hands generation off to
// RAGProductionApp's Celery worker immediately; every caller after that
// just reuses what's already there/generating.
const ensureInfographicGeneration = async ({ chapterId, subject, chapterName, board, standard, force = false }) => {
  let row = await EducationInfographic.findOne({
    where: { chapter_id: chapterId, board, standard },
  });

  if (!row) {
    row = await EducationInfographic.create({
      chapter_id: chapterId,
      board,
      standard,
      status: "processing",
    });
    try {
      await triggerInfographicGeneration({
        infographicId: row.infographic_id,
        subject,
        chapter: chapterName,
        board,
        standard,
      });
    } catch (err) {
      // Reaching the AI service failed (not a generation failure — that
      // comes back later via the callback) — mark failed immediately
      // rather than leaving the row stuck at "processing" forever with
      // nothing running to ever update it.
      await row.update({ status: "failed", error_message: err.message || "Failed to reach the AI service" });
    }
  } else {
    await recoverStuckInfographic(row, { subject, chapterName, board, standard }, { force });
  }

  return row;
};

// Resolves the same (board, standard) shape a real student's own profile
// would produce (see resolveStudentAndChapter's "Standard <name>"
// format) but directly from the chapter's own subject/class -> board
// relation — an admin has no student profile. Keeping the exact same
// string format matters: it's what makes a pregenerated row actually get
// found later by EducationInfographic.findOne({ where: { chapter_id,
// board, standard } }).
const resolveChapterScope = async (chapterId) => {
  const chapter = await EducationChapter.findOne({
    where: { chapter_id: chapterId, is_active: true },
    include: [
      { model: EducationAcademicSubject, as: "subject", include: [{ model: EducationAcademicBoard, as: "board" }] },
      { model: EducationAcademicClass, as: "class", include: [{ model: EducationAcademicBoard, as: "board" }] },
    ],
  });
  if (!chapter) throw createEducationError("Chapter not found", 404, "CHAPTER_NOT_FOUND");

  const board = chapter.subject?.board?.name || chapter.class?.board?.name || "CBSE";
  const standard = chapter.class?.name ? `Standard ${chapter.class.name}` : "Standard 9";
  return { chapter, board, standard };
};

// Admin pregeneration — triggered from the curriculum content-processing
// pipeline once a chapter's text has been ingested (see
// ingestion_service.js's recordIngestionCallbackService), not by a
// student. Reuses the exact same get-or-create core as the student path,
// so a student opening this chapter later just finds it already done.
export const pregenerateInfographicService = async (chapterId, { force = false } = {}) => {
  const { chapter, board, standard } = await resolveChapterScope(chapterId);
  const row = await ensureInfographicGeneration({
    chapterId: chapter.chapter_id,
    subject: chapter.subject.name,
    chapterName: chapter.name,
    board,
    standard,
    force,
  });
  return { chapter_id: chapter.chapter_id, status: row.status };
};

// Read-only status for the admin curriculum screen — same reasoning as
// mindmap_service.js's getMindMapAdminStatusService: GET
// /api/infographic/status is student-scoped and an admin has no student
// profile, so this resolves the exact scope pregenerateInfographicService
// would use and just reads it, never triggering generation.
export const getInfographicAdminStatusService = async (chapterId) => {
  const { chapter, board, standard } = await resolveChapterScope(chapterId);
  const row = await EducationInfographic.findOne({ where: { chapter_id: chapter.chapter_id, board, standard } });
  return { status: row?.status || null };
};

// Bulk counterpart for the Ingestion Monitor's chapter overview — one
// query for every chapter instead of N calls to
// getInfographicAdminStatusService. Same "most recently updated wins"
// tie-break as getSlideDeckStatusForChaptersService.
export const getInfographicStatusForChaptersService = async (chapterIds) => {
  if (!chapterIds || chapterIds.length === 0) return {};
  const rows = await EducationInfographic.findAll({ where: { chapter_id: chapterIds }, order: [["updated_at", "DESC"]] });
  const result = {};
  for (const row of rows) {
    if (!(row.chapter_id in result)) result[row.chapter_id] = { status: row.status };
  }
  return result;
};

// Get-or-create, always async — exact mirror of generateSlideDeckService.
// The first request for a chapter+scope with nothing cached creates a
// "pending" row and hands generation off to RAGProductionApp's Celery
// worker immediately, returning without waiting on it.
export const generateInfographicService = async (userId, { chapterId }) => {
  const { chapter, board, standard } = await resolveStudentAndChapter(userId, chapterId);
  const subject = chapter.subject.name;
  const chapterName = chapter.name;

  const row = await ensureInfographicGeneration({ chapterId: chapter.chapter_id, subject, chapterName, board, standard });

  if (row.status !== "completed") {
    // Not an error — generation is already running (or about to be).
    // The frontend polls GET /api/infographic/status and fetches the
    // infographic once it's ready, same pattern as mind maps/slide decks.
    return {
      chapter_id: chapter.chapter_id,
      chapter_name: chapterName,
      status: row.status,
    };
  }

  return {
    chapter_id: chapter.chapter_id,
    chapter_name: chapterName,
    status: "completed",
    ...row.payload,
  };
};

// Status-only, for the frontend to poll while generation is still
// running. Also doubles as the main recovery path for a stuck row.
export const getInfographicStatusService = async (userId, { chapterId }) => {
  const { chapter, board, standard } = await resolveStudentAndChapter(userId, chapterId);
  const row = await EducationInfographic.findOne({
    where: { chapter_id: chapter.chapter_id, board, standard },
  });
  await recoverStuckInfographic(row, { subject: chapter.subject.name, chapterName: chapter.name, board, standard });
  return { status: row?.status || null };
};

// Called by RAGProductionApp's Celery worker when generation finishes
// (or exhausts its retries) — see core/infographic_tasks.py.
export const recordInfographicCallbackService = async (infographicId, { status, payload, error_message }) => {
  const row = await EducationInfographic.findOne({ where: { infographic_id: infographicId } });
  if (!row) throw createEducationError("Infographic not found", 404, "INFOGRAPHIC_NOT_FOUND");

  await row.update({
    status,
    ...(payload !== undefined && { payload }),
    ...(error_message !== undefined && { error_message }),
    ...(status === "completed" && { generated_at: new Date() }),
  });

  return row;
};
