'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Medication, Appointment, LabResult, SymptomEntry } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'medications' | 'appointments' | 'labs' | 'symptoms';

interface TimelineEvent {
  id: string;
  type: 'medication' | 'appointment' | 'lab' | 'symptom';
  date: Date;
  title: string;
  subtitle: string | null;
  details: string[];
  color: string;
  isAbnormal?: boolean;
}

interface TreatmentTimelineProps {
  medications: Medication[];
  appointments: Appointment[];
  labResults: LabResult[];
  symptomEntries: SymptomEntry[];
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function PillIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 1.5L3 9a4.243 4.243 0 006 6l7.5-7.5a4.243 4.243 0 00-6-6z" />
      <path d="M6.75 12.75L12.75 6.75" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLORS = {
  medication: '#6366F1', // indigo
  appointment: '#22d3ee', // cyan
  lab: '#10b981', // green
  labAbnormal: '#ef4444', // red
  symptom: '#f59e0b', // amber
} as const;

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function moodLabel(mood: string | null): string {
  if (!mood) return '';
  const labels: Record<string, string> = { great: 'Great', good: 'Good', okay: 'Okay', bad: 'Bad', terrible: 'Terrible' };
  return labels[mood] || mood;
}

function sleepLabel(quality: string | null): string {
  if (!quality) return '';
  const labels: Record<string, string> = { great: 'Great', good: 'Good', fair: 'Fair', poor: 'Poor', terrible: 'Terrible' };
  return labels[quality] || quality;
}

// ─── Transform data into timeline events ─────────────────────────────────────

function buildEvents(
  medications: Medication[],
  appointments: Appointment[],
  labResults: LabResult[],
  symptomEntries: SymptomEntry[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const med of medications) {
    const dateStr = med.start_date || med.created_at;
    if (!dateStr) continue;
    const details: string[] = [];
    if (med.dose) details.push(med.dose);
    if (med.frequency) details.push(med.frequency);
    if (med.prescribing_doctor) details.push(`Dr. ${med.prescribing_doctor}`);

    events.push({
      id: `med-${med.id}`,
      type: 'medication',
      date: new Date(dateStr),
      title: med.name,
      subtitle: 'Medication started',
      details,
      color: COLORS.medication,
    });
  }

  for (const apt of appointments) {
    const dateStr = apt.date_time || apt.created_at;
    if (!dateStr) continue;
    const details: string[] = [];
    if (apt.specialty) details.push(apt.specialty);
    if (apt.location) details.push(apt.location);
    if (apt.prep_notes) details.push(`Prep: ${apt.prep_notes}`);

    events.push({
      id: `apt-${apt.id}`,
      type: 'appointment',
      date: new Date(dateStr),
      title: apt.purpose || 'Appointment',
      subtitle: apt.doctor_name ? `Dr. ${apt.doctor_name}` : null,
      details,
      color: COLORS.appointment,
    });
  }

  for (const lab of labResults) {
    const dateStr = lab.date_taken || lab.created_at;
    if (!dateStr) continue;
    const details: string[] = [];
    if (lab.value && lab.unit) details.push(`Result: ${lab.value} ${lab.unit}`);
    else if (lab.value) details.push(`Result: ${lab.value}`);
    if (lab.reference_range) details.push(`Range: ${lab.reference_range}`);
    if (lab.is_abnormal) details.push('Flagged abnormal');
    if (lab.source) details.push(`Source: ${lab.source}`);

    events.push({
      id: `lab-${lab.id}`,
      type: 'lab',
      date: new Date(dateStr),
      title: lab.test_name,
      subtitle: 'Lab result',
      details,
      color: lab.is_abnormal ? COLORS.labAbnormal : COLORS.lab,
      isAbnormal: lab.is_abnormal,
    });
  }

  for (const entry of symptomEntries) {
    const dateStr = entry.date || entry.created_at;
    if (!dateStr) continue;
    const details: string[] = [];
    if (entry.pain_level !== null && entry.pain_level !== undefined) details.push(`Pain: ${entry.pain_level}/10`);
    if (entry.mood) details.push(`Mood: ${moodLabel(entry.mood)}`);
    if (entry.sleep_quality) details.push(`Sleep: ${sleepLabel(entry.sleep_quality)}`);
    if (entry.symptoms?.length > 0) details.push(entry.symptoms.join(', '));

    events.push({
      id: `sym-${entry.id}`,
      type: 'symptom',
      date: new Date(dateStr),
      title: entry.symptoms?.length > 0 ? entry.symptoms.slice(0, 3).join(', ') : 'Journal entry',
      subtitle: entry.notes ? entry.notes.slice(0, 80) + (entry.notes.length > 80 ? '...' : '') : 'Symptom check-in',
      details,
      color: COLORS.symptom,
    });
  }

  events.sort((a, b) => b.date.getTime() - a.date.getTime());
  return events;
}

// ─── Grouped by month ────────────────────────────────────────────────────────

interface MonthGroup {
  key: string;
  label: string;
  events: TimelineEvent[];
}

function groupByMonth(events: TimelineEvent[]): MonthGroup[] {
  const groups: Map<string, MonthGroup> = new Map();

  for (const event of events) {
    const key = `${event.date.getFullYear()}-${String(event.date.getMonth()).padStart(2, '0')}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: formatMonthYear(event.date),
        events: [],
      });
    }
    groups.get(key)!.events.push(event);
  }

  return Array.from(groups.values());
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

const FILTER_TABS: { key: FilterType; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: '#A78BFA' },
  { key: 'medications', label: 'Medications', color: COLORS.medication },
  { key: 'appointments', label: 'Appointments', color: COLORS.appointment },
  { key: 'labs', label: 'Labs', color: COLORS.lab },
  { key: 'symptoms', label: 'Symptoms', color: COLORS.symptom },
];

const TYPE_MAP: Record<FilterType, TimelineEvent['type'] | null> = {
  all: null,
  medications: 'medication',
  appointments: 'appointment',
  labs: 'lab',
  symptoms: 'symptom',
};

// ─── Event icon ──────────────────────────────────────────────────────────────

function EventIcon({ type, color }: { type: TimelineEvent['type']; color: string }) {
  const iconClass = 'w-3.5 h-3.5';
  let icon;
  switch (type) {
    case 'medication':
      icon = <PillIcon className={iconClass} />;
      break;
    case 'appointment':
      icon = <CalendarIcon className={iconClass} />;
      break;
    case 'lab':
      icon = <ClipboardIcon className={iconClass} />;
      break;
    case 'symptom':
      icon = <HeartIcon className={iconClass} />;
      break;
  }

  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ring-4 ring-[var(--bg)]"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {icon}
    </div>
  );
}

// ─── Timeline item ───────────────────────────────────────────────────────────

function TimelineItem({ event, isLatest, index }: { event: TimelineEvent; isLatest: boolean; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative flex gap-4 pb-8 last:pb-0 group"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: `opacity 0.4s ease ${index * 0.03}s, transform 0.4s ease ${index * 0.03}s`,
      }}
    >
      {/* Dot / Icon */}
      <div className="relative flex flex-col items-center">
        <div className={isLatest ? 'animate-pulse' : ''}>
          <EventIcon type={event.type} color={event.color} />
        </div>
        {/* Vertical line continues below the dot */}
        <div className="w-px flex-1 bg-gradient-to-b from-white/[0.08] to-transparent mt-2" />
      </div>

      {/* Content card */}
      <div className="flex-1 min-w-0 -mt-0.5">
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-4 transition-colors hover:border-white/[0.14]">
          {/* Date */}
          <time className="text-[11px] text-[var(--text-muted)] font-medium">
            {formatDate(event.date)}
          </time>

          {/* Title */}
          <h4 className="text-sm font-semibold text-[var(--text)] mt-1 truncate">
            {event.title}
          </h4>

          {/* Subtitle */}
          {event.subtitle && (
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
              {event.subtitle}
            </p>
          )}

          {/* Details chips */}
          {event.details.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {event.details.map((detail, i) => (
                <span
                  key={i}
                  className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: event.isAbnormal && detail === 'Flagged abnormal'
                      ? '#ef444420'
                      : `${event.color}12`,
                    color: event.isAbnormal && detail === 'Flagged abnormal'
                      ? '#ef4444'
                      : `${event.color}`,
                  }}
                >
                  {detail}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Today marker ────────────────────────────────────────────────────────────

function TodayMarker() {
  return (
    <div className="relative flex gap-4 pb-8 items-center">
      <div className="relative flex flex-col items-center">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ring-4 ring-[var(--bg)] bg-gradient-to-br from-[#6366F1] to-[#A78BFA]">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        </div>
        <div className="w-px flex-1 bg-gradient-to-b from-white/[0.08] to-transparent mt-2" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#A78BFA] uppercase tracking-wider">
            Today
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-[#6366F1]/40 to-transparent" />
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: FilterType }) {
  const labels: Record<FilterType, string> = {
    all: 'events',
    medications: 'medications',
    appointments: 'appointments',
    labs: 'lab results',
    symptoms: 'symptom entries',
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-[var(--text)] mb-1">No {labels[filter]} yet</h3>
      <p className="text-sm text-[var(--text-muted)] max-w-xs">
        As you add {labels[filter]} to CareCompanion, they will appear here on your timeline.
      </p>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function TreatmentTimeline({
  medications,
  appointments,
  labResults,
  symptomEntries,
}: TreatmentTimelineProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const allEvents = useMemo(
    () => buildEvents(medications, appointments, labResults, symptomEntries),
    [medications, appointments, labResults, symptomEntries],
  );

  const filteredEvents = useMemo(() => {
    const typeKey = TYPE_MAP[filter];
    if (!typeKey) return allEvents;
    return allEvents.filter((e) => e.type === typeKey);
  }, [allEvents, filter]);

  const monthGroups = useMemo(() => groupByMonth(filteredEvents), [filteredEvents]);

  // Find where "today" should be inserted
  const today = useMemo(() => new Date(), []);

  const handleFilterChange = useCallback((key: FilterType) => {
    setFilter(key);
  }, []);

  // Count badges
  const counts: Record<FilterType, number> = useMemo(
    () => ({
      all: allEvents.length,
      medications: allEvents.filter((e) => e.type === 'medication').length,
      appointments: allEvents.filter((e) => e.type === 'appointment').length,
      labs: allEvents.filter((e) => e.type === 'lab').length,
      symptoms: allEvents.filter((e) => e.type === 'symptom').length,
    }),
    [allEvents],
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">Treatment Timeline</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Your complete care journey &mdash; {allEvents.length} event{allEvents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0"
              style={{
                backgroundColor: isActive ? `${tab.color}20` : 'rgba(255,255,255,0.04)',
                color: isActive ? tab.color : 'var(--text-muted)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: isActive ? `${tab.color}40` : 'rgba(255,255,255,0.08)',
              }}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                  style={{
                    backgroundColor: isActive ? `${tab.color}30` : 'rgba(255,255,255,0.06)',
                    color: isActive ? tab.color : 'var(--text-muted)',
                  }}
                >
                  {counts[tab.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="relative">
          {/* Main vertical line */}
          <div
            className="absolute left-[13px] top-0 bottom-0 w-px"
            style={{
              background: 'linear-gradient(180deg, #6366F1 0%, #A78BFA 50%, transparent 100%)',
            }}
          />

          {monthGroups.map((group) => {
            // Determine if "today" marker belongs before this group
            let todayInserted = false;
            const groupMonth = group.events[0]?.date;
            const isCurrentMonth =
              groupMonth &&
              groupMonth.getFullYear() === today.getFullYear() &&
              groupMonth.getMonth() === today.getMonth();

            return (
              <div key={group.key} className="relative">
                {/* Sticky month header */}
                <div className="sticky top-0 z-10 pb-4 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-7 flex justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white/[0.2]" />
                    </div>
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg)] pr-3">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>
                </div>

                {/* Events in this month */}
                {group.events.map((event, eventIndex) => {
                  const elements = [];

                  // Insert today marker at the correct position
                  if (
                    isCurrentMonth &&
                    !todayInserted &&
                    (isSameDay(event.date, today) || event.date < today)
                  ) {
                    todayInserted = true;
                    elements.push(<TodayMarker key="today-marker" />);
                  }

                  elements.push(
                    <TimelineItem
                      key={event.id}
                      event={event}
                      isLatest={filter === 'all' && eventIndex === 0 && group.key === monthGroups[0].key}
                      index={eventIndex}
                    />,
                  );

                  return elements;
                })}

                {/* If today is after all events in this month and we haven't inserted it */}
                {isCurrentMonth && !todayInserted && <TodayMarker />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
