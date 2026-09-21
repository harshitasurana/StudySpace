import { EducationChapter } from "../curriculum/curriculum_schema.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationAcademicBoard, EducationAcademicClass, EducationAcademicSubject } from "../academic/academic_schema.js";
import { resolveStudentClassId } from "../curriculum/curriculum_service.js";
import { triggerSlideDeckGeneration } from "../../common/services/ai_service_client.js";
import { createEducationError } from "../education_errors.js";
import { EducationSlideDeck } from "./slide_deck_schema.js";
import { EducationSlideDeckView } from "./slide_deck_view_schema.js";

// Same threshold and reasoning as mindmap_service.js's own
// STUCK_ROW_THRESHOLD_MS — generation normally finishes well under a
// minute; 3x that is a generous margin before treating a row as
// abandoned or worth retrying. Covers the identical two real failure
// modes already confirmed for mind maps: a callback POST hitting a
// transient failure after generation already succeeded, and a genuine
// generation failure (e.g. Ollama briefly overloaded) that deserves a
// retry rather than permanently stranding the chapter+scope — built in
// from day one here rather than discovering the same gap again after a
// student hits it (see mindmap_service.js's own comment for how that
// gap was found live in production).
const STUCK_ROW_THRESHOLD_MS = 3 * 60 * 1000;

// force bypasses the cooldown for an explicit admin-triggered retry (see
// processChapterController) — passive auto-recovery on a student's poll
// still respects it so a persistently broken AI service isn't hammered.
const recoverStuckSlideDeck = async (row, { subject, chapterName, board, standard }, { force = false } = {}) => {
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
    await triggerSlideDeckGeneration({
      deckId: row.slide_deck_id,
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
    studentScope,
    chapter,
    board: profile?.board?.name || "CBSE",
    standard: profile?.class?.name ? `Standard ${profile.class.name}` : "Standard 9",
  };
};

// Creates a brand new deck row and hands generation off to
// RAGProductionApp's Celery worker immediately. Called whenever no
// existing pool row can be reused — see ensureAnySlideDeck (admin) and
// ensureSharedSlideDeck (student) below, the two get-or-create cores that
// decide WHEN a new deck is warranted.
const createSlideDeck = async ({ chapterId, subject, chapterName, board, standard }) => {
  const row = await EducationSlideDeck.create({
    chapter_id: chapterId,
    board,
    standard,
    status: "processing",
  });
  try {
    await triggerSlideDeckGeneration({
      deckId: row.slide_deck_id,
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
  return row;
};

// Admin/pregeneration path — "ensure at least one deck exists for this
// chapter+scope," no specific-student concept to check "unseen" against
// (unlike the student path below). Reuses the oldest existing row,
// recovering it if stuck, or creates a brand new one. Preserves this
// function's pre-shared-pool behavior exactly (there used to be only
// ever one row possible; this keeps finding "the" row deterministically
// now that several could theoretically exist).
const ensureAnySlideDeck = async ({ chapterId, subject, chapterName, board, standard, force = false }) => {
  const row = await EducationSlideDeck.findOne({
    where: { chapter_id: chapterId, board, standard },
    order: [["created_at", "ASC"]],
  });

  if (!row) {
    return createSlideDeck({ chapterId, subject, chapterName, board, standard });
  }

  await recoverStuckSlideDeck(row, { subject, chapterName, board, standard }, { force });
  return row;
};

// Get-or-create core for the SHARED chapter-level POOL — direct mirror
// of flashcards_service.js's ensureSharedFlashcardSet / mindmap_service
// .js's ensureSharedMindMapGroup: a student cycles through pool decks
// they haven't seen yet (instant, no AI call); only once they've
// exhausted every existing deck does a genuinely new one get generated,
// which then joins the pool for the next student who needs it.
const ensureSharedSlideDeck = async ({ chapterId, subject, chapterName, board, standard, studentProfileId }) => {
  const pool = await EducationSlideDeck.findAll({
    where: { chapter_id: chapterId, board, standard },
    order: [["created_at", "ASC"]],
  });

  if (pool.length > 0) {
    const viewedDeckIds = new Set(
      (
        await EducationSlideDeckView.findAll({
          where: { student_profile_id: studentProfileId, slide_deck_id: pool.map((d) => d.slide_deck_id) },
          attributes: ["slide_deck_id"],
        })
      ).map((v) => v.slide_deck_id)
    );
    const unseen = pool.filter((d) => !viewedDeckIds.has(d.slide_deck_id));

    const unseenUsable = unseen.find((d) => d.status !== "failed");
    if (unseenUsable) {
      await recoverStuckSlideDeck(unseenUsable, { subject, chapterName, board, standard });
      return unseenUsable;
    }

    // Every remaining unseen deck is failed — retry the oldest one
    // instead of creating yet another new row. force:true bypasses the
    // passive cooldown — this student is actively asking for content now.
    const unseenFailed = unseen.find((d) => d.status === "failed");
    if (unseenFailed) {
      await recoverStuckSlideDeck(unseenFailed, { subject, chapterName, board, standard }, { force: true });
      return unseenFailed;
    }

    // This student has already seen every existing pool deck — fall
    // through to generating a genuinely new one below.
  }

  return createSlideDeck({ chapterId, subject, chapterName, board, standard });
};

// Resolves the same (board, standard) shape a real student's own profile
// would produce (see resolveStudentAndChapter's "Standard <name>"
// format) but directly from the chapter's own subject/class -> board
// relation — an admin has no student profile. Keeping the exact same
// string format matters: it's what makes a pregenerated row actually get
// found later by EducationSlideDeck.findOne({ where: { chapter_id,
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
export const pregenerateSlideDeckService = async (chapterId, { force = false } = {}) => {
  const { chapter, board, standard } = await resolveChapterScope(chapterId);
  const row = await ensureAnySlideDeck({
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
// /api/slide-deck/status is student-scoped and an admin has no student
// profile, so this resolves the exact scope pregenerateSlideDeckService
// would use and just reads it, never triggering generation.
export const getSlideDeckAdminStatusService = async (chapterId) => {
  const { chapter, board, standard } = await resolveChapterScope(chapterId);
  const row = await EducationSlideDeck.findOne({ where: { chapter_id: chapter.chapter_id, board, standard } });
  return { status: row?.status || null };
};

// Bulk counterpart for the Ingestion Monitor's chapter overview — one
// query for every chapter instead of N calls to
// getSlideDeckAdminStatusService. A chapter normally has at most one row
// per board/standard in practice; if more than one somehow exists, the
// most recently updated one wins.
export const getSlideDeckStatusForChaptersService = async (chapterIds) => {
  if (!chapterIds || chapterIds.length === 0) return {};
  const rows = await EducationSlideDeck.findAll({ where: { chapter_id: chapterIds }, order: [["updated_at", "DESC"]] });
  const result = {};
  for (const row of rows) {
    if (!(row.chapter_id in result)) result[row.chapter_id] = { status: row.status };
  }
  return result;
};

// Get-or-create through the shared pool (ensureSharedSlideDeck): a
// student who hasn't seen any existing deck for this chapter+scope either
// gets an unseen one instantly or triggers a genuinely new generation,
// always async (no synchronous variant, unlike mind maps). A student
// who's seen everything and clicks "Generate New" (see
// MyLearningDecks.jsx) gets a fresh deck the same way. Bumps
// EducationSlideDeckView so this resolves into "My Learning Decks"'
// history (listSlideDecksService) regardless of whether a new deck was
// created or an existing one reused.
//
// slideDeckId, when passed, means "reopen exactly this past deck"
// (MyLearningDecks.jsx's "view" link, or this same page's own
// poll-retry call once a deck has already been resolved this session) —
// the shared-pool logic is skipped entirely, so a deck already marked
// "seen" doesn't get silently swapped for an unseen or brand-new one
// just because the student is looking at it again.
export const generateSlideDeckService = async (userId, { chapterId, slideDeckId: requestedDeckId }) => {
  const { studentScope, chapter, board, standard } = await resolveStudentAndChapter(userId, chapterId);
  const subject = chapter.subject.name;
  const chapterName = chapter.name;

  let row;
  if (requestedDeckId) {
    row = await EducationSlideDeck.findOne({
      where: { slide_deck_id: requestedDeckId, chapter_id: chapter.chapter_id, board, standard },
    });
    if (!row) throw createEducationError("Learning deck not found", 404, "SLIDE_DECK_NOT_FOUND");
    await recoverStuckSlideDeck(row, { subject, chapterName, board, standard });
  } else {
    row = await ensureSharedSlideDeck({
      chapterId: chapter.chapter_id,
      subject,
      chapterName,
      board,
      standard,
      studentProfileId: studentScope.studentProfileId,
    });
  }
  await EducationSlideDeckView.upsert({
    student_profile_id: studentScope.studentProfileId,
    slide_deck_id: row.slide_deck_id,
    viewed_at: new Date(),
  });

  if (row.status !== "completed") {
    // Not an error — generation is already running (or about to be).
    // The frontend polls GET /api/slide-deck/status and fetches the
    // deck once it's ready, same pattern as mind maps' background
    // variants.
    return {
      chapter_id: chapter.chapter_id,
      chapter_name: chapterName,
      status: row.status,
      slide_deck_id: row.slide_deck_id,
    };
  }

  return {
    chapter_id: chapter.chapter_id,
    chapter_name: chapterName,
    status: "completed",
    slide_deck_id: row.slide_deck_id,
    ...row.payload,
  };
};

// Status-only, for the frontend to poll while generation is still
// running. Also doubles as the main recovery path for a stuck row — a
// student's tab that's already open and polling will self-heal without
// needing to do anything, not just the next time someone calls
// generate(). Scoped by the exact slide_deck_id generate() returned —
// required now that several decks can coexist for the same chapter+scope
// (the shared pool); a plain chapter+board+standard lookup would be
// ambiguous.
export const getSlideDeckStatusService = async (userId, { chapterId, slideDeckId }) => {
  const { chapter, board, standard } = await resolveStudentAndChapter(userId, chapterId);
  const row = await EducationSlideDeck.findOne({
    where: { slide_deck_id: slideDeckId, chapter_id: chapter.chapter_id, board, standard },
  });
  await recoverStuckSlideDeck(row, { subject: chapter.subject.name, chapterName: chapter.name, board, standard });
  return { status: row?.status || null };
};

// "My Learning Decks" — every pool deck this student has generated/seen,
// direct mirror of flashcards_service.js's listFlashcardSetsService.
export const listSlideDecksService = async (userId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const views = await EducationSlideDeckView.findAll({
    where: { student_profile_id: studentScope.studentProfileId },
    include: [
      {
        model: EducationSlideDeck,
        as: "deck",
        include: [
          {
            model: EducationChapter,
            as: "chapter",
            attributes: ["chapter_id", "name", "subject_id"],
            include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] }],
          },
        ],
      },
    ],
    order: [["viewed_at", "DESC"]],
    limit: 50,
  });

  return views.map((v) => ({
    slide_deck_id: v.slide_deck_id,
    chapter_id: v.deck?.chapter_id,
    chapter_name: v.deck?.chapter?.name || null,
    subject_id: v.deck?.chapter?.subject?.subject_id || null,
    subject_name: v.deck?.chapter?.subject?.name || null,
    status: v.deck?.status,
    error_message: v.deck?.status === "failed" ? v.deck?.error_message : null,
    created_at: v.viewed_at,
  }));
};

// Called by RAGProductionApp's Celery worker when generation finishes
// (or exhausts its retries) — see core/slide_deck_tasks.py.
export const recordSlideDeckCallbackService = async (slideDeckId, { status, payload, error_message }) => {
  const row = await EducationSlideDeck.findOne({ where: { slide_deck_id: slideDeckId } });
  if (!row) throw createEducationError("Slide deck not found", 404, "SLIDE_DECK_NOT_FOUND");

  await row.update({
    status,
    ...(payload !== undefined && { payload }),
    ...(error_message !== undefined && { error_message }),
    ...(status === "completed" && { generated_at: new Date() }),
  });

  return row;
};
