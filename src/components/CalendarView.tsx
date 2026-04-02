'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Appointment, Medication } from '@/lib/types';

interface CalendarViewProps {
  appointments: Appointment[];
  medications: Pick<Medication, 'name' | 'refill_date'>[];
  patientName: string;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DayEvent {
  type: 'appointment' | 'refill';
  label: string;
  time?: string;
  color: string;
}

export function CalendarView({ appointments, medications, patientName }: CalendarViewProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Build event map for the month
  const eventMap = new Map<string, DayEvent[]>();

  for (const appt of appointments) {
    if (!appt.date_time) continue;
    const date = new Date(appt.date_time);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const events = eventMap.get(key) || [];
    events.push({
      type: 'appointment',
      label: appt.doctor_name || 'Appointment',
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      color: 'bg-blue-500',
    });
    eventMap.set(key, events);
  }

  for (const med of medications) {
    if (!med.refill_date) continue;
    const date = new Date(med.refill_date + 'T12:00:00');
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const events = eventMap.get(key) || [];
    events.push({
      type: 'refill',
      label: `${med.name} refill`,
      color: 'bg-amber-500',
    });
    eventMap.set(key, events);
  }

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const selectedEvents = selectedDate ? eventMap.get(selectedDate) || [] : [];

  return (
    <div className="px-5 py-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-white">Calendar</h2>
        <p className="text-xs text-[var(--text-muted)]">{patientName}&apos;s schedule</p>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-[var(--text-secondary)]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h3 className="text-white font-semibold">{MONTH_NAMES[currentMonth]} {currentYear}</h3>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-[var(--text-secondary)]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] text-[var(--text-muted)] font-semibold uppercase py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const events = eventMap.get(dateKey) || [];
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(isSelected ? null : dateKey)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-sm transition-colors relative ${
                isSelected ? 'bg-blue-500/20 border border-blue-500/40' :
                isToday ? 'bg-white/[0.08] border border-white/[0.12]' :
                events.length > 0 ? 'hover:bg-white/[0.06]' : 'hover:bg-white/[0.03]'
              }`}
            >
              <span className={`${isToday ? 'text-blue-400 font-bold' : 'text-[var(--text-secondary)]'} text-xs`}>{day}</span>
              {events.length > 0 && (
                <div className="flex gap-0.5">
                  {events.slice(0, 3).map((e, j) => (
                    <div key={j} className={`w-1 h-1 rounded-full ${e.color}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-[10px] text-[var(--text-muted)]">Appointment</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-[10px] text-[var(--text-muted)]">Refill</span>
        </div>
      </div>

      {/* Selected date events */}
      {selectedDate && (
        <div className="animate-card-in">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h4>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-4 text-center">Nothing scheduled</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event, i) => (
                <div key={i} className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3">
                  <div className={`w-2 h-8 rounded-full ${event.color}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{event.label}</p>
                    {event.time && <p className="text-xs text-[var(--text-muted)]">{event.time}</p>}
                  </div>
                  {event.type === 'appointment' && (
                    <Link
                      href={`/chat?prompt=${encodeURIComponent(`Help me prepare for my appointment with ${event.label}`)}`}
                      className="text-xs text-blue-400 font-medium"
                    >
                      Prep
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
