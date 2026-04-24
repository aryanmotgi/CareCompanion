'use client'

import { useState, useEffect, useCallback } from 'react'
import { SymptomRadarCard } from './SymptomRadarCard'
import Link from 'next/link'

interface CareHubViewProps {
  careProfileId: string
  patientName: string
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
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function getStatusBadge(checkin: CareHubData['todayCheckin']): {
  label: string
  className: string
} {
  if (!checkin) return { label: 'No Check-in', className: 'bg-white/[0.06] text-[var(--text-muted)]' }
  const { pain, mood } = checkin
  if (pain >= 7 || mood <= 1) {
    return { label: 'Needs Attention', className: 'bg-red-500/15 text-red-300 border border-red-500/20' }
  }
  if (pain >= 4 || mood <= 2) {
    return { label: 'Watch', className: 'bg-amber-500/15 text-amber-300 border border-amber-500/20' }
  }
  return { label: 'All Clear', className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' }
}

function SeverityTint({ severity }: { severity: string }) {
  if (severity === 'alert') return <div className="absolute inset-0 rounded-xl bg-red-500/[0.04]" />
  if (severity === 'watch') return <div className="absolute inset-0 rounded-xl bg-amber-500/[0.04]" />
  return <div className="absolute inset-0 rounded-xl bg-emerald-500/[0.04]" />
}

export default function CareHubView({ careProfileId, patientName }: CareHubViewProps) {
  const [data, setData] = useState<CareHubData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/care-hub?careProfileId=${encodeURIComponent(careProfileId)}`)
      if (!res.ok) {
        setError('Failed to load Care Hub data')
        return
      }
      const json = await res.json()
      if (json.ok) {
        setData(json.data)
        setError(null)
      } else {
        setError(json.error || 'Unknown error')
      }
    } catch {
      setError('Failed to load Care Hub data')
    } finally {
      setLoading(false)
    }
  }, [careProfileId])

  useEffect(() => {
    fetchData()

    // Visibility-aware polling at 60s
    let interval: ReturnType<typeof setInterval> | null = null
    const startPolling = () => {
      interval = setInterval(fetchData, 60000)
    }
    const stopPolling = () => {
      if (interval) clearInterval(interval)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData()
        startPolling()
      } else {
        stopPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchData])

  if (loading) return <CareHubSkeleton />

  if (error) {
    return (
      <div className="px-4 sm:px-5 py-8 text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchData() }}
          className="mt-3 text-xs text-[var(--accent)] hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const hasCheckins = data.recentCheckins.length > 0
  const status = getStatusBadge(data.todayCheckin)
  const adherencePercent = data.medications.length > 0 ? Math.round((data.medications.length / data.medications.length) * 100) : 0

  // Empty state
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
            Your family command center. Complete your first check-in to start tracking wellness.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Complete First Check-in
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
      {/* Patient Status Banner */}
      <div className="cc-glow rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg font-bold">
              {(patientName || 'P')[0].toUpperCase()}
            </span>
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

      {/* 2-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 card-stagger">
        {/* Symptom Radar Card */}
        <SymptomRadarCard
          recentCheckins={data.recentCheckins}
          adherencePercent={adherencePercent}
        />

        {/* Meds Today Card */}
        <div className="glass card-hover-glow rounded-xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Medications
          </h3>
          {data.medications.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No medications tracked</p>
          ) : (
            <div className="space-y-2">
              {data.medications.map((med) => (
                <div key={med.id} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md border border-white/[0.12] bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{med.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {[med.dose, med.frequency].filter(Boolean).join(' · ') || 'No details'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Insights Card (full width) */}
        <div className="glass card-hover-glow rounded-xl p-4 md:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            AI Insights
          </h3>
          {data.insights.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No active insights right now</p>
          ) : (
            <div className="space-y-2">
              {data.insights.map((insight) => (
                <div key={insight.id} className="relative rounded-xl p-3 overflow-hidden">
                  <SeverityTint severity={insight.severity} />
                  <div className="relative z-10">
                    <div className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                        insight.severity === 'alert' ? 'bg-red-400' :
                        insight.severity === 'watch' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-white">{insight.title}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{insight.body}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Care Team Activity Card */}
        <div className="glass card-hover-glow rounded-xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Care Team Activity
          </h3>
          {data.activity.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No recent activity</p>
          ) : (
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
                      <span className="text-[var(--text-muted)]">
                        {ACTION_LABELS[item.action] || item.action}
                      </span>
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {item.createdAt ? relativeTime(item.createdAt) : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Card */}
        <div className="glass card-hover-glow rounded-xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Upcoming
          </h3>
          {data.upcoming.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No upcoming appointments</p>
          ) : (
            <div className="space-y-3">
              {data.upcoming.map((appt) => {
                const d = appt.dateTime ? new Date(appt.dateTime) : null
                return (
                  <div key={appt.id} className="flex items-start gap-3">
                    {d && (
                      <div className="flex-shrink-0 w-10 text-center">
                        <div className="text-[10px] uppercase text-[var(--text-muted)]">
                          {d.toLocaleDateString(undefined, { month: 'short' })}
                        </div>
                        <div className="text-lg font-bold text-white leading-tight">
                          {d.getDate()}
                        </div>
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
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {appt.purpose && (
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
                          {appt.purpose}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
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
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`rounded-xl bg-white/[0.04] p-4 ${i === 2 ? 'md:col-span-2' : ''}`}
          >
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
