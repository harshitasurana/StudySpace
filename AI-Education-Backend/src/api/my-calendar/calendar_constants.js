// Shared enums + the event-type color map — real hex values from this
// app's own existing Tailwind palette (already confirmed this session), no
// new colors introduced. The frontend uses these same values as its
// default per-type color when a student hasn't overridden `color`.
export const EVENT_TYPES = ["EXAM", "ASSIGNMENT", "STUDY", "REVISION", "ACADEMIC", "REMINDER", "HOLIDAY"];
export const EXAM_TYPES = ["UNIT_TEST", "MID_TERM", "FINAL", "MOCK_TEST", "OTHER"];
export const EVENT_STATUSES = ["scheduled", "completed", "cancelled"];

export const EVENT_TYPE_COLORS = {
  EXAM: "#D95D5D",
  ASSIGNMENT: "#E89B3C",
  STUDY: "#3B82C4",
  REVISION: "#16866A",
  ACADEMIC: "#283593",
  REMINDER: "#F4B942",
  HOLIDAY: "#7C3AED",
};
