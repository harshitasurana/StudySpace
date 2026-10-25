import React from 'react';
import { addDays, isSameDay, startOfDay, formatDayHeader, formatTime } from '../utils/dateUtils';
import { EVENT_TYPE_META } from '../constants';

// Groups events by day (Today/Tomorrow/formatted date headers, per the
// spec's own mockup) across the visible window — days with no events are
// skipped entirely rather than shown empty.
const AgendaView = ({ rangeStart, rangeDays, events, onSelectEvent }) => {
  const days = Array.from({ length: rangeDays }, (_, i) => addDays(startOfDay(rangeStart), i));

  const daysWithEvents = days
    .map((day) => ({
      day,
      dayEvents: events
        .filter((e) => isSameDay(startOfDay(new Date(e.start_datetime)), day))
        .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime)),
    }))
    .filter(({ dayEvents }) => dayEvents.length > 0);

  if (daysWithEvents.length === 0) {
    return (
      <div className="glass-card rounded-xl p-10 text-center text-on-surface-variant">
        Nothing on your calendar for this period.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {daysWithEvents.map(({ day, dayEvents }) => (
        <div key={day.toISOString()}>
          <p className="text-label-md font-extrabold uppercase tracking-wider text-on-surface-variant mb-2">{formatDayHeader(day)}</p>
          <div className="space-y-2">
            {dayEvents.map((event) => {
              const meta = EVENT_TYPE_META[event.event_type] || EVENT_TYPE_META.ACADEMIC;
              return (
                <button
                  key={event.calendar_event_id}
                  type="button"
                  onClick={() => onSelectEvent(event)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border-subtle bg-white dark:bg-[#152238] hover:border-primary/40 transition-colors text-left cursor-pointer"
                >
                  <span className={`shrink-0 w-9 h-9 rounded-lg ${meta.bg} ${meta.text} flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-body-md text-on-surface truncate">{event.title}</p>
                    <p className="text-label-md text-on-surface-variant">
                      {event.all_day ? 'All day' : `${formatTime(event.start_datetime)} – ${formatTime(event.end_datetime)}`}
                      {event.chapter?.name ? ` · ${event.chapter.name}` : ''}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgendaView;
