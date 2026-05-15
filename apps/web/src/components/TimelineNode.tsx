'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  type: 'medication' | 'appointment' | 'lab' | 'symptom' | 'checkin' | 'insight' | 'cycle';
  date: string; // ISO string
  title: string;
  subtitle?: string | null;
  severity?: 'info' | 'watch' | 'alert' | 'positive' | null;
  isMilestone?: boolean;
  data?: Record<string, unknown>;
}

interface TimelineNodeProps {
  event: TimelineEvent;
  isCurrentDay: boolean;
}

// ─── Color / size helpers ────────────────────────────────────────────────────

function getNodeColor(event: TimelineEvent): {
  dot: string;
  bg: string;
  border: string;
  text: string;
} {
  // Positive (green)
  if (event.severity === 'positive' || event.type === 'checkin') {
    return {
      dot: 'bg-emerald-400',
      bg: 'bg-emerald-400/5',
      border: 'border-emerald-400/15',
      text: 'text-emerald-400',
    };
  }
  // Watch (amber)
  if (event.severity === 'watch' || event.severity === 'alert') {
    return {
      dot: 'bg-amber-400',
      bg: 'bg-amber-400/5',
      border: 'border-amber-400/15',
      text: 'text-amber-400',
    };
  }
  // Labs (cyan)
  if (event.type === 'lab') {
    return {
      dot: 'bg-cyan-400',
      bg: 'bg-cyan-400/5',
      border: 'border-cyan-400/15',
      text: 'text-cyan-400',
    };
  }
  // Neutral / default (indigo)
  return {
    dot: 'bg-indigo-500',
    bg: 'bg-indigo-500/5',
    border: 'border-indigo-500/15',
    text: 'text-indigo-400',
  };
}

function formatEventDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatEventTime(isoString: string): string {
  const d = new Date(isoString);
  const hours = d.getHours();
  const mins = d.getMinutes();
  if (hours === 0 && mins === 0) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ─── ICS helper ──────────────────────────────────────────────────────────────

function toIcsDate(isoString: string): string {
  return isoString.replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// ─── Detail renderer ─────────────────────────────────────────────────────────

function EventDetails({ event }: { event: TimelineEvent }) {
  const [prepItems, setPrepItems] = useState<string[] | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);

  const data = useMemo(() => event.data || {}, [event.data]);
  const isAppointment = event.type === 'appointment';
  const location = isAppointment && data.location ? String(data.location) : null;

  useEffect(() => {
    if (!isAppointment) return;
    const rawId = event.id.replace(/^appt-/, '');
    setPrepLoading(true);
    fetch(`/api/prep?appointmentId=${encodeURIComponent(rawId)}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.data?.items)) setPrepItems(d.data.items); })
      .catch(() => {})
      .finally(() => setPrepLoading(false));
  }, [event.id, isAppointment]);

  const handleAddToCalendar = useCallback(() => {
    const start = toIcsDate(event.date);
    const end = toIcsDate(new Date(new Date(event.date).getTime() + 60 * 60 * 1000).toISOString());
    const loc = data.location ? String(data.location) : '';
    const doctor = data.doctorName ? `Dr. ${String(data.doctorName)}` : '';

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CareCompanion//EN',
      'BEGIN:VEVENT',
      `SUMMARY:${event.title}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      loc ? `LOCATION:${loc}` : null,
      doctor ? `DESCRIPTION:Appointment with ${doctor}` : 'DESCRIPTION:CareCompanion appointment',
      `UID:${event.id}@carecompanion`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/[^a-z0-9]/gi, '-')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }, [event, data]);

  const details: { label: string; value: string }[] = [];

  switch (event.type) {
    case 'medication':
      if (data.dose) details.push({ label: 'Dose', value: String(data.dose) });
      if (data.frequency) details.push({ label: 'Frequency', value: String(data.frequency) });
      if (data.prescribingDoctor) details.push({ label: 'Doctor', value: String(data.prescribingDoctor) });
      break;
    case 'appointment':
      if (data.specialty) details.push({ label: 'Specialty', value: String(data.specialty) });
      if (data.doctorName) details.push({ label: 'Doctor', value: String(data.doctorName) });
      break;
    case 'lab':
      if (data.value) details.push({ label: 'Result', value: `${data.value}${data.unit ? ` ${data.unit}` : ''}` });
      if (data.referenceRange) details.push({ label: 'Range', value: String(data.referenceRange) });
      if (data.isAbnormal) details.push({ label: 'Status', value: 'Flagged abnormal' });
      break;
    case 'checkin':
      if (data.mood != null) details.push({ label: 'Mood', value: `${data.mood}/5` });
      if (data.pain != null) details.push({ label: 'Pain', value: `${data.pain}/10` });
      if (data.energy) details.push({ label: 'Energy', value: String(data.energy) });
      if (data.sleep) details.push({ label: 'Sleep', value: String(data.sleep) });
      break;
    case 'insight':
      if (data.body) details.push({ label: 'Details', value: String(data.body) });
      break;
    case 'cycle':
      if (data.regimenName) details.push({ label: 'Regimen', value: String(data.regimenName) });
      if (data.cycleLengthDays) details.push({ label: 'Length', value: `${data.cycleLengthDays} days` });
      break;
    default:
      break;
  }

  if (details.length === 0 && !isAppointment) return null;

  return (
    <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
      {/* Detail rows */}
      {details.length > 0 && (
        <div className="space-y-1.5">
          {details.map((d, i) => (
            <div key={i} className="flex items-baseline gap-2 text-xs">
              <span className="text-[var(--text-muted)] shrink-0">{d.label}:</span>
              <span className="text-[var(--text-secondary)]">{d.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {isAppointment && (
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          <button
            onClick={handleAddToCalendar}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-medium hover:bg-indigo-500/20 transition-colors"
          >
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Add to Calendar
          </button>
          {location && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
            >
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Get Directions
            </a>
          )}
        </div>
      )}

      {/* AI Prep checklist */}
      {isAppointment && (
        <div className="pt-0.5">
          {prepLoading && (
            <div className="space-y-1.5 animate-pulse">
              <div className="h-2 w-24 bg-white/[0.06] rounded" />
              {[1, 2, 3].map(i => (
                <div key={i} className="h-2 bg-white/[0.04] rounded" style={{ width: `${70 + i * 8}%` }} />
              ))}
            </div>
          )}
          {!prepLoading && prepItems && prepItems.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Prep checklist</p>
              <ul className="space-y-1">
                {prepItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                    <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TimelineNode({ event, isCurrentDay }: TimelineNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = getNodeColor(event);
  const isMilestone = event.isMilestone || event.type === 'cycle';
  const dotSize = isMilestone ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';

  const hasInsightBg = event.type === 'insight' || event.severity === 'watch' || event.severity === 'alert';
  const timeStr = formatEventTime(event.date);

  return (
    <div
      className="relative cursor-pointer group"
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setExpanded((v) => !v);
        }
      }}
    >
      {/* Dot — positioned to center on the timeline line at left: 11px */}
      <div
        className="absolute"
        style={{
          left: isMilestone ? '4.25px' : '5.75px',
          top: '6px',
        }}
      >
        <div
          className={`
            ${dotSize} rounded-full ${colors.dot}
            ${isCurrentDay ? 'here-pulse' : ''}
            ring-4 ring-[var(--bg)]
            transition-transform group-hover:scale-125
          `}
        />
      </div>

      {/* Content — offset to the right of the timeline line */}
      <div className="ml-8">
        {/* Date label */}
        <div className="flex items-center gap-2 mb-1">
          <time className="text-[11px] font-medium text-[var(--text-muted)]">
            {formatEventDate(event.date)}
          </time>
          {timeStr && (
            <span className="text-[10px] text-[var(--text-muted)]">{timeStr}</span>
          )}
          {isCurrentDay && (
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
              Today
            </span>
          )}
        </div>

        {/* Card */}
        <div
          className={`
            rounded-xl p-3 transition-all
            ${hasInsightBg
              ? `${colors.bg} border ${colors.border}`
              : 'bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12]'
            }
          `}
        >
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-[var(--text)] truncate">
                {event.title}
              </h4>
              {event.subtitle && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                  {event.subtitle}
                </p>
              )}
            </div>
            {/* Expand indicator */}
            <svg
              className={`w-3.5 h-3.5 shrink-0 text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Expanded details */}
          {expanded && <EventDetails event={event} />}
        </div>
      </div>
    </div>
  );
}
