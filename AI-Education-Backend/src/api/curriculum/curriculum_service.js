import { EducationChapter, EducationStudentChapterProgress } from "./curriculum_schema.js";
import { EducationAcademicSubject, EducationAcademicClass } from "../academic/academic_schema.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationBookIngestion } from "../admin/ingestion/ingestion_schema.js";
import { streamChapterPdf, streamChapterPdfByKey, streamNcertSolutionsPdf, streamNcertNotesPdf, getNcertSolutionsIndex, getNcertAvailability } from "../../common/services/ai_service_client.js";
import { createEducationError } from "../education_errors.js";
import { createNotification } from "../profile/notification_service.js";
import { logError } from "../../common/utils/logger.js";

/**
 * Looks up the calling user's own student_profile_id and class_id.
 * Used to server-side scope a student's chapter list/progress to their own
 * class and profile — a client can never pass class_id or another user's
 * student_profile_id to reach another class's or student's data.
 *
 * Returns null when the caller has no student profile at all (the Admin
 * Curriculum Management screen's staff callers) — the controller uses that
 * to decide whether class_id/subject_id come from the query string.
 */
export const resolveStudentClassId = async (userId) => {
  const profile = await EducationStudentProfile.findOne({
    where: { user_id: userId },
    attributes: ["student_profile_id", "class_id"],
  });

  if (!profile || !profile.class_id) {
    return null;
  }

  return { studentProfileId: profile.student_profile_id, classId: profile.class_id };
};

// getNcertAvailability's answer for a given chapter almost never changes
// — it flips only when an admin uploads/replaces that chapter's NCERT
// Solutions/Notes PDF, not on any student-facing action — so re-checking
// it via a live RAGProductionApp round-trip on every single Learning Path
// load (still N-per-page-load even after the opt-in fix below) is pure
// waste. Cached in-memory per (subject, chapter) with a generous TTL;
// resets on a server restart, which just means the first request after a
// restart pays the real cost once, same as a cold cache anywhere else.
const NCERT_AVAILABILITY_CACHE_TTL_MS = 60 * 60 * 1000;
const ncertAvailabilityCache = new Map(); // key -> { value, expiresAt }

const getCachedNcertAvailability = async (subject, chapter) => {
  const key = `${subject}::${chapter}`;
  const cached = ncertAvailabilityCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = await getNcertAvailability({ subject, chapter });
  ncertAvailabilityCache.set(key, { value, expiresAt: Date.now() + NCERT_AVAILABILITY_CACHE_TTL_MS });
  return value;
};

// Turns a chapter NAME (as returned by RAGProductionApp's
// retrieved_chapters — Qdrant payloads only carry names, not ids) back
// into a real chapter_id, scoped to the student's own subject+class so a
// name collision in another subject/class can never resolve to the wrong
// chapter. Used once per "which chapter is this" chat reply, after the
// AI call returns — never in a loop. Returns null (not a throw) on no
// match: an unresolved chapter name should degrade to "no clickable
// chapter link" for that one reply, not fail the whole chat response.
export const resolveChapterByName = async (chapterName, subjectId, classId) => {
  if (!chapterName) return null;
  const chapter = await EducationChapter.findOne({
    where: { name: chapterName, subject_id: subjectId, class_id: classId, is_active: true },
    include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["name"] }],
  });
  return chapter;
};

// includeNcertAvailability is opt-in (default false) — checking it makes
// one live HTTP round-trip to RAGProductionApp PER CHAPTER (now cache-
// backed, see above). Only LearningPath.jsx's chapter cards actually need
// has_ncert_solutions/has_ncert_notes; every other caller of this endpoint
// (Quiz/Flashcards/MockTests/PreAssessment/chapter dropdowns elsewhere)
// just needs id/name/chapter_order and was paying that N-request cost
// for nothing every time a subject was picked — that's what made
// "chapters" feel slow to populate outside Learning Path. Same
// safe-degrade posture as getChapterMetaService when it IS requested —
// a down/slow AI service just hides the Notes/Solutions affordances for
// that chapter (both false) instead of failing the whole list — checked
// in parallel across the list rather than N sequential round-trips.
export const getChaptersService = async ({ subjectId, classId, includeNcertAvailability = false }) => {
  const chapters = await EducationChapter.findAll({
    where: {
      subject_id: subjectId,
      class_id: classId,
      is_active: true,
    },
    include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["name"] }],
    order: [["chapter_order", "ASC"]],
  });

  if (!includeNcertAvailability) {
    return chapters.map((chapter) => ({ ...chapter.get({ plain: true }), has_ncert_solutions: false, has_ncert_notes: false }));
  }

  const withAvailability = await Promise.all(
    chapters.map(async (chapter) => {
      let has_ncert_solutions = false;
      let has_ncert_notes = false;
      try {
        const availability = await getNcertAvailability({ subject: chapter.subject.name, chapter: chapter.name });
        has_ncert_solutions = Boolean(availability?.has_ncert_solutions);
        has_ncert_notes = Boolean(availability?.has_ncert_notes);
      } catch (err) {
        logError("Failed to check NCERT Notes/Solutions availability — defaulting both to unavailable.", err, {
          service: "curriculum-service",
          chapterId: chapter.chapter_id,
        });
      }
      const plain = chapter.get({ plain: true });
      return { ...plain, has_ncert_solutions, has_ncert_notes };
    })
  );

  return withAvailability;
};

const assertReferencedRowsExist = async ({ subject_id, class_id }) => {
  const subject = await EducationAcademicSubject.findOne({ where: { subject_id, is_active: true } });
  if (!subject) throw createEducationError("Invalid subject_id", 400, "INVALID_SUBJECT");

  const klass = await EducationAcademicClass.findOne({ where: { class_id, is_active: true } });
  if (!klass) throw createEducationError("Invalid class_id", 400, "INVALID_CLASS");
};

// Chapters created without a hand-typed source_file (the normal case now —
// see curriculum_schema.js) get a unique placeholder slug instead, since the
// column still has a UNIQUE constraint. This is never read as a real
// filename by anything — the actual PDF's location lives in
// education_book_ingestions.storage_key once a file is ingested.
const generatePlaceholderSourceFile = ({ subject_id, class_id, chapter_order }) =>
  `chapter-${subject_id}-${class_id}-${chapter_order}-${Date.now()}`;

export const createChapterService = async (payload) => {
  await assertReferencedRowsExist(payload);

  const source_file = payload.source_file || generatePlaceholderSourceFile(payload);

  return EducationChapter.create({ ...payload, source_file });
};

export const updateChapterService = async (chapterId, payload) => {
  const chapter = await EducationChapter.findOne({ where: { chapter_id: chapterId } });
  if (!chapter) {
    throw createEducationError("Chapter not found", 404, "CHAPTER_NOT_FOUND");
  }

  await assertReferencedRowsExist({
    subject_id: payload.subject_id ?? chapter.subject_id,
    class_id: payload.class_id ?? chapter.class_id,
  });

  await chapter.update(payload);
  return chapter;
};

// Soft delete — same is_active convention used across the rest of the
// education module — so an existing student progress row is never left
// pointing at a hard-deleted chapter.
export const deleteChapterService = async (chapterId) => {
  const chapter = await EducationChapter.findOne({ where: { chapter_id: chapterId } });
  if (!chapter) {
    throw createEducationError("Chapter not found", 404, "CHAPTER_NOT_FOUND");
  }

  await chapter.update({ is_active: false });
  return chapter;
};

export const getProgressService = async (studentProfileId) => {
  return EducationStudentChapterProgress.findAll({
    where: { student_profile_id: studentProfileId },
    include: [{ model: EducationChapter, as: "chapter", where: { is_active: true } }],
  });
};

export const upsertProgressService = async (studentProfileId, chapterId, payload) => {
  const chapter = await EducationChapter.findOne({ where: { chapter_id: chapterId, is_active: true } });
  if (!chapter) {
    throw createEducationError("Chapter not found", 404, "CHAPTER_NOT_FOUND");
  }

  const { progress_percent, status, last_page_index, manually_unlocked } = payload;

  let progress = await EducationStudentChapterProgress.findOne({
    where: { student_profile_id: studentProfileId, chapter_id: chapterId },
  });

  // Only the FIRST manually_unlocked:true call actually does anything —
  // once set, manually_unlocked_at is never overwritten or cleared, so
  // this chapter can never silently re-lock itself again.
  const isNewUnlock = manually_unlocked === true && !progress?.manually_unlocked_at;

  const updates = {
    ...(progress_percent !== undefined && { progress_percent }),
    ...(status !== undefined && { status }),
    ...(last_page_index !== undefined && { last_page_index }),
    ...(isNewUnlock && { manually_unlocked_at: new Date() }),
    last_activity_at: new Date(),
  };

  if (!progress) {
    progress = await EducationStudentChapterProgress.create({
      student_profile_id: studentProfileId,
      chapter_id: chapterId,
      ...updates,
    });
  } else {
    await progress.update(updates);
  }

  if (isNewUnlock) {
    try {
      const profile = await EducationStudentProfile.findByPk(studentProfileId, { attributes: ["user_id"] });
      if (profile) {
        await createNotification(
          {
            type: "CHAPTER_UNLOCKED",
            title: "New chapter unlocked!",
            message: `You've unlocked "${chapter.name}" — jump in whenever you're ready.`,
            channel: "IN_APP",
          },
          profile.user_id
        );
      }
    } catch (err) {
      logError("Failed to send manual chapter-unlock notification.", err, {
        service: "curriculum-service",
        studentProfileId,
        chapterId,
      });
    }
  }

  return progress;
};

/**
 * Looks up one chapter's own metadata (name/order/subject) for the
 * reader's header — the real body content is now the actual PDF, fetched
 * separately/streamed by streamChapterPdfService below, not returned
 * here. Same authorization shape as quiz/flashcard generation and the
 * old getChapterContentService: chapter must belong to the caller's own
 * class.
 */
export const getChapterMetaService = async (userId, chapterId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const chapter = await EducationChapter.findOne({
    where: { chapter_id: chapterId, is_active: true },
    include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] }],
  });
  if (!chapter) throw createEducationError("Chapter not found", 404, "CHAPTER_NOT_FOUND");
  if (chapter.class_id !== studentScope.classId) {
    throw createEducationError("Chapter does not belong to your class", 403, "CHAPTER_CLASS_MISMATCH");
  }

  // Availability check never blocks the core chapter-meta response — a
  // down/slow AI service degrades to "hide the cards" (both false), the
  // same safe default as a genuinely unavailable chapter, rather than
  // failing the whole page load over an optional sidebar affordance.
  let has_ncert_solutions = false;
  let has_ncert_notes = false;
  try {
    const availability = await getNcertAvailability({ subject: chapter.subject.name, chapter: chapter.name });
    has_ncert_solutions = Boolean(availability?.has_ncert_solutions);
    has_ncert_notes = Boolean(availability?.has_ncert_notes);
  } catch (err) {
    logError("Failed to check NCERT Notes/Solutions availability — defaulting both to unavailable.", err, {
      service: "curriculum-service",
      chapterId,
    });
  }

  return {
    chapter_id: chapter.chapter_id,
    chapter_name: chapter.name,
    chapter_order: chapter.chapter_order,
    subject_id: chapter.subject.subject_id,
    subject_name: chapter.subject.name,
    has_ncert_solutions,
    has_ncert_notes,
  };
};

/**
 * Resolves + authorizes the same way getChapterMetaService does, then
 * hands back the real PDF's response stream from the AI service — the
 * controller pipes response.data straight through to the browser. No
 * durable cache/table needed here (unlike the old markdown-based
 * approach): the AI service just streams the same static file off disk
 * every time, which is already fast.
 */
export const streamChapterPdfService = async (userId, chapterId) => {
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

  // Every chapter actually ingested through the real admin pipeline has
  // its real uploaded PDF recorded here — prefer it over the legacy
  // subject/chapter-name dict lookup below, which only ever resolves for
  // the hand-seeded Math/Science chapters (see streamChapterPdfByKey's
  // own docstring). Falling back to the old path rather than erroring
  // outright costs nothing and covers any chapter whose text was
  // somehow never ingested.
  const textJob = await EducationBookIngestion.findOne({
    where: { chapter_id: chapter.chapter_id, job_type: "text", status: "completed" },
    order: [["created_at", "DESC"]],
  });
  if (textJob?.storage_key) {
    return streamChapterPdfByKey({ storageKey: textJob.storage_key });
  }

  return streamChapterPdf({ subject: chapter.subject.name, chapter: chapter.name });
};

// Shared by the three NCERT service functions below — same resolve+
// auth shape as streamChapterPdfService above (chapter must belong to
// the caller's own class), factored out since there are three near-
// identical callers this time rather than just one.
const resolveOwnedChapterForNcert = async (userId, chapterId) => {
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
  return chapter;
};

/**
 * Real NCERT Solutions/Notes content — same "not every chapter has this
 * yet" honesty as the pilot scope: a chapter with no NCERT resources
 * 404s from the AI service, which this just lets propagate (the
 * controller's existing error.response?.status handling already turns
 * that into a clean 404 for the frontend, same as any other AI-service
 * error today).
 */
export const streamNcertSolutionsPdfService = async (userId, chapterId) => {
  const chapter = await resolveOwnedChapterForNcert(userId, chapterId);
  return streamNcertSolutionsPdf({ subject: chapter.subject.name, chapter: chapter.name });
};

export const streamNcertNotesPdfService = async (userId, chapterId) => {
  const chapter = await resolveOwnedChapterForNcert(userId, chapterId);
  return streamNcertNotesPdf({ subject: chapter.subject.name, chapter: chapter.name });
};

export const getNcertSolutionsIndexService = async (userId, chapterId) => {
  const chapter = await resolveOwnedChapterForNcert(userId, chapterId);
  return getNcertSolutionsIndex({ subject: chapter.subject.name, chapter: chapter.name });
};
