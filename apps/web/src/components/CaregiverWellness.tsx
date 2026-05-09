'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

/* ─── Types ─── */
type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'
type SignalCategory = 'sleep' | 'mood' | 'energy' | 'pain' | 'isolation' | 'overload'

interface BurnoutSignal {
  category: SignalCategory
  signal: string
  weight: number
}

interface BurnoutData {
  score: number
  risk_level: RiskLevel
  signals: BurnoutSignal[]
  recommendations: string[]
  last_assessed: string
}

/* ─── Constants ─── */
const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; message: string }> = {
  low: {
    label: 'You\u2019re doing well',
    color: '#10b981',
    message: 'Your wellness looks steady. Keep taking care of yourself \u2014 you deserve it.',
  },
  moderate: {
    label: 'Worth watching',
    color: '#f59e0b',
    message: 'Some signs of strain are showing. Small acts of rest can make a big difference.',
  },
  high: {
    label: 'Needs attention',
    color: '#f97316',
    message: 'You\u2019re carrying a lot right now. Please be gentle with yourself.',
  },
  critical: {
    label: 'Please reach out',
    color: '#ef4444',
    message: 'You matter too. Consider talking to someone you trust or a professional today.',
  },
}

const CATEGORY_META: Record<SignalCategory, { icon: React.ReactNode; label: string }> = {
  sleep: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
    label: 'Sleep',
  },
  mood: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
    label: 'Mood',
  },
  energy: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    label: 'Energy',
  },
  pain: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    label: 'Pain',
  },
  isolation: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    label: 'Isolation',
  },
  overload: {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="10" y1="14" x2="14" y2="14" />
        <line x1="10" y1="18" x2="14" y2="18" />
      </svg>
    ),
    label: 'Overload',
  },
}

/* ─── Gauge Component ─── */
function WellnessGauge({ score, riskLevel }: { score: number; riskLevel: RiskLevel }) {
  const config = RISK_CONFIG[riskLevel]
  const radius = 54
  const stroke = 10
  const circumference = 2 * Math.PI * radius
  // Invert: wellness = 100 - burnout score
  const wellness = 100 - score
  const progress = (wellness / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-[140px] h-[140px]">
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          {/* Background track */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          {/* Progress arc */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={config.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${config.color}40)` }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-bold tabular-nums transition-colors duration-500"
            style={{ color: config.color }}
          >
            {wellness}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
            wellness
          </span>
        </div>
      </div>
      <span
        className="text-sm font-medium px-3 py-0.5 rounded-full"
        style={{
          color: config.color,
          backgroundColor: `${config.color}15`,
        }}
      >
        {config.label}
      </span>
    </div>
  )
}

/* ─── Signal Chips ─── */
function SignalChips({ signals }: { signals: BurnoutSignal[] }) {
  // Group by category
  const grouped = signals.reduce<Record<string, BurnoutSignal[]>>((acc, s) => {
    ;(acc[s.category] ??= []).push(s)
    return acc
  }, {})

  const categories = Object.keys(grouped) as SignalCategory[]

  if (categories.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
        What we noticed
      </p>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat]
          return grouped[cat].map((signal, i) => (
            <div
              key={`${cat}-${i}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs text-[var(--text-secondary)]"
              title={signal.signal}
            >
              <span className="text-[#A78BFA] flex-shrink-0">{meta.icon}</span>
              <span className="truncate max-w-[180px]">{signal.signal}</span>
            </div>
          ))
        })}
      </div>
    </div>
  )
}

/* ─── Recommendations ─── */
function Recommendations({ items }: { items: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const toggleCheck = (idx: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left group"
      >
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
          Gentle suggestions
        </p>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-[var(--text-muted)] transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 pt-1">
            {items.map((rec, i) => (
              <button
                key={i}
                onClick={() => toggleCheck(i)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                  checked.has(i)
                    ? 'bg-[#10b981]/10 border-[#10b981]/20'
                    : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'
                }`}
              >
                <div
                  className={`mt-0.5 w-4.5 h-4.5 flex-shrink-0 rounded-md border flex items-center justify-center transition-all duration-200 ${
                    checked.has(i)
                      ? 'bg-[#10b981] border-[#10b981]'
                      : 'border-white/[0.2] bg-transparent'
                  }`}
                >
                  {checked.has(i) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-sm leading-relaxed transition-colors duration-200 ${
                    checked.has(i) ? 'text-[#10b981] line-through opacity-70' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {rec}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Loading Skeleton ─── */
function WellnessSkeleton() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-white/[0.06]" />
        <div className="h-4 w-40 rounded bg-white/[0.06]" />
      </div>
      {/* Gauge placeholder */}
      <div className="flex justify-center">
        <div className="w-[140px] h-[140px] rounded-full bg-white/[0.04]" />
      </div>
      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-7 w-24 rounded-full bg-white/[0.04]" />
        ))}
      </div>
      {/* Recs */}
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-white/[0.06]" />
        <div className="h-12 w-full rounded-xl bg-white/[0.03]" />
        <div className="h-12 w-full rounded-xl bg-white/[0.03]" />
      </div>
    </div>
  )
}

/* ─── Empty State ─── */
function EmptyState() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-6">
      <div className="flex flex-col items-center text-center py-6 space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#A78BFA]/10 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[var(--text)]">
            Your wellness matters too
          </p>
          <p className="text-xs text-[var(--text-muted)] max-w-[240px] leading-relaxed">
            Start journaling how you feel each day, and we&apos;ll gently track your wellness over time. No judgment, ever.
          </p>
        </div>
        <Link
          href="/journal"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6366F1] text-white text-sm font-medium hover:bg-[#6366F1]/90 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Start journaling
        </Link>
      </div>
    </div>
  )
}

/* ─── Main Component ─── */
export function CaregiverWellness() {
  const [data, setData] = useState<BurnoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchBurnout = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/caregiver/burnout')
      if (!res.ok) {
        if (res.status === 404) {
          setIsEmpty(true)
          return
        }
        throw new Error('Failed to fetch')
      }
      const json = await res.json()
      if (!json.data || json.data.signals?.length === 0) {
        setIsEmpty(true)
        return
      }
      setData(json.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBurnout()
  }, [fetchBurnout])

  if (loading) return <WellnessSkeleton />
  if (isEmpty) return <EmptyState />
  if (error || !data) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-6">
        <div className="flex flex-col items-center text-center py-4 space-y-3">
          <p className="text-sm text-[var(--text-muted)]">
            We couldn&apos;t load your wellness check right now.
          </p>
          <button
            onClick={fetchBurnout}
            className="text-xs text-[#6366F1] hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const riskConfig = RISK_CONFIG[data.risk_level]
  const assessedDate = new Date(data.last_assessed)
  const timeAgo = getRelativeTime(assessedDate)

  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#A78BFA]/20 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Your Wellness
          </h3>
        </div>
        <span className="text-[10px] text-[var(--text-muted)]">
          {timeAgo}
        </span>
      </div>

      {/* Gauge */}
      <WellnessGauge score={data.score} riskLevel={data.risk_level} />

      {/* Supportive message */}
      <p className="text-center text-xs text-[var(--text-muted)] leading-relaxed max-w-[280px] mx-auto">
        {riskConfig.message}
      </p>

      {/* Signals */}
      <SignalChips signals={data.signals} />

      {/* Recommendations */}
      <Recommendations items={data.recommendations} />

      {/* Journal CTA */}
      <div className="pt-2">
        <Link
          href="/journal"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#A78BFA] text-sm font-medium hover:bg-[#6366F1]/15 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Log how you&apos;re feeling
        </Link>
      </div>
    </div>
  )
}

/* ─── Helpers ─── */
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
