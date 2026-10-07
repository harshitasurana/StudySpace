// Plain Date-object arithmetic — no calendar/date library dependency
// (none is currently used in this app, and a month grid + week grid is
// bounded, straightforward date math).

export const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

// Sunday-start week, matching the spec's own MON-first mockup loosely but
// using the simpler/more common Sun-Sat grid convention (JS Date's own
// getDay() week numbering) — a cosmetic choice, not a functional one.
export const startOfWeek = (date) => {
  const d = startOfDay(date);
  return addDays(d, -d.getDay());
};

// The 6-row (42-day) grid a month view renders, including the padding
// days from the adjacent months that fill out the first/last week.
export const monthGridRange = (date) => {
  const gridStart = startOfWeek(startOfMonth(date));
  const gridEnd = addDays(gridStart, 41);
  return { gridStart, gridEnd };
};

export const toISODateTime = (date) => new Date(date).toISOString();

export const formatMonthYear = (date) => date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export const formatDayHeader = (date) => {
  const today = startOfDay(new Date());
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, addDays(today, 1))) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

export const formatTime = (date) => new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export const formatShortDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Never stored — always computed live from the real start_datetime, so
// this can't go stale between page loads.
export const daysRemaining = (startDatetime) => {
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(startDatetime));
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
};

// Local "YYYY-MM-DDTHH:mm" for a <input type="datetime-local"> value —
// deliberately NOT toISOString() (which converts to UTC and would shift
// the displayed clock time in any non-UTC browser).
export const toDatetimeLocalValue = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
