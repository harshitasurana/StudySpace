import cron from "node-cron";
import { Op } from "sequelize";
import { EducationStudentProfile } from "../../api/student-profile/student_profile_schema.js";
import { Notification, UserNotification } from "../../api/profile/notification_schema.js";
import { createNotification } from "../../api/profile/notification_service.js";
import { getNotificationPreferences } from "../../api/profile/notification_preference_service.js";
import { getRecommendedChapterForStudent } from "../../api/progress/progress_service.js";
import { logInfo, logError } from "../utils/logger.js";

// Same single toggle streak_reminder_job.js and quiz_service.js's
// notifyAttemptCompleted respect (Settings > Notifications > "Learning
// Activity Notifications"). Default-on; only an explicit false opts out.
const isTaskUpdatesEnabled = async (userId) => {
  const prefs = await getNotificationPreferences(userId);
  return prefs.system_task_updates !== false;
};

const alreadySentToday = async (userId, type) => {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const existing = await UserNotification.findOne({
    where: { user_id: userId },
    include: [
      {
        model: Notification,
        as: "notification",
        where: { type, createdAt: { [Op.gte]: startOfDay } },
        required: true,
      },
    ],
  });
  return Boolean(existing);
};

/**
 * The counterpart to streak_reminder_job.js's sendStreakReminders — that
 * one only ever fires for a self-mode student who has an active streak
 * genuinely at risk of resetting (studied yesterday, hasn't yet today).
 * Every other self-mode student — brand new, mid-onboarding-momentum-lost,
 * or just someone whose last real session wasn't yesterday specifically —
 * gets silently skipped by that job, with nothing telling them what to do
 * next. This sends that student a real, specific "here's what to study"
 * nudge instead — the exact same recommendation the Dashboard's Continue
 * Learning card already shows (progress_service.js's pickRecommendation),
 * never a generic "come back and study" with no real chapter behind it.
 *
 * Skips anyone who already got a STREAK_REMINDER today (see
 * streak_reminder_job.js — that message already folds the same
 * recommendation in, so a second notification would just be redundant)
 * and anyone who has genuinely already studied today (nothing to nudge).
 */
export const sendStudyReminders = async () => {
  const profiles = await EducationStudentProfile.findAll({
    where: { learning_mode: "self" },
    attributes: ["student_profile_id", "user_id"],
  });

  let sent = 0;
  for (const profile of profiles) {
    try {
      if (!(await isTaskUpdatesEnabled(profile.user_id))) continue;
      if (await alreadySentToday(profile.user_id, "STREAK_REMINDER")) continue;
      if (await alreadySentToday(profile.user_id, "STUDY_REMINDER")) continue;

      const recommendation = await getRecommendedChapterForStudent(profile.user_id);
      if (!recommendation) continue; // no profile yet, or genuinely everything already mastered

      await createNotification(
        {
          type: "STUDY_REMINDER",
          title: "Ready to study?",
          message: `${recommendation.reason_text} Start "${recommendation.chapter_name}" (${recommendation.subject_name}).`,
          channel: "IN_APP",
        },
        profile.user_id
      );
      sent += 1;
    } catch (err) {
      logError("Failed to evaluate/send study reminder for student.", err, {
        service: "study-reminder-job",
        studentProfileId: profile.student_profile_id,
      });
    }
  }

  logInfo(`Study reminder job complete: ${sent} reminder(s) sent.`, { service: "study-reminder-job" });
  return { sent };
};

/**
 * Runs once daily at 09:00 IST (03:30 UTC) — morning, deliberately well
 * before streak_reminder_job's 19:00 IST evening check, so a student who
 * hasn't studied yet gets a "here's what to do today" nudge early, not
 * competing same-instant with the streak job's own run. The server runs
 * in UTC (no TZ env var set), same posture as streak_reminder_job.js's
 * own IST-offset comment.
 */
export const startStudyReminderJob = () => {
  cron.schedule("30 3 * * *", () => {
    sendStudyReminders().catch((err) =>
      logError("Study reminder job failed.", err, { service: "study-reminder-job" })
    );
  });
  logInfo("Study reminder job scheduled (daily at 09:00 IST / 03:30 UTC).", { service: "study-reminder-job" });
};
