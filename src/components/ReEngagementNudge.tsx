'use client'

import { useState, useEffect } from 'react'

interface ReEngagementNudgeProps {
  type: string
  title: string
  description: string
  actionLabel: string
  actionHref: string
  icon: React.ReactNode
  onDismiss: () => void
}

function getSnoozeKey(type: string) {
  return `nudge_snoozed_${type}`
}

function getDismissKey(type: string) {
  return `nudge_dismissed_${type}`
}

export function isDismissed(type: string): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(getDismissKey(type)) === '1'
}

export function isSnoozed(type: string): boolean {
  if (typeof window === 'undefined') return false
  const snoozedUntil = localStorage.getItem(getSnoozeKey(type))
  if (!snoozedUntil) return false
  return Date.now() < parseInt(snoozedUntil, 10)
}

export function ReEngagementNudge({
  type,
  title,
  description,
  actionLabel,
  actionHref,
  icon,
  onDismiss,
}: ReEngagementNudgeProps) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // Trigger slide-in after mount
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(getDismissKey(type), '1')
    setExiting(true)
    setTimeout(onDismiss, 300)
  }

  const handleSnooze = () => {
    const threeDays = 3 * 24 * 60 * 60 * 1000
    localStorage.setItem(getSnoozeKey(type), String(Date.now() + threeDays))
    setExiting(true)
    setTimeout(onDismiss, 300)
  }

  return (
    <div
      className="transition-all duration-300 ease-out"
      style={{
        opacity: visible && !exiting ? 1 : 0,
        transform: visible && !exiting ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      <div className="glass-card rounded-2xl border border-[var(--border)] p-4 relative group">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.06] transition-colors"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-start gap-3 pr-6">
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl bg-[var(--lavender-light)] flex items-center justify-center flex-shrink-0">
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{description}</p>

            <div className="flex items-center gap-3 mt-3">
              <a
                href={actionHref}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--lavender)] bg-[var(--lavender-light)] hover:bg-[var(--lavender-glow)] px-3.5 py-1.5 rounded-lg transition-colors"
              >
                {actionLabel}
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </a>
              <button
                onClick={handleSnooze}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                Remind me later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
