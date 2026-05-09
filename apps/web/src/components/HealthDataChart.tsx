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

const METRIC_CONFIG: Record<string, { color: string; refLow?: number; refHigh?: number }> = {
  'Hemoglobin': { color: '#ef4444', refLow: 12, refHigh: 17 },
  'Blood Glucose': { color: '#3b82f6', refLow: 70, refHigh: 100 },
  'Glucose': { color: '#3b82f6', refLow: 70, refHigh: 100 },
  'Fasting Glucose': { color: '#3b82f6', refLow: 70, refHigh: 100 },
  'Platelets': { color: '#eab308', refLow: 150, refHigh: 400 },
  'Platelet Count': { color: '#eab308', refLow: 150, refHigh: 400 },
  'WBC': { color: '#10b981', refLow: 4, refHigh: 11 },
  'White Blood Cells': { color: '#10b981', refLow: 4, refHigh: 11 },
  'Creatinine': { color: '#8b5cf6', refLow: 0.6, refHigh: 1.2 },
  'ALT': { color: '#06b6d4', refLow: 7, refHigh: 56 },
}

const FALLBACK_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f97316', '#ec4899']

function getMetricColor(testName: string, fallbackIdx: number): string {
  return METRIC_CONFIG[testName]?.color ?? FALLBACK_COLORS[fallbackIdx % FALLBACK_COLORS.length]
}

function getRefRange(testName: string): { low: number; high: number } | null {
  const cfg = METRIC_CONFIG[testName]
  if (cfg?.refLow !== undefined && cfg?.refHigh !== undefined) {
    return { low: cfg.refLow, high: cfg.refHigh }
  }
  return null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface TooltipEntry {
  name: string
  value: number
  color: string
  dataKey: string
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-[#1e1b2e]/95 backdrop-blur-sm border border-white/[0.1] px-3.5 py-2.5 shadow-xl">
      <p className="text-[11px] text-[#94a3b8] mb-1.5 font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-[#e2e8f0]">{entry.name}:</span>
          <span className="font-bold text-white tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function HealthDataChart() {
  const [trends, setTrends] = useState<LabTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/labs/trends')
      .then(r => r.json())
      .then(json => {
        const data = (json.data?.trends ?? []) as LabTrend[]
        setTrends(data)
        setVisible(new Set(data.slice(0, 3).map(t => t.test_name)))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const activeTrends = useMemo(
    () => trends.filter(t => visible.has(t.test_name)),
    [trends, visible]
  )

  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number | undefined>>()
    for (const t of activeTrends) {
      for (const v of t.values) {
        const label = formatDate(v.date)
        const row = dateMap.get(label) ?? {}
        row[t.test_name] = v.value
        dateMap.set(label, row)
      }
    }
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => {
        const parse = (s: string) => new Date(`${s}, ${new Date().getFullYear()}`).getTime()
        return parse(a) - parse(b)
      })
      .map(([date, vals]) => ({ date, ...vals }))
  }, [activeTrends])

  function toggleTest(name: string) {
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  if (loading) {
    return <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 h-[280px] animate-pulse" />
  }

  if (trends.length === 0) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.04] flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 12h4l3-9 4 18 3-9h4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-medium text-white">No lab data yet</p>
        <p className="text-xs text-[#64748b] mt-1">Upload lab results to see trends here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Lab Trends</h3>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {trends.map((t, i) => {
          const color = getMetricColor(t.test_name, i)
          const isActive = visible.has(t.test_name)
          return (
            <button
              key={t.test_name}
              type="button"
              onClick={() => toggleTest(t.test_name)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap min-h-[36px]"
              style={isActive ? {
                backgroundColor: `${color}25`,
                borderColor: `${color}55`,
                color,
              } : {
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.06)',
                color: '#64748b',
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: isActive ? color : '#64748b' }}
              />
              {t.test_name}
            </button>
          )
        })}
      </div>

      {/* Chart */}
      {activeTrends.length > 0 && chartData.length >= 1 ? (
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-4">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
              {activeTrends.map((t, i) => {
                const range = getRefRange(t.test_name)
                if (!range) return null
                const color = getMetricColor(t.test_name, i)
                return (
                  <ReferenceArea
                    key={t.test_name}
                    y1={range.low}
                    y2={range.high}
                    fill={color}
                    fillOpacity={0.07}
                    stroke={color}
                    strokeOpacity={0.15}
                  />
                )
              })}

              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#ffffff0a' }}
                dy={4}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#ffffff15', strokeWidth: 1 }}
              />

              {activeTrends.map((t, i) => {
                const color = getMetricColor(t.test_name, i)
                return (
                  <Line
                    key={t.test_name}
                    type="monotone"
                    dataKey={t.test_name}
                    name={t.test_name}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: color, stroke: '#0f0d1a', strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: color, stroke: '#0f0d1a', strokeWidth: 2 }}
                    connectNulls={false}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>

          {/* Normal range legend */}
          <div className="flex flex-wrap gap-3 mt-3 justify-center">
            {activeTrends.map((t, i) => {
              const range = getRefRange(t.test_name)
              if (!range) return null
              const color = getMetricColor(t.test_name, i)
              return (
                <div key={t.test_name} className="flex items-center gap-1.5">
                  <span
                    className="w-5 h-2 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
                  />
                  <span className="text-[10px] text-[#64748b]">
                    {t.test_name}: {range.low}–{range.high}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 text-center">
          <p className="text-sm text-[#64748b]">Select a metric above to view its trend</p>
        </div>
      )}
    </div>
  )
}
