import React from 'react';
import { addDays, isSameDay, startOfDay } from '../utils/dateUtils';
import { EVENT_TYPE_META } from '../constants';

// A 6am-10pm window covers real study scheduling without an all-day-tall
// grid — an all-day event still shows as its own chip at the top of its
// column rather than being positioned by time.
const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_HEIGHT_PX = 48;
const TOTAL_HEIGHT_PX = (END_HOUR - START_HOUR) * HOUR_HEIGHT_PX;

const hourLabel = (hour) => {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? 'AM' : 'PM'}`;
};

const eventPosition = (event) => {
  const start = new Date(event.start_datetime);
  const end = new Date(event.end_datetime);
  const startMinutes = Math.max(0, (start.getHours() - START_HOUR) * 60 + start.getMinutes());
  const endMinutes = Math.min((END_HOUR - START_HOUR) * 60, (end.getHours() - START_HOUR) * 60 + end.getMinutes());
  const top = (startMinutes / 60) * HOUR_HEIGHT_PX;
  const height = Math.max(20, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT_PX);
  return { top, height };
};

const WeekView = ({ weekStart, events, onSelectEvent, onDayClick }) => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = startOfDay(new Date());
  const now = new Date();
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  // Current time position in pixels
  const nowHour = now.getHours();
  const nowMinutes = now.getMinutes();
  const isNowInWindow = nowHour >= START_HOUR && nowHour < END_HOUR;
  const nowTopPx = ((nowHour - START_HOUR) * 60 + nowMinutes) / 60 * HOUR_HEIGHT_PX;

  const eventsForDay = (day) => events.filter((e) => !e.all_day && isSameDay(startOfDay(new Date(e.start_datetime)), day));
  const allDayEventsForDay = (day) => events.filter((e) => e.all_day && isSameDay(startOfDay(new Date(e.start_datetime)), day));

  return (
    <div className="rounded-2xl border border-border-subtle dark:border-[#2e3f5f] overflow-hidden bg-white dark:bg-[#152238] shadow-2xs">
      {/* Weekday Header Row */}
      <div
        className="border-b border-border-subtle dark:border-[#2e3f5f] bg-surface-container-low dark:bg-[#1e2d4a]"
        style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, minmax(0, 1fr))' }}
      >
        <div className="flex items-center justify-center p-2 text-[10px] font-black text-on-surface-variant uppercase">
          GMT
        </div>
        {days.map((day, idx) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={idx}
              onClick={() => onDayClick && onDayClick(day)}
              className={`py-3 text-center border-l border-border-subtle/70 dark:border-[#2e3f5f]/70 cursor-pointer hover:bg-primary/5 transition-all ${
                isToday ? 'bg-primary/10' : ''
              }`}
            >
              <p className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </p>
              <p
                className={`text-sm font-black mt-1 inline-flex items-center justify-center w-7 h-7 rounded-full transition-transform ${
                  isToday
                    ? 'bg-primary text-white shadow-xs scale-105'
                    : 'text-on-surface'
                }`}
              >
                {day.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* All-day Events Row */}
      <div
        className="border-b border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest/50 dark:bg-[#101a2c]/50"
        style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, minmax(0, 1fr))' }}
      >
        <div className="text-[10px] font-extrabold uppercase text-on-surface-variant p-2 flex items-center justify-center">
          All day
        </div>
        {days.map((day, idx) => (
          <div key={idx} className="border-l border-border-subtle/70 dark:border-[#2e3f5f]/70 p-1 space-y-1 min-h-[36px]">
            {allDayEventsForDay(day).map((event) => {
              const meta = EVENT_TYPE_META[event.event_type] || EVENT_TYPE_META.ACADEMIC;
              return (
                <button
                  key={event.calendar_event_id}
                  type="button"
                  onClick={() => onSelectEvent(event)}
                  className={`w-full truncate text-left px-2 py-1 rounded-md text-[10px] font-extrabold cursor-pointer transition-all hover:scale-[1.02] ${meta.bg} ${meta.text} shadow-2xs`}
                >
                  {event.title}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Hour-by-Hour Interactive Time Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, minmax(0, 1fr))' }} className="relative">
        {/* Time Sidebar Labels */}
        <div className="relative" style={{ height: TOTAL_HEIGHT_PX }}>
          {hours.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 text-[10px] font-extrabold text-on-surface-variant text-center -translate-y-2 select-none"
              style={{ top: (h - START_HOUR) * HOUR_HEIGHT_PX }}
            >
              {hourLabel(h)}
            </div>
          ))}
        </div>

        {/* 7 Day Columns */}
        {days.map((day, dayIdx) => {
          const isToday = isSameDay(day, today);
          const dayEvents = eventsForDay(day);

          return (
            <div
              key={dayIdx}
              className={`relative border-l border-border-subtle/70 dark:border-[#2e3f5f]/70 ${
                isToday ? 'bg-primary/[0.02]' : ''
              }`}
              style={{ height: TOTAL_HEIGHT_PX }}
            >
              {/* Hourly Slot Click Grids */}
              {hours.map((h) => (
                <div
                  key={h}
                  onClick={() => {
                    if (onDayClick) {
                      const slotDate = new Date(day);
                      slotDate.setHours(h, 0, 0, 0);
                      onDayClick(slotDate);
                    }
                  }}
                  className="absolute left-0 right-0 border-t border-border-subtle/40 dark:border-[#2e3f5f]/40 hover:bg-primary/5 cursor-pointer transition-colors group/slot"
                  style={{ top: (h - START_HOUR) * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
                >
                  <span className="hidden group-hover/slot:inline-block text-[9px] font-bold text-primary px-1 bg-white dark:bg-[#152238] rounded shadow-2xs ml-1 mt-1">
                    + Add
                  </span>
                </div>
              ))}

              {/* Red Current Time Line Indicator */}
              {isToday && isNowInWindow && (
                <div
                  className="absolute left-0 right-0 border-b-2 border-error z-20 pointer-events-none flex items-center"
                  style={{ top: nowTopPx }}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-error -ml-1.25 shadow-xs animate-pulse" />
                </div>
              )}

              {/* Event Cards */}
              {dayEvents.map((event) => {
                const { top, height } = eventPosition(event);
                const meta = EVENT_TYPE_META[event.event_type] || EVENT_TYPE_META.ACADEMIC;
                const startTimeStr = new Date(event.start_datetime).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                });

                return (
                  <button
                    key={event.calendar_event_id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                    title={`${event.title} (${startTimeStr})`}
                    style={{ top, height }}
                    className={`absolute left-1 right-1 rounded-xl p-1.5 text-left overflow-hidden cursor-pointer border ${meta.bg} ${meta.text} border-current/20 shadow-2xs hover:shadow-md hover:scale-[1.02] transition-all duration-150 z-10 group`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] shrink-0">{meta.icon}</span>
                      <span className="block text-[11px] font-black truncate leading-tight group-hover:underline">
                        {event.title}
                      </span>
                    </div>
                    {height > 32 && (
                      <span className="block text-[10px] font-bold opacity-80 mt-0.5 truncate">
                        {startTimeStr}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeekView;
