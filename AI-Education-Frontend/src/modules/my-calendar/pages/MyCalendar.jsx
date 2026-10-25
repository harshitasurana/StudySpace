import React, { useEffect, useState, useCallback } from 'react';
import EducationService from '../../../services/EducationService';
import CalendarHeader from '../components/CalendarHeader';
import MonthView from '../components/MonthView';
import WeekView from '../components/WeekView';
import AgendaView from '../components/AgendaView';
import AddEventMenu from '../components/AddEventMenu';
import EventForm from '../components/EventForm';
import ExamForm from '../components/ExamForm';
import EventDetailsDrawer from '../components/EventDetailsDrawer';
import UpcomingSidebar from '../components/UpcomingSidebar';
import { monthGridRange, startOfWeek, startOfDay, addDays, toISODateTime } from '../utils/dateUtils';

const MyCalendar = () => {
  const [subjects, setSubjects] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  const [viewMode, setViewMode] = useState('month');
  const [currentDate, setCurrentDate] = useState(startOfDay(new Date()));

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState('');

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [formType, setFormType] = useState(null); // event type string, or null when no form is open
  const [initialDatetime, setInitialDatetime] = useState(null); // pre-fills EventForm's start time when opened from a clicked day/slot
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Bumped after any create/update/delete so UpcomingSidebar re-fetches
  // its own independent data instead of going stale.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    EducationService.getMyProfile()
      .then((res) => {
        if (cancelled) return;
        setSubjects((res?.data?.subjects || []).map((s) => ({ id: s.subject_id, label: s.name })));
      })
      .catch(() => {
        if (!cancelled) setMetaError("Couldn't load your subjects. Please refresh and try again.");
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => { cancelled = true; };
  }, []);

  const visibleRange = useCallback(() => {
    if (viewMode === 'month') {
      const { gridStart, gridEnd } = monthGridRange(currentDate);
      return { start: gridStart, end: addDays(gridEnd, 1) };
    }
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate);
      return { start: weekStart, end: addDays(weekStart, 7) };
    }
    // agenda — a rolling 14-day window from the current anchor date.
    return { start: startOfDay(currentDate), end: addDays(currentDate, 14) };
  }, [viewMode, currentDate]);

  const fetchEvents = useCallback(() => {
    const { start, end } = visibleRange();
    setLoadingEvents(true);
    setEventsError('');
    EducationService.getCalendarEvents(toISODateTime(start), toISODateTime(end))
      .then((res) => setEvents(res?.data || []))
      .catch(() => setEventsError("Couldn't load your calendar. Please try again."))
      .finally(() => setLoadingEvents(false));
  }, [visibleRange]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const shiftDate = (direction) => {
    if (viewMode === 'month') {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + direction, 1));
    } else if (viewMode === 'week') {
      setCurrentDate((d) => addDays(d, 7 * direction));
    } else {
      setCurrentDate((d) => addDays(d, 14 * direction));
    }
  };

  const handleSelectType = (type, presetDate) => {
    setAddMenuOpen(false);
    setCreateError('');
    setInitialDatetime(presetDate || null);
    setFormType(type);
  };

  const closeForm = () => {
    setFormType(null);
    setInitialDatetime(null);
  };

  const handleCreateSubmit = async (payload) => {
    setCreating(true);
    setCreateError('');
    try {
      if (formType === 'EXAM') await EducationService.createExamEvent(payload);
      else await EducationService.createCalendarEvent(payload);
      closeForm();
      fetchEvents();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to save this event. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (eventId, payload) => {
    setUpdating(true);
    setUpdateError('');
    try {
      const res = await EducationService.updateCalendarEvent(eventId, payload);
      setSelectedEvent(res?.data || null);
      fetchEvents();
      setRefreshKey((k) => k + 1);
      return true;
    } catch (err) {
      setUpdateError(err.response?.data?.message || 'Failed to update this event. Please try again.');
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (eventId) => {
    setDeleting(true);
    try {
      await EducationService.deleteCalendarEvent(eventId);
      setSelectedEvent(null);
      fetchEvents();
      setRefreshKey((k) => k + 1);
    } catch {
      // Non-fatal — the drawer stays open so the student can retry.
    } finally {
      setDeleting(false);
    }
  };

  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Whether to show the seeded Indian-holiday layer — a display-only
  // preference (holidays are global backend rows, not per-student data),
  // so it lives in localStorage rather than round-tripping to the server.
  const [showHolidays, setShowHolidays] = useState(() => {
    try {
      return localStorage.getItem('myCalendar.showHolidays') !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('myCalendar.showHolidays', String(showHolidays));
    } catch {
      // Non-fatal — the toggle just won't persist across sessions.
    }
  }, [showHolidays]);

  const { start: rangeStart } = visibleRange();

  const filteredEvents = (selectedCategory === 'ALL'
    ? events
    : events.filter((e) => e.event_type === selectedCategory)
  ).filter((e) => showHolidays || e.event_type !== 'HOLIDAY');

  return (
    <main className="w-full min-h-screen bg-[#F7F3EA] dark:bg-[#0b1324] py-6 sm:py-8 px-2 sm:px-3 transition-colors">
      <div className="w-full space-y-6">
        {/* Top Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#064e3b] text-white flex items-center justify-center text-2xl shadow-md shadow-emerald-950/20 shrink-0">
              <span className="material-symbols-outlined text-[26px]">calendar_month</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                Study Planner
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Plan your learning, stay on track, and see what's coming next.
              </p>
            </div>
          </div>

          {/* AI Planning & Event Creation Actions */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => navigate('/ai-tutor/chat?topic=StudyPlan')}
              className="px-4 py-2.5 rounded-2xl bg-[#e6f4ea] text-[#064e3b] dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 font-bold text-xs sm:text-sm flex items-center gap-2 hover:bg-emerald-200/50 transition-all cursor-pointer shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>Ask StudySpace to Plan</span>
            </button>

            <button
              type="button"
              onClick={() => setAddMenuOpen(true)}
              className="px-5 py-2.5 rounded-2xl bg-[#064e3b] text-white font-bold text-xs sm:text-sm flex items-center gap-2 hover:bg-[#04392b] transition-all cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Create My Study Plan</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {[
              { id: 'ALL', label: 'All Events', icon: 'grid_view' },
              { id: 'EXAM', label: 'Exams', icon: 'timer' },
              { id: 'STUDY', label: 'Study Sessions', icon: 'auto_stories' },
              { id: 'REVISION', label: 'Revision', icon: 'psychology' },
              { id: 'ASSIGNMENT', label: 'Assignments', icon: 'assignment' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-[#064e3b] text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-[16px] text-amber-600 dark:text-amber-400">celebration</span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Holidays</span>
            <button
              type="button"
              role="switch"
              aria-checked={showHolidays}
              aria-label="Show Indian holidays on calendar"
              onClick={() => setShowHolidays((v) => !v)}
              className={`shrink-0 relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                showHolidays ? 'bg-[#064e3b]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  showHolidays ? 'translate-x-4' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {loadingMeta ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
          </div>
        ) : metaError ? (
          <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">{metaError}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
            <div className="space-y-4 min-w-0">
              <div className="glass-card rounded-2xl p-5 space-y-4 border border-border-subtle dark:border-[#2e3f5f] shadow-sm">
                <CalendarHeader
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  currentDate={currentDate}
                  onToday={() => setCurrentDate(startOfDay(new Date()))}
                  onPrev={() => shiftDate(-1)}
                  onNext={() => shiftDate(1)}
                  onAddEvent={() => setAddMenuOpen(true)}
                />

                {eventsError && <p className="text-error text-body-md">{eventsError}</p>}

                <div role="region" aria-label="Calendar">
                  {loadingEvents ? (
                    <div className="flex justify-center py-16">
                      <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
                    </div>
                  ) : viewMode === 'month' ? (
                    <MonthView
                      gridStart={monthGridRange(currentDate).gridStart}
                      currentMonth={currentDate.getMonth()}
                      events={filteredEvents}
                      onSelectEvent={setSelectedEvent}
                      onDayClick={(day) => { setCurrentDate(day); setViewMode('agenda'); }}
                    />
                  ) : viewMode === 'week' ? (
                    <WeekView
                      weekStart={startOfWeek(currentDate)}
                      events={filteredEvents}
                      onSelectEvent={setSelectedEvent}
                      onDayClick={(slotDate) => handleSelectType('STUDY', slotDate)}
                    />
                  ) : (
                    <AgendaView rangeStart={rangeStart} rangeDays={14} events={filteredEvents} onSelectEvent={setSelectedEvent} />
                  )}
                </div>
              </div>
            </div>

            <UpcomingSidebar onSelectEvent={setSelectedEvent} refreshKey={refreshKey} />
          </div>
        )}
      </div>

      {addMenuOpen && <AddEventMenu onClose={() => setAddMenuOpen(false)} onSelectType={handleSelectType} />}

      {formType && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => closeForm()}>
          <div
            role="dialog"
            aria-label="Add event"
            className="bg-white dark:bg-[#152238] rounded-3xl shadow-2xl border border-border-subtle dark:border-[#2e3f5f] w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Bar with Event Type Tabs */}
            <div className="flex items-center justify-between border-b border-border-subtle/50 pb-3">
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                {[
                  { id: 'STUDY', label: 'Study', icon: 'auto_stories' },
                  { id: 'EXAM', label: 'Exam', icon: 'timer' },
                  { id: 'REVISION', label: 'Revision', icon: 'psychology' },
                  { id: 'ASSIGNMENT', label: 'Assignment', icon: 'assignment' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFormType(t.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-extrabold cursor-pointer transition-all flex items-center gap-1 whitespace-nowrap ${formType === t.id
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => closeForm()}
                className="w-8 h-8 rounded-full bg-surface-container-low dark:bg-[#1e2d4a] text-on-surface-variant hover:text-error flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {formType === 'EXAM' ? (
              <ExamForm
                subjects={subjects}
                onSubmit={handleCreateSubmit}
                onCancel={() => closeForm()}
                submitting={creating}
                error={createError}
              />
            ) : (
              <EventForm
                eventType={formType}
                subjects={subjects}
                initialDatetime={initialDatetime}
                onSubmit={handleCreateSubmit}
                onCancel={() => closeForm()}
                submitting={creating}
                error={createError}
              />
            )}
          </div>
        </div>
      )}

      {selectedEvent && (
        <EventDetailsDrawer
          event={selectedEvent}
          subjects={subjects}
          onClose={() => setSelectedEvent(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          updating={updating}
          updateError={updateError}
          deleting={deleting}
        />
      )}
    </main>
  );
};

export default MyCalendar;
