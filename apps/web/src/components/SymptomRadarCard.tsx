'use client'

interface CheckinData {
  mood: number
  pain: number
  energy: string
  checkedInAt: string | Date
}

interface SymptomRadarCardProps {
  recentCheckins: CheckinData[]
  adherencePercent: number
  patientFirstName?: string
  onRemind?: () => void
}

const ENERGY_MAP: Record<string, number> = { low: 1, med: 2, medium: 2, high: 3 }

function energyToNum(e: string): number {
  return ENERGY_MAP[e] ?? 2
}

function getOrbColor(
  metric: 'pain' | 'energy' | 'mood' | 'adherence',
  value: number,
): { bg: string; glow: string } {
  if (metric === 'pain') {
    if (value <= 3) return { bg: '#6EE7B7', glow: 'orb-green' }
    if (value <= 6) return { bg: '#FBBF24', glow: 'orb-amber' }
    return { bg: '#FCA5A5', glow: 'orb-red' }
  }
  if (metric === 'energy') {
    if (value >= 3) return { bg: '#6EE7B7', glow: 'orb-green' }
    if (value >= 2) return { bg: '#FBBF24', glow: 'orb-amber' }
    return { bg: '#FCA5A5', glow: 'orb-red' }
  }
  if (metric === 'mood') {
    if (value >= 4) return { bg: '#6EE7B7', glow: 'orb-green' }
    if (value >= 3) return { bg: '#FBBF24', glow: 'orb-amber' }
    return { bg: '#FCA5A5', glow: 'orb-red' }
  }
  // adherence
  if (value >= 80) return { bg: '#6EE7B7', glow: 'orb-green' }
  if (value >= 50) return { bg: '#FBBF24', glow: 'orb-amber' }
  return { bg: '#FCA5A5', glow: 'orb-red' }
}

function hasCheckinToday(checkins: CheckinData[]): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return checkins.some(c => {
    const d = new Date(c.checkedInAt)
    d.setHours(0, 0, 0, 0)
    return d.getTime() === today.getTime()
  })
}

function lastCheckinLabel(checkins: CheckinData[]): string | null {
  if (checkins.length === 0) return null
  const sorted = [...checkins].sort(
    (a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime()
  )
  const last = sorted[0]
  const diffMs = Date.now() - new Date(last.checkedInAt).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Last check-in: just now'
  if (mins < 60) return `Last check-in: ${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Last check-in: ${hours}h ago`
  if (hours < 48) return 'Last check-in: yesterday'
  return `Last check-in: ${Math.floor(hours / 24)}d ago`
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 120
  const h = 24
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SymptomRadarCard({
  recentCheckins,
  adherencePercent,
  patientFirstName,
  onRemind,
}: SymptomRadarCardProps) {
  const sorted = [...recentCheckins].sort(
    (a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime(),
  )

  const latestPain = sorted.length > 0 ? sorted[sorted.length - 1].pain : 0
  const latestEnergy = sorted.length > 0 ? energyToNum(sorted[sorted.length - 1].energy) : 2
  const latestMood = sorted.length > 0 ? sorted[sorted.length - 1].mood : 3
  const noCheckinToday = !hasCheckinToday(recentCheckins)
  const lastLabel = lastCheckinLabel(recentCheckins)

  const orbs = [
    { label: 'Pain', metric: 'pain' as const, value: latestPain, displayValue: `${latestPain}/10` },
    { label: 'Energy', metric: 'energy' as const, value: latestEnergy, displayValue: latestEnergy === 3 ? 'High' : latestEnergy === 2 ? 'Med' : 'Low' },
    { label: 'Mood', metric: 'mood' as const, value: latestMood, displayValue: `${latestMood}/5` },
    { label: 'Adherence', metric: 'adherence' as const, value: adherencePercent, displayValue: `${adherencePercent}%` },
  ]

  const sparklines = [
    { label: 'Pain', data: sorted.map(c => c.pain), color: getOrbColor('pain', latestPain).bg },
    { label: 'Energy', data: sorted.map(c => energyToNum(c.energy)), color: getOrbColor('energy', latestEnergy).bg },
    { label: 'Mood', data: sorted.map(c => c.mood), color: getOrbColor('mood', latestMood).bg },
  ]

  return (
    <div className="glass card-hover-glow rounded-xl p-4">
      {/* Header with timestamp */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Symptom Radar
        </h3>
        {lastLabel && (
          <span className="text-[10px] text-[var(--text-muted)]">{lastLabel}</span>
        )}
      </div>

      {/* Larger orbs row */}
      <div className="flex justify-between items-center mb-4">
        {orbs.map((orb) => {
          const orbStyle = getOrbColor(orb.metric, orb.value)
          return (
            <div key={orb.label} className="flex flex-col items-center gap-2">
              <div
                className={`w-14 h-14 rounded-full ${orbStyle.glow} flex items-center justify-center`}
                style={{
                  background: `radial-gradient(circle at 40% 40%, ${orbStyle.bg}40, ${orbStyle.bg}18)`,
                  border: `2px solid ${orbStyle.bg}55`,
                  boxShadow: `0 0 12px ${orbStyle.bg}30`,
                }}
              >
                <span className="text-[11px] font-bold" style={{ color: orbStyle.bg }}>
                  {orb.displayValue}
                </span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)]">{orb.label}</span>
            </div>
          )
        })}
      </div>

      {/* Sparklines */}
      <div className="space-y-2">
        {sparklines.map((s) =>
          s.data.length >= 2 ? (
            <div key={s.label} className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-[var(--text-muted)] w-16 flex-shrink-0">
                {s.label}
              </span>
              <MiniSparkline data={s.data} color={s.color} />
            </div>
          ) : null,
        )}
      </div>

      {/* No check-in today prompt */}
      {noCheckinToday && recentCheckins.length > 0 && (
        <div
          className="flex items-center justify-between gap-3 mt-4 pt-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-[11px] text-[var(--text-muted)]">No check-in yet today</span>
          {onRemind && (
            <button
              onClick={onRemind}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#818CF8',
              }}
            >
              Remind {patientFirstName ?? 'them'} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
