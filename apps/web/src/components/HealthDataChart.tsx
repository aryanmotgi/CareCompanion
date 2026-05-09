'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
} from 'recharts'

interface TrendValue {
  date: string
  value: number
}

interface LabTrend {
  test_name: string
  unit: string | null
  values: TrendValue[]
}

// Only ref ranges — per-metric colors removed (all lines use Vital Cyan per DESIGN.md Semantic Lock)
const METRIC_CONFIG: Record<string, { refLow: number; refHigh: number }> = {
  'Hemoglobin': { refLow: 12, refHigh: 17 },
  'Blood Glucose': { refLow: 70, refHigh: 100 },
  'Glucose': { refLow: 70, refHigh: 100 },
  'Fasting Glucose': { refLow: 70, refHigh: 100 },
  'Platelets': { refLow: 150, refHigh: 400 },
  'Platelet Count': { refLow: 150, refHigh: 400 },
  'WBC': { refLow: 4, refHigh: 11 },
  'White Blood Cells': { refLow: 4, refHigh: 11 },
  'Creatinine': { refLow: 0.6, refHigh: 1.2 },
  'ALT': { refLow: 7, refHigh: 56 },
}

// DESIGN.md Semantic Lock colors
const VITAL_CYAN = '#67E8F9'
const ALERT_ROSE = '#FCA5A5'
const CLEAR_SIGNAL = '#6EE7B7'
const CAUTION_AMBER = '#FCD34D'
const TEXT_MUTED = '#5B6785'
const TEXT_SECONDARY = '#A5B4CF'
const TRUST_INDIGO = '#6366F1'
const MIDNIGHT_BASE = '#0C0E1A'

type LabStatus = 'normal' | 'low' | 'high' | 'critical'

function getRefRange(testName: string): { low: number; high: number } | null {
  const cfg = METRIC_CONFIG[testName]
  return cfg ? { low: cfg.refLow, high: cfg.refHigh } : null
}

function getStatus(val: number, ref: { low: number; high: number }): LabStatus {
  const range = ref.high - ref.low
  if (val < ref.low - range * 0.3 || val > ref.high + range * 0.3) return 'critical'
  if (val < ref.low) return 'low'
  if (val > ref.high) return 'high'
  return 'normal'
}

function statusColor(status: LabStatus): string {
  if (status === 'normal') return CLEAR_SIGNAL
  if (status === 'critical') return ALERT_ROSE
  return CAUTION_AMBER
}

function statusLabel(status: LabStatus): string {
  if (status === 'critical') return 'CRITICAL'
  if (status === 'low') return 'LOW'
  if (status === 'high') return 'HIGH'
  return 'NORMAL'
}

// Returns 0 for normal, >0 for abnormal (% of range width deviation from nearest boundary)
function getAbnormality(val: number, ref: { low: number; high: number }): number {
  const range = ref.high - ref.low
  if (val < ref.low) return (ref.low - val) / range
  if (val > ref.high) return (val - ref.high) / range
  return 0
}

function chronological(values: TrendValue[]): TrendValue[] {
  return [...values].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getMostAbnormalLab(trends: LabTrend[]): string | null {
  if (trends.length === 0) return null
  let best: string | null = null
  let bestAbn = -1
  for (const t of trends) {
    const ref = getRefRange(t.test_name)
    const sorted = chronological(t.values)
    const latest = sorted[sorted.length - 1]
    if (!ref || !latest) {
      if (best === null) best = t.test_name
      continue
    }
    const abn = getAbnormality(latest.value, ref)
    if (abn > bestAbn) {
      bestAbn = abn
      best = t.test_name
    }
  }
  return best
}

// ── Tooltip ────────────────────────────────────────────────────────────────

interface TooltipEntry {
  value: number
}

function CustomTooltip({
  active,
  payload,
  label,
  refRange,
  unit,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
  refRange: { low: number; high: number } | null
  unit: string | null
}) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  const isLow = refRange && val < refRange.low
  const isHigh = refRange && val > refRange.high
  const isAbnormal = isLow || isHigh
  const direction = isLow ? 'Below' : 'Above'

  return (
    <div className="rounded-xl bg-[#1e1b2e]/95 backdrop-blur-sm border border-white/[0.1] px-3.5 py-2.5 shadow-xl">
      <p className="text-[11px] mb-1.5 font-medium" style={{ color: TEXT_SECONDARY }}>{label}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color: VITAL_CYAN, fontFamily: 'Figtree, system-ui, sans-serif' }}>
        {val}{unit ? ` ${unit}` : ''}
      </p>
      {isAbnormal && refRange && (
        <p className="text-[11px] mt-1.5 leading-tight" style={{ color: ALERT_ROSE }}>
          {direction} normal range
          <br />
          <span style={{ color: TEXT_MUTED }}>
            ({refRange.low}–{refRange.high}{unit ? ` ${unit}` : ''})
          </span>
        </p>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export function HealthDataChart() {
  const [trends, setTrends] = useState<LabTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLab, setSelectedLab] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/labs/trends')
      .then(r => r.json())
      .then(json => {
        const data = (json.data?.trends ?? []) as LabTrend[]
        setTrends(data)
        setSelectedLab(getMostAbnormalLab(data))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Labs sorted most-abnormal first (by latest value % deviation from ref range)
  const sortedTrends = useMemo(() => {
    return [...trends].sort((a, b) => {
      const aRef = getRefRange(a.test_name)
      const bRef = getRefRange(b.test_name)
      const aLatest = chronological(a.values).at(-1)?.value
      const bLatest = chronological(b.values).at(-1)?.value
      const aAbn = aRef && aLatest !== undefined ? getAbnormality(aLatest, aRef) : 0
      const bAbn = bRef && bLatest !== undefined ? getAbnormality(bLatest, bRef) : 0
      return bAbn - aAbn
    })
  }, [trends])

  const statCardTrends = useMemo(() => sortedTrends.slice(0, 3), [sortedTrends])

  const selectedTrend = useMemo(
    () => trends.find(t => t.test_name === selectedLab) ?? null,
    [trends, selectedLab]
  )
  const selectedRef = useMemo(
    () => (selectedTrend ? getRefRange(selectedTrend.test_name) : null),
    [selectedTrend]
  )

  const chartData = useMemo(() => {
    if (!selectedTrend) return []
    return chronological(selectedTrend.values).map(v => ({
      date: formatDate(v.date),
      value: v.value,
    }))
  }, [selectedTrend])

  // Last 5 lab entries across all labs, newest first
  const recentResults = useMemo(() => {
    const all: { date: string; testName: string; unit: string | null; value: number }[] = []
    for (const t of trends) {
      for (const v of t.values) {
        all.push({ date: v.date, testName: t.test_name, unit: t.unit, value: v.value })
      }
    }
    return all
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  }, [trends])

  if (loading) {
    return <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 h-[280px] animate-pulse" />
  }

  if (trends.length === 0) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.04] flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 12h4l3-9 4 18 3-9h4" stroke={TEXT_MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: '#EDE9FE' }}>No lab data yet</p>
        <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>Upload lab results to see trends here.</p>
      </div>
    )
  }

  const gridCols =
    statCardTrends.length === 1 ? 'grid-cols-1' :
    statCardTrends.length === 2 ? 'grid-cols-2' :
    'grid-cols-3'

  return (
    <div className="space-y-4">

      {/* ── Stat Cards Strip ── */}
      <div className={`grid ${gridCols} gap-2`}>
        {statCardTrends.map(t => {
          const sorted = chronological(t.values)
          const latest = sorted.at(-1)
          const prev = sorted.at(-2)
          const ref = getRefRange(t.test_name)
          const status = ref && latest ? getStatus(latest.value, ref) : null
          const delta = latest && prev ? +(latest.value - prev.value).toFixed(2) : null
          const isSelected = selectedLab === t.test_name

          let deltaColor = TEXT_MUTED
          if (delta !== null && ref && latest) {
            const movingTowardNormal =
              (latest.value < ref.low && delta > 0) ||
              (latest.value > ref.high && delta < 0) ||
              (latest.value >= ref.low && latest.value <= ref.high)
            deltaColor = movingTowardNormal ? CLEAR_SIGNAL : ALERT_ROSE
          }

          return (
            <button
              key={t.test_name}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedLab(t.test_name)}
              className="flex flex-col gap-0.5 p-3 rounded-[20px] border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              style={{
                backgroundColor: 'rgba(167,139,250,0.04)',
                borderColor: isSelected ? `${TRUST_INDIGO}60` : 'rgba(167,139,250,0.12)',
                boxShadow: isSelected
                  ? `0 0 0 1px ${TRUST_INDIGO}40, 0 0 16px ${TRUST_INDIGO}15`
                  : 'none',
              }}
            >
              <span
                className="text-[11px] truncate leading-tight"
                style={{ color: TEXT_SECONDARY, fontFamily: 'Noto Sans, system-ui, sans-serif' }}
              >
                {t.test_name}
              </span>

              {latest && (
                <>
                  <span
                    className="text-lg font-bold leading-tight tabular-nums"
                    style={{ color: VITAL_CYAN, fontFamily: 'Figtree, system-ui, sans-serif' }}
                  >
                    {latest.value}
                  </span>
                  {t.unit && (
                    <span className="text-[10px] leading-tight" style={{ color: TEXT_MUTED }}>
                      {t.unit}
                    </span>
                  )}
                  {delta !== null && prev && (
                    <span className="text-[10px] leading-tight" style={{ color: deltaColor }}>
                      {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}
                      <span className="hidden sm:inline"> since {formatDate(prev.date)}</span>
                    </span>
                  )}
                  {status && (
                    <span
                      className="mt-1 self-start px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold leading-tight"
                      style={{
                        color: statusColor(status),
                        backgroundColor: `${statusColor(status)}20`,
                        letterSpacing: '0.03em',
                        fontFamily: 'Noto Sans, system-ui, sans-serif',
                      }}
                    >
                      {statusLabel(status)}
                    </span>
                  )}
                </>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Filter Pills ── */}
      <div className="flex flex-wrap gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" role="radiogroup" aria-label="Select lab">
        {sortedTrends.map(t => {
          const sorted = chronological(t.values)
          const latest = sorted.at(-1)
          const ref = getRefRange(t.test_name)
          const isSelected = selectedLab === t.test_name

          let dotColor = TEXT_MUTED
          if (ref && latest) {
            dotColor = statusColor(getStatus(latest.value, ref))
          }

          return (
            <button
              key={t.test_name}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelectedLab(t.test_name)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              style={
                isSelected
                  ? {
                      backgroundColor: `${TRUST_INDIGO}20`,
                      borderColor: `${TRUST_INDIGO}55`,
                      color: '#EDE9FE',
                    }
                  : {
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      borderColor: 'rgba(255,255,255,0.06)',
                      color: TEXT_SECONDARY,
                    }
              }
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: dotColor }}
              />
              {t.test_name}
            </button>
          )
        })}
      </div>

      {/* ── Chart ── */}
      {selectedTrend ? (
        <div
          className="rounded-[20px] border p-4"
          style={{
            backgroundColor: 'rgba(167,139,250,0.03)',
            borderColor: 'rgba(167,139,250,0.1)',
          }}
        >
          {chartData.length === 1 && (
            <p className="text-[11px] text-center mb-3" style={{ color: TEXT_MUTED }}>
              Only 1 result on record — trend requires at least 2 data points
            </p>
          )}

          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
              {selectedRef && (
                <ReferenceArea
                  y1={selectedRef.low}
                  y2={selectedRef.high}
                  fill={CLEAR_SIGNAL}
                  fillOpacity={0.12}
                  stroke={CLEAR_SIGNAL}
                  strokeOpacity={0.25}
                />
              )}
              <XAxis
                dataKey="date"
                tick={{ fill: TEXT_MUTED, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                dy={4}
              />
              <YAxis
                tick={{ fill: TEXT_MUTED, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                content={
                  <CustomTooltip refRange={selectedRef} unit={selectedTrend.unit} />
                }
                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={selectedTrend.test_name}
                stroke={VITAL_CYAN}
                strokeWidth={2}
                dot={(dotProps: {
                  cx?: number
                  cy?: number
                  value?: number
                  index?: number
                }) => {
                  const { cx, cy, value, index } = dotProps
                  if (cx === undefined || cy === undefined || value === undefined) {
                    return <g key={`dot-empty-${index}`} />
                  }
                  const abnormal = selectedRef && (value < selectedRef.low || value > selectedRef.high)
                  return (
                    <circle
                      key={`dot-${index}`}
                      cx={cx}
                      cy={cy}
                      r={abnormal ? 5 : 3.5}
                      fill={abnormal ? ALERT_ROSE : VITAL_CYAN}
                      stroke={MIDNIGHT_BASE}
                      strokeWidth={2}
                    />
                  )
                }}
                activeDot={{ r: 5, fill: VITAL_CYAN, stroke: MIDNIGHT_BASE, strokeWidth: 2 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>

          {selectedRef && (
            <p className="text-[10px] text-right mt-1" style={{ color: TEXT_MUTED }}>
              Normal: {selectedRef.low}–{selectedRef.high}{selectedTrend.unit ? ` ${selectedTrend.unit}` : ''}
            </p>
          )}
        </div>
      ) : (
        <div
          className="rounded-[20px] border p-6 text-center"
          style={{ borderColor: 'rgba(167,139,250,0.1)' }}
        >
          <p className="text-sm" style={{ color: TEXT_MUTED }}>Select a lab above to view its trend</p>
        </div>
      )}

      {/* ── Recent Results ── */}
      {recentResults.length > 0 && (
        <div>
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: TEXT_SECONDARY }}
          >
            Recent Results
          </h3>
          <div
            className="rounded-[20px] border overflow-hidden"
            style={{ borderColor: 'rgba(167,139,250,0.1)' }}
          >
            {recentResults.map((r, i) => {
              const ref = getRefRange(r.testName)
              const status = ref ? getStatus(r.value, ref) : null
              return (
                <div
                  key={`${r.testName}-${r.date}-${i}`}
                  className="flex items-center justify-between px-3 py-2.5"
                  style={{
                    borderTop: i > 0 ? '1px solid rgba(167,139,250,0.06)' : 'none',
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[11px] shrink-0 tabular-nums" style={{ color: TEXT_MUTED }}>
                      {formatDate(r.date)}
                    </span>
                    <span
                      className="text-xs truncate"
                      style={{ color: TEXT_SECONDARY, fontFamily: 'Noto Sans, system-ui, sans-serif' }}
                    >
                      {r.testName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: VITAL_CYAN, fontFamily: 'Figtree, system-ui, sans-serif' }}
                    >
                      {r.value}
                      {r.unit && (
                        <span className="text-[10px] font-normal ml-0.5" style={{ color: TEXT_MUTED }}>
                          {r.unit}
                        </span>
                      )}
                    </span>
                    {status && (
                      <span
                        className="px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold shrink-0"
                        style={{
                          color: statusColor(status),
                          backgroundColor: `${statusColor(status)}20`,
                          letterSpacing: '0.03em',
                          fontFamily: 'Noto Sans, system-ui, sans-serif',
                        }}
                      >
                        {statusLabel(status)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
