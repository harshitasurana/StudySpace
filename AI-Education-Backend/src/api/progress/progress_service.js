
import { Op } from "sequelize";
import { EducationChapter, EducationStudentChapterProgress } from "../curriculum/curriculum_schema.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationAcademicSubject } from "../academic/academic_schema.js";
import { QuizAttempt, QuizAnswer } from "../quiz/quiz_schema.js";
import { getWeakestConceptForChapter } from "../quiz/quiz_service.js";
import { AiConversation, AiMessage } from "../ai-tutor/ai_tutor_schema.js";
import { EducationStudentNote } from "../notes/notes_schema.js";
import { EducationStudentBookmark } from "../bookmarks/bookmarks_schema.js";
import { EducationStudentAchievement } from "./student_achievement_schema.js";
import { createEducationError } from "../education_errors.js";
import { toISTDateString, computeStreakDays } from "../../common/utils/streak_dates.js";
import { createNotification } from "../profile/notification_service.js";
import { logError } from "../../common/utils/logger.js";

// ── Rubric ───────────────────────────────────────────────────────────────
// A chapter's mastery is a weighted blend of every real signal available
// for it — never a single raw number, and never fabricated when a signal
// is missing:
//   - calibration (30%): the chapter's progress_percent, i.e. the
//     pre-assessment-seeded baseline (see curriculum/quiz Phase 5)
//   - quizAvg (35%): average % across the student's own submitted
//     practice-quiz attempts for that chapter
//   - mockAvg (35%): average % across the student's own submitted
//     mock-test attempts for that chapter
// Missing signals are dropped and the remaining weights renormalized —
// e.g. a chapter with only a pre-assessment (calibration) and no quizzes
// yet is scored on calibration alone, not penalized to zero for the gap.
export const RUBRIC_WEIGHTS = { calibration: 0.3, quizAvg: 0.35, mockAvg: 0.35 };

export const rubricScore = ({ calibration, quizAvg, mockAvg }) => {
  const parts = [];
  if (calibration != null) parts.push({ value: calibration, weight: RUBRIC_WEIGHTS.calibration });
  if (quizAvg != null) parts.push({ value: quizAvg, weight: RUBRIC_WEIGHTS.quizAvg });
  if (mockAvg != null) parts.push({ value: mockAvg, weight: RUBRIC_WEIGHTS.mockAvg });
  if (parts.length === 0) return 0;

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const weighted = parts.reduce((sum, p) => sum + p.value * p.weight, 0);
  return Math.round((weighted / totalWeight) * 100) / 100;
};

const average = (values) => (values.length === 0 ? null : values.reduce((s, v) => s + v, 0) / values.length);

// Real elapsed time for one attempt — created_at is stamped when the AI
// generated the questions, submitted_at when the last answer was graded.
// null for anything not yet submitted (shouldn't occur in submitted-only
// queries, but kept defensive).
const durationSeconds = (attempt) =>
  attempt.submitted_at && attempt.created_at
    ? Math.max(0, Math.round((new Date(attempt.submitted_at) - new Date(attempt.created_at)) / 1000))
    : null;

const daysAgo = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};

/**
 * Pulls every real signal for the calling student — their enrolled
 * subjects' chapters, progress rows, and submitted quiz/mock attempts —
 * and folds them into one per-chapter map. Every other function in this
 * module builds on this single real dataset; nothing here is fabricated
 * or defaulted to a plausible-looking number.
 */
export const buildStudentChapterData = async (userId) => {
  const profile = await EducationStudentProfile.findOne({
    where: { user_id: userId },
    attributes: ["student_profile_id", "class_id"],
    include: [{ model: EducationAcademicSubject, as: "subjects", attributes: ["subject_id", "name"], through: { attributes: [] } }],
  });

  if (!profile || !profile.class_id) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const subjectIds = profile.subjects.map((s) => s.subject_id);
  const subjectNameById = new Map(profile.subjects.map((s) => [s.subject_id, s.name]));

  const chapters = await EducationChapter.findAll({
    where: { class_id: profile.class_id, subject_id: { [Op.in]: subjectIds }, is_active: true },
    order: [["subject_id", "ASC"], ["chapter_order", "ASC"]],
  });

  const [progressRows, attempts] = await Promise.all([
    EducationStudentChapterProgress.findAll({ where: { student_profile_id: profile.student_profile_id } }),
    QuizAttempt.findAll({ where: { student_profile_id: profile.student_profile_id, status: "submitted" } }),
  ]);

  const progressByChapter = new Map(progressRows.map((p) => [p.chapter_id, p]));
  const attemptsByChapter = new Map();
  attempts.forEach((a) => {
    if (!attemptsByChapter.has(a.chapter_id)) attemptsByChapter.set(a.chapter_id, []);
    attemptsByChapter.get(a.chapter_id).push(a);
  });

  const chapterData = chapters.map((chapter) => {
    const progress = progressByChapter.get(chapter.chapter_id);
    const chapterAttempts = attemptsByChapter.get(chapter.chapter_id) || [];
    const quizAvg = average(chapterAttempts.filter((a) => a.attempt_type === "quiz").map((a) => Number(a.percentage)));
    const mockAvg = average(chapterAttempts.filter((a) => a.attempt_type === "mock_test").map((a) => Number(a.percentage)));
    const calibration = progress ? Number(progress.progress_percent) : null;

    return {
      chapter_id: chapter.chapter_id,
      chapter_name: chapter.name,
      subject_id: chapter.subject_id,
      subject_name: subjectNameById.get(chapter.subject_id) || null,
      status: progress?.status || "not_started",
      mastery: rubricScore({ calibration, quizAvg, mockAvg }),
      quiz_count: chapterAttempts.filter((a) => a.attempt_type === "quiz").length,
      mock_count: chapterAttempts.filter((a) => a.attempt_type === "mock_test").length,
    };
  });

  return { studentProfileId: profile.student_profile_id, chapterData, attempts, progressRows };
};

// Scoped counterpart to buildStudentChapterData, above, for callers that
// only need one chapter's number (e.g. AI Tutor chat, called on every
// message) — querying the whole syllabus's progress/attempts per chat
// turn would be wasteful. Uses the exact same rubricScore so this can
// never silently drift from what the dashboard shows for the same
// chapter. Returns null (not a zero) when there's no real signal yet —
// callers must treat "no data" as "say nothing," never as "mastery 0".
export const getChapterMasteryForStudent = async (studentProfileId, chapterId) => {
  const [progress, attempts] = await Promise.all([
    EducationStudentChapterProgress.findOne({ where: { student_profile_id: studentProfileId, chapter_id: chapterId } }),
    QuizAttempt.findAll({
      where: { student_profile_id: studentProfileId, chapter_id: chapterId, status: "submitted" },
      attributes: ["attempt_type", "percentage"],
    }),
  ]);

  const calibration = progress ? Number(progress.progress_percent) : null;
  const quizAvg = average(attempts.filter((a) => a.attempt_type === "quiz").map((a) => Number(a.percentage)));
  const mockAvg = average(attempts.filter((a) => a.attempt_type === "mock_test").map((a) => Number(a.percentage)));
  const quiz_count = attempts.filter((a) => a.attempt_type === "quiz").length;
  const mock_count = attempts.filter((a) => a.attempt_type === "mock_test").length;

  if (calibration == null && quizAvg == null && mockAvg == null) return null;

  return { mastery: rubricScore({ calibration, quizAvg, mockAvg }), quiz_count, mock_count };
};

// Picks the one chapter most worth studying next, from real signals only:
//   1. Any not-yet-mastered chapter the student has actually engaged with
//      (in progress, or has quiz/mock attempts) — the weakest of those by
//      real rubric mastery, since that's the highest-value place to focus.
//   2. Otherwise (nothing attempted yet) — the first not-started chapter in
//      curriculum order, so a brand-new student always has a concrete
//      starting point.
// Returns null only when every chapter is already completed.
export const pickRecommendation = (chapterData) => {
  const notMastered = chapterData.filter((c) => c.status !== "completed");
  if (notMastered.length === 0) return null;

  const engaged = notMastered.filter((c) => c.status !== "not_started" || c.quiz_count > 0 || c.mock_count > 0);

  let pick;
  let reason;
  if (engaged.length > 0) {
    pick = [...engaged].sort((a, b) => a.mastery - b.mastery)[0];
    reason = pick.status === "in_progress" ? "in_progress" : "weak_area";
  } else {
    pick = notMastered[0];
    reason = "not_started";
  }

  const reasonText =
    reason === "in_progress"
      ? `You're partway through this chapter (${pick.mastery}% mastery) — let's push it further.`
      : reason === "weak_area"
        ? `Your mastery here is ${pick.mastery}% — a good chapter to strengthen.`
        : "You haven't started this chapter yet — a good place to begin.";

  return {
    chapter_id: pick.chapter_id,
    chapter_name: pick.chapter_name,
    subject_id: pick.subject_id,
    subject_name: pick.subject_name,
    status: pick.status,
    mastery: pick.mastery,
    reason,
    reason_text: reasonText,
  };
};

// Thin wrapper around buildStudentChapterData + pickRecommendation for
// callers that only have a userId and want the same real "what to study
// next" pick the Dashboard's Continue Learning card already shows — the
// study reminder job (common/jobs/study_reminder_job.js) is the first
// other caller. Returns null both when the student has no profile yet
// (buildStudentChapterData throws STUDENT_PROFILE_NOT_FOUND) and when
// every chapter is already mastered — a caller sending a reminder should
// treat both the same way: nothing real to recommend, so send nothing.
export const getRecommendedChapterForStudent = async (userId) => {
  try {
    const { chapterData } = await buildStudentChapterData(userId);
    return pickRecommendation(chapterData);
  } catch {
    return null;
  }
};

export const getProgressOverviewService = async (userId) => {
  const { chapterData, attempts, studentProfileId, progressRows } = await buildStudentChapterData(userId);

  const totalChapters = chapterData.length;
  const chaptersCompleted = chapterData.filter((c) => c.status === "completed").length;
  const chaptersInProgress = chapterData.filter((c) => c.status === "in_progress").length;
  const chaptersNotStarted = totalChapters - chaptersCompleted - chaptersInProgress;

  const overallMastery = totalChapters === 0 ? 0 : Math.round((chapterData.reduce((s, c) => s + c.mastery, 0) / totalChapters) * 100) / 100;

  const quizAttempts = attempts.filter((a) => a.attempt_type === "quiz");
  const mockAttempts = attempts.filter((a) => a.attempt_type === "mock_test");

  // Streak counts any real day of engagement, not just a submitted quiz/
  // mock test — a student who spent the day reading a chapter or chatting
  // with the AI Tutor genuinely used the app that day, and a streak that
  // only recognized quiz/mock submissions was resetting to 0 for students
  // like this even with real, multi-day activity (reported: a student
  // active across 4 real days still showed a 0 streak, because 2 of those
  // days had no quiz/mock submission — only chapter reading / AI chat).
  // Every source here is a real, already-stored timestamp — nothing
  // fabricated or inferred.
  const [aiMessages, notes, bookmarks] = await Promise.all([
    AiMessage.findAll({
      attributes: ["created_at"],
      include: [{ model: AiConversation, as: "conversation", attributes: [], where: { student_profile_id: studentProfileId }, required: true }],
    }),
    EducationStudentNote.findAll({ where: { student_profile_id: studentProfileId }, attributes: ["created_at"] }),
    EducationStudentBookmark.findAll({ where: { student_profile_id: studentProfileId }, attributes: ["created_at"] }),
  ]);

  // Bucketed by IST calendar date (see streak_dates.js) — bucketing by
  // raw UTC date here was a real, confirmed bug: the server runs in
  // UTC, so a late-night IST session could land on a different UTC
  // date than the very next session, creating a false one-day gap that
  // snapped a real multi-day streak down to 1.
  const activityDates = new Set();
  const addActivityDate = (value) => {
    const dateStr = toISTDateString(value);
    if (dateStr) activityDates.add(dateStr);
  };
  attempts.forEach((a) => addActivityDate(a.submitted_at));
  aiMessages.forEach((m) => addActivityDate(m.created_at));
  notes.forEach((n) => addActivityDate(n.created_at));
  bookmarks.forEach((b) => addActivityDate(b.created_at));
  progressRows.forEach((p) => addActivityDate(p.last_activity_at || p.updated_at));

  const streakDays = computeStreakDays(activityDates);

  const recentActivity = [...attempts]
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
    .slice(0, 5)
    .map((a) => {
      const chapter = chapterData.find((c) => c.chapter_id === a.chapter_id);
      return {
        attempt_type: a.attempt_type,
        chapter_name: chapter?.chapter_name || null,
        percentage: Number(a.percentage),
        submitted_at: a.submitted_at,
      };
    });

  const completionPercent = totalChapters === 0 ? 0 : Math.round((chaptersCompleted / totalChapters) * 10000) / 100;

  // Real elapsed time across every submitted attempt (quiz + mock +
  // pre-assessment) — the only activity this app actually timestamps
  // start-to-finish. Labeled "Study Time" but genuinely covers active
  // practice/test time, not passive reading/chat time (which isn't
  // duration-tracked anywhere yet).
  const studyTimeSeconds = attempts.reduce((sum, a) => sum + (durationSeconds(a) || 0), 0);

  // Productivity — real activity rate, not a total: how many attempts in
  // the last real 7 days.
  const last7Days = daysAgo(7);
  const productivity = attempts.filter((a) => a.submitted_at && new Date(a.submitted_at) >= last7Days).length;

  // Weekly/Monthly Comparison — real average score this period vs the
  // prior period of the same length, both from real submitted_at dates.
  // null on either side just means "not enough history yet", never 0.
  const buildComparison = (periodDays) => {
    const periodStart = daysAgo(periodDays);
    const priorStart = daysAgo(periodDays * 2);
    const current = attempts.filter((a) => a.submitted_at && new Date(a.submitted_at) >= periodStart);
    const prior = attempts.filter(
      (a) => a.submitted_at && new Date(a.submitted_at) >= priorStart && new Date(a.submitted_at) < periodStart
    );
    return {
      current_average: average(current.map((a) => Number(a.percentage))),
      previous_average: average(prior.map((a) => Number(a.percentage))),
      current_count: current.length,
      previous_count: prior.length,
    };
  };

  // Learning Score — one composite headline number, transparently a
  // blend of three already-real signals (never its own fabricated
  // input): 50% overall mastery, 30% real completion rate, 20%
  // consistency (streak, capped at a 10-day streak = full marks so one
  // long-ago streak doesn't dominate forever).
  const consistencyScore = Math.min(streakDays * 10, 100);
  const learningScore = Math.round(overallMastery * 0.5 + completionPercent * 0.3 + consistencyScore * 0.2);

  return {
    overall_mastery: overallMastery,
    total_chapters: totalChapters,
    chapters_completed: chaptersCompleted,
    chapters_in_progress: chaptersInProgress,
    chapters_not_started: chaptersNotStarted,
    completion_percent: completionPercent,
    streak_days: streakDays,
    quizzes_taken: quizAttempts.length,
    mock_tests_taken: mockAttempts.length,
    average_quiz_score: average(quizAttempts.map((a) => Number(a.percentage))),
    average_mock_test_score: average(mockAttempts.map((a) => Number(a.percentage))),
    recent_activity: recentActivity,
    recommended_next: pickRecommendation(chapterData),
    learning_score: learningScore,
    study_time_seconds: studyTimeSeconds,
    productivity_last_7_days: productivity,
    weekly_comparison: buildComparison(7),
    monthly_comparison: buildComparison(30),
  };
};

export const getSubjectProgressService = async (userId) => {
  const { studentProfileId, chapterData, attempts } = await buildStudentChapterData(userId);

  // Real per-chapter weak-concept, same data the AI Tutor's private memory
  // already uses (see ai_tutor_service.js's buildChapterMemory) — surfaced
  // here so "Weak Areas" can name the actual sub-topic ("Newton's Third
  // Law") instead of just re-sorting chapters by their own mastery score
  // and showing the chapter name, which is all the frontend had to work
  // with before. Only queried for chapters with at least one real
  // attempt — the vast majority of a student's chapters have none, and
  // getWeakestConceptForChapter would just return null for those anyway
  // after its own first query, so skipping them outright avoids that
  // wasted round-trip across a whole syllabus. Parallelized since each
  // lookup is independent.
  const engagedChapterIds = chapterData.filter((c) => c.quiz_count + c.mock_count > 0).map((c) => c.chapter_id);
  const weakestConceptEntries = await Promise.all(
    engagedChapterIds.map(async (chapterId) => [chapterId, await getWeakestConceptForChapter(studentProfileId, { chapterId })])
  );
  const weakestConceptByChapter = new Map(weakestConceptEntries);

  const subjectIds = [...new Set(chapterData.map((c) => c.subject_id))];
  const subjects = subjectIds.map((subjectId) => {
    const chapters = chapterData.filter((c) => c.subject_id === subjectId);
    const subjectAttempts = attempts.filter((a) => chapters.some((c) => c.chapter_id === a.chapter_id));
    const mastery = chapters.length === 0 ? 0 : Math.round((chapters.reduce((s, c) => s + c.mastery, 0) / chapters.length) * 100) / 100;
    const learningTimeSeconds = subjectAttempts.reduce((sum, a) => sum + (durationSeconds(a) || 0), 0);

    return {
      subject_id: subjectId,
      subject_name: chapters[0]?.subject_name || null,
      mastery,
      total_chapters: chapters.length,
      chapters_completed: chapters.filter((c) => c.status === "completed").length,
      chapters_in_progress: chapters.filter((c) => c.status === "in_progress").length,
      average_quiz_score: average(subjectAttempts.filter((a) => a.attempt_type === "quiz").map((a) => Number(a.percentage))),
      average_mock_test_score: average(subjectAttempts.filter((a) => a.attempt_type === "mock_test").map((a) => Number(a.percentage))),
      learning_time_seconds: learningTimeSeconds,
      chapters: chapters.map((c) => ({
        chapter_id: c.chapter_id,
        chapter_name: c.chapter_name,
        status: c.status,
        mastery: c.mastery,
        quiz_count: c.quiz_count,
        mock_count: c.mock_count,
        weakest_concept: weakestConceptByChapter.get(c.chapter_id) || null,
      })),
    };
  });

  return { subjects };
};

// 11 legible milestones — each condition is derived directly from the
// same real data buildStudentChapterData already gathers, plus two more
// real signals (AI Tutor conversation count, correct-answer count). No
// unlock timestamps are stored/returned since there's no dedicated
// achievements table yet — just the current, real achieved/not-achieved
// state, recomputed on every call.
// Extracted from getAchievementsService below so checkAchievementsAndNotify
// (the persist/notify side effect, called from both that service and
// quiz_service.js's notifyAttemptCompleted) can reuse the exact same
// live-computed achieved/not-achieved states rather than recomputing
// them a second, possibly-drifting way.
const computeAchievementStates = async (userId) => {
  const { studentProfileId, chapterData, attempts } = await buildStudentChapterData(userId);
  const overview = await getProgressOverviewService(userId);

  const preAssessmentsTaken = attempts.filter((a) => a.attempt_type === "pre_assessment").length;
  const quizzesTaken = attempts.filter((a) => a.attempt_type === "quiz").length;
  const mockAttempts = attempts.filter((a) => a.attempt_type === "mock_test");
  const bestMockScore = Math.max(0, ...mockAttempts.map((a) => Number(a.percentage)));
  const chaptersCompleted = chapterData.filter((c) => c.status === "completed").length;
  const subjectsWithACompletedChapter = new Set(chapterData.filter((c) => c.status === "completed").map((c) => c.subject_id));
  const totalSubjects = new Set(chapterData.map((c) => c.subject_id)).size;

  const anyPerfectScore = attempts.some((a) => Number(a.percentage) === 100);

  // Retook a mock test on a chapter and scored higher the second time —
  // real evidence of revision paying off.
  const mockByChapter = new Map();
  mockAttempts.forEach((a) => {
    if (!mockByChapter.has(a.chapter_id)) mockByChapter.set(a.chapter_id, []);
    mockByChapter.get(a.chapter_id).push(a);
  });
  const revisionImproved = [...mockByChapter.values()].some((list) => {
    const sorted = [...list].sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    return sorted.some((a, i) => i > 0 && Number(a.percentage) > Number(sorted[i - 1].percentage));
  });

  // Mastered (completed) a chapter with only 1-2 real attempts behind it
  // — efficient, not lucky (still a real signal: low attempt count +
  // completed status).
  const fastLearnerChapter = chapterData.find(
    (c) => c.status === "completed" && c.quiz_count + c.mock_count > 0 && c.quiz_count + c.mock_count <= 2
  );

  const subjectMastery = new Map();
  chapterData.forEach((c) => {
    if (!subjectMastery.has(c.subject_id)) subjectMastery.set(c.subject_id, []);
    subjectMastery.get(c.subject_id).push(c.mastery);
  });
  const anySubjectMastered = [...subjectMastery.values()].some(
    (list) => list.length > 0 && list.reduce((s, v) => s + v, 0) / list.length >= 95
  );

  const chaptersWithAiChat = await AiConversation.count({ where: { student_profile_id: studentProfileId } });

  return [
    { id: "first_steps", title: "First Steps", description: "Complete your first pre-assessment", icon: "flag", achieved: preAssessmentsTaken >= 1 },
    { id: "quiz_whiz", title: "Quiz Whiz", description: "Complete 5 practice quizzes", icon: "quiz", achieved: quizzesTaken >= 5 },
    { id: "chapter_master", title: "Chapter Master", description: "Fully master a chapter", icon: "workspace_premium", achieved: chaptersCompleted >= 1 },
    { id: "mock_test_ace", title: "Mock Test Ace", description: "Score 80% or higher on a mock test", icon: "military_tech", achieved: bestMockScore >= 80 },
    { id: "on_a_roll", title: "On a Roll", description: "Keep a 3-day learning streak", icon: "local_fire_department", achieved: overview.streak_days >= 3 },
    { id: "well_rounded", title: "Well-Rounded", description: "Master a chapter in every subject", icon: "auto_awesome", achieved: totalSubjects > 0 && subjectsWithACompletedChapter.size >= totalSubjects },
    { id: "subject_master", title: "Subject Master", description: "Reach 95%+ mastery in a subject", icon: "school", achieved: anySubjectMastered },
    { id: "ai_explorer", title: "AI Explorer", description: "Chat with the AI Tutor across 3 different chapters", icon: "explore", achieved: chaptersWithAiChat >= 3 },
    { id: "quiz_champion", title: "Quiz Champion", description: "Score a perfect 100% on any quiz or test", icon: "emoji_events", achieved: anyPerfectScore },
    { id: "revision_hero", title: "Revision Hero", description: "Retake a mock test and beat your previous score", icon: "trending_up", achieved: revisionImproved },
    { id: "fast_learner", title: "Fast Learner", description: "Master a chapter in 2 attempts or fewer", icon: "bolt", achieved: !!fastLearnerChapter },
  ];
};

// Flat bonus per achievement — same order of magnitude as an already-
// meaningful action on the existing XP scale (chapter complete = 100,
// mock test = 20) without dwarfing it. Documented here, not hidden, same
// posture as getGameStatsService's own weights comment below.
const ACHIEVEMENT_BONUS_XP = 50;

/**
 * The side-effecting counterpart to computeAchievementStates above —
 * diffs the current live states against what's already persisted in
 * education_student_achievements, and for anything newly true that
 * wasn't before: persists it (so this never fires twice for the same
 * achievement), awards the real XP bonus (read back by
 * getGameStatsService below), and sends a real ACHIEVEMENT_UNLOCKED
 * notification. Called from getAchievementsService (so opening the
 * Achievements page always catches up) and from quiz_service.js's
 * notifyAttemptCompleted (the same real moment STREAK_MILESTONE already
 * fires from, and the one point most of these 11 conditions actually
 * change at) — not from every page in the app, so an achievement that
 * only a feature outside those two moments could flip (e.g. ai_explorer,
 * only ever changes via AI Tutor chat) is caught the next time the
 * student opens Achievements rather than the instant it happens. A
 * one-time-per-achievement guarantee, not a real-time-everywhere one.
 */
export const checkAchievementsAndNotify = async (userId) => {
  const { studentProfileId } = await buildStudentChapterData(userId);
  const states = await computeAchievementStates(userId);

  const achievedIds = states.filter((a) => a.achieved).map((a) => a.id);
  if (achievedIds.length === 0) return states;

  const existing = await EducationStudentAchievement.findAll({
    where: { student_profile_id: studentProfileId, achievement_id: { [Op.in]: achievedIds } },
    attributes: ["achievement_id"],
  });
  const alreadyPersisted = new Set(existing.map((r) => r.achievement_id));
  const newlyUnlocked = states.filter((a) => a.achieved && !alreadyPersisted.has(a.id));

  for (const achievement of newlyUnlocked) {
    try {
      await EducationStudentAchievement.create({
        student_profile_id: studentProfileId,
        achievement_id: achievement.id,
        bonus_xp: ACHIEVEMENT_BONUS_XP,
      });
      await createNotification(
        {
          type: "ACHIEVEMENT_UNLOCKED",
          title: `Achievement unlocked: ${achievement.title}`,
          message: `${achievement.description} — +${ACHIEVEMENT_BONUS_XP} XP`,
          channel: "IN_APP",
        },
        userId
      );
    } catch (err) {
      // A unique-constraint race (two near-simultaneous calls both
      // detecting the same newly-true achievement before either had
      // persisted it) must never surface as a 500 to whichever caller
      // lost the race — the other one's insert already made this
      // achievement's state correct.
      logError("Failed to persist/notify newly unlocked achievement.", err, {
        service: "progress-service",
        userId,
        achievementId: achievement.id,
      });
    }
  }

  return states;
};

export const getAchievementsService = async (userId) => checkAchievementsAndNotify(userId);

// XP/Coins/Level — mostly deterministic functions of the same real
// activity counts everything else on this page already uses, recomputed
// fresh on every call; the one real exception is the achievement bonus
// below, which IS persisted (education_student_achievements — see
// checkAchievementsAndNotify above) specifically so it can only ever be
// earned once per achievement, not recomputed from a live condition that
// could flicker. Weights are documented here, not hidden.
export const getGameStatsService = async (userId) => {
  const { studentProfileId, chapterData, attempts } = await buildStudentChapterData(userId);
  const overview = await getProgressOverviewService(userId);

  const preAssessmentsTaken = attempts.filter((a) => a.attempt_type === "pre_assessment").length;
  const quizzesTaken = attempts.filter((a) => a.attempt_type === "quiz").length;
  const mockTestsTaken = attempts.filter((a) => a.attempt_type === "mock_test").length;
  const chaptersCompleted = chapterData.filter((c) => c.status === "completed").length;

  const achievementBonusXp =
    (await EducationStudentAchievement.sum("bonus_xp", { where: { student_profile_id: studentProfileId } })) || 0;

  const xp =
    chaptersCompleted * 100 +
    quizzesTaken * 10 +
    mockTestsTaken * 20 +
    preAssessmentsTaken * 15 +
    overview.streak_days * 5 +
    achievementBonusXp;
  const level = Math.floor(xp / 500) + 1;
  const xpIntoLevel = xp % 500;

  const attemptIds = attempts.map((a) => a.attempt_id);
  const coins = attemptIds.length ? await QuizAnswer.count({ where: { attempt_id: attemptIds, is_correct: true } }) : 0;

  // Missions — real, time-windowed counts against the same real data,
  // not a separate tracked/reset system. "Today"/"this week"/"this
  // month" are computed fresh on every call from real submitted_at
  // timestamps, so they're always accurate without needing a reset job.
  const todayStart = daysAgo(0);
  const weekStart = daysAgo(7);

  const answeredToday = attemptIds.length
    ? await QuizAnswer.count({ where: { attempt_id: attemptIds, answered_at: { [Op.gte]: todayStart } } })
    : 0;
  const attemptsThisWeek = attempts.filter((a) => a.submitted_at && new Date(a.submitted_at) >= weekStart).length;
  const monthlyAvg = overview.monthly_comparison.current_average;

  const missions = [
    {
      id: "daily_questions",
      period: "daily",
      title: "Answer 5 questions today",
      progress: Math.min(answeredToday, 5),
      target: 5,
      completed: answeredToday >= 5,
    },
    {
      id: "weekly_attempts",
      period: "weekly",
      title: "Complete 3 quizzes or tests this week",
      progress: Math.min(attemptsThisWeek, 3),
      target: 3,
      completed: attemptsThisWeek >= 3,
    },
    {
      id: "monthly_average",
      period: "monthly",
      title: "Keep your monthly average at 70% or higher",
      progress: monthlyAvg == null ? 0 : Math.min(Math.round(monthlyAvg), 70),
      target: 70,
      completed: monthlyAvg != null && monthlyAvg >= 70,
    },
  ];

  return {
    xp,
    level,
    xp_into_level: xpIntoLevel,
    xp_for_next_level: 500,
    achievement_bonus_xp: achievementBonusXp,
    coins,
    missions,
  };
};
