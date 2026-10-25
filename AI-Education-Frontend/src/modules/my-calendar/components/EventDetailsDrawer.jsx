import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EVENT_TYPE_META, EXAM_TYPE_LABELS } from '../constants';
import { formatDayHeader, formatTime, daysRemaining } from '../utils/dateUtils';
import EventForm from './EventForm';
import ExamForm from './ExamForm';

const EventDetailsDrawer = ({ event, subjects, onClose, onUpdate, onDelete, updating, deleting, updateError }) => {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!event) return null;
  const meta = EVENT_TYPE_META[event.event_type] || EVENT_TYPE_META.ACADEMIC;
  const isExam = event.event_type === 'EXAM';
  const isHoliday = event.event_type === 'HOLIDAY';
  const remaining = isExam ? daysRemaining(event.start_datetime) : null;

  const handleFormSubmit = async (payload) => {
    const ok = await onUpdate(event.calendar_event_id, payload);
    if (ok) setEditing(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-label="Event details" className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] bg-white dark:bg-[#152238] shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border-subtle sticky top-0 bg-white dark:bg-[#152238]">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-md font-bold ${meta.bg} ${meta.text}`}>
            <span className="material-symbols-outlined text-[16px]">{meta.icon}</span>
            {meta.label}
          </span>
          <button type="button" onClick={onClose} className="p-1.5 text-on-surface-variant hover:text-error rounded-lg cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-5">
          {editing ? (
            isExam ? (
              <ExamForm
                subjects={subjects}
                initialValues={event}
                onSubmit={handleFormSubmit}
                onCancel={() => setEditing(false)}
                submitting={updating}
                error={updateError}
              />
            ) : (
              <EventForm
                eventType={event.event_type}
                subjects={subjects}
                initialValues={event}
                onSubmit={handleFormSubmit}
                onCancel={() => setEditing(false)}
                submitting={updating}
                error={updateError}
              />
            )
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="font-headline-md text-headline-md font-bold text-on-surface">{event.title}</h2>
                <p className="text-body-md text-on-surface-variant mt-1">
                  {formatDayHeader(new Date(event.start_datetime))} · {event.all_day ? 'All day' : `${formatTime(event.start_datetime)} – ${formatTime(event.end_datetime)}`}
                </p>
                {event.subject?.name && <p className="text-label-md text-on-surface-variant">{event.subject.name}</p>}
              </div>

              {isExam && (
                <div className={`rounded-xl p-4 ${meta.bg} text-center`}>
                  <p className={`text-headline-lg font-black ${meta.text}`}>{remaining >= 0 ? remaining : 0}</p>
                  <p className={`text-label-md font-bold uppercase tracking-wide ${meta.text}`}>
                    {remaining < 0 ? 'days ago' : remaining === 0 ? 'today' : remaining === 1 ? 'day remaining' : 'days remaining'}
                  </p>
                </div>
              )}

              {isExam && event.examDetail?.chapters?.length > 0 && (
                <div>
                  <p className="text-label-md font-bold uppercase tracking-wide text-on-surface-variant mb-1.5">Chapters</p>
                  <ul className="space-y-1">
                    {event.examDetail.chapters.map((c) => (
                      <li key={c.chapter_id} className="text-body-md text-on-surface flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-current text-on-surface-variant" />
                        {c.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {isExam && (
                <div className="flex items-center gap-4 text-body-md text-on-surface-variant">
                  {event.examDetail?.exam_type && <span>{EXAM_TYPE_LABELS[event.examDetail.exam_type] || event.examDetail.exam_type}</span>}
                  {event.examDetail?.total_marks != null && <span>{event.examDetail.total_marks} marks</span>}
                </div>
              )}

              {!isExam && event.chapter?.name && (
                <p className="text-body-md text-on-surface-variant">{event.chapter.name}</p>
              )}

              {event.notes && (
                <div>
                  <p className="text-label-md font-bold uppercase tracking-wide text-on-surface-variant mb-1">Notes</p>
                  <p className="text-body-md text-on-surface whitespace-pre-wrap">{event.notes}</p>
                </div>
              )}

              {isExam && (
                <div className="border-t border-border-subtle pt-4 space-y-2">
                  <p className="text-label-md font-bold uppercase tracking-wide text-on-surface-variant">Preparation</p>
                  <p className="text-body-md text-on-surface-variant">Not started</p>
                  <button
                    type="button"
                    onClick={() => navigate('/ai-tutor/study-plan')}
                    className="w-full flex items-center justify-center gap-1.5 bg-primary text-on-primary py-2.5 rounded-lg font-bold text-body-md hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    Prepare with AI
                  </button>
                </div>
              )}

              {isHoliday ? (
                <p className="border-t border-border-subtle pt-4 text-label-md text-on-surface-variant">
                  A shared academic holiday, visible on every student's calendar.
                </p>
              ) : (
                <div className="border-t border-border-subtle pt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="flex-1 px-4 py-2 rounded-lg border border-border-subtle text-body-md font-semibold text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  {confirmingDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(event.calendar_event_id)}
                      disabled={deleting}
                      className="flex-1 px-4 py-2 rounded-lg bg-error text-white text-body-md font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                    >
                      {deleting ? 'Deleting…' : 'Confirm Delete'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className="flex-1 px-4 py-2 rounded-lg border border-error text-error text-body-md font-semibold hover:bg-error hover:text-white transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default EventDetailsDrawer;
