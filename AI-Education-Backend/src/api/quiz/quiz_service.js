import { Op } from "sequelize";
import { QuizAttempt, QuizAnswer } from "./quiz_schema.js";
import { EducationChapter, EducationStudentChapterProgress } from "../curriculum/curriculum_schema.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";
import { EducationAcademicBoard, EducationAcademicClass, EducationAcademicSubject } from "../academic/academic_schema.js";
import { resolveStudentClassId, upsertProgressService } from "../curriculum/curriculum_service.js";
import { triggerQuizGeneration, generateTestReview } from "../../common/services/ai_service_client.js";
import { createEducationError } from "../education_errors.js";
import { createNotification } from "../profile/notification_service.js";
import { getNotificationPreferences } from "../profile/notification_preference_service.js";
import { checkAchievementsAndNotify } from "../progress/progress_service.js";
import { toISTDateString, computeStreakDays } from "../../common/utils/streak_dates.js";

// Score needed on a quiz/mock test to count a chapter as mastered — the
// only thing that ever marks education_student_chapter_progress
// "completed" (see markChapterProgressFromAttempt below). Below this, a
// completed attempt still records the chapter as "in_progress" (real
// engagement, just not passing yet) rather than leaving it looking
// untouched.
const CHAPTER_MASTERY_THRESHOLD = 70;

// Learning-activity streak milestones — matches the "On a Roll" (3-day)
// achievement already defined in progress_service.js, extended with a few
// bigger round numbers.
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

// Every education notification this file sends is IN_APP, so they're all
// gated by the one existing "system task updates" preference (Settings >
// Notifications). This MUST go through notification_preference_service.js
// (backed by the dedicated user_notification_preferences table) — not the
// generic user_preferences EAV table other settings use — since that's
// the actual table GET/PUT /api/profile/notifications/preferences reads
// and writes. Default-on; only an explicit false opts a student out.
const isTaskUpdatesEnabled = async (userId) => {
  const prefs = await getNotificationPreferences(userId);
  return prefs.system_task_updates !== false;
};

/**
 * Fires the Topbar-notification side effects for a just-submitted attempt:
 * a quiz/mock-test result notification, plus a one-time streak-milestone
 * notification if today's submission is what pushed the student's streak
 * to a round number. Best-effort — a notification failure must never fail
 * the actual quiz submission, so every call site wraps this in .catch().
 */
const notifyAttemptCompleted = async (userId, studentProfileId, attempt, updates) => {
  if (!(await isTaskUpdatesEnabled(userId))) return;

  if (attempt.attempt_type === "quiz" || attempt.attempt_type === "mock_test") {
    const chapter = await EducationChapter.findByPk(attempt.chapter_id, { attributes: ["name"] });
    const chapterName = chapter?.name || "this chapter";
    const isMock = attempt.attempt_type === "mock_test";
    await createNotification(
      {
        type: isMock ? "MOCK_TEST_RESULT" : "QUIZ_RESULT",
        title: isMock ? "Mock Test Results Ready" : "Quiz Result Ready",
        message: `You scored ${updates.percentage}% (${attempt.score}/${attempt.total_questions}) on ${chapterName}.`,
        channel: "IN_APP",
      },
      userId
    );
  }

  // Streak milestone — gated to the FIRST submitted attempt of today for
  // this student, so additional same-day submissions don't refire the
  // same milestone notification (the streak number itself doesn't change
  // again today once it's already counted today).
  const submitted = await QuizAttempt.findAll({
    where: { student_profile_id: studentProfileId, status: "submitted" },
    attributes: ["submitted_at"],
    raw: true,
  });
  // IST calendar dates (see streak_dates.js) — was raw UTC before, the
  // same bug that made getProgressOverviewService's streak count wrong.
  const dateStrs = new Set(submitted.map((a) => toISTDateString(a.submitted_at)));
  const todayStr = toISTDateString(Date.now());
  const submittedToday = submitted.filter((a) => toISTDateString(a.submitted_at) === todayStr).length;
  if (submittedToday !== 1) return;

  const streakDays = computeStreakDays(dateStrs);

  if (STREAK_MILESTONES.includes(streakDays)) {
    await createNotification(
      {
        type: "STREAK_MILESTONE",
        title: `${streakDays}-Day Streak!`,
        message: `You've kept a learning streak going for ${streakDays} days in a row. Keep it up!`,
        channel: "IN_APP",
      },
      userId
    );
  }
};

/**
 * The ONLY place a quiz/mock-test result feeds into
 * education_student_chapter_progress — without this, no chapter could
 * ever show as mastered anywhere in the app (Subjects/dashboard mastery
 * rings, Progress, Study Plan), no matter how a student actually did,
 * since nothing else in the codebase ever writes that table.
 *
 * Scoring at/above CHAPTER_MASTERY_THRESHOLD marks the chapter
 * "completed"; a real but lower-scoring attempt still marks it
 * "in_progress" rather than leaving it untouched. Status only ever moves
 * forward — a later lower-scoring retake (e.g. practicing again) never
 * un-masters an already-completed chapter, and progress_percent always
 * reflects the best score seen, not just the latest one.
 */
const markChapterProgressFromAttempt = async (studentProfileId, chapterId, percentage) => {
  const existing = await EducationStudentChapterProgress.findOne({
    where: { student_profile_id: studentProfileId, chapter_id: chapterId },
  });

  const alreadyCompleted = existing?.status === "completed";
  const passed = percentage >= CHAPTER_MASTERY_THRESHOLD;
  const bestPercent = Math.max(percentage, Number(existing?.progress_percent) || 0);

  await upsertProgressService(studentProfileId, chapterId, {
    progress_percent: bestPercent,
    status: alreadyCompleted || passed ? "completed" : "in_progress",
  });
};

// Strips correct_answer/explanation before a question ever reaches the
// client — those only exist server-side until the student has answered.
const toPublicQuestion = ({ question, options }) => ({ question, options });

// Applied to EVERY quiz regardless of mode — keeps question STYLE
// appropriate to the real subject (the three that exist today:
// education_academic_subjects has exactly Mathematics/Science/English).
// Without this, "Formula Quiz" on English literally asked for numeric
// formula problems, since MODE_FOCUS used to be mode-only with no subject
// awareness at all.
const SUBJECT_FOCUS = {
  Mathematics:
    "Write numeric, problem-solving questions that require a calculation or applying a formula/method from this chapter — the kind of question that appears in a real Mathematics exam, not just recalling a definition.",
  Science:
    "Write a mix of factual and application questions grounded in this chapter, including calculations using any formula/law it covers where relevant — the kind of question that appears in a real Science exam.",
  English:
    "Write questions in the style of a real English exam for this chapter — comprehension of the text, grammar/usage in context, or interpretation of meaning — never numeric or formula-based questions.",
};
const DEFAULT_SUBJECT_FOCUS = "Write questions in the style of a real exam for this subject, not just simple recall.";

// "formula"/"concept"/"challenge" layer a mode-specific emphasis ON TOP of
// the subject style above — a function of (subject, mode) rather than a
// flat mode-only lookup, since "formula" only means something for
// Mathematics/Science; forcing it onto English would fight with
// SUBJECT_FOCUS's own "never numeric or formula-based" instruction, so it
// falls back to the subject's own baseline style instead.
const buildQuizFocus = (subject, mode) => {
  const subjectFocus = SUBJECT_FOCUS[subject] || DEFAULT_SUBJECT_FOCUS;

  if (mode === "formula") {
    if (subject === "Mathematics" || subject === "Science") {
      return `${subjectFocus} Focus specifically on formula application and numeric problem-solving from this chapter.`;
    }
    // No real "formula" concept in this subject — the subject's own exam
    // style is the right fallback rather than a nonsensical numeric ask.
    return subjectFocus;
  }
  if (mode === "concept") {
    return `${subjectFocus} Focus specifically on conceptual understanding — why/how questions, not just definitions or formulas.`;
  }
  if (mode === "challenge") {
    // Genuinely harder, not just a client-side timer on standard questions
    // (that's what 'timed' is) — mixes multiple concepts from the chapter
    // together and favors multi-step application/reasoning over simple
    // recall, so it's a real step up rather than the same quiz under a clock.
    return `${subjectFocus} Make these harder than a standard quiz — mix multiple concepts from this chapter together in the same question where possible, favor multi-step application/reasoning questions over simple recall or single-fact lookups, and avoid trivially easy questions.`;
  }
  return subjectFocus;
};

// Real per-concept accuracy from the student's own submitted attempts —
// every count here comes from an actual QuizAnswer row, nothing estimated
// or fabricated. Requires the `concept` tag the AI service started
// attaching to each generated question (see prompts.py's QUIZ_PROMPT /
// tutor_engine.py's generate_quiz schema) — attempts from before that
// change have no `concept` on their stored questions and are silently
// skipped, not treated as a 0% concept. A concept needs at least 2
// answered questions before it's considered (MIN_CONCEPT_SAMPLE) — one
// unlucky guess on a single-question concept isn't a real signal.
//
// `chapterId` scopes to one chapter (the AI Tutor's per-chapter memory
// use case); omitted, it looks across every chapter the student has
// attempted — e.g. getTestReviewService's whole-history mock-test review,
// which was previously using the lowest-scoring *chapter* as a stand-in
// for "weakest concept" since this function didn't exist yet.
// `attemptType` optionally restricts to one attempt_type ('quiz' |
// 'mock_test' | 'pre_assessment'); omitted, it considers all of them.
const MIN_CONCEPT_SAMPLE = 2;

export const getWeakestConceptForChapter = async (studentProfileId, { chapterId = null, attemptType = null } = {}) => {
  const attempts = await QuizAttempt.findAll({
    where: {
      student_profile_id: studentProfileId,
      status: "submitted",
      ...(chapterId != null && { chapter_id: chapterId }),
      ...(attemptType && { attempt_type: attemptType }),
    },
    attributes: ["attempt_id", "questions"],
  });
  if (attempts.length === 0) return null;

  const questionsByAttempt = new Map(attempts.map((a) => [a.attempt_id, a.questions || []]));
  const answers = await QuizAnswer.findAll({
    where: { attempt_id: { [Op.in]: attempts.map((a) => a.attempt_id) } },
    attributes: ["attempt_id", "question_index", "is_correct"],
  });

  const statsByConcept = new Map();
  for (const answer of answers) {
    const question = questionsByAttempt.get(answer.attempt_id)?.[answer.question_index];
    const concept = typeof question?.concept === "string" ? question.concept.trim() : "";
    if (!concept) continue;

    if (!statsByConcept.has(concept)) statsByConcept.set(concept, { correct: 0, total: 0 });
    const stat = statsByConcept.get(concept);
    stat.total += 1;
    if (answer.is_correct) stat.correct += 1;
  }

  let weakest = null;
  for (const [concept, { correct, total }] of statsByConcept) {
    if (total < MIN_CONCEPT_SAMPLE) continue;
    const accuracy = Math.round((correct / total) * 100);
    if (!weakest || accuracy < weakest.accuracy) weakest = { concept, accuracy, total };
  }
  return weakest;
};

// Generation normally finishes well under a minute; 3x that is a
// generous margin before treating a row as abandoned or worth retrying.
// Same threshold and reasoning as mindmap_service.js/slide_deck_service.js
// — covers a callback POST hitting a transient failure after generation
// already succeeded, and a genuine generation failure (e.g. Ollama
// briefly overloaded) that deserves a retry rather than permanently
// stranding the attempt.
const STUCK_ROW_THRESHOLD_MS = 3 * 60 * 1000;

const recoverStuckQuizAttempt = async (attempt, { subject, chapterName }) => {
  if (!attempt) return;
  const staleCutoff = Date.now() - STUCK_ROW_THRESHOLD_MS;
  const isStuck =
    ["processing", "failed"].includes(attempt.generation_status) &&
    new Date(attempt.updated_at).getTime() < staleCutoff;
  if (!isStuck) return;

  // Re-saving to "processing" refreshes updated_at even for an attempt
  // already at that status, so a stuck/failed attempt is only ever
  // retried once per STUCK_ROW_THRESHOLD_MS window, not on every request
  // that happens to poll in between.
  await attempt.update({ generation_status: "processing", error_message: null });
  try {
    await triggerQuizGeneration({
      attemptId: attempt.attempt_id,
      subject,
      chapter: chapterName,
      numQuestions: attempt.total_questions || 10,
      focus: attempt.generation_focus,
      sourceText: attempt.source_text,
    });
  } catch (err) {
    await attempt.update({ generation_status: "failed", error_message: err.message || "Failed to reach the AI service" });
  }
};

export const generateQuizService = async (
  userId,
  { chapterId, numQuestions = 10, attemptType = "quiz", mode = "standard", sourceText = null, addedByUserId = null }
) => {
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

  const focus = buildQuizFocus(chapter.subject.name, mode);

  // Created BEFORE the AI service is called (and before it even
  // acknowledges the hand-off) — this is what makes the attempt survive
  // the student navigating away mid-generation. Previously this row was
  // only created after generateQuiz's response came back, so a dropped
  // client left nothing behind at all.
  const attempt = await QuizAttempt.create({
    student_profile_id: studentScope.studentProfileId,
    chapter_id: chapterId,
    attempt_type: attemptType,
    generation_status: "processing",
    generation_focus: focus,
    source_text: sourceText,
    added_by_user_id: addedByUserId,
  });

  try {
    await triggerQuizGeneration({
      attemptId: attempt.attempt_id,
      subject: chapter.subject.name,
      chapter: chapter.name,
      numQuestions,
      board: profile?.board?.name || "CBSE",
      standard: profile?.class?.name ? `Standard ${profile.class.name}` : "Standard 9",
      focus,
      sourceText,
    });
  } catch (err) {
    // Reaching the AI service failed (not a generation failure — that
    // comes back later via the callback) — mark failed immediately
    // rather than leaving the row stuck at "processing" forever with
    // nothing running to ever update it.
    await attempt.update({ generation_status: "failed", error_message: err.message || "Failed to reach the AI service" });
  }

  return {
    attempt_id: attempt.attempt_id,
    attempt_type: attempt.attempt_type,
    generation_status: attempt.generation_status,
  };
};

/**
 * Status-only, for the frontend to poll while generation is still
 * running — also doubles as the main recovery path for a stuck attempt,
 * same pattern as getMindMapStatusService/getSlideDeckStatusService.
 */
export const getQuizStatusService = async (userId, attemptId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const attempt = await QuizAttempt.findOne({
    where: { attempt_id: attemptId, student_profile_id: studentScope.studentProfileId },
    include: [
      {
        model: EducationChapter,
        as: "chapter",
        attributes: ["chapter_id", "name"],
        include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["name"] }],
      },
    ],
  });
  if (!attempt) throw createEducationError("Quiz attempt not found", 404, "ATTEMPT_NOT_FOUND");

  await recoverStuckQuizAttempt(attempt, { subject: attempt.chapter?.subject?.name, chapterName: attempt.chapter?.name });

  if (attempt.generation_status !== "completed") {
    return {
      attempt_id: attempt.attempt_id,
      attempt_type: attempt.attempt_type,
      generation_status: attempt.generation_status,
      error_message: attempt.generation_status === "failed" ? attempt.error_message : null,
    };
  }

  // Also doubles as the Resume endpoint for an in_progress attempt whose
  // generation already finished (see listAttemptsService's includeGenerating)
  // — resume_index is simply how many questions are already answered,
  // since submitAnswerService only ever accepts the next sequential
  // question_index (the UI has no way to jump around), so "answered
  // count" and "index to resume at" are the same number. 0 for a
  // genuinely fresh attempt, same as before this existed.
  const answeredCount = await QuizAnswer.count({ where: { attempt_id: attempt.attempt_id } });

  return {
    attempt_id: attempt.attempt_id,
    attempt_type: attempt.attempt_type,
    generation_status: "completed",
    status: attempt.status,
    score: attempt.score,
    resume_index: answeredCount,
    total_questions: attempt.total_questions,
    questions: (attempt.questions || []).map(toPublicQuestion),
  };
};

/**
 * Called by RAGProductionApp's Celery worker when generation finishes
 * (or exhausts its retries) — see core/quiz_tasks.py.
 */
export const recordQuizGenerationCallbackService = async (attemptId, { status, questions, error_message }) => {
  const attempt = await QuizAttempt.findOne({ where: { attempt_id: attemptId } });
  if (!attempt) throw createEducationError("Quiz attempt not found", 404, "ATTEMPT_NOT_FOUND");

  await attempt.update({
    generation_status: status,
    ...(questions !== undefined && { questions, total_questions: questions.length }),
    ...(error_message !== undefined && { error_message }),
  });

  return attempt;
};

/**
 * Grades exactly one answer against the question's correct_answer as
 * frozen on the attempt at generation time — a client-supplied "correct"
 * flag is never read or trusted. Marks the attempt submitted once every
 * question has been answered.
 */
export const submitAnswerService = async (userId, attemptId, { questionIndex, selectedAnswer }) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const attempt = await QuizAttempt.findOne({
    where: { attempt_id: attemptId, student_profile_id: studentScope.studentProfileId },
  });
  if (!attempt) throw createEducationError("Quiz attempt not found", 404, "ATTEMPT_NOT_FOUND");
  if (attempt.status === "submitted") {
    throw createEducationError("This quiz attempt has already been completed", 400, "ATTEMPT_ALREADY_SUBMITTED");
  }
  if (questionIndex < 0 || questionIndex >= attempt.total_questions) {
    throw createEducationError("Invalid question_index", 400, "INVALID_QUESTION_INDEX");
  }

  const existing = await QuizAnswer.findOne({ where: { attempt_id: attemptId, question_index: questionIndex } });
  if (existing) throw createEducationError("This question has already been answered", 400, "QUESTION_ALREADY_ANSWERED");

  const question = attempt.questions[questionIndex];
  const isCorrect = String(selectedAnswer).trim().toUpperCase() === String(question.correct_answer).trim().toUpperCase();

  await QuizAnswer.create({
    attempt_id: attemptId,
    question_index: questionIndex,
    selected_answer: selectedAnswer,
    is_correct: isCorrect,
  });

  const newScore = attempt.score + (isCorrect ? 1 : 0);
  const answeredCount = await QuizAnswer.count({ where: { attempt_id: attemptId } });
  const completed = answeredCount >= attempt.total_questions;

  const updates = { score: newScore };
  if (completed) {
    updates.status = "submitted";
    updates.percentage = Math.round((newScore / attempt.total_questions) * 10000) / 100;
    updates.submitted_at = new Date();
  }
  await attempt.update(updates);

  // A pre-assessment's whole purpose is to calibrate where the student is
  // starting from — completing one seeds a real starting mastery baseline
  // on the chapter's progress row (replacing the old hardcoded 0.50 mock).
  if (completed && attempt.attempt_type === "pre_assessment") {
    await upsertProgressService(studentScope.studentProfileId, attempt.chapter_id, {
      progress_percent: updates.percentage,
      status: "in_progress",
    });
  }

  // Real quizzes/mock tests are what actually decide "mastered" (see
  // CHAPTER_MASTERY_THRESHOLD) — pre_assessment above only ever seeds a
  // starting baseline, never marks completion.
  if (completed && (attempt.attempt_type === "quiz" || attempt.attempt_type === "mock_test")) {
    await markChapterProgressFromAttempt(studentScope.studentProfileId, attempt.chapter_id, updates.percentage);
  }

  if (completed) {
    notifyAttemptCompleted(userId, studentScope.studentProfileId, attempt, updates).catch((err) =>
      console.warn("Failed to create attempt-completed notification.", err)
    );
    // Fired here (after markChapterProgressFromAttempt above has already
    // updated this chapter's completion status) rather than only from
    // getAchievementsService's own GET — this is the one real moment
    // most of the 11 conditions actually change (chapter_master,
    // fast_learner, quiz_whiz, mock_test_ace, quiz_champion,
    // revision_hero, on_a_roll). Achievements that only change via a
    // different feature (ai_explorer via AI Tutor chat, well_rounded/
    // subject_master via broader mastery shifts) are still caught the
    // next time the student opens Achievements — see
    // checkAchievementsAndNotify's own docstring.
    checkAchievementsAndNotify(userId).catch((err) =>
      console.warn("Failed to check/notify achievements after attempt.", err)
    );
  }

  return {
    is_correct: isCorrect,
    correct_answer: question.correct_answer,
    explanation: question.explanation,
    score: newScore,
    total_questions: attempt.total_questions,
    completed,
    percentage: completed ? updates.percentage : null,
  };
};

export const listAttemptsService = async (userId, { attemptType, includeGenerating = false } = {}) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  // Default: submitted (fully answered) attempts only, exactly as
  // before this feature existed — review-only pages (TestHistory.jsx)
  // rely on every attempt here already having real score/duration data.
  //
  // includeGenerating (opt-in, passed only by pages that actually
  // generate quizzes/mock tests — Quiz.jsx, MockTests.jsx): ALSO include
  // any attempt whose GENERATION hasn't resolved yet (processing/failed),
  // regardless of answering status, so a student who navigated away
  // mid-generation can find their way back instead of it just being
  // gone — AND any attempt that finished generating but was never fully
  // answered (in_progress + generation completed), so an abandoned
  // mid-quiz isn't just invisible forever; the caller resumes it the
  // same way as a still-generating one (see resume_index below).
  const where = { student_profile_id: studentScope.studentProfileId };
  if (includeGenerating) {
    where[Op.or] = [
      { status: "submitted" },
      { generation_status: { [Op.in]: ["processing", "failed"] } },
      { status: "in_progress", generation_status: "completed" },
    ];
  } else {
    where.status = "submitted";
  }
  if (attemptType) where.attempt_type = attemptType;

  const attempts = await QuizAttempt.findAll({
    where,
    include: [
      {
        model: EducationChapter,
        as: "chapter",
        attributes: ["chapter_id", "name", "subject_id"],
        include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] }],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  // Batched, not per-attempt — how many questions have actually been
  // answered on each in_progress attempt, so the caller can show real
  // progress ("2 of 5 answered") instead of just "In Progress".
  const answeredCountByAttempt = {};
  const attemptIds = attempts.map((a) => a.attempt_id);
  if (attemptIds.length > 0) {
    const answers = await QuizAnswer.findAll({
      where: { attempt_id: { [Op.in]: attemptIds } },
      attributes: ["attempt_id"],
      raw: true,
    });
    for (const ans of answers) {
      answeredCountByAttempt[ans.attempt_id] = (answeredCountByAttempt[ans.attempt_id] || 0) + 1;
    }
  }

  return attempts.map((a) => ({
    attempt_id: a.attempt_id,
    attempt_type: a.attempt_type,
    chapter_id: a.chapter_id,
    chapter_name: a.chapter?.name || null,
    subject_id: a.chapter?.subject?.subject_id || null,
    subject_name: a.chapter?.subject?.name || null,
    status: a.status,
    generation_status: a.generation_status,
    error_message: a.generation_status === "failed" ? a.error_message : null,
    score: a.score,
    total_questions: a.total_questions,
    percentage: a.percentage,
    // Only meaningful for an in_progress + completed-generation row —
    // how many questions this student has already answered, i.e. the
    // question index a Resume action should jump straight back to.
    answered_count: answeredCountByAttempt[a.attempt_id] || 0,
    // Real elapsed time, not fabricated — created_at is stamped when the
    // AI generated the questions, submitted_at when the last answer was
    // graded. Null until submitted_at exists (submitted-only before this
    // feature; now also null for an in_progress row, same reasoning).
    duration_seconds:
      a.submitted_at && a.created_at ? Math.round((new Date(a.submitted_at) - new Date(a.created_at)) / 1000) : null,
    submitted_at: a.submitted_at,
  }));
};

/**
 * Every real wrong answer the student has ever given, across submitted
 * attempts — the actual question/options/correct answer/explanation come
 * straight from that attempt's own frozen `questions` JSONB (the same
 * content the student was actually shown), never regenerated or guessed.
 */
export const listMistakesService = async (userId, { subjectId, attemptType } = {}) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const attemptWhere = { student_profile_id: studentScope.studentProfileId, status: "submitted" };
  if (attemptType) attemptWhere.attempt_type = attemptType;

  const chapterInclude = {
    model: EducationChapter,
    as: "chapter",
    attributes: ["chapter_id", "name", "subject_id"],
    include: [{ model: EducationAcademicSubject, as: "subject", attributes: ["subject_id", "name"] }],
  };
  if (subjectId) chapterInclude.where = { subject_id: subjectId };

  const attempts = await QuizAttempt.findAll({
    where: attemptWhere,
    include: [
      chapterInclude,
      { model: QuizAnswer, as: "answers", where: { is_correct: false }, required: true },
    ],
    order: [["submitted_at", "DESC"]],
  });

  const mistakes = [];
  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      const question = attempt.questions[answer.question_index];
      if (!question) continue;
      mistakes.push({
        attempt_id: attempt.attempt_id,
        attempt_type: attempt.attempt_type,
        chapter_id: attempt.chapter_id,
        chapter_name: attempt.chapter?.name || null,
        subject_id: attempt.chapter?.subject?.subject_id || null,
        subject_name: attempt.chapter?.subject?.name || null,
        question: question.question,
        options: question.options,
        selected_answer: answer.selected_answer,
        correct_answer: question.correct_answer,
        explanation: question.explanation,
        submitted_at: attempt.submitted_at,
      });
    }
  }

  return mistakes;
};

// generateTestReview is a live, synchronous Ollama call with no caching —
// every Test History page load regenerated it from scratch, a real LLM
// completion (not a DB query) that's what actually made this page feel
// slow. Cached here keyed by the exact stats that went into it, same
// reasoning/shape as study_plan_service.js's getCachedStudyPlanIntro: those
// stats only change when the student submits a new mock test, so
// re-opening the page with nothing new gets the cached review instantly.
const TEST_REVIEW_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const testReviewCache = new Map(); // key -> { value, expiresAt }

const getCachedTestReview = async (params) => {
  const key = JSON.stringify(params);
  const cached = testReviewCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const aiResponse = await generateTestReview(params);
  const review = aiResponse.review || null;
  testReviewCache.set(key, { value: review, expiresAt: Date.now() + TEST_REVIEW_CACHE_TTL_MS });
  return review;
};

/**
 * Short AI-written review of the student's mock test performance overall
 * — every number it's built from is real (submitted mock_test attempts),
 * the AI is only asked to phrase them. Best-effort: returns review: null
 * if the AI service is unavailable rather than failing Test History.
 */
export const getTestReviewService = async (userId) => {
  const studentScope = await resolveStudentClassId(userId);
  if (!studentScope) {
    throw createEducationError("No student profile found — complete onboarding first", 404, "STUDENT_PROFILE_NOT_FOUND");
  }

  const attempts = await QuizAttempt.findAll({
    where: { student_profile_id: studentScope.studentProfileId, attempt_type: "mock_test", status: "submitted" },
    include: [{ model: EducationChapter, as: "chapter", attributes: ["chapter_id", "name"] }],
    order: [["submitted_at", "DESC"]],
  });

  if (attempts.length === 0) {
    return { review: null, tests_taken: 0 };
  }

  const latestScore = Number(attempts[0].percentage);
  const previousScore = attempts.length > 1 ? Number(attempts[1].percentage) : null;
  const averageScore = Math.round((attempts.reduce((s, a) => s + Number(a.percentage), 0) / attempts.length) * 100) / 100;

  // Real per-concept weakness across every mock-tested chapter — see
  // getWeakestConceptForChapter's own docstring. Falls back to null (not
  // a chapter name) when the student's mock-test history predates concept
  // tagging or hasn't answered enough of any one concept yet;
  // generateTestReview already handles a null weakestConcept gracefully
  // (it just omits that part of the review sentence).
  const weakest = await getWeakestConceptForChapter(studentScope.studentProfileId, { attemptType: "mock_test" });
  const weakestConcept = weakest?.concept || null;

  // The 3 lowest-scoring mock-tested chapters, each enriched with its own
  // real weakest concept (mock-test-scoped, same helper as above but
  // per-chapter) — Test History's "Weak Concepts" card used to just show
  // these chapter names; this gives it the same real sub-topic-level
  // detail the Subject Progress page already got (see
  // progress_service.js's getSubjectProgressService).
  const byChapter = new Map();
  attempts.forEach((a) => {
    const key = a.chapter_id;
    if (!byChapter.has(key)) byChapter.set(key, { chapter_id: key, chapter_name: a.chapter?.name || null, scores: [] });
    byChapter.get(key).scores.push(Number(a.percentage));
  });
  const weakestChapters = [...byChapter.values()]
    .map((c) => ({ ...c, avg: Math.round((c.scores.reduce((s, v) => s + v, 0) / c.scores.length) * 10) / 10 }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);
  const weakChapters = await Promise.all(
    weakestChapters.map(async (c) => ({
      chapter_id: c.chapter_id,
      chapter_name: c.chapter_name,
      avg: c.avg,
      weakest_concept: await getWeakestConceptForChapter(studentScope.studentProfileId, {
        chapterId: c.chapter_id,
        attemptType: "mock_test",
      }),
    }))
  );

  let review = null;
  try {
    review = await getCachedTestReview({
      userId,
      latestScore,
      previousScore,
      averageScore,
      testsTaken: attempts.length,
      weakestConcept,
    });
  } catch {
    review = null;
  }

  return {
    review,
    tests_taken: attempts.length,
    latest_score: latestScore,
    previous_score: previousScore,
    average_score: averageScore,
    weakest_concept: weakestConcept,
    weak_chapters: weakChapters,
  };
};
