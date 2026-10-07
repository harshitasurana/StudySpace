import React, { useEffect, useState } from 'react';
import EducationService from '../../../services/EducationService';
import { EVENT_TYPE_META } from '../constants';
import { toDatetimeLocalValue } from '../utils/dateUtils';

const defaultTimes = () => {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return { start, end };
};

// Generic form for the 5 non-exam types (STUDY/REVISION/ASSIGNMENT/
// ACADEMIC/REMINDER) — Exam creation goes through ExamForm instead (needs
// exam_type/total_marks/multi-chapter, which a plain event never has).
// initialDatetime (a plain Date) pre-fills the start time when the form is
// opened from a clicked calendar day/slot — e.g. WeekView's click-to-add
// hourly grid — rather than always defaulting to "an hour from now".
// initialValues (editing an existing event) always wins over it.
const EventForm = ({ eventType, subjects, initialValues, initialDatetime, onSubmit, onCancel, submitting, error }) => {
  const { start, end } = defaultTimes();
  const presetStart = initialValues
    ? new Date(initialValues.start_datetime)
    : initialDatetime
    ? new Date(initialDatetime)
    : start;
  const presetEnd = initialValues
    ? new Date(initialValues.end_datetime)
    : initialDatetime
    ? new Date(new Date(initialDatetime).getTime() + 60 * 60 * 1000)
    : end;
  const [title, setTitle] = useState(initialValues?.title || '');
  const [startDatetime, setStartDatetime] = useState(toDatetimeLocalValue(presetStart));
  const [endDatetime, setEndDatetime] = useState(toDatetimeLocalValue(presetEnd));
  const [allDay, setAllDay] = useState(initialValues?.all_day || false);
  const [subjectId, setSubjectId] = useState(initialValues?.subject_id || subjects[0]?.id || '');
  const [chapterId, setChapterId] = useState(initialValues?.chapter_id || '');
  const [chapters, setChapters] = useState([]);
  const [notes, setNotes] = useState(initialValues?.notes || '');

  useEffect(() => {
    if (!subjectId) {
      setChapters([]);
      return;
    }
    let cancelled = false;
    EducationService.getChapters(subjectId)
      .then((res) => {
        if (!cancelled) setChapters(res?.data || []);
      })
      .catch(() => {
        if (!cancelled) setChapters([]);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  const meta = EVENT_TYPE_META[eventType];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      event_type: eventType,
      title: title.trim(),
      start_datetime: new Date(startDatetime).toISOString(),
      end_datetime: new Date(endDatetime).toISOString(),
      all_day: allDay,
      subject_id: subjectId || null,
      chapter_id: chapterId || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Top Title Input — Google Calendar Style */}
      <div className="space-y-1 pb-1 border-b border-border-subtle/60 dark:border-[#2e3f5f]/60">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
          className="w-full bg-transparent text-xl font-headline-sm font-extrabold text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
          placeholder={`e.g. ${meta.label}`}
        />
        <div className="flex items-center gap-2 pt-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${meta.bg} ${meta.text}`}>
            <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Row 1: Schedule & Time */}
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-2 shrink-0">schedule</span>
        <div className="flex-1 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-extrabold uppercase text-on-surface-variant">Starts</label>
              <input
                type="datetime-local"
                value={startDatetime}
                onChange={(e) => setStartDatetime(e.target.value)}
                required
                className="mt-0.5 w-full rounded-xl border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest dark:bg-[#152238] px-3 py-2 text-xs font-semibold text-on-surface"
              />
            </div>
            <div>
              <label className="text-[11px] font-extrabold uppercase text-on-surface-variant">Ends</label>
              <input
                type="datetime-local"
                value={endDatetime}
                onChange={(e) => setEndDatetime(e.target.value)}
                required
                className="mt-0.5 w-full rounded-xl border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest dark:bg-[#152238] px-3 py-2 text-xs font-semibold text-on-surface"
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-extrabold text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="rounded accent-primary"
            />
            All day event
          </label>
        </div>
      </div>

      {/* Row 2: Subject & Chapter */}
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-2 shrink-0">auto_stories</span>
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-extrabold uppercase text-on-surface-variant">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => { setSubjectId(Number(e.target.value)); setChapterId(''); }}
              className="mt-0.5 w-full rounded-xl border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest dark:bg-[#152238] px-3 py-2 text-xs font-semibold text-on-surface"
            >
              <option value="">None</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-extrabold uppercase text-on-surface-variant">Chapter</label>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(Number(e.target.value) || '')}
              disabled={!subjectId || chapters.length === 0}
              className="mt-0.5 w-full rounded-xl border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest dark:bg-[#152238] px-3 py-2 text-xs font-semibold text-on-surface disabled:opacity-50"
            >
              <option value="">None</option>
              {chapters.map((c) => (
                <option key={c.chapter_id} value={c.chapter_id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Row 3: Notes */}
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-2 shrink-0">description</span>
        <div className="flex-1">
          <label className="text-[11px] font-extrabold uppercase text-on-surface-variant">Notes / Details</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add study goals or agenda notes…"
            className="mt-0.5 w-full rounded-xl border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest dark:bg-[#152238] px-3 py-2 text-xs font-semibold text-on-surface resize-none placeholder:text-on-surface-variant/50"
          />
        </div>
      </div>

      {error && <p className="text-error text-xs font-bold">{error}</p>}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle/50">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-extrabold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-extrabold text-xs hover:bg-primary-dark disabled:opacity-50 transition-all cursor-pointer shadow-xs"
        >
          {submitting ? 'Saving…' : `Add ${meta.label}`}
        </button>
      </div>
    </form>
  );
};

export default EventForm;
