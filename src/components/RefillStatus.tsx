'use client'

import { useState, useEffect, useCallback } from 'react'

interface RefillMedication {
  medication_id: string
  medication_name: string
  dose: string | null
  refill_date: string | null
  days_until_refill: number | null
  status: 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'ok' | 'unknown'
  pharmacy_phone: string | null
  prescribing_doctor: string | null
}

const STATUS_CONFIG = {
  overdue: {
    label: 'Overdue',
    bg: 'bg-[rgba(239,68,68,0.12)]',
    text: 'text-[#ef4444]',
    border: 'border-[rgba(239,68,68,0.3)]',
    dot: 'bg-[#ef4444]',
    pulse: false,
    sortOrder: 0,
  },
  due_today: {
    label: 'Due Today',
    bg: 'bg-[rgba(239,68,68,0.10)]',
    text: 'text-[#ef4444]',
    border: 'border-[rgba(239,68,68,0.25)]',
    dot: 'bg-[#ef4444]',
    pulse: true,
    sortOrder: 1,
  },
  due_soon: {
    label: 'Due Soon',
    bg: 'bg-[rgba(245,158,11,0.10)]',
    text: 'text-[#f59e0b]',
    border: 'border-[rgba(245,158,11,0.25)]',
    dot: 'bg-[#f59e0b]',
    pulse: false,
    sortOrder: 2,
  },
  upcoming: {
    label: 'Upcoming',
    bg: 'bg-[rgba(99,102,241,0.10)]',
    text: 'text-[#818CF8]',
    border: 'border-[rgba(99,102,241,0.25)]',
    dot: 'bg-[#818CF8]',
    pulse: false,
    sortOrder: 3,
  },
  ok: {
    label: 'Filled',
    bg: 'bg-[rgba(16,185,129,0.10)]',
    text: 'text-[#10b981]',
    border: 'border-[rgba(16,185,129,0.25)]',
    dot: 'bg-[#10b981]',
    pulse: false,
    sortOrder: 4,
  },
  unknown: {
    label: 'Unknown',
    bg: 'bg-white/[0.06]',
    text: 'text-[var(--text-muted,#9ca3af)]',
    border: 'border-white/[0.10]',
    dot: 'bg-gray-400',
    pulse: false,
    sortOrder: 5,
  },
} as const

function formatDaysUntilRefill(med: RefillMedication): string {
  if (med.status === 'overdue') return 'Overdue'
  if (med.status === 'due_today') return 'Due today'
  if (med.status === 'unknown') return 'No refill date'
  if (med.days_until_refill === null) return 'No refill date'
  if (med.days_until_refill === 1) return '1 day'
  return `${med.days_until_refill} days`
}

function sortByUrgency(a: RefillMedication, b: RefillMedication): number {
  const orderA = STATUS_CONFIG[a.status].sortOrder
  const orderB = STATUS_CONFIG[b.status].sortOrder
  if (orderA !== orderB) return orderA - orderB
  // Secondary sort: fewer days = more urgent
  const daysA = a.days_until_refill ?? 9999
  const daysB = b.days_until_refill ?? 9999
  return daysA - daysB
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
      <div className="w-2 h-2 rounded-full bg-white/[0.06]" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-32 rounded bg-white/[0.06]" />
        <div className="h-2.5 w-20 rounded bg-white/[0.04]" />
      </div>
      <div className="h-3 w-16 rounded bg-white/[0.04]" />
    </div>
  )
}

export function RefillStatusCard() {
  const [medications, setMedications] = useState<RefillMedication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRefills = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/refills/status')
      if (!res.ok) {
        throw new Error(`Failed to fetch refill status (${res.status})`)
      }
      const json = await res.json()
      const sorted = [...(json.data ?? [])].sort(sortByUrgency)
      setMedications(sorted)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRefills()
  }, [fetchRefills])

  const urgentCount = medications.filter(
    (m) => m.status === 'overdue' || m.status === 'due_today' || m.status === 'due_soon'
  ).length

  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366F1]/20 to-[#A78BFA]/20">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#A78BFA]">
              <path
                d="M5.5 1v2.5m5-2.5v2.5M2 6h12M3.5 3h9a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-8A1.5 1.5 0 013.5 3z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="5.5" cy="9" r="0.75" fill="currentColor" />
              <circle cx="8" cy="9" r="0.75" fill="currentColor" />
              <circle cx="10.5" cy="9" r="0.75" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text,#f0f0f0)]">
              Refill Status
            </h3>
            {!loading && !error && medications.length > 0 && (
              <p className="text-[11px] text-[var(--text-muted,#9ca3af)] mt-0.5">
                {urgentCount > 0
                  ? `${urgentCount} need${urgentCount === 1 ? 's' : ''} attention`
                  : 'All medications on track'}
              </p>
            )}
          </div>
        </div>
        {!loading && !error && (
          <button
            onClick={fetchRefills}
            className="text-[11px] text-[var(--text-secondary,#a78bfa)] hover:text-[#c4b5fd] transition-colors"
            aria-label="Refresh refill status"
          >
            Refresh
          </button>
        )}
      </div>

      {/* Content */}
      <div className="pb-2">
        {loading && (
          <div>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )}

        {error && (
          <div className="px-5 py-6 text-center">
            <div className="w-10 h-10 rounded-full bg-[rgba(239,68,68,0.10)] flex items-center justify-center mx-auto mb-3">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-[#ef4444]">
                <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3" />
                <path d="M9 5.5v4M9 11.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm text-[var(--text-muted,#9ca3af)] mb-3">{error}</p>
            <button
              onClick={fetchRefills}
              className="text-xs font-medium text-[#A78BFA] hover:text-[#c4b5fd] transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && medications.length === 0 && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <p className="text-sm text-[#94a3b8]">No refills to track yet</p>
            <p className="text-xs text-[#64748b] mt-1">
              <a href="/medications" className="text-[#A78BFA] hover:underline">Add medications</a> with refill dates to see their status here
            </p>
          </div>
        )}

        {!loading && !error && medications.length > 0 && (
          <div className="divide-y divide-white/[0.04]">
            {medications.map((med) => {
              const config = STATUS_CONFIG[med.status]
              return (
                <div
                  key={med.medication_id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Status dot */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                    {config.pulse && (
                      <div className={`absolute inset-0 w-2 h-2 rounded-full ${config.dot} animate-ping opacity-75`} />
                    )}
                  </div>

                  {/* Medication info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text,#f0f0f0)] truncate">
                        {med.medication_name}
                      </span>
                      {med.dose && (
                        <span className="text-[11px] text-[var(--text-muted,#9ca3af)] flex-shrink-0">
                          {med.dose}
                        </span>
                      )}
                    </div>
                    {med.prescribing_doctor && (
                      <p className="text-[11px] text-[var(--text-muted,#9ca3af)] opacity-60 mt-0.5 truncate">
                        Dr. {med.prescribing_doctor}
                      </p>
                    )}
                  </div>

                  {/* Status + actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${config.bg} ${config.text} border ${config.border}`}
                      >
                        {config.label}
                      </span>
                      <p className="text-[10px] text-[var(--text-muted,#9ca3af)] mt-0.5 text-right">
                        {formatDaysUntilRefill(med)}
                      </p>
                    </div>

                    {med.pharmacy_phone && (
                      <a
                        href={`tel:${med.pharmacy_phone}`}
                        className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
                        aria-label={`Call pharmacy for ${med.medication_name}`}
                        title={`Call ${med.pharmacy_phone}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#10b981]">
                          <path
                            d="M1.5 2.5A1 1 0 012.5 1.5h1.382a.5.5 0 01.474.342l.652 1.955a.5.5 0 01-.154.536L3.691 5.496a6.5 6.5 0 002.813 2.813l1.163-1.163a.5.5 0 01.536-.154l1.955.652a.5.5 0 01.342.474V9.5a1 1 0 01-1 1A8.5 8.5 0 011.5 2.5z"
                            stroke="currentColor"
                            strokeWidth="1.1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
