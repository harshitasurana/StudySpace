import { buildStudentChapterData, getProgressOverviewService } from "../progress/progress_service.js";
import { generateStudyPlanIntro } from "../../common/services/ai_service_client.js";

// The intro is a live, synchronous Ollama call (generateStudyPlanIntro ->
// RAGProductionApp's /api/study-plan/intro -> tutor_engine.py's
// generate_study_plan_intro) with no caching at all — every single page
// load regenerated it from scratch, which is what actually made this page
// feel slow (a real LLM completion, not a DB query). Cached here keyed by
// the exact stats that went into it: those stats only change when the
// student's real progress changes (completes a chapter, takes a quiz), so
// a student re-opening the page with nothing new to show gets the cached
// intro instantly instead of paying for a fresh generation that would
// have said the same thing anyway. TTL is just a backstop against
// unbounded growth, not the primary invalidation mechanism.
const STUDY_PLAN_INTRO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const studyPlanIntroCache = new Map(); // key -> { value, expiresAt }

const getCachedStudyPlanIntro = async (params) => {
  const key = JSON.stringify(params);
  const cached = studyPlanIntroCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const aiResponse = await generateStudyPlanIntro(params);
  const intro = aiResponse.intro || null;
  studyPlanIntroCache.set(key, { value: intro, expiresAt: Date.now() + STUDY_PLAN_INTRO_CACHE_TTL_MS });
  return intro;
};

// Same rule pickRecommendation (progress_service.js) uses for its single
// top pick, generalized to rank every not-yet-mastered chapter instead of
// just the first — real signals only, nothing fabricated:
//   - "focus" items: chapters the student has actually engaged with
//     (in progress, or has quiz/mock attempts), ranked weakest-mastery
//     first — the highest-value places to spend time next.
//   - "up_next" items: untouched chapters, in real curriculum order
//     (subject_id, chapter_order), for once the focus items are handled.
const buildRankedPlan = (chapterData) => {
  const notMastered = chapterData.filter((c) => c.status !== "completed");

  const focus = notMastered
    .filter((c) => c.status !== "not_started" || c.quiz_count > 0 || c.mock_count > 0)
    .sort((a, b) => a.mastery - b.mastery);

  const upNext = notMastered.filter(
    (c) => c.status === "not_started" && c.quiz_count === 0 && c.mock_count === 0
  );

  const toItem = (c, group) => ({
    chapter_id: c.chapter_id,
    chapter_name: c.chapter_name,
    subject_id: c.subject_id,
    subject_name: c.subject_name,
    status: c.status,
    mastery: c.mastery,
    group,
  });

  return [...focus.map((c) => toItem(c, "focus")), ...upNext.map((c) => toItem(c, "up_next"))];
};

// Spreads the same real, priority-ordered items across the next 7 real
// calendar days — highest-priority items land on earlier days, evenly
// packed (ceil(items/7) per day) rather than front-loading everything
// onto day 1. A day with nothing left assigned is a real "caught up /
// review" day, not an error — the frontend shows it as such.
const buildWeeklyPlan = (items) => {
  const perDay = items.length === 0 ? 0 : Math.max(1, Math.ceil(items.length / 7));
  const today = new Date();

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    return {
      date: date.toISOString().slice(0, 10),
      day_label: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      items: perDay === 0 ? [] : items.slice(i * perDay, (i + 1) * perDay),
    };
  });
};

export const getStudyPlanService = async (userId) => {
  const { chapterData } = await buildStudentChapterData(userId);

  const items = buildRankedPlan(chapterData);
  const weeklyPlan = buildWeeklyPlan(items);
  const { streak_days: streakDays } = await getProgressOverviewService(userId);

  const totalChapters = chapterData.length;
  const chaptersCompleted = chapterData.filter((c) => c.status === "completed").length;
  const overallMastery =
    totalChapters === 0 ? 0 : Math.round((chapterData.reduce((s, c) => s + c.mastery, 0) / totalChapters) * 100) / 100;
  const weakest = items.find((i) => i.group === "focus") || null;

  let intro = null;
  try {
    intro = await getCachedStudyPlanIntro({
      userId,
      overallMastery,
      totalChapters,
      chaptersCompleted,
      weakestChapter: weakest?.chapter_name || null,
      weakestMastery: weakest?.mastery ?? null,
      notStartedCount: items.filter((i) => i.group === "up_next").length,
    });
  } catch {
    // AI service unavailable/slow — the plan itself is still real and
    // useful without the narrative intro, so degrade quietly rather than
    // failing the whole page.
    intro = null;
  }

  return {
    intro,
    overall_mastery: overallMastery,
    total_chapters: totalChapters,
    chapters_completed: chaptersCompleted,
    streak_days: streakDays,
    items,
    weekly_plan: weeklyPlan,
  };
};
