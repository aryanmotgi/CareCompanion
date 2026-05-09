'use client'

import { useState, useEffect, useCallback } from 'react'
import { SymptomRadarCard } from './SymptomRadarCard'
import Link from 'next/link'

interface CareHubViewProps {
  careProfileId: string
  patientName: string
  careGroupName?: string | null
}

interface CareHubData {
  profile: {
    id: string
    patientName: string | null
    cancerType: string | null
    treatmentPhase: string | null
    checkinStreak: number
  } | null
  todayCheckin: {
    mood: number
    pain: number
    energy: string
    sleep: string
    notes: string | null
    checkedInAt: string
  } | null
  recentCheckins: Array<{
    mood: number
    pain: number
    energy: string
    checkedInAt: string
  }>
  insights: Array<{
    id: string
    type: string
    severity: string
    title: string
    body: string
    createdAt: string
  }>
  medications: Array<{
    id: string
    name: string
    dose: string | null
    frequency: string | null
  }>
  activity: Array<{
    id: string
    userId: string
    action: string
    metadata: unknown
    createdAt: string
    userName: string | null
  }>
  upcoming: Array<{
    id: string
    doctorName: string | null
    specialty: string | null
    dateTime: string | null
    location: string | null
    purpose: string | null
  }>
}

const ACTION_LABELS: Record<string, string> = {
  logged_meds: 'Logged medications',
  completed_checkin: 'Completed a check-in',
  viewed_summary: 'Viewed health summary',
  shared_link: 'Shared a health link',
  exported_pdf: 'Exported a PDF',
}

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

function isChemoAppointment(appt: CareHubData['upcoming'][0]): boolean {
  const keywords = ['chemo', 'infusion', 'herceptin', 'perjeta', 'taxotere', 'oncol', 'carboplatin', 'taxol', 'cytoxan']
  const text = [appt.specialty, appt.purpose, appt.doctorName].filter(Boolean).join(' ').toLowerCase()
  return keywords.some(k => text.includes(k))
}

function getStatusBadge(checkin: CareHubData['todayCheckin']): { label: string; className: string } {
  if (!checkin) return { label: 'No Check-in', className: 'bg-white/[0.06] text-[var(--text-muted)]' }
  const { pain, mood } = checkin
  if (pain >= 7 || mood <= 1) return { label: 'Needs Attention', className: 'bg-red-500/15 text-red-300 border border-red-500/20' }
  if (pain >= 4 || mood <= 2) return { label: 'Watch', className: 'bg-amber-500/15 text-amber-300 border border-amber-500/20' }
  return { label: 'All Clear', className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' }
}

function currentWeekNumber(): number {
  const d = new Date()
  const jan1 = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7)
}

// ─── ChemoCountdownBanner ──────────────────────────────────────────────────────

function ChemoCountdownBanner({
  upcoming,
}: {
  upcoming: CareHubData['upcoming']
}) {
  const chemo = upcoming
    .filter(a => {
      if (!a.dateTime) return false
      const d = daysUntil(a.dateTime)
      return d >= 0 && d <= 7 && isChemoAppointment(a)
    })
    .sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime())

  if (chemo.length === 0) return null

  const next = chemo[0]
  const days = daysUntil(next.dateTime!)
  const urgent = days <= 3
  const dayLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`
  const detail = [next.purpose, next.specialty].filter(Boolean).join(' · ')

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4"
      style={{
        background: urgent ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)',
        border: `1px solid ${urgent ? 'rgba(245,158,11,0.28)' : 'rgba(99,102,241,0.28)'}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: urgent ? '#FBBF24' : '#818CF8' }}>
          {urgent ? '⚠️ ' : '💊 '}Chemo {dayLabel}
        </p>
        {detail && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{detail}</p>
        )}
        {next.location && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">📍 {next.location}</p>
        )}
      </div>
      <Link
        href="/visit-prep"
        className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
        style={{
          background: urgent ? 'rgba(245,158,11,0.18)' : 'rgba(99,102,241,0.18)',
          border: `1px solid ${urgent ? 'rgba(245,158,11,0.35)' : 'rgba(99,102,241,0.35)'}`,
          color: urgent ? '#FBBF24' : '#818CF8',
        }}
      >
        Prep checklist →
      </Link>
    </div>
  )
}

// ─── ClinicalAlertsSection ─────────────────────────────────────────────────────

function ClinicalAlertsSection({ insights }: { insights: CareHubData['insights'] }) {
  type AlertItem = { key: string; text: string; sub?: string; color: string; bg: string; border: string }
  const alerts: AlertItem[] = []

  const nadirInsight = insights.find(i => {
    const t = `${i.title} ${i.body}`.toLowerCase()
    return t.includes('nadir') || t.includes('neutrophil') || t.includes('wbc') || t.includes('anc')
  })
  if (nadirInsight) {
    alerts.push({
      key: 'nadir',
      text: '⚠️ Nadir period — fever above 100.4°F requires immediate ER visit',
      color: '#FCA5A5',
      bg: 'rgba(239,68,68,0.08)',
      border: 'rgba(239,68,68,0.22)',
    })
  }

  const authInsight = insights.find(i => {
    const t = `${i.title} ${i.body}`.toLowerCase()
    return t.includes('prior auth') || t.includes('authorization') || t.includes('auth expir')
  })
  if (authInsight) {
    alerts.push({
      key: 'auth',
      text: `Insurance action needed · ${authInsight.title}`,
      sub: authInsight.body,
      color: '#FBBF24',
      bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.22)',
    })
  }

  const refillInsight = insights.find(i => {
    const t = `${i.title} ${i.body}`.toLowerCase()
    return t.includes('refill') && (t.includes('day') || t.includes('due'))
  })
  if (refillInsight) {
    alerts.push({
      key: 'refill',
      text: `Refill needed · ${refillInsight.title}`,
      color: '#FBBF24',
      bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.22)',
    })
  }

  if (alerts.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {alerts.map(a => (
        <div
          key={a.key}
          className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ background: a.bg, border: `1px solid ${a.border}` }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
            style={{ backgroundColor: a.color }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium leading-snug">{a.text}</p>
            {a.sub && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{a.sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── WellbeingStrip ────────────────────────────────────────────────────────────

function WellbeingStrip({ patientFirstName, checkinStreak }: {
  patientFirstName: string
  checkinStreak: number
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      const key = 'cc-wellbeing-week'
      const week = currentWeekNumber()
      const stored = localStorage.getItem(key)
      if (stored !== String(week)) {
        setShow(true)
        localStorage.setItem(key, String(week))
      }
    } catch {
      // localStorage unavailable
    }
  }, [])

  if (!show) return null

  return (
    <div
      className="glass rounded-xl p-4 mt-4"
      style={{ borderColor: 'rgba(139,92,246,0.2)' }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🌿</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">How are you holding up?</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
            Caregiving is hard too. What you&apos;re doing for {patientFirstName} matters.
          </p>
          {checkinStreak > 0 && (
            <p className="text-xs font-semibold mt-2" style={{ color: '#A78BFA' }}>
              {`You've been caring for ${patientFirstName} for ${checkinStreak} days 💙`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SeverityTint ──────────────────────────────────────────────────────────────

function SeverityTint({ severity }: { severity: string }) {
  if (severity === 'alert' || severity === 'critical') return <div className="absolute inset-0 rounded-xl bg-red-500/[0.04]" />
  if (severity === 'watch' || severity === 'warning') return <div className="absolute inset-0 rounded-xl bg-amber-500/[0.04]" />
  return <div className="absolute inset-0 rounded-xl bg-emerald-500/[0.04]" />
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export default function CareHubView({ careProfileId, patientName, careGroupName }: CareHubViewProps) {
  const [data, setData] = useState<CareHubData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const patientFirstName = patientName.split(' ')[0]

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/care-hub?careProfileId=${encodeURIComponent(careProfileId)}`)
      if (!res.ok) { setError('Failed to load Care Hub data'); return }
      const json = await res.json()
      if (json.ok) { setData(json.data); setError(null) }
      else setError(json.error || 'Unknown error')
    } catch {
      setError('Failed to load Care Hub data')
    } finally {
      setLoading(false)
    }
  }, [careProfileId])

  useEffect(() => {
    fetchData()
    let interval: ReturnType<typeof setInterval> | null = null
    const startPolling = () => { interval = setInterval(fetchData, 60000) }
    const stopPolling = () => { if (interval) clearInterval(interval) }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') { fetchData(); startPolling() }
      else stopPolling()
    }
    startPolling()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => { stopPolling(); document.removeEventListener('visibilitychange', handleVisibility) }
  }, [fetchData])

  function handleRemind() {
    // TODO: wire to push notification API
    alert(`A gentle check-in reminder will be sent to ${patientFirstName}.`)
  }

  if (loading) return <CareHubSkeleton />

  if (error) {
    return (
      <div className="px-4 sm:px-5 py-8 text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={() => { setLoading(true); fetchData() }} className="mt-3 text-xs text-[var(--accent)] hover:underline">
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const hasCheckins = data.recentCheckins.length > 0
  const status = getStatusBadge(data.todayCheckin)
  const adherencePercent = 0
  const checkinStreak = data.profile?.checkinStreak ?? 0

  if (!hasCheckins && data.medications.length === 0 && data.insights.length === 0) {
    return (
      <div className="px-4 sm:px-5 py-6">
        <div className="glass rounded-2xl p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#A78BFA]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Welcome to Care Hub</h2>
          <p className="text-sm text-[var(--text-muted)] mb-5">
            Your family&apos;s care command center. Start with a daily check-in on the Home tab.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Do today&apos;s check-in
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-5 py-5 sm:py-6">
      {/* Invite family — compact banner when no group */}
      {!careGroupName && (
        <div
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl mb-4"
          style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)' }}
        >
          <svg className="w-3.5 h-3.5 text-[#818CF8] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#818CF8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
          <span className="text-xs text-[var(--text-muted)] flex-1">Invite family to coordinate care together</span>
          <a href="/settings" className="text-xs font-semibold" style={{ color: '#818CF8' }}>Invite →</a>
        </div>
      )}

      {/* Care Group name pill (when connected) */}
      {careGroupName && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 text-sm"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: 'rgba(255,255,255,0.7)' }}
        >
          <svg className="w-4 h-4 text-[#c4b5fd] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
          <span>Care Group: <strong style={{ color: '#c4b5fd' }}>{careGroupName}</strong></span>
        </div>
      )}

      {/* Patient status banner */}
      <div className="cc-glow rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg font-bold">{(patientName || 'P')[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">{patientName}</h1>
            {data.todayCheckin ? (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Mood {data.todayCheckin.mood}/5 · Pain {data.todayCheckin.pain}/10 · Energy {data.todayCheckin.energy}
              </p>
            ) : (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">No check-in today</p>
            )}
          </div>
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${status.className}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Chemo countdown banner */}
      <ChemoCountdownBanner upcoming={data.upcoming} />

      {/* Clinical alerts */}
      <ClinicalAlertsSection insights={data.insights} />

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 card-stagger">

        {/* Symptom Radar — upgraded */}
        <SymptomRadarCard
          recentCheckins={data.recentCheckins}
          adherencePercent={adherencePercent}
          patientFirstName={patientFirstName}
          onRemind={handleRemind}
        />

        {/* Today's Medications */}
        <div className="glass card-hover-glow rounded-xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Today&apos;s Medications
          </h3>
          {data.medications.length === 0 ? null : (
            <div className="space-y-2.5">
              {data.medications.map((med) => {
                const isAsNeeded = med.frequency?.toLowerCase().includes('as needed') ?? false
                return (
                  <div key={med.id} className="flex items-center gap-2.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: isAsNeeded ? '#94a3b8' : '#818CF8' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{med.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {[med.dose, med.frequency].filter(Boolean).join(' · ') || 'No details'}
                      </p>
                    </div>
                    {isAsNeeded && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-[var(--text-muted)] flex-shrink-0">
                        AS NEEDED
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* AI Insights — hidden when empty */}
        {data.insights.length > 0 && (
          <div className="glass card-hover-glow rounded-xl p-4 md:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              AI Insights
            </h3>
            <div className="space-y-2">
              {data.insights.map((insight) => (
                <div key={insight.id} className="relative rounded-xl p-3 overflow-hidden">
                  <SeverityTint severity={insight.severity} />
                  <div className="relative z-10 flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      (insight.severity === 'alert' || insight.severity === 'critical') ? 'bg-red-400' :
                      (insight.severity === 'watch' || insight.severity === 'warning') ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-white">{insight.title}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{insight.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Care Team Activity — hidden when empty */}
        {data.activity.length > 0 && (
          <div className="glass card-hover-glow rounded-xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Care Team Activity
            </h3>
            <div className="space-y-3">
              {data.activity.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#6366F1]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-[#A78BFA]">
                      {(item.userName || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white">
                      <span className="font-medium">{item.userName || 'Team member'}</span>{' '}
                      <span className="text-[var(--text-muted)]">{ACTION_LABELS[item.action] || item.action}</span>
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {item.createdAt ? relativeTime(item.createdAt) : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming — with Prep button within 48h */}
        {data.upcoming.length > 0 && (
          <div className="glass card-hover-glow rounded-xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Upcoming
            </h3>
            <div className="space-y-3">
              {data.upcoming.map((appt) => {
                const d = appt.dateTime ? new Date(appt.dateTime) : null
                const days = appt.dateTime ? daysUntil(appt.dateTime) : null
                const within48h = days !== null && days <= 2
                return (
                  <div key={appt.id} className="flex items-start gap-3">
                    {d && (
                      <div className="flex-shrink-0 w-10 text-center">
                        <div className="text-[10px] uppercase text-[var(--text-muted)]">
                          {d.toLocaleDateString(undefined, { month: 'short' })}
                        </div>
                        <div className="text-lg font-bold text-white leading-tight">{d.getDate()}</div>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {appt.doctorName || 'Appointment'}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {[
                          appt.specialty,
                          d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null,
                          appt.location,
                        ].filter(Boolean).join(' · ')}
                      </p>
                      {appt.purpose && (
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{appt.purpose}</p>
                      )}
                    </div>
                    {within48h && (
                      <Link
                        href="/visit-prep"
                        className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                        style={{
                          background: 'rgba(99,102,241,0.13)',
                          border: '1px solid rgba(99,102,241,0.3)',
                          color: '#818CF8',
                        }}
                      >
                        Prep ✓
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Caregiver Wellbeing Strip */}
      <WellbeingStrip patientFirstName={patientFirstName} checkinStreak={checkinStreak} />
    </div>
  )
}

function CareHubSkeleton() {
  return (
    <div className="px-4 sm:px-5 py-5 sm:py-6">
      <div className="rounded-2xl bg-white/[0.04] p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/[0.06] animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-32 rounded bg-white/[0.06] animate-pulse mb-1.5" />
            <div className="h-3 w-48 rounded bg-white/[0.04] animate-pulse" />
          </div>
          <div className="h-5 w-16 rounded-full bg-white/[0.06] animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-white/[0.04] p-4">
            <div className="h-3 w-24 rounded bg-white/[0.06] animate-pulse mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-white/[0.04] animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-white/[0.04] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
