'use client'

import { PriorityCard } from './PriorityCard'

interface DashboardViewProps {
  patientName: string
  medications: any[]
  appointments: any[]
  notifications: any[]
  labResults: any[]
  claims: any[]
}

export function DashboardView({
  patientName,
  medications,
  appointments,
  notifications,
  labResults,
  claims,
}: DashboardViewProps) {
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  type CardEntry = { variant: 'urgent' | 'upcoming' | 'alert' | 'quick-ask'; title: string; subtitle?: string; action?: string; href?: string; priority: number }
  const cards: CardEntry[] = []

  medications.forEach((med) => {
    if (!med.refill_date) return
    const diff = Math.ceil((new Date(med.refill_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff <= 3) {
      const urgency = diff <= 0 ? 'overdue' : diff === 1 ? 'due tomorrow' : `due in ${diff} days`
      cards.push({
        variant: 'urgent',
        title: `${med.name} refill ${urgency}`,
        subtitle: `${med.dosage || ''} ${med.frequency || ''}`.trim() || undefined,
        action: 'Tap to manage refill',
        href: '/care',
        priority: 0,
      })
    }
  })

  appointments.forEach((appt) => {
    if (!appt.date_time) return
    const apptDate = new Date(appt.date_time)
    const diff = Math.ceil((apptDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff >= 0 && diff <= 7) {
      const dayStr = apptDate.toLocaleDateString('en-US', { weekday: 'long' })
      const timeStr = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      cards.push({
        variant: 'upcoming',
        title: `${appt.doctor_name || 'Appointment'} — ${dayStr} ${timeStr}`,
        subtitle: appt.specialty || undefined,
        href: '/care',
        priority: 1,
      })
    }
  })

  labResults.forEach((lab) => {
    if (lab.is_abnormal) {
      cards.push({
        variant: 'alert',
        title: `${lab.test_name || 'Lab result'} flagged ${lab.flag || 'abnormal'}`,
        subtitle: lab.value ? `Result: ${lab.value}` : undefined,
        action: 'Ask AI about this',
        href: `/chat?prompt=${encodeURIComponent(`Tell me about my ${lab.test_name} result`)}`,
        priority: 2,
      })
    }
  })

  claims.forEach((claim) => {
    if (claim.status === 'denied') {
      cards.push({
        variant: 'alert',
        title: 'Insurance claim denied',
        subtitle: claim.description || claim.provider || undefined,
        action: 'Ask AI for help',
        href: `/chat?prompt=${encodeURIComponent('Help me understand my denied insurance claim')}`,
        priority: 2,
      })
    }
  })

  let quickAskPrompt = 'What should I know about my care this week?'
  const nextAppt = appointments.find((a) => a.date_time && new Date(a.date_time) >= now)
  if (nextAppt) {
    quickAskPrompt = `What should I ask ${nextAppt.doctor_name || 'the doctor'} at my next appointment?`
  }
  cards.push({
    variant: 'quick-ask',
    title: quickAskPrompt,
    action: 'Tap to ask',
    href: `/chat?prompt=${encodeURIComponent(quickAskPrompt)}`,
    priority: 3,
  })

  cards.sort((a, b) => a.priority - b.priority)

  return (
    <div className="px-5 py-4">
      <div className="mb-5">
        <div className="text-[#94a3b8] text-xs">{greeting}</div>
        <h2 className="text-[#f1f5f9] text-xl font-bold mt-0.5">{patientName}&apos;s Care Summary</h2>
      </div>

      <div>
        {cards.map((card, i) => (
          <PriorityCard
            key={`${card.variant}-${i}`}
            variant={card.variant}
            title={card.title}
            subtitle={card.subtitle}
            action={card.action}
            href={card.href}
            index={i}
          />
        ))}
      </div>
    </div>
  )
}
