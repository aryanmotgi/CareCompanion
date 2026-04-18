'use client'

import { useState, useEffect } from 'react'
import { ReEngagementNudge, isDismissed, isSnoozed } from './ReEngagementNudge'

interface NudgeManagerProps {
  hasMedications: boolean
  hasAppointments: boolean
  hasEmergencyContact: boolean
  hasDocumentsScanned: boolean
  profileCreatedAt: string
}

interface NudgeConfig {
  type: string
  title: string
  description: string
  actionLabel: string
  actionHref: string
  icon: React.ReactNode
}

const NUDGE_CONFIGS: NudgeConfig[] = [
  {
    type: 'medications',
    title: 'Add your medications',
    description: 'Track refills, interactions, and dosage schedules so nothing falls through the cracks.',
    actionLabel: 'Add medications',
    actionHref: '/medications',
    icon: (
      <svg className="w-5 h-5 text-[var(--lavender)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6v11a3 3 0 01-3 3v0a3 3 0 01-3-3V3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 17v4" />
      </svg>
    ),
  },
  {
    type: 'appointments',
    title: 'Add your next appointment',
    description: "We'll help you prepare questions, set reminders, and track follow-ups.",
    actionLabel: 'Add appointment',
    actionHref: '/care',
    icon: (
      <svg className="w-5 h-5 text-[var(--lavender)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    type: 'emergency_contact',
    title: 'Add an emergency contact',
    description: 'Keep a trusted contact on file so we can help in urgent situations.',
    actionLabel: 'Add contact',
    actionHref: '/profile/edit',
    icon: (
      <svg className="w-5 h-5 text-[var(--lavender)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3" />
      </svg>
    ),
  },
  {
    type: 'documents_scanned',
    title: 'Scan a lab report or prescription',
    description: 'Take a photo of any medical document and we will auto-import the data for you.',
    actionLabel: 'Scan document',
    actionHref: '/scans',
    icon: (
      <svg className="w-5 h-5 text-[var(--lavender)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
      </svg>
    ),
  },
]

export function NudgeManager({
  hasMedications,
  hasAppointments,
  hasEmergencyContact,
  hasDocumentsScanned,
  profileCreatedAt,
}: NudgeManagerProps) {
  const [activeNudge, setActiveNudge] = useState<NudgeConfig | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Don't show nudges if profile was created less than 1 day ago
    const profileAge = Date.now() - new Date(profileCreatedAt).getTime()
    const oneDayMs = 24 * 60 * 60 * 1000
    if (profileAge < oneDayMs) {
      setReady(true)
      return
    }

    // Map of which data is missing
    const missingFlags: Record<string, boolean> = {
      medications: !hasMedications,
      appointments: !hasAppointments,
      emergency_contact: !hasEmergencyContact,
      documents_scanned: !hasDocumentsScanned,
    }

    // Find highest priority nudge that is missing, not dismissed, and not snoozed
    const nudge = NUDGE_CONFIGS.find(
      (config) =>
        missingFlags[config.type] &&
        !isDismissed(config.type) &&
        !isSnoozed(config.type)
    ) ?? null

    setActiveNudge(nudge)
    setReady(true)
  }, [hasMedications, hasAppointments, hasEmergencyContact, hasDocumentsScanned, profileCreatedAt])

  if (!ready || !activeNudge) return null

  return (
    <div className="mb-4">
      <ReEngagementNudge
        key={activeNudge.type}
        type={activeNudge.type}
        title={activeNudge.title}
        description={activeNudge.description}
        actionLabel={activeNudge.actionLabel}
        actionHref={activeNudge.actionHref}
        icon={activeNudge.icon}
        onDismiss={() => setActiveNudge(null)}
      />
    </div>
  )
}
