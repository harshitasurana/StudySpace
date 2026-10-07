// Real hex values from this app's existing Tailwind palette (already
// confirmed this session) — no new colors. Token names (error/warning/
// info/success/primary/accent) are the same real colors MindMap.jsx's own
// risk-red/focus-orange aliases point at.
export const EVENT_TYPE_META = {
  EXAM: { label: 'Exam', icon: 'quiz', text: 'text-error', bg: 'bg-error/10', dot: 'bg-error', solid: 'bg-error' },
  ASSIGNMENT: { label: 'Assignment', icon: 'assignment', text: 'text-warning', bg: 'bg-warning/10', dot: 'bg-warning', solid: 'bg-warning' },
  STUDY: { label: 'Study Session', icon: 'menu_book', text: 'text-info', bg: 'bg-info/10', dot: 'bg-info', solid: 'bg-info' },
  REVISION: { label: 'Revision', icon: 'refresh', text: 'text-success', bg: 'bg-success/10', dot: 'bg-success', solid: 'bg-success' },
  ACADEMIC: { label: 'Academic Event', icon: 'school', text: 'text-primary', bg: 'bg-primary/10', dot: 'bg-primary', solid: 'bg-primary' },
  REMINDER: { label: 'Reminder', icon: 'notifications', text: 'text-accent', bg: 'bg-accent/20', dot: 'bg-accent', solid: 'bg-accent' },
  HOLIDAY: { label: 'Holiday', icon: 'celebration', text: 'text-secondary', bg: 'bg-secondary/10', dot: 'bg-secondary', solid: 'bg-secondary' },
};

export const EVENT_TYPES = Object.keys(EVENT_TYPE_META);
export const NON_EXAM_EVENT_TYPES = EVENT_TYPES.filter((t) => t !== 'EXAM');
// HOLIDAY events are seeded globally, not student-created — excluded from
// "add new event" pickers, only ever shown read-only on the calendar.
export const CREATABLE_EVENT_TYPES = EVENT_TYPES.filter((t) => t !== 'HOLIDAY');

export const EXAM_TYPE_LABELS = {
  UNIT_TEST: 'Unit Test',
  MID_TERM: 'Mid-Term',
  FINAL: 'Final',
  MOCK_TEST: 'Mock Test',
  OTHER: 'Other',
};
export const EXAM_TYPES = Object.keys(EXAM_TYPE_LABELS);
