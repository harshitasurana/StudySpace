// Shared IST-correct date math — originally built for streak calculations
// (progress overview, the daily "don't lose your streak" reminder job, the
// streak-milestone notification — previously each had its own copy of this
// exact date-bucketing logic), now also used for exam/event countdowns
// (my-calendar's daysRemaining, the exam reminder job) since they share
// the exact same real bug: bucketing/comparing timestamps by raw UTC calendar date
// (`new Date(value).toISOString().slice(0, 10)`) instead of the
// student's actual local date. The Node process runs in UTC (no TZ env
// var set), so a late-night session could land on a different UTC date
// than the very next session, creating a false one-day gap that
// snapped a real multi-day streak down to 1.
//
// This deployment is India-only today (see regional_settings_schema.js's
// own default "UTC" — never actually overridden per-student; there's no
// real per-user timezone data to read yet), so IST (UTC+5:30, no
// daylight saving) is assumed for everyone rather than left unhandled.
// If students outside India are ever supported, this is the one place
// that needs to grow real per-student timezone awareness.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// The IST calendar-date string (YYYY-MM-DD) for a given timestamp —
// shifts to IST wall-clock time first, then reads its date components
// via toISOString (which is safe here precisely because the shift
// already happened; toISOString itself always reports UTC). IST has no
// daylight-saving transitions, so a fixed +5:30 offset is exact
// year-round, unlike most other timezones.
export const toISTDateString = (value) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp + IST_OFFSET_MS).toISOString().slice(0, 10);
};

// Consecutive-day streak, walked backward from "today" (IST) through a
// set of IST-bucketed activity date strings — stops at the first
// missing day. Stepping the cursor by exactly 24 real-world hours is
// safe here (rather than a calendar-aware "subtract one day") because
// IST's fixed offset means 24 hours always crosses exactly one IST
// calendar boundary, with no DST edge case to account for.
export const computeStreakDays = (activityDateStrings) => {
  const activityDates = activityDateStrings instanceof Set ? activityDateStrings : new Set(activityDateStrings);
  let streakDays = 0;
  let cursorMs = Date.now();
  const todayStr = toISTDateString(cursorMs);
  if (!activityDates.has(todayStr)) cursorMs -= ONE_DAY_MS;
  while (activityDates.has(toISTDateString(cursorMs))) {
    streakDays += 1;
    cursorMs -= ONE_DAY_MS;
  }
  return streakDays;
};

// Whole IST calendar days between "today" and a target timestamp (an exam
// date, say) — negative once the target date is in the past. Computed by
// diffing the two IST date strings' own UTC-midnight representations
// (both go through toISTDateString's same shift-then-truncate logic), not
// by dividing a raw millisecond difference, which would be thrown off by
// whatever time-of-day each timestamp happens to carry.
export const daysRemaining = (targetDatetime) => {
  const todayIST = new Date(`${toISTDateString(Date.now())}T00:00:00.000Z`);
  const targetIST = new Date(`${toISTDateString(targetDatetime)}T00:00:00.000Z`);
  return Math.round((targetIST.getTime() - todayIST.getTime()) / ONE_DAY_MS);
};
