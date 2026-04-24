'use client';

import { useState } from 'react';

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

// ─── Detail renderer ─────────────────────────────────────────────────────────

function EventDetails({ event }: { event: TimelineEvent }) {
  const data = event.data || {};
  const details: { label: string; value: string }[] = [];

  switch (event.type) {
    case 'medication':
      if (data.dose) details.push({ label: 'Dose', value: String(data.dose) });
      if (data.frequency) details.push({ label: 'Frequency', value: String(data.frequency) });
      if (data.prescribingDoctor) details.push({ label: 'Doctor', value: String(data.prescribingDoctor) });
      break;
    case 'appointment':
      if (data.specialty) details.push({ label: 'Specialty', value: String(data.specialty) });
      if (data.location) details.push({ label: 'Location', value: String(data.location) });
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

  if (details.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      {details.map((d, i) => (
        <div key={i} className="flex items-baseline gap-2 text-xs">
          <span className="text-[var(--text-muted)] shrink-0">{d.label}:</span>
          <span className="text-[var(--text-secondary)]">{d.value}</span>
        </div>
      ))}
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
