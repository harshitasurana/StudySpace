import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import { EVENT_TYPE_META } from '../constants';
import { formatDayHeader, formatTime } from '../utils/dateUtils';
import ProgressRing from '../../../shared/ProgressRing';

const DEFAULT_TODAY_TASKS = [
  { id: '1', title: 'Revise Chapter 3', subject: 'Mathematics', time: '4:00 PM – 5:00 PM', completed: true },
  { id: '2', title: 'Practice 10 Questions', subject: 'Science', time: '5:30 PM – 6:00 PM', completed: false },
  { id: '3', title: 'Read English Story', subject: 'English', time: '6:30 PM – 7:00 PM', completed: false },
];

const UpcomingSidebar = ({ onSelectEvent, refreshKey }) => {
  const navigate = useNavigate();
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayTasks, setTodayTasks] = useState(DEFAULT_TODAY_TASKS);
  const [progressStats, setProgressStats] = useState({
    studySessions: 60,
    quizzes: 40,
    revision: 20,
    assignments: 10,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      EducationService.getUpcomingCalendarEvents(6).catch(() => ({ data: [] })),
      EducationService.getProgressOverview().catch(() => ({ data: null })),
    ])
      .then(([eventsRes, overviewRes]) => {
        if (cancelled) return;
        setUpcoming(eventsRes?.data || []);
        if (overviewRes?.data?.overall_mastery !== undefined) {
          const mastery = Number(overviewRes.data.overall_mastery) || 60;
          setProgressStats({
            studySessions: Math.min(100, mastery + 10),
            quizzes: Math.min(100, Math.round(mastery * 0.7)),
            revision: Math.min(100, Math.round(mastery * 0.4)),
            assignments: Math.min(100, Math.round(mastery * 0.2)),
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const toggleTask = (taskId) => {
    setTodayTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const todayDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xs flex justify-center items-center py-12">
        <span className="material-symbols-outlined animate-spin text-3xl text-emerald-600 mr-2">progress_activity</span>
        <span className="text-sm font-medium text-slate-500">Loading plan...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Card 1: Today's Plan */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-[#064e3b] dark:text-emerald-300 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">calendar_today</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">Today's Plan</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{todayDateStr}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/study-planner')}
            className="text-xs font-bold text-[#064e3b] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {todayTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:bg-slate-100/70 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                    task.completed
                      ? 'bg-[#064e3b] text-white'
                      : 'border border-slate-300 dark:border-slate-600 hover:border-[#064e3b]'
                  }`}
                >
                  {task.completed && <span className="material-symbols-outlined text-[14px]">check</span>}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-bold truncate transition-colors ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                    {task.title}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{task.subject}</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                {task.time}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Card 2: Upcoming Events */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-[#064e3b] dark:text-emerald-300 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">event_upcoming</span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">Upcoming Events</h3>
          </div>
          <button
            type="button"
            onClick={() => navigate('/study-planner')}
            className="text-xs font-bold text-[#064e3b] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>

        {upcoming.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-2 text-center">No upcoming events scheduled.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((event) => {
              const meta = EVENT_TYPE_META[event.event_type] || EVENT_TYPE_META.ACADEMIC;
              return (
                <div
                  key={event.calendar_event_id}
                  onClick={() => onSelectEvent && onSelectEvent(event)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:bg-slate-100/70 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${meta.bg} ${meta.text}`}>
                      <span className="material-symbols-outlined text-[18px]">{meta.icon || 'event'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#064e3b] dark:group-hover:text-emerald-400 transition-colors truncate">
                        {event.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {formatDayHeader(new Date(event.start_datetime))} · {formatTime(event.start_datetime)}
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                    chevron_right
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card 3: Study Progress (This Month) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-[#064e3b] dark:text-emerald-300 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">bar_chart</span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">Study Progress</h3>
          </div>
          <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full">
            This Month
          </span>
        </div>

        {/* 4 Circular Gauges */}
        <div className="grid grid-cols-4 gap-2 pt-2 text-center">
          <div className="flex flex-col items-center">
            <ProgressRing percent={progressStats.studySessions} size={48} strokeWidth={4.5} strokeColor="#059669" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2 leading-tight">Study Sessions</span>
          </div>
          <div className="flex flex-col items-center">
            <ProgressRing percent={progressStats.quizzes} size={48} strokeWidth={4.5} strokeColor="#7c3aed" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2 leading-tight">Quizzes</span>
          </div>
          <div className="flex flex-col items-center">
            <ProgressRing percent={progressStats.revision} size={48} strokeWidth={4.5} strokeColor="#2563eb" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2 leading-tight">Revision</span>
          </div>
          <div className="flex flex-col items-center">
            <ProgressRing percent={progressStats.assignments} size={48} strokeWidth={4.5} strokeColor="#ea580c" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2 leading-tight">Assignments</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpcomingSidebar;
