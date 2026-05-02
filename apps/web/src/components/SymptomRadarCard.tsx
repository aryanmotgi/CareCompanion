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
}

const ENERGY_MAP: Record<string, number> = { low: 1, med: 2, medium: 2, high: 3 }

function energyToNum(e: string): number {
  return ENERGY_MAP[e] ?? 2
}

function getOrbColor(
  metric: 'pain' | 'energy' | 'mood' | 'adherence',
  value: number,
): { bg: string; glow: string; className: string } {
  if (metric === 'pain') {
    if (value <= 3) return { bg: '#6EE7B7', glow: 'orb-green', className: 'bg-emerald-400' }
    if (value <= 6) return { bg: '#FBBF24', glow: 'orb-amber', className: 'bg-amber-400' }
    return { bg: '#FCA5A5', glow: 'orb-red', className: 'bg-red-300' }
  }
  if (metric === 'energy') {
    if (value >= 3) return { bg: '#6EE7B7', glow: 'orb-green', className: 'bg-emerald-400' }
    if (value >= 2) return { bg: '#FBBF24', glow: 'orb-amber', className: 'bg-amber-400' }
    return { bg: '#FCA5A5', glow: 'orb-red', className: 'bg-red-300' }
  }
  if (metric === 'mood') {
    if (value >= 4) return { bg: '#6EE7B7', glow: 'orb-green', className: 'bg-emerald-400' }
    if (value >= 3) return { bg: '#FBBF24', glow: 'orb-amber', className: 'bg-amber-400' }
    return { bg: '#FCA5A5', glow: 'orb-red', className: 'bg-red-300' }
  }
  // adherence
  if (value >= 80) return { bg: '#6EE7B7', glow: 'orb-green', className: 'bg-emerald-400' }
  if (value >= 50) return { bg: '#FBBF24', glow: 'orb-amber', className: 'bg-amber-400' }
  return { bg: '#FCA5A5', glow: 'orb-red', className: 'bg-red-300' }
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

export function SymptomRadarCard({ recentCheckins, adherencePercent }: SymptomRadarCardProps) {
  const sorted = [...recentCheckins].sort(
    (a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime(),
  )

  const latestPain = sorted.length > 0 ? sorted[sorted.length - 1].pain : 0
  const latestEnergy = sorted.length > 0 ? energyToNum(sorted[sorted.length - 1].energy) : 2
  const latestMood = sorted.length > 0 ? sorted[sorted.length - 1].mood : 3

  const painData = sorted.map((c) => c.pain)
  const energyData = sorted.map((c) => energyToNum(c.energy))
  const moodData = sorted.map((c) => c.mood)
  const adherenceData = sorted.length > 0 ? [adherencePercent] : []

  const orbs = [
    { label: 'Pain', metric: 'pain' as const, value: latestPain, displayValue: `${latestPain}/10` },
    { label: 'Energy', metric: 'energy' as const, value: latestEnergy, displayValue: latestEnergy === 3 ? 'High' : latestEnergy === 2 ? 'Med' : 'Low' },
    { label: 'Mood', metric: 'mood' as const, value: latestMood, displayValue: `${latestMood}/5` },
    { label: 'Adherence', metric: 'adherence' as const, value: adherencePercent, displayValue: `${adherencePercent}%` },
  ]

  const sparklines = [
    { label: 'Pain', data: painData, color: getOrbColor('pain', latestPain).bg },
    { label: 'Energy', data: energyData, color: getOrbColor('energy', latestEnergy).bg },
    { label: 'Mood', data: moodData, color: getOrbColor('mood', latestMood).bg },
    { label: 'Adherence', data: adherenceData, color: getOrbColor('adherence', adherencePercent).bg },
  ]

  return (
    <div className="glass card-hover-glow rounded-xl p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
        Symptom Radar
      </h3>

      {/* Orbs row */}
      <div className="flex justify-between items-center mb-4">
        {orbs.map((orb) => {
          const orbStyle = getOrbColor(orb.metric, orb.value)
          return (
            <div key={orb.label} className="flex flex-col items-center gap-1.5">
              <div
                className={`w-11 h-11 rounded-full ${orbStyle.glow} flex items-center justify-center`}
                style={{
                  background: `radial-gradient(circle at 40% 40%, ${orbStyle.bg}40, ${orbStyle.bg}15)`,
                  border: `1.5px solid ${orbStyle.bg}50`,
                }}
              >
                <span className="text-[10px] font-bold text-white/90">{orb.displayValue}</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)]">{orb.label}</span>
            </div>
          )
        })}
      </div>

      {/* Sparkline rows */}
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
    </div>
  )
}
