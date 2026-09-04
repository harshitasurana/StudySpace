import cron from "node-cron";
import { Op } from "sequelize";
import { EducationCalendarEvent } from "../../api/my-calendar/calendar_schema.js";
import { EducationStudentProfile } from "../../api/student-profile/student_profile_schema.js";
import { Notification, UserNotification } from "../../api/profile/notification_schema.js";
import { createNotification } from "../../api/profile/notification_service.js";
import { getNotificationPreferences } from "../../api/profile/notification_preference_service.js";
import { logInfo, logError } from "../utils/logger.js";
import { toISTDateString, daysRemaining } from "../utils/streak_dates.js";

// Same single toggle streak_reminder_job.js's sendStreakReminders respects
// (Settings > Notifications > "Learning Activity Notifications").
const isTaskUpdatesEnabled = async (userId) => {
  const prefs = await getNotificationPreferences(userId);
  return prefs.system_task_updates !== false;
};

// A reminder fires when an exam is exactly this many IST calendar days
// away — a week out, 3 days out, the day before, and the morning of —
// rather than "any exam within 7 days", so a student gets a handful of
// distinct nudges instead of the same one every day for a week.
const REMINDER_OFFSET_DAYS = [7, 3, 1, 0];

const reminderMessage = (examTitle, daysLeft) => {
  if (daysLeft === 0) return `${examTitle} is today. Good luck!`;
  if (daysLeft === 1) return `${examTitle} is tomorrow — make sure you're ready.`;
  return `${examTitle} is in ${daysLeft} days. Time to start (or continue) revising.`;
};

/**
 * Nudges a student ahead of each upcoming exam on their Academic
 * Calendar, at 7/3/1/0 days out. Uses the same IST-correct day math
 * (streak_dates.js's daysRemaining) as the calendar UI's own countdown,
 * so "3 days left" here always matches what the student sees on the
 * exam's details drawer.
 */
export const sendExamReminders = async () => {
  const todayIST = toISTDateString(Date.now());

  const exams = await EducationCalendarEvent.findAll({
    where: { event_type: "EXAM", status: "scheduled", start_datetime: { [Op.gte]: new Date() } },
    include: [{ model: EducationStudentProfile, as: "studentProfile", attributes: ["student_profile_id", "user_id"] }],
  });

  let sent = 0;
  for (const exam of exams) {
    try {
      const daysLeft = daysRemaining(exam.start_datetime);
      if (!REMINDER_OFFSET_DAYS.includes(daysLeft)) continue;

      const userId = exam.studentProfile?.user_id;
      if (!userId) continue;
      if (!(await isTaskUpdatesEnabled(userId))) continue;

      // Scoped to this exact exam's title (not just "any EXAM_REMINDER
      // today") — a student can have more than one exam due for a
      // reminder on the same day, and each one needs its own notification.
      const title = `Upcoming Exam: ${exam.title}`;

      const alreadyReminded = await UserNotification.findOne({
        where: { user_id: userId },
        include: [
          {
            model: Notification,
            as: "notification",
            where: { type: "EXAM_REMINDER", title, createdAt: { [Op.gte]: new Date(`${todayIST}T00:00:00.000Z`) } },
            required: true,
          },
        ],
      });
      if (alreadyReminded) continue;

      await createNotification(
        {
          type: "EXAM_REMINDER",
          title,
          message: reminderMessage(exam.title, daysLeft),
          channel: "IN_APP",
        },
        userId
      );
      sent += 1;
    } catch (err) {
      logError("Failed to evaluate/send exam reminder.", err, {
        service: "exam-reminder-job",
        calendarEventId: exam.calendar_event_id,
      });
    }
  }

  logInfo(`Exam reminder job complete: ${sent} reminder(s) sent.`, { service: "exam-reminder-job" });
  return { sent };
};

/**
 * Runs once daily at 19:00 IST (13:30 UTC) — same schedule and same
 * reasoning as startStreakReminderJob (see streak_reminder_job.js):
 * evening, so a same-day "0 days left" reminder isn't wasted hours
 * before the student even wakes up, and the server itself runs in UTC
 * with no TZ env var set.
 */
export const startExamReminderJob = () => {
  cron.schedule("30 13 * * *", () => {
    sendExamReminders().catch((err) =>
      logError("Exam reminder job failed.", err, { service: "exam-reminder-job" })
    );
  });
  logInfo("Exam reminder job scheduled (daily at 19:00 IST / 13:30 UTC).", { service: "exam-reminder-job" });
};
