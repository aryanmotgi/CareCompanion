'use client'

import { useState, useEffect } from 'react'

interface MorningSummaryCardProps {
  medicationCount: number
  nextAppointment?: { doctor: string; when: string } | null
  sleepQuality?: string | null
}

function getTodayKey(): string {
  const d = new Date()
  return `morning_card_dismissed_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MorningSummaryCard({
  medicationCount,
  nextAppointment,
  sleepQuality,
}: MorningSummaryCardProps) {
  const [dismissed, setDismissed] = useState(true) // default hidden until we check localStorage

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(localStorage.getItem(getTodayKey()) === '1')
    }
  }, [])

  // If all data is empty/zero, don't render
  if (medicationCount === 0 && !nextAppointment && !sleepQuality) {
    return null
  }

  if (dismissed) {
    return null
  }

  const handleDismiss = () => {
    localStorage.setItem(getTodayKey(), '1')
    setDismissed(true)
  }

  return (
    <div className="cc-glow mb-4">
      <div className="bg-gradient-to-br from-[rgba(99,102,241,0.12)] to-[rgba(167,139,250,0.08)] rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: '#A78BFA', letterSpacing: '0.1em' }}
          >
            YOUR DAY
          </span>
          <button
            onClick={handleDismiss}
            className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors p-0.5"
            aria-label="Dismiss morning summary"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {medicationCount > 0 && (
            <div className="text-xs text-[var(--text)]">
              <span className="text-[var(--text-muted)]">Meds:</span>{' '}
              {medicationCount} scheduled
            </div>
          )}
          <div className="text-xs text-[var(--text)]">
            <span className="text-[var(--text-muted)]">Appt:</span>{' '}
            {nextAppointment
              ? `${nextAppointment.doctor} ${nextAppointment.when}`
              : 'None today'}
          </div>
          {sleepQuality && (
            <div className="text-xs text-[var(--text)]">
              <span className="text-[var(--text-muted)]">Sleep:</span>{' '}
              {sleepQuality}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
