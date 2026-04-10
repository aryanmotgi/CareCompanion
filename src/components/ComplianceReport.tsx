'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatedNumber } from './AnimatedNumber'
import { Skeleton } from './Skeleton'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MedicationBreakdown {
  medication_name: string
  expected: number
  taken: number
  missed: number
  snoozed: number
  adherence_percent: number
}

interface ComplianceData {
  period_days: number
  total_expected: number
  total_taken: number
  total_missed: number
  total_snoozed: number
  adherence_percent: number
  by_medication: MedicationBreakdown[]
  streak: number
  worst_time: string | null
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PERIOD_OPTIONS = [7, 30, 90] as const
type Period = (typeof PERIOD_OPTIONS)[number]

const PERIOD_LABELS: Record<Period, string> = {
  7: '7 days',
  30: '30 days',
  90: '90 days',
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function adherenceColor(pct: number): string {
  if (pct >= 90) return '#10b981'
  if (pct >= 70) return '#f59e0b'
  return '#ef4444'
}

function adherenceLabel(pct: number): string {
  if (pct >= 90) return 'Excellent'
  if (pct >= 70) return 'Fair'
  return 'Needs attention'
}

/** Convert "HH:MM" (24h) to a readable 12-hour string. */
function formatTime24(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  let h = parseInt(hStr, 10)
  const m = mStr ?? '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${m} ${ampm}`
}

/* ------------------------------------------------------------------ */
/*  Circular progress ring                                             */
/* ------------------------------------------------------------------ */

function ProgressRing({
  percent,
  size = 160,
  strokeWidth = 10,
}: {
  percent: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference
  const color = adherenceColor(percent)

  return (
    <svg
      width={size}
      height={size}
      className="transform -rotate-90"
      aria-hidden="true"
    >
      {/* background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      {/* progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Per-medication bar                                                 */
/* ------------------------------------------------------------------ */

function MedicationBar({ med }: { med: MedicationBreakdown }) {
  const total = med.expected || 1
  const takenPct = (med.taken / total) * 100
  const snoozedPct = (med.snoozed / total) * 100
  const missedPct = (med.missed / total) * 100
  const color = adherenceColor(med.adherence_percent)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text)] truncate pr-3">
          {med.medication_name}
        </span>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>
          {Math.round(med.adherence_percent)}%
        </span>
      </div>

      <div className="flex h-2.5 rounded-full overflow-hidden bg-white/[0.06]">
        {takenPct > 0 && (
          <div
            className="h-full transition-[width] duration-500 ease-out"
            style={{ width: `${takenPct}%`, backgroundColor: '#10b981' }}
          />
        )}
        {snoozedPct > 0 && (
          <div
            className="h-full transition-[width] duration-500 ease-out"
            style={{ width: `${snoozedPct}%`, backgroundColor: '#f59e0b' }}
          />
        )}
        {missedPct > 0 && (
          <div
            className="h-full transition-[width] duration-500 ease-out"
            style={{ width: `${missedPct}%`, backgroundColor: '#ef4444' }}
          />
        )}
      </div>

      <div className="flex gap-3 text-[10px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10b981]" />
          {med.taken} taken
        </span>
        {med.snoozed > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
            {med.snoozed} snoozed
          </span>
        )}
        {med.missed > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
            {med.missed} missed
          </span>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function ReportSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Period tabs */}
      <Skeleton className="h-10 w-full" />

      {/* Hero card */}
      <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-6">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-40 w-40 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-6">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </div>

      {/* Medication breakdown */}
      <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-2.5 w-full rounded-full" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#6366F1]/10">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6366F1"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5" />
          <path d="M10.5 1.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1-3 0v-1z" />
        </svg>
      </div>

      <h3 className="text-base font-semibold text-[var(--text)] mb-1">
        No reminders set up yet
      </h3>
      <p className="text-sm text-[var(--text-muted)] mb-5">
        Add medication reminders to start tracking your adherence.
      </p>

      <a
        href="/settings"
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Go to Settings
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ComplianceReport() {
  const [period, setPeriod] = useState<Period>(7)
  const [data, setData] = useState<ComplianceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchReport = useCallback(async (days: Period) => {
    setLoading(true)
    setError(null)
    setIsEmpty(false)

    try {
      const res = await fetch(`/api/compliance/report?days=${days}`)
      if (!res.ok) throw new Error('Failed to load compliance data')

      const json = await res.json()
      const report: ComplianceData = json.data

      if (report.total_expected === 0) {
        setIsEmpty(true)
        setData(null)
      } else {
        setData(report)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReport(period)
  }, [period, fetchReport])

  /* ---- Period selector tabs ---- */
  const periodTabs = (
    <div className="flex bg-white/[0.04] rounded-[14px] p-[3px] border border-white/[0.08]">
      {PERIOD_OPTIONS.map((days) => (
        <button
          key={days}
          onClick={() => setPeriod(days)}
          className={`flex-1 text-center py-2 px-4 min-h-[44px] rounded-[11px] text-[13px] font-semibold transition-all duration-200 ${
            days === period
              ? 'bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white shadow-lg shadow-[#6366F1]/20'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
          aria-pressed={days === period}
        >
          {PERIOD_LABELS[days]}
        </button>
      ))}
    </div>
  )

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="space-y-5">
        {periodTabs}
        <ReportSkeleton />
      </div>
    )
  }

  /* ---- Error state ---- */
  if (error) {
    return (
      <div className="space-y-5">
        {periodTabs}
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-6 text-center">
          <p className="text-sm text-[#ef4444] mb-3">{error}</p>
          <button
            onClick={() => fetchReport(period)}
            className="text-sm font-semibold text-[#6366F1] hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  /* ---- Empty state ---- */
  if (isEmpty || !data) {
    return (
      <div className="space-y-5">
        {periodTabs}
        <EmptyState />
      </div>
    )
  }

  /* ---- Data state ---- */
  const pct = Math.round(data.adherence_percent)
  const color = adherenceColor(pct)

  return (
    <div className="space-y-5">
      {periodTabs}

      {/* Hero adherence card */}
      <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-6">
        <div className="flex flex-col items-center">
          <div className="relative">
            <ProgressRing percent={pct} />
            {/* Centered text overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold tabular-nums" style={{ color }}>
                <AnimatedNumber value={pct} suffix="%" duration={900} />
              </span>
              <span className="text-xs text-[var(--text-muted)] mt-0.5">
                {adherenceLabel(pct)}
              </span>
            </div>
          </div>

          <p className="text-xs text-[var(--text-muted)] mt-3">
            {data.total_taken} of {data.total_expected} doses taken
          </p>
        </div>

        {/* Streak + worst time insights */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          {/* Streak */}
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              {/* Flame icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
              <span className="text-xl font-bold text-[var(--text)] tabular-nums">
                {data.streak}
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
              Day streak
            </p>
          </div>

          {/* Worst time */}
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              {/* Clock icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#A78BFA"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {data.worst_time ? (
                <span className="text-sm font-bold text-[var(--text)]">
                  {formatTime24(data.worst_time)}
                </span>
              ) : (
                <span className="text-sm font-semibold text-[#10b981]">
                  None
                </span>
              )}
            </div>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
              {data.worst_time ? 'Most missed' : 'No misses'}
            </p>
          </div>
        </div>

        {data.worst_time && (
          <p className="text-xs text-[var(--text-muted)] text-center mt-3">
            You most often miss your{' '}
            <span className="font-medium text-[var(--text-secondary)]">
              {formatTime24(data.worst_time)}
            </span>{' '}
            dose
          </p>
        )}
      </div>

      {/* Per-medication breakdown */}
      {data.by_medication.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-5">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">
            By Medication
          </h3>

          <div className="space-y-5">
            {data.by_medication.map((med) => (
              <MedicationBar key={med.medication_name} med={med} />
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-5 pt-4 border-t border-white/[0.06]">
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
              <span className="inline-block w-2 h-2 rounded-full bg-[#10b981]" />
              Taken
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
              <span className="inline-block w-2 h-2 rounded-full bg-[#f59e0b]" />
              Snoozed
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
              <span className="inline-block w-2 h-2 rounded-full bg-[#ef4444]" />
              Missed
            </span>
          </div>
        </div>
      )}

      {/* Summary stats row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-2.5 sm:p-3 text-center">
          <p className="text-base sm:text-lg font-bold text-[#10b981] tabular-nums">
            {data.total_taken}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
            Taken
          </p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-2.5 sm:p-3 text-center">
          <p className="text-base sm:text-lg font-bold text-[#f59e0b] tabular-nums">
            {data.total_snoozed}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
            Snoozed
          </p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-2.5 sm:p-3 text-center">
          <p className="text-base sm:text-lg font-bold text-[#ef4444] tabular-nums">
            {data.total_missed}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
            Missed
          </p>
        </div>
      </div>
    </div>
  )
}
