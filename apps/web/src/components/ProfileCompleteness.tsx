'use client'

import { useState, useEffect, useMemo } from 'react'

interface ProfileCompletenessProps {
  patientName: string | null
  cancerType?: string | null
  cancerStage?: string | null
  treatmentPhase?: string | null
  allergies?: string | null
  conditions?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  medicationCount: number
  doctorCount: number
  appointmentCount: number
  /** When rendered on the profile page, never auto-dismiss */
  alwaysShow?: boolean
}

interface CompletionItem {
  key: string
  label: string
  weight: number
  filled: boolean
  action: string
  href: string
  icon: React.ReactNode
}

export function ProfileCompleteness({
  patientName,
  cancerType,
  cancerStage,
  treatmentPhase,
  allergies,
  conditions,
  emergencyContactName,
  emergencyContactPhone,
  medicationCount,
  doctorCount,
  appointmentCount,
  alwaysShow = false,
}: ProfileCompletenessProps) {
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!alwaysShow && typeof window !== 'undefined') {
      const wasDismissed = localStorage.getItem('profile_completeness_dismissed')
      if (wasDismissed === '1') {
        setDismissed(true)
      }
    }
  }, [alwaysShow])

  const items: CompletionItem[] = useMemo(() => [
    {
      key: 'name',
      label: 'Add patient name',
      weight: 11,
      filled: Boolean(patientName && patientName.trim() && patientName !== 'your loved one'),
      action: 'Add name',
      href: '/profile/edit',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
        </svg>
      ),
    },
    {
      key: 'cancer_type',
      label: 'Set cancer type',
      weight: 11,
      filled: Boolean(cancerType),
      action: 'Add cancer type',
      href: '/onboarding?step=2',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.59-.659L5 14.5m14 0V17a2.25 2.25 0 01-2.25 2.25H7.25A2.25 2.25 0 015 17v-2.5" />
        </svg>
      ),
    },
    {
      key: 'cancer_stage',
      label: 'Set cancer stage',
      weight: 11,
      filled: Boolean(cancerStage),
      action: 'Add stage',
      href: '/onboarding?step=2',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
    {
      key: 'treatment_phase',
      label: 'Set treatment phase',
      weight: 11,
      filled: Boolean(treatmentPhase),
      action: 'Set phase',
      href: '/onboarding?step=2',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'medications',
      label: 'Add a medication',
      weight: 11,
      filled: medicationCount > 0,
      action: 'Add medication',
      href: '/medications',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6v11a3 3 0 01-3 3v0a3 3 0 01-3-3V3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 17v4" />
        </svg>
      ),
    },
    {
      key: 'doctors',
      label: 'Add a doctor',
      weight: 11,
      filled: doctorCount > 0,
      action: 'Add doctor',
      href: '/profile/edit',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.073c0 1.078-.607 2.063-1.577 2.546A11.955 11.955 0 0112 22.5a11.955 11.955 0 01-6.673-1.731c-.97-.483-1.577-1.468-1.577-2.546V14.15" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6a3 3 0 106 0 3 3 0 00-6 0z" />
        </svg>
      ),
    },
    {
      key: 'appointments',
      label: 'Add an appointment',
      weight: 11,
      filled: appointmentCount > 0,
      action: 'Add appointment',
      href: '/appointments',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      ),
    },
    {
      key: 'allergies',
      label: 'Add allergies',
      weight: 11,
      filled: Boolean(allergies && allergies.trim()),
      action: 'Add allergies',
      href: '/profile/edit',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
    },
    {
      key: 'conditions',
      label: 'Add medical conditions',
      weight: 11,
      filled: Boolean(conditions && conditions.trim()),
      action: 'Add conditions',
      href: '/profile/edit',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 011.65 1.586m-5.8 0c-.376.023-.75.05-1.124.08C8.76 4.002 8 4.832 8 5.832v13.338c0 1 .76 1.83 1.726 1.916a48.04 48.04 0 005.548 0c.966-.086 1.726-.916 1.726-1.916V5.832c0-1-.76-1.83-1.726-1.916a48.22 48.22 0 00-1.124-.08" />
        </svg>
      ),
    },
    {
      key: 'emergency_contact',
      label: 'Add emergency contact',
      weight: 11,
      filled: Boolean(emergencyContactName && emergencyContactPhone),
      action: 'Add contact',
      href: '/profile/edit',
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
        </svg>
      ),
    },
  ], [
    patientName, cancerType, cancerStage, treatmentPhase,
    medicationCount, doctorCount, appointmentCount,
    allergies, conditions, emergencyContactName, emergencyContactPhone,
  ])

  const percentage = useMemo(() => {
    let total = 0
    for (const item of items) {
      if (item.filled) total += item.weight
    }
    return Math.min(total, 100)
  }, [items])

  const missingItems = useMemo(() => {
    return items.filter(item => !item.filled)
  }, [items])

  const nextSteps = missingItems.slice(0, 3)
  const isComplete = percentage === 100

  const handleDismiss = () => {
    setDismissed(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('profile_completeness_dismissed', '1')
    }
  }

  const handleReshow = () => {
    setDismissed(false)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('profile_completeness_dismissed')
    }
  }

  // SSR guard
  if (!mounted) return null

  // If dismissed and not forced to show, render a small "re-show" button
  if (dismissed && !alwaysShow) {
    return (
      <button
        onClick={handleReshow}
        className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--lavender)] transition-colors mb-3"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
        Show profile progress
      </button>
    )
  }

  // Compute the SVG circle properties
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="profile-completeness-card rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 mb-4 animate-fade-in-up relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#6366F1]/[0.03] to-[#A78BFA]/[0.06] pointer-events-none" />

      <div className="relative z-10">
        {/* Header row with dismiss button */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Circular progress ring */}
            <div className="relative flex-shrink-0">
              <svg width="88" height="88" viewBox="0 0 88 88" className="profile-progress-ring">
                {/* Background circle */}
                <circle
                  cx="44"
                  cy="44"
                  r={radius}
                  fill="none"
                  stroke="rgba(167, 139, 250, 0.1)"
                  strokeWidth="6"
                />
                {/* Progress circle */}
                <circle
                  cx="44"
                  cy="44"
                  r={radius}
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className="profile-progress-fill"
                  transform="rotate(-90 44 44)"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#A78BFA" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Percentage text in center */}
              <div className="absolute inset-0 flex items-center justify-center">
                {isComplete ? (
                  <svg width="28" height="28" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="text-lg font-bold text-[var(--text)]">{percentage}%</span>
                )}
              </div>
            </div>

            {/* Title & subtitle */}
            <div className="min-w-0">
              {isComplete ? (
                <>
                  <h3 className="text-sm font-semibold text-[#10b981]">Profile complete</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Your care team has everything they need.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-[var(--text)]">Complete your profile</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {missingItems.length} {missingItems.length === 1 ? 'item' : 'items'} remaining for a full profile
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Dismiss button */}
          {!alwaysShow && (
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-[var(--text-muted)] hover:text-[var(--text)] flex-shrink-0"
              aria-label="Dismiss profile completeness"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Next steps — action cards */}
        {!isComplete && nextSteps.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
              Next steps
            </div>
            {nextSteps.map((item, i) => (
              <a
                key={item.key}
                href={item.href}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:border-[var(--lavender)]/20 transition-all animate-press group"
                style={{ animationDelay: `${i * 50}ms` }}
                data-tour={item.key === 'emergency_contact' ? 'emergency-card' : undefined}
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--lavender)]/10 flex items-center justify-center text-[var(--lavender)] flex-shrink-0 group-hover:bg-[var(--lavender)]/15 transition-colors">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text)]">{item.label}</p>
                </div>
                <svg className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 group-hover:text-[var(--lavender)] transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </a>
            ))}
          </div>
        )}

        {/* Celebration state */}
        {isComplete && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#10b981]/[0.08] border border-[#10b981]/20">
            <div className="w-8 h-8 rounded-lg bg-[#10b981]/15 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs text-[#10b981]">
              Your care team has everything they need to support you.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
