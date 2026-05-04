'use client'

import { useState, useMemo } from 'react'
import type { LabResult } from '@/lib/types'
import { LabInterpretation } from '@/components/LabInterpretation'
import { LabTrends } from '@/components/LabTrends'
import { SectionEmptyState } from '@/components/SectionEmptyState'

type Filter = 'all' | 'abnormal' | 'recent'

function formatDateHeading(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function LabsView({ labResults, patientName = 'your loved one' }: { labResults: LabResult[]; patientName?: string }) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    switch (filter) {
      case 'abnormal':
        return labResults.filter((r) => r.isAbnormal)
      case 'recent':
        return labResults.filter((r) => {
          if (!r.dateTaken) return false
          // Append T00:00:00 so bare YYYY-MM-DD strings are parsed as local midnight, not UTC midnight
          const d = new Date(r.dateTaken.includes('T') ? r.dateTaken : r.dateTaken + 'T00:00:00')
          return !isNaN(d.getTime()) && d >= thirtyDaysAgo
        })
      default:
        return labResults
    }
  }, [labResults, filter])

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, LabResult[]> = {}
    for (const lab of filtered) {
      const key = lab.dateTaken ?? 'Unknown date'
      if (!groups[key]) groups[key] = []
      groups[key].push(lab)
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Unknown date') return 1
      if (b === 'Unknown date') return -1
      return b.localeCompare(a)
    })
  }, [filtered])

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: labResults.length },
    { key: 'abnormal', label: 'Abnormal', count: labResults.filter((r) => r.isAbnormal).length },
    { key: 'recent', label: 'Recent' },
  ]

  return (
    <div className="px-4 sm:px-5 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Lab Results</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Understand your lab work with plain-language interpretations
        </p>
      </div>

      {/* Trends */}
      <LabTrends />

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-5 sm:px-5 scrollbar-none flex-nowrap">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 min-h-[44px] rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
              filter === f.key
                ? 'bg-[#6366F1]/20 text-[#A78BFA] border border-[#6366F1]/30'
                : 'bg-white/[0.04] text-[var(--text-muted)] border border-white/[0.06] hover:bg-white/[0.08]'
            }`}
          >
            {f.label}
            {f.count !== undefined && (
              <span className="ml-1.5 opacity-60">{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Results grouped by date */}
      {grouped.length === 0 ? (
        <EmptyState filter={filter} patientName={patientName} />
      ) : (
        <div className="space-y-8">
          {grouped.map(([date, labs], groupIdx) => (
            <div key={date}>
              {/* Date heading */}
              <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                {date === 'Unknown date' ? 'Unknown Date' : formatDateHeading(date)}
              </h2>

              {/* Lab cards with staggered fade-in */}
              <div className="space-y-3">
                {labs.map((lab, idx) => (
                  <div
                    key={lab.id}
                    className="animate-fade-in"
                    style={{
                      animationDelay: `${(groupIdx * labs.length + idx) * 60}ms`,
                      animationFillMode: 'backwards',
                    }}
                  >
                    <LabInterpretation labResult={lab} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ filter, patientName }: { filter: Filter; patientName: string }) {
  if (filter === 'all') {
    return (
      <SectionEmptyState
        patientName={patientName}
        icon={
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
          </svg>
        }
        heading="Lab results tell [patient name]'s health story"
        body="Upload a PDF or photo and I'll read and explain it."
        actionHref="/scans"
        actionLabel="Scan a Lab Report"
      />
    )
  }

  const messages: Record<Exclude<Filter, 'all'>, { title: string; body: string; hint?: string }> = {
    abnormal: {
      title: 'No abnormal results',
      body: 'Great news! None of your lab results are flagged as abnormal.',
    },
    recent: {
      title: 'No recent results',
      body: 'No lab results from the past 30 days. Check back after your next lab work.',
    },
  }

  const msg = messages[filter]

  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-8 text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#6366F1]/10 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-[#A78BFA]"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
          />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-[var(--text)] mb-1">{msg.title}</h3>
      <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
        {msg.body}
      </p>
      {msg.hint && (
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          {msg.hint}
        </p>
      )}
    </div>
  )
}
