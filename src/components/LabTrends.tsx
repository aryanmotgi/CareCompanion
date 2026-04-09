'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { LabTrendChart } from './LabTrendChart'

/* ─── Types ─── */

interface TrendValue {
  value: number
  date: string
}

interface TrendAlert {
  severity: 'critical' | 'warning' | 'info'
  message: string
  action: string
}

interface LabTrend {
  test_name: string
  trend: 'improving' | 'stable' | 'declining' | 'rapid_decline' | 'insufficient_data'
  current_value: number | null
  previous_value: number | null
  change_percent: number | null
  values: TrendValue[]
  alerts: TrendAlert[]
  prediction_7d: number | null
}

interface LabTrendsResponse {
  data: {
    trends: LabTrend[]
    red_flags: Array<{ message: string }>
    overall_status: 'good' | 'monitor' | 'concerning' | 'critical'
  }
}

/* ─── Constants ─── */

const STATUS_CONFIG = {
  good: { label: 'Good', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  monitor: { label: 'Monitor', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  concerning: { label: 'Concerning', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  critical: { label: 'Critical', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
} as const

const TREND_CONFIG = {
  improving: { label: 'Improving', color: '#10b981' },
  stable: { label: 'Stable', color: '#6366F1' },
  declining: { label: 'Declining', color: '#f59e0b' },
  rapid_decline: { label: 'Rapid Decline', color: '#ef4444' },
  insufficient_data: { label: 'Insufficient Data', color: '#64748b' },
} as const

const ALERT_BADGE = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  info: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
} as const

/* ─── Trend Arrow Icons ─── */

function TrendArrow({ trend }: { trend: LabTrend['trend'] }) {
  const color = TREND_CONFIG[trend].color

  if (trend === 'improving') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 12L13 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M7 4H13V10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (trend === 'stable') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 8H14" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M10 5L14 8L10 11" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (trend === 'declining') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 4L13 12" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M7 12H13V6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (trend === 'rapid_decline') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 2L8 8L4 8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 6L12 12L8 12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  // insufficient_data
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="4" cy="8" r="1.5" fill={color} />
      <circle cx="8" cy="8" r="1.5" fill={color} />
      <circle cx="12" cy="8" r="1.5" fill={color} />
    </svg>
  )
}

/* ─── Mini Sparkline ─── */

function MiniSparkline({
  values,
  prediction7d,
  trend,
}: {
  values: TrendValue[]
  prediction7d: number | null
  trend: LabTrend['trend']
}) {
  if (values.length < 2) {
    return (
      <div className="flex items-center justify-center h-10 text-[10px] text-[var(--text-muted,#64748b)]">
        Not enough data
      </div>
    )
  }

  const width = 120
  const height = 40
  const padding = 4

  const allValues = values.map((v) => v.value)
  if (prediction7d !== null) allValues.push(prediction7d)

  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)
  const range = maxVal - minVal || 1

  const toX = (i: number, total: number) =>
    padding + (i / (total - 1)) * (width - padding * 2)
  const toY = (val: number) =>
    height - padding - ((val - minVal) / range) * (height - padding * 2)

  // Main polyline points
  const points = values
    .map((v, i) => `${toX(i, values.length)},${toY(v.value)}`)
    .join(' ')

  const strokeColor = TREND_CONFIG[trend].color

  // Prediction dashed line
  let predictionLine: string | null = null
  if (prediction7d !== null && values.length >= 1) {
    const lastX = toX(values.length - 1, values.length)
    const lastY = toY(values[values.length - 1].value)
    const predX = width - padding
    const predY = toY(prediction7d)
    predictionLine = `${lastX},${lastY} ${predX},${predY}`
  }

  // Gradient fill
  const gradientId = `sparkGrad-${trend}`
  const fillPoints = [
    `${toX(0, values.length)},${height - padding}`,
    ...values.map((v, i) => `${toX(i, values.length)},${toY(v.value)}`),
    `${toX(values.length - 1, values.length)},${height - padding}`,
  ].join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="flex-shrink-0"
      aria-label={`Sparkline showing ${trend} trend`}
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Fill area */}
      <polygon points={fillPoints} fill={`url(#${gradientId})`} />

      {/* Main line */}
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Current value dot */}
      <circle
        cx={toX(values.length - 1, values.length)}
        cy={toY(values[values.length - 1].value)}
        r="2.5"
        fill={strokeColor}
      />

      {/* Prediction dashed extension */}
      {predictionLine && (
        <>
          <polyline
            points={predictionLine}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="3 3"
            opacity="0.5"
          />
          <circle
            cx={width - padding}
            cy={toY(prediction7d!)}
            r="2"
            fill={strokeColor}
            opacity="0.5"
          />
        </>
      )}
    </svg>
  )
}

/* ─── Skeleton ─── */

function LabTrendsSkeleton() {
  return (
    <div className="space-y-3">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-5 w-28 skeleton-bone rounded" />
        <div className="h-5 w-16 skeleton-bone rounded-full" />
      </div>
      {/* Card skeletons */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl bg-white/[0.02] border border-white/[0.04] p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 skeleton-bone rounded" style={{ animationDelay: `${i * 0.1}s` }} />
            <div className="h-4 w-16 skeleton-bone rounded" style={{ animationDelay: `${i * 0.1 + 0.05}s` }} />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-6 w-32 skeleton-bone rounded" style={{ animationDelay: `${i * 0.1 + 0.1}s` }} />
            <div className="h-10 w-[120px] skeleton-bone rounded" style={{ animationDelay: `${i * 0.1 + 0.15}s` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Empty State ─── */

function EmptyState() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-8 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.06] flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 12h4l3-9 4 18 3-9h4"
            stroke="#64748b"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-[var(--text,#f1f5f9)]">No lab trends yet</p>
      <p className="text-xs text-[var(--text-muted,#64748b)] mt-1">
        Lab trends will appear here once you have enough results to track changes over time.
      </p>
    </div>
  )
}

/* ─── Trend Card ─── */

function TrendCard({ trend }: { trend: LabTrend }) {
  const config = TREND_CONFIG[trend.trend]
  const isPositive = trend.trend === 'improving'
  const isNegative = trend.trend === 'declining' || trend.trend === 'rapid_decline'
  const changeColor = isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-[var(--text-secondary,#94a3b8)]'

  const chatPrompt = `Tell me about my ${trend.test_name} trend. It is currently ${trend.trend}${
    trend.current_value !== null ? ` at ${trend.current_value}` : ''
  }${trend.change_percent !== null ? ` with a ${trend.change_percent}% change` : ''}.`

  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-4 space-y-3">
      {/* Header row: test name + trend badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendArrow trend={trend.trend} />
          <span className="text-sm font-semibold text-[var(--text,#f1f5f9)]">
            {trend.test_name}
          </span>
        </div>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
          style={{
            color: config.color,
            borderColor: `${config.color}33`,
            backgroundColor: `${config.color}1a`,
          }}
        >
          {config.label}
        </span>
      </div>

      {/* Values + sparkline row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          {trend.current_value !== null ? (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg font-bold text-[var(--text,#f1f5f9)] tabular-nums">
                {trend.current_value}
              </span>
              {trend.previous_value !== null && (
                <span className="text-xs text-[var(--text-muted,#64748b)]">
                  from {trend.previous_value}
                </span>
              )}
              {trend.change_percent !== null && (
                <span className={`text-xs font-medium tabular-nums ${changeColor}`}>
                  {trend.change_percent > 0 ? '+' : ''}
                  {trend.change_percent.toFixed(1)}%
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-[var(--text-muted,#64748b)]">No current value</span>
          )}

          {/* 7-day prediction */}
          {trend.prediction_7d !== null && (
            <p className="text-[10px] text-[var(--text-muted,#64748b)] mt-0.5">
              7-day prediction: <span className="text-[var(--text-secondary,#94a3b8)] font-medium">{trend.prediction_7d}</span>
            </p>
          )}
        </div>

        <MiniSparkline
          values={trend.values}
          prediction7d={trend.prediction_7d}
          trend={trend.trend}
        />
      </div>

      {/* Inline alerts */}
      {trend.alerts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {trend.alerts.map((alert, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${ALERT_BADGE[alert.severity]}`}
              title={alert.action}
            >
              {alert.severity === 'critical' && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5 3v2.5M5 7h.005" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              )}
              {alert.message}
            </span>
          ))}
        </div>
      )}

      {/* Discuss with AI */}
      <Link
        href={`/chat?prompt=${encodeURIComponent(chatPrompt)}`}
        className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] font-medium text-[var(--text-secondary,#94a3b8)] hover:text-[var(--text,#f1f5f9)] transition-all"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M6 1C3.24 1 1 3.02 1 5.5c0 1.3.63 2.47 1.63 3.28L2 10.5l2.13-.95C4.7 9.82 5.33 10 6 10c2.76 0 5-2.02 5-4.5S8.76 1 6 1z"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Discuss with AI
      </Link>
    </div>
  )
}

/* ─── Main Component ─── */

export function LabTrends() {
  const [data, setData] = useState<LabTrendsResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'chart' | 'cards'>('chart')
  const [selectedTest, setSelectedTest] = useState<string | null>(null)

  const fetchTrends = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/labs/trends')
      if (!res.ok) throw new Error(`Failed to fetch lab trends (${res.status})`)
      const json: LabTrendsResponse = await res.json()
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrends()
  }, [fetchTrends])

  if (loading) {
    return (
      <section className="space-y-4" aria-label="Lab Trends">
        <LabTrendsSkeleton />
      </section>
    )
  }

  if (error) {
    return (
      <section className="space-y-4" aria-label="Lab Trends">
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-5 text-center">
          <p className="text-sm text-red-400 mb-2">{error}</p>
          <button
            onClick={fetchTrends}
            className="text-xs font-medium text-[#6366F1] hover:text-[#A78BFA] transition-colors"
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (!data || data.trends.length === 0) {
    return (
      <section className="space-y-4" aria-label="Lab Trends">
        <EmptyState />
      </section>
    )
  }

  const statusConfig = STATUS_CONFIG[data.overall_status]

  // Build chart data from trends
  const chartTrends = (selectedTest
    ? data.trends.filter((t) => t.test_name === selectedTest)
    : data.trends
  ).map((t) => ({
    test_name: t.test_name,
    values: t.values,
    trend: t.trend,
    prediction: t.prediction_7d ?? undefined,
  }))

  return (
    <section className="space-y-4" aria-label="Lab Trends">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--text,#f1f5f9)]">Lab Trends</h2>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg bg-white/[0.04] border border-white/[0.06] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('chart')}
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                viewMode === 'chart'
                  ? 'bg-[#6366F1]/20 text-[#A78BFA]'
                  : 'text-[#64748b] hover:text-[#94a3b8]'
              }`}
            >
              Chart
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                viewMode === 'cards'
                  ? 'bg-[#6366F1]/20 text-[#A78BFA]'
                  : 'text-[#64748b] hover:text-[#94a3b8]'
              }`}
            >
              Cards
            </button>
          </div>
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Interactive chart view */}
      {viewMode === 'chart' && data.trends.length > 0 && (
        <div className="space-y-3">
          {/* Test filter pills */}
          {data.trends.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedTest(null)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border ${
                  selectedTest === null
                    ? 'bg-[#6366F1]/20 text-[#A78BFA] border-[#6366F1]/30'
                    : 'bg-white/[0.04] text-[#64748b] border-white/[0.06] hover:bg-white/[0.08]'
                }`}
              >
                All
              </button>
              {data.trends.map((t) => (
                <button
                  key={t.test_name}
                  type="button"
                  onClick={() => setSelectedTest(t.test_name === selectedTest ? null : t.test_name)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border ${
                    selectedTest === t.test_name
                      ? 'bg-[#6366F1]/20 text-[#A78BFA] border-[#6366F1]/30'
                      : 'bg-white/[0.04] text-[#64748b] border-white/[0.06] hover:bg-white/[0.08]'
                  }`}
                >
                  {t.test_name}
                </button>
              ))}
            </div>
          )}

          <LabTrendChart trends={chartTrends} />
        </div>
      )}

      {/* Red flags */}
      {data.red_flags.length > 0 && (
        <div className="space-y-2" role="alert">
          {data.red_flags.map((flag, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-3"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="flex-shrink-0 mt-0.5"
                aria-hidden="true"
              >
                <path
                  d="M8 1.5L1.5 13h13L8 1.5z"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M8 6v3M8 11h.005" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-xs text-red-300 leading-relaxed">{flag.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Trend cards */}
      {viewMode === 'cards' && (
        <div className="space-y-3">
          {data.trends.map((trend) => (
            <TrendCard key={trend.test_name} trend={trend} />
          ))}
        </div>
      )}
    </section>
  )
}
