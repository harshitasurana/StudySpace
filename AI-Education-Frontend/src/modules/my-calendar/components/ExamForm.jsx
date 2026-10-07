import React, { useEffect, useState } from 'react';
import EducationService from '../../../services/EducationService';
import { EVENT_TYPE_META, EXAM_TYPES, EXAM_TYPE_LABELS } from '../constants';
import { toDatetimeLocalValue } from '../utils/dateUtils';

const defaultTimes = () => {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(12, 0, 0, 0);
  return { start, end };
};

const ExamForm = ({ subjects, initialValues, onSubmit, onCancel, submitting, error }) => {
  const { start, end } = defaultTimes();
  const [title, setTitle] = useState(initialValues?.title || '');
  const [startDatetime, setStartDatetime] = useState(initialValues ? toDatetimeLocalValue(initialValues.start_datetime) : toDatetimeLocalValue(start));
  const [endDatetime, setEndDatetime] = useState(initialValues ? toDatetimeLocalValue(initialValues.end_datetime) : toDatetimeLocalValue(end));
  const [subjectId, setSubjectId] = useState(initialValues?.subject_id || subjects[0]?.id || '');
  const [chapters, setChapters] = useState([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState(
    new Set((initialValues?.examDetail?.chapters || []).map((c) => c.chapter_id))
  );
  const [examType, setExamType] = useState(initialValues?.examDetail?.exam_type || 'UNIT_TEST');
  const [totalMarks, setTotalMarks] = useState(initialValues?.examDetail?.total_marks ?? '');
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

  const meta = EVENT_TYPE_META.EXAM;

  const toggleChapter = (chapterId) => {
    setSelectedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedChapterIds.size === 0) return;
    onSubmit({
      title: title.trim(),
      start_datetime: new Date(startDatetime).toISOString(),
      end_datetime: new Date(endDatetime).toISOString(),
      all_day: false,
      subject_id: subjectId,
      exam_type: examType,
      total_marks: totalMarks === '' ? null : Number(totalMarks),
      chapter_ids: [...selectedChapterIds],
      notes: notes.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Top Title Input — Google Calendar Style */}
      <div className="space-y-1 pb-1 border-b border-border-subtle/60 dark:border-[#2e3f5f]/60">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
          placeholder="e.g. Mid-Term Examination"
          className="w-full bg-transparent text-xl font-headline-sm font-extrabold text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
        />
        <div className="flex items-center gap-2 pt-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${meta.bg} ${meta.text}`}>
            <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
            Exam
          </span>
        </div>
      </div>

      {/* Row 1: Subject */}
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-2 shrink-0">school</span>
        <div className="flex-1">
          <label className="text-[11px] font-extrabold uppercase text-on-surface-variant">Subject</label>
          <select
            value={subjectId}
            onChange={(e) => { setSubjectId(Number(e.target.value)); setSelectedChapterIds(new Set()); }}
            required
            className="mt-0.5 w-full rounded-xl border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest dark:bg-[#152238] px-3 py-2 text-xs font-semibold text-on-surface"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Schedule & Time */}
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-2 shrink-0">schedule</span>
        <div className="flex-1 grid grid-cols-2 gap-2">
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
      </div>

      {/* Row 3: Chapters included */}
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-2 shrink-0">auto_stories</span>
        <div className="flex-1 space-y-1">
          <label className="text-[11px] font-extrabold uppercase text-on-surface-variant">Chapters included</label>
          <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-border-subtle dark:border-[#2e3f5f] p-2.5 bg-surface-container-lowest dark:bg-[#152238]">
            {chapters.length === 0 && <p className="text-xs font-semibold text-on-surface-variant px-1 py-1">Select a subject first.</p>}
            {chapters.map((c) => (
              <label key={c.chapter_id} className="flex items-center gap-2 text-xs font-semibold text-on-surface px-2 py-1 rounded-lg hover:bg-surface-container-low dark:hover:bg-[#1e2d4a] cursor-pointer">
                <input type="checkbox" checked={selectedChapterIds.has(c.chapter_id)} onChange={() => toggleChapter(c.chapter_id)} className="rounded accent-primary" />
                {c.chapter_order ? `Chapter ${c.chapter_order}: ${c.name}` : c.name}
              </label>
            ))}
          </div>
          {selectedChapterIds.size === 0 && chapters.length > 0 && (
            <p className="text-xs font-extrabold text-warning">Select at least one chapter.</p>
          )}
        </div>
      </div>

      {/* Row 4: Exam Type & Marks */}
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-2 shrink-0">grade</span>
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-extrabold uppercase text-on-surface-variant">Exam type</label>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              className="mt-0.5 w-full rounded-xl border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest dark:bg-[#152238] px-3 py-2 text-xs font-semibold text-on-surface"
            >
              {EXAM_TYPES.map((t) => (
                <option key={t} value={t}>{EXAM_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-extrabold uppercase text-on-surface-variant">Total marks</label>
            <input
              type="number"
              min="0"
              value={totalMarks}
              onChange={(e) => setTotalMarks(e.target.value)}
              placeholder="e.g. 80"
              className="mt-0.5 w-full rounded-xl border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest dark:bg-[#152238] px-3 py-2 text-xs font-semibold text-on-surface"
            />
          </div>
        </div>
      </div>

      {/* Row 5: Notes */}
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-2 shrink-0">description</span>
        <div className="flex-1">
          <label className="text-[11px] font-extrabold uppercase text-on-surface-variant">Notes / Syllabus</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add exam instructions or syllabus topics…"
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
          disabled={submitting || !title.trim() || selectedChapterIds.size === 0}
          className="px-6 py-2.5 rounded-xl bg-error text-white font-extrabold text-xs hover:bg-red-700 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
        >
          {submitting ? 'Saving…' : 'Add Exam'}
        </button>
      </div>
    </form>
  );
};

export default ExamForm;
