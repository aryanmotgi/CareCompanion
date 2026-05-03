'use client';

import { useState, useMemo, useCallback } from 'react';
import { TimelineNode } from './TimelineNode';
import type { TimelineEvent } from './TimelineNode';

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'medications' | 'appointments' | 'labs' | 'checkins' | 'insights';

interface TreatmentTimelineProps {
  events: TimelineEvent[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ─── Cycle chapter detection ─────────────────────────────────────────────────

interface CycleChapter {
  cycleNumber: number;
  regimenName: string | null;
  startDate: string;
}

function detectCycleChapters(events: TimelineEvent[]): CycleChapter[] {
  return events
    .filter((e) => e.type === 'cycle')
    .map((e) => ({
      cycleNumber: (e.data?.cycleNumber as number) || 0,
      regimenName: (e.data?.regimenName as string) || null,
      startDate: e.date,
    }))
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

// ─── Month grouping ──────────────────────────────────────────────────────────

interface MonthGroup {
  key: string;
  label: string;
  events: TimelineEvent[];
}

function groupByMonth(events: TimelineEvent[]): MonthGroup[] {
  const groups: Map<string, MonthGroup> = new Map();

  for (const event of events) {
    const d = new Date(event.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    if (!groups.has(key)) {
      groups.set(key, { key, label: formatMonthYear(d), events: [] });
    }
    groups.get(key)!.events.push(event);
  }

  return Array.from(groups.values());
}

// ─── Filter config ───────────────────────────────────────────────────────────

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'medications', label: 'Medications' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'labs', label: 'Labs' },
  { key: 'checkins', label: 'Check-ins' },
  { key: 'insights', label: 'Insights' },
];

const TYPE_MAP: Record<FilterType, TimelineEvent['type'][] | null> = {
  all: null,
  medications: ['medication'],
  appointments: ['appointment'],
  labs: ['lab'],
  checkins: ['checkin', 'symptom'],
  insights: ['insight'],
};

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyTimeline() {
  return (
    <div className="relative pl-8 py-8">
      {/* Dashed line */}
      <div
        className="absolute left-[11px] top-4 bottom-4 w-[3px] rounded-full"
        style={{
          background: 'repeating-linear-gradient(180deg, rgba(99,102,241,0.15) 0px, rgba(99,102,241,0.15) 6px, transparent 6px, transparent 12px)',
        }}
      />

      <div className="space-y-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="relative">
            {/* Dashed circle */}
            <div
              className="absolute -left-8"
              style={{ left: '3px', top: '4px' }}
            >
              <div className="w-4 h-4 rounded-full border-2 border-dashed border-indigo-500/20" />
            </div>
            <div className="ml-8">
              <div className="h-3 w-20 rounded bg-white/[0.04] mb-2" />
              <div className="h-16 rounded-xl border border-dashed border-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-8">
        <p className="text-sm text-[var(--text-secondary)]">
          Your treatment journey will appear here
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          As you add medications, appointments, and check-ins, CareCompanion will build your timeline.
        </p>
        <a
          href="/chat"
          className="inline-block mt-3 text-xs font-medium text-[var(--lavender)] hover:underline"
        >
          Start a conversation
        </a>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function TreatmentTimeline({ events }: TreatmentTimelineProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [showTrends, setShowTrends] = useState(false);

  const today = useMemo(() => new Date(), []);

  // Sort events descending by date
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [events],
  );

  // Filter
  const filteredEvents = useMemo(() => {
    const types = TYPE_MAP[filter];
    if (!types) return sortedEvents;
    return sortedEvents.filter((e) => types.includes(e.type));
  }, [sortedEvents, filter]);

  const monthGroups = useMemo(() => groupByMonth(filteredEvents), [filteredEvents]);

  // Cycle chapters
  const cycles = useMemo(() => detectCycleChapters(sortedEvents), [sortedEvents]);

  // Counts for filter badges
  const counts: Record<FilterType, number> = useMemo(() => ({
    all: sortedEvents.length,
    medications: sortedEvents.filter((e) => e.type === 'medication').length,
    appointments: sortedEvents.filter((e) => e.type === 'appointment').length,
    labs: sortedEvents.filter((e) => e.type === 'lab').length,
    checkins: sortedEvents.filter((e) => e.type === 'checkin' || e.type === 'symptom').length,
    insights: sortedEvents.filter((e) => e.type === 'insight').length,
  }), [sortedEvents]);

  const handleFilterChange = useCallback((key: FilterType) => {
    setFilter(key);
  }, []);

  const handleShare = useCallback(async () => {
    // Placeholder — share functionality coming later
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Treatment Timeline',
          text: 'Check out my treatment timeline on CareCompanion',
          url: window.location.href,
        });
      } catch {
        // User cancelled or share failed
      }
    }
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">Treatment Timeline</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Your complete care journey &mdash; {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Action buttons row */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowTrends((v) => !v)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            ${showTrends
              ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
              : 'bg-white/[0.04] text-[var(--text-muted)] border border-white/[0.08] hover:border-white/[0.14]'
            }
          `}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Trends
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-[var(--text-muted)] border border-white/[0.08] hover:border-white/[0.14] transition-all"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share
        </button>
      </div>

      {/* Trends placeholder */}
      {showTrends && (
        <div className="mb-6 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/15 text-center">
          <p className="text-xs text-indigo-400 font-medium">Trend analysis coming soon</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            We are working on visualizing your health patterns over time.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className={`
                flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0
                ${isActive
                  ? 'bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]/40'
                  : 'bg-white/[0.04] text-[var(--text-muted)] border border-white/[0.08] hover:border-white/[0.14]'
                }
              `}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span
                  className={`
                    text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                    ${isActive ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-white/[0.06] text-[var(--text-muted)]'}
                  `}
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
        <EmptyTimeline />
      ) : (
        <div className="relative" style={{ paddingLeft: '32px' }}>
          {/* Glowing connection line */}
          <div
            className="timeline-line absolute top-0 bottom-0 rounded-full"
            style={{ width: '3px', left: '11px' }}
          />

          {/* Cycle chapter headers (if any) */}
          {cycles.length > 0 && filter === 'all' && (
            <div className="mb-2">
              {cycles.slice(0, 1).map((cycle) => (
                <div
                  key={cycle.cycleNumber}
                  className="flex items-center gap-2 mb-4 -ml-8 pl-8"
                >
                  <div className="absolute left-[5px] w-[15px] h-[15px] rounded-full bg-indigo-500 here-pulse ring-4 ring-[var(--bg)]" />
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                    Cycle {cycle.cycleNumber}
                    {cycle.regimenName ? ` — ${cycle.regimenName}` : ''}
                  </span>
                  <div className="flex-1 h-px bg-indigo-500/20" />
                </div>
              ))}
            </div>
          )}

          {/* Month groups with staggered animation */}
          <div className="card-stagger">
            {monthGroups.map((group) => {
              // Check if "today" falls in this month
              const groupDate = new Date(group.events[0]?.date);
              const isCurrentMonth =
                groupDate.getFullYear() === today.getFullYear() &&
                groupDate.getMonth() === today.getMonth();

              let todayInserted = false;

              return (
                <div key={group.key} className="relative mb-6">
                  {/* Month header */}
                  <div className="sticky top-0 z-10 pb-3 pt-1 -ml-8">
                    <div className="flex items-center gap-3 pl-8">
                      <div
                        className="absolute left-[9px] w-[7px] h-[7px] rounded-full bg-white/[0.2]"
                      />
                      <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg)] pr-3">
                        {group.label}
                      </span>
                      <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>
                  </div>

                  {/* Events */}
                  <div className="space-y-4">
                    {group.events.map((event) => {
                      const eventDate = new Date(event.date);
                      const isToday = isSameDay(eventDate, today);
                      const elements: React.ReactNode[] = [];

                      // Insert "You are here" marker
                      if (
                        isCurrentMonth &&
                        !todayInserted &&
                        (isToday || eventDate < today)
                      ) {
                        todayInserted = true;
                        elements.push(
                          <div key="today-marker" className="relative flex items-center gap-3 py-2 -ml-8 pl-8">
                            <div className="absolute left-[4px] w-[17px] h-[17px] rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] here-pulse ring-4 ring-[var(--bg)] flex items-center justify-center">
                              <div className="w-[5px] h-[5px] rounded-full bg-white" />
                            </div>
                            <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#A78BFA] uppercase tracking-wider">
                              You are here
                            </span>
                            <div className="flex-1 h-px bg-gradient-to-r from-[#6366F1]/40 to-transparent" />
                          </div>,
                        );
                      }

                      elements.push(
                        <TimelineNode
                          key={event.id}
                          event={event}
                          isCurrentDay={isToday}
                        />,
                      );

                      return elements;
                    })}

                    {/* If today is after all events in this month */}
                    {isCurrentMonth && !todayInserted && (
                      <div className="relative flex items-center gap-3 py-2 -ml-8 pl-8">
                        <div className="absolute left-[4px] w-[17px] h-[17px] rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] here-pulse ring-4 ring-[var(--bg)] flex items-center justify-center">
                          <div className="w-[5px] h-[5px] rounded-full bg-white" />
                        </div>
                        <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#A78BFA] uppercase tracking-wider">
                          You are here
                        </span>
                        <div className="flex-1 h-px bg-gradient-to-r from-[#6366F1]/40 to-transparent" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
