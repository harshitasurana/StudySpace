import cron from "node-cron";
import { Op } from "sequelize";
import { EducationStudentProfile } from "../../api/student-profile/student_profile_schema.js";
import { QuizAttempt } from "../../api/quiz/quiz_schema.js";
import { Notification, UserNotification } from "../../api/profile/notification_schema.js";
import { createNotification } from "../../api/profile/notification_service.js";
import { getNotificationPreferences } from "../../api/profile/notification_preference_service.js";
import { getRecommendedChapterForStudent } from "../../api/progress/progress_service.js";
import { logInfo, logError } from "../utils/logger.js";
import { toISTDateString, computeStreakDays } from "../utils/streak_dates.js";

// Same single toggle quiz_service.js's notifyAttemptCompleted respects
// (Settings > Notifications > "Learning Activity Notifications") — backed
// by the dedicated user_notification_preferences table via
// notification_preference_service.js, the same service GET/PUT
// /api/profile/notifications/preferences actually reads and writes.
// Default-on; only an explicit false opts a student out.
const isTaskUpdatesEnabled = async (userId) => {
  const prefs = await getNotificationPreferences(userId);
  return prefs.system_task_updates !== false;
};

// IST calendar dates (see streak_dates.js) — was raw UTC before, the
// same bug that made getProgressOverviewService's streak count wrong.
const todayStr = () => toISTDateString(Date.now());
const daysAgoStr = (n) => toISTDateString(Date.now() - n * 24 * 60 * 60 * 1000);

/**
 * Nudges a Self Student who has an active streak (submitted a quiz/mock
 * test yesterday) but hasn't submitted anything yet today — the exact
 * window where a streak is genuinely at risk of resetting. Students who
 * already did something today, or who have no active streak to protect,
 * are silently skipped — never a fabricated "you're about to lose a
 * streak" for someone with nothing to lose. School-mode students aren't
 * evaluated: the streak chip/gamification only exists for self-mode
 * (see Topbar.jsx), so there's nothing for them to be reminded about.
 */
export const sendStreakReminders = async () => {
  const today = todayStr();
  const yesterday = daysAgoStr(1);

  const profiles = await EducationStudentProfile.findAll({
    where: { learning_mode: "self" },
    attributes: ["student_profile_id", "user_id"],
  });

  let sent = 0;
  for (const profile of profiles) {
    try {
      if (!(await isTaskUpdatesEnabled(profile.user_id))) continue;

      const attempts = await QuizAttempt.findAll({
        where: { student_profile_id: profile.student_profile_id, status: "submitted" },
        attributes: ["submitted_at"],
        raw: true,
      });
      if (attempts.length === 0) continue;

      const dateStrs = new Set(attempts.map((a) => toISTDateString(a.submitted_at)));
      if (dateStrs.has(today)) continue; // already active today — streak isn't at risk
      if (!dateStrs.has(yesterday)) continue; // no active streak to protect

      // Defensive de-dupe — this job is only scheduled to run once a day,
      // but stays safe if it's ever re-triggered (e.g. manual testing).
      const alreadyReminded = await UserNotification.findOne({
        where: { user_id: profile.user_id },
        include: [
          {
            model: Notification,
            as: "notification",
            where: { type: "STREAK_REMINDER", createdAt: { [Op.gte]: new Date(`${today}T00:00:00.000Z`) } },
            required: true,
          },
        ],
      });
      if (alreadyReminded) continue;

      // Real streak length — computeStreakDays anchors at "today" and
      // falls back to "yesterday" when today has no activity, which is
      // always true here (the `dateStrs.has(today)` check above already
      // continued past any student active today), so this naturally
      // walks back from yesterday. Same shared helper
      // progress_service.js's getProgressOverviewService uses.
      const streakDays = computeStreakDays(dateStrs);

      // Real, specific next step — same pick the Dashboard's Continue
      // Learning card already shows (see progress_service.js's
      // pickRecommendation) — folded in here rather than as a second,
      // same-day notification so a streak-at-risk student gets one
      // actionable nudge, not two competing ones (see
      // study_reminder_job.js for students who AREN'T on an at-risk
      // streak). Every chapter already mastered is a real, if rare, case
      // — falls back to the generic message rather than naming a chapter
      // that isn't actually the "next" one.
      const recommendation = await getRecommendedChapterForStudent(profile.user_id);
      const message = recommendation
        ? `You're on a ${streakDays}-day learning streak. Complete a quiz or mock test today before it resets — "${recommendation.chapter_name}" (${recommendation.subject_name}) is a good place to pick up.`
        : `You're on a ${streakDays}-day learning streak. Complete a quiz or mock test today before it resets.`;

      await createNotification(
        {
          type: "STREAK_REMINDER",
          title: "Don't Lose Your Streak!",
          message,
          channel: "IN_APP",
        },
        profile.user_id
      );
      sent += 1;
    } catch (err) {
      logError("Failed to evaluate/send streak reminder for student.", err, {
        service: "streak-reminder-job",
        studentProfileId: profile.student_profile_id,
      });
    }
  }

  logInfo(`Streak reminder job complete: ${sent} reminder(s) sent.`, { service: "streak-reminder-job" });
  return { sent };
};

/**
 * Runs once daily at 19:00 IST (13:30 UTC) — evening, so "streak is at
 * risk" genuinely means something (a morning check would flag almost
 * every active streak, most of which will still be completed later
 * that day). The server itself runs in UTC (no TZ env var set) — this
 * was previously "0 19 * * *", which is 19:00 UTC = 00:30 IST the NEXT
 * day, firing well after midnight instead of in the evening. This
 * deployment is India-only today (see streak_dates.js), so a fixed IST
 * offset is applied directly to the cron expression rather than adding
 * real per-student timezone support.
 */
export const startStreakReminderJob = () => {
  cron.schedule("30 13 * * *", () => {
    sendStreakReminders().catch((err) =>
      logError("Streak reminder job failed.", err, { service: "streak-reminder-job" })
    );
  });
  logInfo("Streak reminder job scheduled (daily at 19:00 IST / 13:30 UTC).", { service: "streak-reminder-job" });
};
