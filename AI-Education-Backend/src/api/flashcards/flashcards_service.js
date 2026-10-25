import { Op } from "sequelize";
import { EducationChapter } from "../curriculum/curriculum_schema.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationAcademicBoard, EducationAcademicClass, EducationAcademicSubject } from "../academic/academic_schema.js";
import { resolveStudentClassId } from "../curriculum/curriculum_service.js";
import { triggerFlashcardGeneration } from "../../common/services/ai_service_client.js";
import { createEducationError } from "../education_errors.js";
import { EducationFlashcardSet, EducationFlashcardSetView } from "./flashcards_schema.js";

// Same threshold and reasoning as mindmap_service.js's own
// STUCK_ROW_THRESHOLD_MS — generation normally finishes well under a
// minute; 3x that is a generous margin before treating a row as
// abandoned or worth retrying.
const STUCK_ROW_THRESHOLD_MS = 3 * 60 * 1000;

const recoverStuckFlashcardSet = async (set, { subject, chapterName }) => {
  if (!set) return;
  const staleCutoff = Date.now() - STUCK_ROW_THRESHOLD_MS;
  const isStuck =
    ["processing", "failed"].includes(set.generation_status) &&
    new Date(set.updated_at).getTime() < staleCutoff;
  if (!isStuck) return;

  // Re-saving to "processing" refreshes updated_at even for a set
  // already at that status, so a stuck/failed set is only ever retried
  // once per STUCK_ROW_THRESHOLD_MS window, not on every request that
  // happens to poll in between. Works identically for shared and
  // personal rows — only the scope used to FIND the row differs.
  await set.update({ generation_status: "processing", error_message: null });
  try {
    await triggerFlashcardGeneration({
      setId: set.set_id,
      subject,
      chapter: chapterName,
      numCards: set.num_cards,
      board: set.board,
      standard: set.standard,
      sourceText: set.source_text,
    });
  } catch (err) {
    await set.update({ generation_status: "failed", error_message: err.message || "Failed to reach the AI service" });
  }
};

const triggerOrFailShared = async (set, { subject, chapterName, numCards, board, standard }) => {
  try {
    await triggerFlashcardGeneration({ setId: set.set_id, subject, chapter: chapterName, numCards, board, standard });
  } catch (err) {
    // Reaching the AI service failed (not a generation failure — that
    // comes back later via the callback) — mark failed immediately
    // rather than leaving the row stuck at "processing" forever with
    // nothing running to ever update it.
    await set.update({ generation_status: "failed", error_message: err.message || "Failed to reach the AI service" });
  }
};

/**
 * Get-or-create core for the SHARED chapter-level POOL
 * (student_profile_id IS NULL), scoped by chapter_id+board+standard+
 * num_cards. Unlike mind maps' single cached row, this chapter+scope
 * can hold MANY distinct sets — the explicit product rule is: a
 * student cycles through pool members they haven't been shown yet
 * (instant, no AI call); only once they've exhausted every existing
 * member does a genuinely new one get generated, which then joins the
 * pool for the next student who needs it. This is what makes repeat
 * "Generate Flashcards" clicks always feel fresh to the clicking
 * student while still sharing real generation work across everyone
 * else. Never used for note-grounded (source_text) generations — those
 * are always personal, see generateFlashcardsService.
 */
const ensureSharedFlashcardSet = async ({ chapterId, board, standard, numCards, subject, chapterName, studentProfileId }) => {
  const pool = await EducationFlashcardSet.findAll({
    where: { chapter_id: chapterId, board, standard, num_cards: numCards, student_profile_id: null },
    order: [["created_at", "ASC"]],
  });

  if (pool.length > 0) {
    const viewedSetIds = new Set(
      (
        await EducationFlashcardSetView.findAll({
          where: { student_profile_id: studentProfileId, set_id: { [Op.in]: pool.map((s) => s.set_id) } },
          attributes: ["set_id"],
        })
      ).map((v) => v.set_id)
    );
    const unseen = pool.filter((s) => !viewedSetIds.has(s.set_id));

    // Prefer an unseen member that's usable as-is (completed, or
    // already generating — watching an in-flight one rather than
    // starting a redundant duplicate generation) over one that's
    // failed.
    const unseenUsable = unseen.find((s) => s.generation_status !== "failed");
    if (unseenUsable) {
      await recoverStuckFlashcardSet(unseenUsable, { subject, chapterName });
      return unseenUsable;
    }

    // Every remaining unseen member is failed — retry the oldest one
    // (self-heals a pool that's accumulated dead entries) instead of
    // creating yet another new row.
    const unseenFailed = unseen.find((s) => s.generation_status === "failed");
    if (unseenFailed) {
      await unseenFailed.update({ generation_status: "processing", error_message: null });
      await triggerOrFailShared(unseenFailed, { subject, chapterName, numCards, board, standard });
      return unseenFailed;
    }

    // This student has already seen every existing pool member — fall
    // through to generating a genuinely new one below.
  }

  const set = await EducationFlashcardSet.create({ chapter_id: chapterId, board, standard, num_cards: numCards, generation_status: "processing" });
  await triggerOrFailShared(set, { subject, chapterName, numCards, board, standard });
  return set;
};

const resolveStudentChapterAndProfile = async (userId, chapterId) => {
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
    studentScope,
    chapter,
    board: profile?.board?.name || "CBSE",
    standard: profile?.class?.name ? `Standard ${profile.class.name}` : "Standard 9",
  };
};

// Same authorization shape as before this feature: chapter must belong
// to the caller's own class, board/class come from the caller's own
// profile — never trusted from the client.
//
// sourceText set -> note-to-flashcards: unchanged personal behavior,
// always a fresh row, never shared/deduped (a student's own private
// note content must never surface to anyone else).
// sourceText not set -> the common case: resolves through the shared,
// chapter-level pool (ensureSharedFlashcardSet) — a student gets an
// existing pool member they haven't seen yet instantly; only once
// they've seen every existing member does a genuinely new one get
// generated (which then joins the pool for the next student who needs
// it). Either way, the row is created BEFORE the AI service is called,
// so it survives the student navigating away mid-generation.
export const generateFlashcardsService = async (userId, { chapterId, numCards = 8, sourceText = null, addedByUserId = null }) => {
  const { studentScope, chapter, board, standard } = await resolveStudentChapterAndProfile(userId, chapterId);
  const subject = chapter.subject.name;
  const chapterName = chapter.name;

  let set;
  if (sourceText) {
    set = await EducationFlashcardSet.create({
      chapter_id: chapterId,
      board,
      standard,
      num_cards: numCards,
      student_profile_id: studentScope.studentProfileId,
      source_text: sourceText,
      generation_status: "processing",
      added_by_user_id: addedByUserId,
    });
    try {
      await triggerFlashcardGeneration({ setId: set.set_id, subject, chapter: chapterName, numCards, board, standard, sourceText });
    } catch (err) {
      await set.update({ generation_status: "failed", error_message: err.message || "Failed to reach the AI service" });
    }
  } else {
    set = await ensureSharedFlashcardSet({ chapterId, board, standard, numCards, subject, chapterName, studentProfileId: studentScope.studentProfileId });
    // Bumps viewed_at even if this row already existed — lets "Past
    // Sets" order by most-recently-touched regardless of who actually
    // generated it.
    await EducationFlashcardSetView.upsert({ student_profile_id: studentScope.studentProfileId, set_id: set.set_id, viewed_at: new Date() });
  }

  return {
    set_id: set.set_id,
    chapter_id: set.chapter_id,
    generation_status: set.generation_status,
  };
};

/**
 * Status-only, for the frontend to poll while generation is still
 * running — also doubles as the main recovery path for a stuck set,
 * same pattern as getMindMapStatusService. Authorization can no longer
 * be a simple "is this my row" check for a shared set — it now verifies
 * class-scope access the same way generation itself does.
 */
export const getFlashcardSetStatusService = async (userId, setId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const set = await EducationFlashcardSet.findOne({
    where: { set_id: setId },
    include: [
      {
        model: EducationChapter,
        as: "chapter",
        attributes: ["chapter_id", "name", "class_id"],
        include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["name"] }],
      },
    ],
  });
  if (!set) throw createEducationError("Flashcard set not found", 404, "FLASHCARD_SET_NOT_FOUND");

  const isOwnPersonalSet = set.student_profile_id === studentScope.studentProfileId;
  const isSharedSetForMyClass = set.student_profile_id === null && set.chapter?.class_id === studentScope.classId;
  if (!isOwnPersonalSet && !isSharedSetForMyClass) {
    throw createEducationError("Flashcard set not found", 404, "FLASHCARD_SET_NOT_FOUND");
  }

  await recoverStuckFlashcardSet(set, { subject: set.chapter?.subject?.name, chapterName: set.chapter?.name });

  if (set.generation_status !== "completed") {
    return {
      set_id: set.set_id,
      chapter_id: set.chapter_id,
      generation_status: set.generation_status,
      error_message: set.generation_status === "failed" ? set.error_message : null,
    };
  }

  return {
    set_id: set.set_id,
    chapter_id: set.chapter_id,
    chapter_name: set.chapter?.name || null,
    generation_status: "completed",
    cards: set.cards || [],
  };
};

/**
 * Called by RAGProductionApp's Celery worker when generation finishes
 * (or exhausts its retries) — see core/flashcard_tasks.py. Works
 * identically for shared and personal rows; the worker only ever knows
 * a set_id.
 */
export const recordFlashcardGenerationCallbackService = async (setId, { status, cards, error_message }) => {
  const set = await EducationFlashcardSet.findOne({ where: { set_id: setId } });
  if (!set) throw createEducationError("Flashcard set not found", 404, "FLASHCARD_SET_NOT_FOUND");

  await set.update({
    generation_status: status,
    ...(cards !== undefined && { cards }),
    ...(error_message !== undefined && { error_message }),
  });

  return set;
};

/**
 * "Past Sets" — a union of this student's own personal (note-grounded)
 * generations, plus any shared set they've generated or received via
 * ensureSharedFlashcardSet (tracked in EducationFlashcardSetView),
 * merged and sorted by "when I last touched this" (created_at for
 * personal rows, viewed_at for shared ones). Two plain queries merged
 * in JS rather than one UNION query — simplest given the two shapes
 * (and "when touched" columns) differ.
 */
export const listFlashcardSetsService = async (userId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const chapterInclude = {
    model: EducationChapter,
    as: "chapter",
    attributes: ["chapter_id", "name", "subject_id"],
    include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] }],
  };

  const [personalSets, views] = await Promise.all([
    EducationFlashcardSet.findAll({
      where: { student_profile_id: studentScope.studentProfileId },
      include: [chapterInclude],
      order: [["created_at", "DESC"]],
      limit: 50,
    }),
    EducationFlashcardSetView.findAll({
      where: { student_profile_id: studentScope.studentProfileId },
      include: [{ model: EducationFlashcardSet, as: "set", include: [chapterInclude] }],
      order: [["viewed_at", "DESC"]],
      limit: 50,
    }),
  ]);

  const toRow = (s, touchedAt) => ({
    set_id: s.set_id,
    chapter_id: s.chapter_id,
    chapter_name: s.chapter?.name || null,
    subject_id: s.chapter?.subject?.subject_id || null,
    subject_name: s.chapter?.subject?.name || null,
    generation_status: s.generation_status,
    error_message: s.generation_status === "failed" ? s.error_message : null,
    num_cards: s.num_cards,
    touched_at: touchedAt,
  });

  const rows = [
    ...personalSets.map((s) => toRow(s, s.created_at)),
    ...views.map((v) => toRow(v.set, v.viewed_at)),
  ];

  rows.sort((a, b) => new Date(b.touched_at) - new Date(a.touched_at));

  return rows.slice(0, 50).map(({ touched_at, ...rest }) => ({ ...rest, created_at: touched_at }));
};
