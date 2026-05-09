'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  Legend,
} from 'recharts'

/* ─── Types ─── */

interface TrendValue {
  date: string
  value: number
}

interface LabTrendData {
  test_name: string
  values: TrendValue[]
  reference_range?: { low?: number; high?: number }
  trend: 'improving' | 'stable' | 'declining' | 'rapid_decline' | 'insufficient_data'
  prediction?: number
}

interface LabTrendChartProps {
  trends: LabTrendData[]
}

/* ─── Constants ─── */

const TREND_COLORS: Record<string, string> = {
  improving: '#10b981',
  stable: '#8b5cf6',
  declining: '#f59e0b',
  rapid_decline: '#ef4444',
  insufficient_data: '#64748b',
}

/* ─── Date formatting ─── */

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ─── Custom tooltip ─── */

interface TooltipPayloadEntry {
  name: string
  value: number
  color: string
  dataKey: string
  payload: Record<string, unknown>
}

function CustomTooltip({
  active,
  payload,
  label,
  referenceRanges,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
  referenceRanges: Record<string, { low?: number; high?: number } | undefined>
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-xl bg-[#1e1b2e]/95 backdrop-blur-sm border border-white/[0.1] px-3.5 py-2.5 shadow-xl">
      <p className="text-[11px] text-[#94a3b8] mb-1.5 font-medium">{label}</p>
      {payload.map((entry) => {
        const range = referenceRanges[entry.name]
        const val = entry.value
        const isDashed = entry.dataKey.endsWith('_pred')
        const isAbnormal =
          range &&
          ((range.low !== undefined && val < range.low) ||
            (range.high !== undefined && val > range.high))

        return (
          <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[#e2e8f0] font-medium">
              {entry.name}
              {isDashed ? ' (predicted)' : ''}:
            </span>
            <span
              className={`font-bold tabular-nums ${
                isAbnormal ? 'text-red-400' : 'text-white'
              }`}
            >
              {val}
            </span>
            {isAbnormal && (
              <span className="text-[10px] text-red-400 font-medium">
                abnormal
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Main Component ─── */

export function LabTrendChart({ trends }: LabTrendChartProps) {
  // Build unified data points indexed by date
  const { chartData, lineConfigs, referenceRanges, yDomain } = useMemo(() => {
    const dateMap = new Map<string, Record<string, number | null>>()
    const configs: Array<{
      dataKey: string
      name: string
      color: string
      isDashed: boolean
    }> = []
    const ranges: Record<string, { low?: number; high?: number } | undefined> = {}

    let globalMin = Infinity
    let globalMax = -Infinity

    for (const t of trends) {
      const color = TREND_COLORS[t.trend] || '#8b5cf6'
      const key = t.test_name.replace(/\s+/g, '_')
      const predKey = `${key}_pred`

      configs.push({ dataKey: key, name: t.test_name, color, isDashed: false })
      ranges[t.test_name] = t.reference_range

      // Track min/max for y domain
      for (const v of t.values) {
        if (v.value < globalMin) globalMin = v.value
        if (v.value > globalMax) globalMax = v.value

        const dateLabel = formatDateLabel(v.date)
        const existing = dateMap.get(dateLabel) || {}
        existing[key] = v.value
        dateMap.set(dateLabel, existing)
      }

      // Add prediction point
      if (t.prediction !== undefined && t.prediction !== null && t.values.length > 0) {
        const lastDate = new Date(t.values[t.values.length - 1].date)
        const predDate = new Date(lastDate.getTime() + 7 * 24 * 60 * 60 * 1000)
        const predLabel = formatDateLabel(predDate.toISOString())

        // Connect prediction to last actual value
        const lastLabel = formatDateLabel(t.values[t.values.length - 1].date)
        const lastEntry = dateMap.get(lastLabel) || {}
        lastEntry[predKey] = t.values[t.values.length - 1].value
        dateMap.set(lastLabel, lastEntry)

        const predEntry = dateMap.get(predLabel) || {}
        predEntry[predKey] = t.prediction
        dateMap.set(predLabel, predEntry)

        if (t.prediction < globalMin) globalMin = t.prediction
        if (t.prediction > globalMax) globalMax = t.prediction

        configs.push({ dataKey: predKey, name: t.test_name, color, isDashed: true })
      }

      // Include reference range in y domain
      if (t.reference_range) {
        if (t.reference_range.low !== undefined && t.reference_range.low < globalMin) {
          globalMin = t.reference_range.low
        }
        if (t.reference_range.high !== undefined && t.reference_range.high > globalMax) {
          globalMax = t.reference_range.high
        }
      }
    }

    // Convert map to sorted array
    const data = Array.from(dateMap.entries())
      .sort(([a], [b]) => {
        // Parse "Mar 5" style dates for sorting
        const parseShort = (s: string) => {
          const d = new Date(`${s}, ${new Date().getFullYear()}`)
          return d.getTime()
        }
        return parseShort(a) - parseShort(b)
      })
      .map(([date, values]) => ({ date, ...values }))

    // Add padding to y domain
    const range = globalMax - globalMin || 1
    const padding = range * 0.15

    return {
      chartData: data,
      lineConfigs: configs,
      referenceRanges: ranges,
      yDomain: [
        Math.max(0, Math.floor(globalMin - padding)),
        Math.ceil(globalMax + padding),
      ] as [number, number],
    }
  }, [trends])

  if (trends.length === 0 || chartData.length === 0) {
    return null
  }

  if (chartData.length === 1) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-4 text-center py-8">
        <p className="text-sm text-[var(--text-secondary)]">Only one data point recorded.</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Add another result to see trends over time.</p>
      </div>
    )
  }

  // Find reference area bounds (use first trend with a reference range)
  const refRange = trends.find((t) => t.reference_range)?.reference_range

  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text,#f1f5f9)]">
          {trends.length === 1 ? trends[0].test_name : 'Lab Trends'}
        </h3>
        {trends.length === 1 && (
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
            style={{
              color: TREND_COLORS[trends[0].trend],
              borderColor: `${TREND_COLORS[trends[0].trend]}33`,
              backgroundColor: `${TREND_COLORS[trends[0].trend]}1a`,
            }}
          >
            {trends[0].trend.replace('_', ' ')}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          {/* Normal range shaded band */}
          {refRange && refRange.low !== undefined && refRange.high !== undefined && (
            <ReferenceArea
              y1={refRange.low}
              y2={refRange.high}
              fill="#10b981"
              fillOpacity={0.08}
              stroke="#10b981"
              strokeOpacity={0.15}
              strokeDasharray="3 3"
            />
          )}

          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#ffffff0a' }}
            dy={4}
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <Tooltip
            content={
              <CustomTooltip referenceRanges={referenceRanges} />
            }
            cursor={{ stroke: '#ffffff15', strokeWidth: 1 }}
          />
          {trends.length > 1 && (
            <Legend
              wrapperStyle={{ paddingTop: 8 }}
              formatter={(value: string) => (
                <span className="text-xs text-[#94a3b8]">{value}</span>
              )}
            />
          )}

          {lineConfigs.map((config) => (
            <Line
              key={config.dataKey}
              type="monotone"
              dataKey={config.dataKey}
              name={config.isDashed ? `${config.name} (pred)` : config.name}
              stroke={config.color}
              strokeWidth={config.isDashed ? 1.5 : 2}
              strokeDasharray={config.isDashed ? '6 4' : undefined}
              dot={
                config.isDashed
                  ? false
                  : {
                      r: 3.5,
                      fill: config.color,
                      stroke: '#0f0d1a',
                      strokeWidth: 2,
                    }
              }
              activeDot={
                config.isDashed
                  ? false
                  : {
                      r: 5,
                      fill: config.color,
                      stroke: '#0f0d1a',
                      strokeWidth: 2,
                    }
              }
              connectNulls={false}
              legendType={config.isDashed ? 'none' : 'circle'}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Reference range legend */}
      {refRange && refRange.low !== undefined && refRange.high !== undefined && (
        <div className="flex items-center gap-2 mt-2 justify-center">
          <span className="w-6 h-2 rounded-sm bg-[#10b981]/20 border border-[#10b981]/30" />
          <span className="text-[10px] text-[#64748b]">
            Normal range: {refRange.low} &ndash; {refRange.high}
          </span>
        </div>
      )}
    </div>
  )
}
