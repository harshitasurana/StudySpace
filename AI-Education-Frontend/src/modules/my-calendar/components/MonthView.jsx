import React from 'react';
import { addDays, isSameDay, startOfDay } from '../utils/dateUtils';
import { EVENT_TYPE_META } from '../constants';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE_PER_DAY = 3;

const MonthView = ({ gridStart, currentMonth, events, onSelectEvent, onDayClick }) => {
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = startOfDay(new Date());

  const eventsForDay = (day) =>
    events.filter((e) => isSameDay(startOfDay(new Date(e.start_datetime)), day)).sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));

  return (
    <div className="rounded-2xl border border-border-subtle dark:border-[#2e3f5f] overflow-hidden bg-white dark:bg-[#152238] shadow-2xs">
      {/* 7-Column Horizontal Weekday Header Row */}
      <div
        className="border-b border-border-subtle dark:border-[#2e3f5f] bg-surface-container-low dark:bg-[#1e2d4a]"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
      >
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-3 text-center text-xs font-black uppercase tracking-wider text-on-surface-variant">
            {d}
          </div>
        ))}
      </div>

      {/* 7-Column Horizontal 42-Day Grid */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
      >
        {days.map((day, idx) => {
          const inMonth = day.getMonth() === currentMonth;
          const isToday = isSameDay(day, today);
          const dayEvents = eventsForDay(day);
          const overflow = dayEvents.length - MAX_VISIBLE_PER_DAY;
          return (
            <div
              key={idx}
              onClick={() => onDayClick(day)}
              className={`min-h-[100px] border-b border-r border-border-subtle/70 dark:border-[#2e3f5f]/70 p-2 cursor-pointer hover:bg-primary/5 dark:hover:bg-primary/10 transition-all group ${inMonth ? 'bg-white dark:bg-[#152238]' : 'bg-surface-container-lowest/40 dark:bg-[#101a2c]/40'
                }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black transition-transform ${isToday
                      ? 'bg-primary text-white shadow-xs scale-105'
                      : inMonth
                        ? 'text-on-surface group-hover:text-primary'
                        : 'text-on-surface-variant/40'
                    }`}
                >
                  {day.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-primary shadow-2xs" />
                )}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, MAX_VISIBLE_PER_DAY).map((event) => {
                  const meta = EVENT_TYPE_META[event.event_type] || EVENT_TYPE_META.ACADEMIC;
                  return (
                    <button
                      key={event.calendar_event_id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(event);
                      }}
                      title={event.title}
                      className={`w-full text-left truncate px-2 py-1 rounded-md text-[11px] font-extrabold cursor-pointer transition-all duration-200 hover:scale-[1.02] ${meta.bg} ${meta.text} hover:shadow-2xs`}
                    >
                      {event.title}
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <p className="text-[10px] font-extrabold text-primary px-1 hover:underline">+{overflow} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
