import crypto from "crypto";
import { EducationChapter } from "../curriculum/curriculum_schema.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationAcademicBoard, EducationAcademicClass, EducationAcademicSubject } from "../academic/academic_schema.js";
import { resolveStudentClassId } from "../curriculum/curriculum_service.js";
import { generateMindMap, triggerMindMapGeneration } from "../../common/services/ai_service_client.js";
import { createEducationError } from "../education_errors.js";
import { EducationMindMap } from "./mindmap_schema.js";
import { EducationMindMapView } from "./mindmap_view_schema.js";

// Must match RAGProductionApp's MIND_MAP_LENS_INSTRUCTIONS keys exactly
// (core/prompts.py) — each is a differently-organized pre-generated view
// of the same chapter. "concept_overview" is always the first (and only
// synchronously-generated) one a student sees.
export const MIND_MAP_VARIANTS = [
  { id: "concept_overview", label: "Concept Overview" },
  { id: "problem_solving_path", label: "Problem-Solving Path" },
  { id: "compare_contrast", label: "Compare & Contrast" },
  { id: "building_blocks", label: "Building Blocks" },
  { id: "real_world_applications", label: "Real-World Applications" },
];
const DEFAULT_VARIANT = "concept_overview";

const toVariantSummary = (row) => ({ variant: row.variant, status: row.status });

const isValidPayload = (payload) =>
  Boolean(payload && payload.central_topic && Array.isArray(payload.branches) && payload.branches.length > 0);

// Generation normally finishes in well under a minute; 3x that is a
// generous margin before treating a row as abandoned or worth retrying.
//
// Covers two real, confirmed failure modes:
// 1. Stuck at "processing"/"pending": the AI service's background task
//    completes and calls back here, but the callback POST itself hits a
//    transient failure (e.g. Node briefly restarting) — the generated
//    content is gone either way, and without this the row would stay
//    "processing" forever with nothing ever re-triggering it.
// 2. "failed": a genuine generation failure (e.g. the shared local
//    Ollama instance briefly overloaded — confirmed live: a synchronous
//    concept_overview call exceeded even the 180s budget under heavy
//    concurrent load, and the 4 background hand-offs then also missed
//    their 15s acknowledgement window). Without also retrying these,
//    ANY failure — even a one-off, transient one — permanently strands
//    that chapter+scope: generateMindMapService only ever creates+fires
//    all 5 rows once, the very first time none exist, so a failed row
//    had no path back to "completed" ever again. Retried on the same
//    cooldown as stuck rows — a real failure deserves another attempt,
//    not silence forever, but still throttled so a persistently broken
//    service doesn't get hammered on every request/poll.
const STUCK_ROW_THRESHOLD_MS = 3 * 60 * 1000;

// force bypasses the cooldown for an explicit admin-triggered retry (see
// processChapterController) — passive auto-recovery on a student's poll
// still respects it so a persistently broken AI service isn't hammered.
const recoverStuckRows = async (rows, { subject, chapterName, board, standard }, { force = false } = {}) => {
  const staleCutoff = Date.now() - STUCK_ROW_THRESHOLD_MS;
  const stuck = rows.filter(
    (r) => ["processing", "pending", "failed"].includes(r.status) && (force || new Date(r.updated_at).getTime() < staleCutoff)
  );
  if (stuck.length === 0) return;

  await Promise.all(
    stuck.map(async (row) => {
      // Re-saving to "processing" refreshes updated_at even for rows
      // already at that status, so a stuck/failed row is only ever
      // retried once per STUCK_ROW_THRESHOLD_MS window, not on every
      // request that happens to poll in between.
      await row.update({ status: "processing", error_message: null });
      try {
        await triggerMindMapGeneration({
          mindMapId: row.mind_map_id,
          subject,
          chapter: chapterName,
          board,
          standard,
          variant: row.variant,
        });
      } catch (err) {
        await row.update({ status: "failed", error_message: err.message || "Failed to reach the AI service" });
      }
    })
  );
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

// Creates a brand new generation group: 5 variant rows tied together by a
// fresh generation_group_id, the default variant generated synchronously,
// the other 4 fired in the background via the AI service's Celery worker
// (reporting back through recordMindMapCallbackService). Called whenever
// no existing pool group can be reused — see ensureAnyMindMapGroup (admin)
// and ensureSharedMindMapGroup (student) below, the two get-or-create
// cores that decide WHEN a new group is warranted.
const createMindMapGroup = async ({ chapterId, subject, chapterName, board, standard }) => {
  const generationGroupId = crypto.randomUUID();
  const rows = await EducationMindMap.bulkCreate(
    MIND_MAP_VARIANTS.map((v) => ({
      chapter_id: chapterId,
      board,
      standard,
      variant: v.id,
      status: "pending",
      generation_group_id: generationGroupId,
    }))
  );

  const primaryRow = rows.find((r) => r.variant === DEFAULT_VARIANT);
  await primaryRow.update({ status: "processing" });
  try {
    const aiResponse = await generateMindMap({
      subject,
      chapter: chapterName,
      board,
      standard,
      variant: DEFAULT_VARIANT,
    });
    if (!isValidPayload(aiResponse)) {
      throw new Error("AI service returned an empty or malformed mind map");
    }
    const payload = {
      central_topic: aiResponse.central_topic,
      branches: aiResponse.branches,
      relationships: Array.isArray(aiResponse.relationships) ? aiResponse.relationships : [],
    };
    await primaryRow.update({ status: "completed", payload, generated_at: new Date() });
  } catch (err) {
    // Marked failed here; NOT re-thrown immediately — the other 4
    // variants below are independent and may still succeed, and the
    // "pick whatever's completed" fallback further down gives an
    // honest error only if truly nothing is ready for this student.
    await primaryRow.update({ status: "failed", error_message: err.message || "Generation failed" });
  }

  // Fire the other 4 asynchronously — don't await completion. A
  // hand-off failure (reaching the AI service at all, not a
  // generation failure — that comes back later via the callback)
  // marks the row failed immediately rather than leaving it stuck at
  // "pending" forever with nothing running to ever update it (same
  // reasoning as startIngestionService's ingestion job hand-off).
  const backgroundRows = rows.filter((r) => r.variant !== DEFAULT_VARIANT);
  await Promise.all(
    backgroundRows.map(async (row) => {
      await row.update({ status: "processing" });
      try {
        await triggerMindMapGeneration({
          mindMapId: row.mind_map_id,
          subject,
          chapter: chapterName,
          board,
          standard,
          variant: row.variant,
        });
      } catch (err) {
        await row.update({ status: "failed", error_message: err.message || "Failed to reach the AI service" });
      }
    })
  );

  return rows;
};

const getGroupRows = (generationGroupId) =>
  EducationMindMap.findAll({ where: { generation_group_id: generationGroupId } });

// Admin/pregeneration path — "ensure at least one group exists for this
// chapter+scope," no specific-student concept to check "unseen" against
// (unlike the student path below). Reuses the oldest existing group,
// recovering any stuck rows in it, or creates a brand new one. Preserves
// this function's pre-shared-pool behavior exactly (there used to be only
// ever one group possible; this keeps finding "the" group deterministically
// now that several could theoretically exist).
const ensureAnyMindMapGroup = async ({ chapterId, subject, chapterName, board, standard, force = false }) => {
  const existingPrimary = await EducationMindMap.findOne({
    where: { chapter_id: chapterId, board, standard, variant: DEFAULT_VARIANT },
    order: [["created_at", "ASC"]],
  });

  if (!existingPrimary) {
    return createMindMapGroup({ chapterId, subject, chapterName, board, standard });
  }

  const rows = await getGroupRows(existingPrimary.generation_group_id);
  await recoverStuckRows(rows, { subject, chapterName, board, standard }, { force });
  return rows;
};

// Get-or-create core for the SHARED chapter-level POOL of generation
// groups — direct mirror of flashcards_service.js's
// ensureSharedFlashcardSet, just operating on a 5-row group (keyed by its
// concept_overview row, the one variant every group is guaranteed to
// have attempted) instead of a single row: a student cycles through pool
// groups they haven't seen yet (instant, no AI call); only once they've
// exhausted every existing group does a genuinely new one get generated,
// which then joins the pool for the next student who needs it.
const ensureSharedMindMapGroup = async ({ chapterId, subject, chapterName, board, standard, studentProfileId }) => {
  const primaries = await EducationMindMap.findAll({
    where: { chapter_id: chapterId, board, standard, variant: DEFAULT_VARIANT },
    order: [["created_at", "ASC"]],
  });

  if (primaries.length > 0) {
    const viewedGroupIds = new Set(
      (
        await EducationMindMapView.findAll({
          where: { student_profile_id: studentProfileId, generation_group_id: primaries.map((p) => p.generation_group_id) },
          attributes: ["generation_group_id"],
        })
      ).map((v) => v.generation_group_id)
    );
    const unseen = primaries.filter((p) => !viewedGroupIds.has(p.generation_group_id));

    // Prefer an unseen group that's usable as-is (completed, or already
    // generating — watching an in-flight one rather than starting a
    // redundant duplicate generation) over one that's failed.
    const unseenUsable = unseen.find((p) => p.status !== "failed");
    if (unseenUsable) {
      const rows = await getGroupRows(unseenUsable.generation_group_id);
      await recoverStuckRows(rows, { subject, chapterName, board, standard });
      return rows;
    }

    // Every remaining unseen group is failed — retry the oldest one
    // (self-heals a pool that's accumulated dead entries) instead of
    // creating yet another new group. force:true bypasses the passive
    // cooldown — this student is actively asking for content now.
    const unseenFailed = unseen.find((p) => p.status === "failed");
    if (unseenFailed) {
      const rows = await getGroupRows(unseenFailed.generation_group_id);
      await recoverStuckRows(rows, { subject, chapterName, board, standard }, { force: true });
      return rows;
    }

    // This student has already seen every existing pool group — fall
    // through to generating a genuinely new one below.
  }

  return createMindMapGroup({ chapterId, subject, chapterName, board, standard });
};

// Resolves the same (board, standard) shape a real student's own profile
// would produce (see resolveStudentAndChapter's "Standard <name>" format)
// but directly from the chapter's own subject/class -> board relation —
// an admin has no student profile. Keeping the exact same string format
// matters: it's what makes a pregenerated row actually get found later by
// EducationMindMap.findAll({ where: { chapter_id, board, standard } }).
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
export const pregenerateMindMapService = async (chapterId, { force = false } = {}) => {
  const { chapter, board, standard } = await resolveChapterScope(chapterId);
  const rows = await ensureAnyMindMapGroup({
    chapterId: chapter.chapter_id,
    subject: chapter.subject.name,
    chapterName: chapter.name,
    board,
    standard,
    force,
  });
  return { chapter_id: chapter.chapter_id, variants: rows.map(toVariantSummary) };
};

// Read-only status for the admin curriculum screen — GET
// /api/mindmap/status is student-scoped (resolveStudentAndChapter
// requires a real student profile, which an admin never has), so this is
// a separate path that resolves the exact same (board, standard) scope
// pregenerateMindMapService would use and just reads whatever's there,
// never triggering generation itself.
export const getMindMapAdminStatusService = async (chapterId) => {
  const { chapter, board, standard } = await resolveChapterScope(chapterId);
  const rows = await EducationMindMap.findAll({ where: { chapter_id: chapter.chapter_id, board, standard } });
  return { variants: rows.map(toVariantSummary) };
};

// Bulk counterpart for the Ingestion Monitor's chapter overview — one
// query for every chapter instead of N calls to
// getMindMapAdminStatusService. Ignores board/standard (a chapter
// normally only ever has one combination in practice — see
// resolveChapterScope) and just collapses every row found for a
// chapter_id into a single status: any failed variant wins (surfaces the
// thing worth fixing), then any variant still in flight, then completed
// only once every variant is, otherwise null (never generated).
export const getMindMapStatusForChaptersService = async (chapterIds) => {
  if (!chapterIds || chapterIds.length === 0) return {};
  const rows = await EducationMindMap.findAll({ where: { chapter_id: chapterIds } });
  const byChapter = {};
  for (const row of rows) {
    if (!byChapter[row.chapter_id]) byChapter[row.chapter_id] = [];
    byChapter[row.chapter_id].push(row.status);
  }
  const result = {};
  for (const [chapterId, statuses] of Object.entries(byChapter)) {
    let status = null;
    if (statuses.some((s) => s === "failed")) status = "failed";
    else if (statuses.every((s) => s === "completed")) status = "completed";
    else if (statuses.some((s) => s === "processing" || s === "pending")) status = "processing";
    result[chapterId] = { status };
  }
  return result;
};

// Get-or-create through the shared pool (ensureSharedMindMapGroup): a
// student who hasn't seen any existing group for this chapter+scope
// either gets an unseen one instantly or triggers a genuinely new
// generation (the default variant synchronously, the other 4 in the
// background via the AI service's Celery worker, reporting back through
// recordMindMapCallbackService). A student who's seen everything and
// clicks "Generate New" (see MyMindMaps.jsx) gets a fresh group the same
// way. Bumps EducationMindMapView so this resolves into "My Mind Maps"'
// history (listMindMapsService) regardless of whether a new group was
// created or an existing one reused.
//
// generationGroupId, when passed, means "reopen exactly this past
// generation" (MyMindMaps.jsx's "view" link, or this same page's own
// variant-switch/poll-retry calls once a group has already been
// resolved this session) — the shared-pool logic is skipped entirely, so
// a group already marked "seen" doesn't get silently swapped for an
// unseen or brand-new one just because the student is looking at it
// again.
export const generateMindMapService = async (userId, { chapterId, variant, generationGroupId: requestedGroupId }) => {
  const requestedVariant = MIND_MAP_VARIANTS.some((v) => v.id === variant) ? variant : DEFAULT_VARIANT;
  const { studentScope, chapter, board, standard } = await resolveStudentAndChapter(userId, chapterId);
  const subject = chapter.subject.name;
  const chapterName = chapter.name;

  let rows;
  if (requestedGroupId) {
    rows = await getGroupRows(requestedGroupId);
    // Scope check: the group must actually belong to this chapter+scope,
    // same protection resolveStudentAndChapter already gives every other
    // path here — a group id from a different chapter (or another
    // student's board/class) must 404, not leak its content.
    if (rows.length === 0 || rows[0].chapter_id !== chapter.chapter_id || rows[0].board !== board || rows[0].standard !== standard) {
      throw createEducationError("Mind map not found", 404, "MIND_MAP_NOT_FOUND");
    }
    await recoverStuckRows(rows, { subject, chapterName, board, standard });
  } else {
    rows = await ensureSharedMindMapGroup({
      chapterId: chapter.chapter_id,
      subject,
      chapterName,
      board,
      standard,
      studentProfileId: studentScope.studentProfileId,
    });
  }
  const generationGroupId = rows[0].generation_group_id;
  await EducationMindMapView.upsert({
    student_profile_id: studentScope.studentProfileId,
    generation_group_id: generationGroupId,
    viewed_at: new Date(),
  });

  // Prefer the requested variant if it's ready; otherwise fall back to
  // whichever variant IS completed — relevant for a second student
  // hitting a chapter that's still warming up, but just as often the
  // SAME student's own request landing while their own first-ever
  // request (which awaits the primary variant synchronously above) is
  // still in flight — e.g. a double-click, or a second effect firing
  // before the first resolves. That's not a failure, just early.
  let targetRow = rows.find((r) => r.variant === requestedVariant);
  if (!targetRow || targetRow.status !== "completed") {
    targetRow = rows.find((r) => r.status === "completed") || targetRow;
  }

  const anyCompleted = rows.some((r) => r.status === "completed");
  if (!targetRow || (targetRow.status === "failed" && !anyCompleted)) {
    // Genuinely nothing usable anywhere for this chapter+scope — a real
    // failure, not just "still cooking".
    throw createEducationError("Could not generate a mind map for this chapter", 502, "MINDMAP_GENERATION_FAILED");
  }

  if (targetRow.status !== "completed") {
    // Still pending/processing — the request that will complete it is
    // already running (or about to be). Not an error: the frontend
    // already polls GET /api/mindmap/status and picks this variant up
    // once it's ready, same as any other still-generating variant.
    return {
      chapter_id: chapter.chapter_id,
      chapter_name: chapterName,
      variant: targetRow.variant,
      status: targetRow.status,
      generation_group_id: generationGroupId,
      variants: rows.map(toVariantSummary),
    };
  }

  return {
    chapter_id: chapter.chapter_id,
    chapter_name: chapterName,
    variant: targetRow.variant,
    status: "completed",
    generation_group_id: generationGroupId,
    ...targetRow.payload,
    variants: rows.map(toVariantSummary),
  };
};

// Manifest-only, for the frontend's variant switcher to poll while
// background variants are still generating. Also doubles as the main
// recovery path for a stuck row — a student's tab that's already open
// and polling will self-heal without them needing to do anything, not
// just the next time someone happens to call generate(). Scoped by the
// exact generation_group_id generate() returned — required now that
// several groups can coexist for the same chapter+scope (the shared
// pool); a plain chapter+board+standard query would mix rows from
// unrelated groups together.
export const getMindMapStatusService = async (userId, { chapterId, generationGroupId }) => {
  const { chapter, board, standard } = await resolveStudentAndChapter(userId, chapterId);
  const rows = await EducationMindMap.findAll({
    where: { chapter_id: chapter.chapter_id, board, standard, generation_group_id: generationGroupId },
  });
  await recoverStuckRows(rows, { subject: chapter.subject.name, chapterName: chapter.name, board, standard });
  return { variants: rows.map(toVariantSummary) };
};

// "My Mind Maps" — every pool group this student has generated/seen,
// direct mirror of flashcards_service.js's listFlashcardSetsService: this
// student's view rows (one per group), joined to each group's
// concept_overview row for status/chapter/subject, sorted by when they
// last touched it.
export const listMindMapsService = async (userId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const views = await EducationMindMapView.findAll({
    where: { student_profile_id: studentScope.studentProfileId },
    order: [["viewed_at", "DESC"]],
    limit: 50,
  });
  if (views.length === 0) return [];

  const primaries = await EducationMindMap.findAll({
    where: { generation_group_id: views.map((v) => v.generation_group_id), variant: DEFAULT_VARIANT },
    include: [
      {
        model: EducationChapter,
        as: "chapter",
        attributes: ["chapter_id", "name", "subject_id"],
        include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] }],
      },
    ],
  });
  const byGroup = new Map(primaries.map((p) => [p.generation_group_id, p]));

  return views
    .map((v) => {
      const p = byGroup.get(v.generation_group_id);
      if (!p) return null; // Orphaned view row — shouldn't happen, skip defensively.
      return {
        generation_group_id: v.generation_group_id,
        chapter_id: p.chapter_id,
        chapter_name: p.chapter?.name || null,
        subject_id: p.chapter?.subject?.subject_id || null,
        subject_name: p.chapter?.subject?.name || null,
        status: p.status,
        error_message: p.status === "failed" ? p.error_message : null,
        created_at: v.viewed_at,
      };
    })
    .filter(Boolean);
};

// Called by RAGProductionApp's Celery worker when a background variant
// finishes (or exhausts its retries) — see core/mindmap_tasks.py.
export const recordMindMapCallbackService = async (mindMapId, { status, payload, error_message }) => {
  const row = await EducationMindMap.findOne({ where: { mind_map_id: mindMapId } });
  if (!row) throw createEducationError("Mind map not found", 404, "MIND_MAP_NOT_FOUND");

  await row.update({
    status,
    ...(payload !== undefined && { payload }),
    ...(error_message !== undefined && { error_message }),
    ...(status === "completed" && { generated_at: new Date() }),
  });

  return row;
};
