import React from 'react';
import { formatMonthYear, addDays } from '../utils/dateUtils';

const VIEW_MODES = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'agenda', label: 'Agenda' },
];

const CalendarHeader = ({ viewMode, onViewModeChange, currentDate, onToday, onPrev, onNext, onAddEvent }) => {
  const label =
    viewMode === 'month'
      ? formatMonthYear(currentDate)
      : viewMode === 'week'
      ? `${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${addDays(currentDate, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : `Starting ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <span className="material-symbols-outlined text-[20px]">calendar_month</span>
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">{label}</h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToday}
              className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Today
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPrev}
                aria-label="Previous"
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={onNext}
                aria-label="Next"
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700">
          {VIEW_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onViewModeChange(m.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                viewMode === m.id
                  ? 'bg-[#064e3b] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onAddEvent}
          className="flex items-center gap-1.5 bg-[#064e3b] text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-[#04392b] transition-all cursor-pointer shadow-xs shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Add Event
        </button>
      </div>
    </div>
  );
};

export default CalendarHeader;
