'use client'

import { DashboardView } from './DashboardView'
import type { Medication, Appointment, LabResult, Claim } from '@/lib/types'

interface SelfCareDashboardViewProps {
  patientName: string
  userName?: string
  medications: Medication[]
  appointments: Appointment[]
  labResults: LabResult[]
  claims: Claim[]
  cancerType?: string | null
  cancerStage?: string | null
  treatmentPhase?: string | null
  onboardingComplete?: boolean
  priorities?: string[] | null
  hasEmergencyContact?: boolean
  hasDocumentsScanned?: boolean
  profileCreatedAt?: string
  allergies?: string | null
  conditions?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  doctorCount?: number
  profileId?: string | null
  shareHealthCard?: React.ReactNode
  insightsContent?: React.ReactNode
  moodCheckIn: string | null
  supportStyle: string | null
}

const MOOD_CONFIG: Record<string, { greeting: string; color: string; bg: string; border: string }> = {
  okay:        { greeting: 'Good to see you',        color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)' },
  anxious:     { greeting: "I've got you",            color: '#818CF8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.2)' },
  overwhelmed: { greeting: 'One thing at a time',    color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)' },
  proactive:   { greeting: 'Ready to make progress', color: '#22d3ee', bg: 'rgba(34,211,238,0.08)',  border: 'rgba(34,211,238,0.2)' },
}

const SUPPORT_CONFIG: Record<string, { label: string; desc: string; href: string; emoji: string }> = {
  informed:     { emoji: '📊', label: 'Review your results',      desc: 'Stay on top of your latest lab results',    href: '/chat?prompt=explain+my+latest+lab+results' },
  check_in:     { emoji: '🫶', label: 'Log how you feel today',   desc: 'Track your symptoms and energy',             href: '/chat?prompt=log+how+I+feel+today' },
  appointments: { emoji: '📅', label: 'Prep for your next visit', desc: "Get ready for what's coming up",            href: '/chat?prompt=help+me+prep+for+my+next+appointment' },
  available:    { emoji: '💬', label: 'Ask me anything',          desc: 'Your AI companion is right here',            href: '/chat' },
}

function MoodSupportBanner({ moodCheckIn, supportStyle, firstName }: {
  moodCheckIn: string
  supportStyle: string
  firstName: string
}) {
  const mood = MOOD_CONFIG[moodCheckIn] ?? MOOD_CONFIG.okay
  const support = SUPPORT_CONFIG[supportStyle] ?? SUPPORT_CONFIG.available

  return (
    <div className="px-4 sm:px-5 pt-5 sm:pt-6 space-y-3">
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border"
        style={{ background: mood.bg, color: mood.color, borderColor: mood.border }}
      >
        {mood.greeting}, {firstName}
      </div>

      <a
        href={support.href}
        className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
      >
        <span className="text-xl leading-none flex-shrink-0">{support.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{support.label}</p>
          <p className="text-xs text-white/50 mt-0.5">{support.desc}</p>
        </div>
        <svg className="w-4 h-4 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </a>
    </div>
  )
}

export function SelfCareDashboardView(props: SelfCareDashboardViewProps) {
  const { moodCheckIn, supportStyle, ...rest } = props
  const firstName = (rest.userName || rest.patientName || 'there').split(' ')[0]

  if (!moodCheckIn || !supportStyle) return <DashboardView {...rest} />

  return (
    <>
      <MoodSupportBanner moodCheckIn={moodCheckIn} supportStyle={supportStyle} firstName={firstName} />
      <DashboardView {...rest} />
    </>
  )
}
