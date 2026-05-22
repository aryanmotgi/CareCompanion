'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { PriorityCard } from './PriorityCard'
import { AlertInsights } from './AlertInsights'
import { AppealGenerator } from './AppealGenerator'
import { CheckinCard } from './CheckinCard'
import { HealthDataChart } from './HealthDataChart'
import { TreatmentTimeline } from './TreatmentTimeline'
import GuidedTour from './GuidedTour'
import { parseLabValue } from '@/lib/lab-parsing'
import type { Medication, Appointment, LabResult, Claim } from '@/lib/types'
import type { TimelineEvent } from './TimelineNode'

interface DashboardViewProps {
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
}

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  just_diagnosed: { label: 'Just Diagnosed', color: 'text-amber-400 bg-amber-500/10' },
  active_treatment: { label: 'Active Treatment', color: 'text-blue-400 bg-blue-500/10' },
  between_treatments: { label: 'Between Cycles', color: 'text-cyan-400 bg-cyan-500/10' },
  remission: { label: 'In Remission', color: 'text-emerald-400 bg-emerald-500/10' },
  unsure: { label: 'Evaluating', color: 'text-violet-400 bg-violet-500/10' },
}

function parseCycleInfoFromMeds(meds: Medication[]): {
  drugName: string; currentCycle: number; totalCycles: number;
  cycleLengthDays: number; dayInCycle: number; phaseLabel: string; phaseColor: string;
} | null {
  for (const med of meds) {
    const notes = (med.notes || '').toLowerCase()
    const freq = (med.frequency || '').toLowerCase()
    const cycleMatch = notes.match(/cycle\s*(\d+)\s*(?:of|\/)\s*(\d+)/i)
    if (!cycleMatch) continue
    const currentCycle = parseInt(cycleMatch[1])
    const totalCycles = parseInt(cycleMatch[2])
    let cycleLengthDays = 21
    if (freq.includes('every 2 weeks') || freq.includes('every 14')) cycleLengthDays = 14
    if (freq.includes('every 3 weeks') || freq.includes('every 21')) cycleLengthDays = 21
    if (freq.includes('every 4 weeks') || freq.includes('every 28')) cycleLengthDays = 28
    if (freq.includes('weekly')) cycleLengthDays = 7
    let dayInCycle = 1
    if (med.refillDate) {
      const nextInfusion = new Date(med.refillDate)
      const daysUntilNext = Math.ceil((nextInfusion.getTime() - Date.now()) / 86400000)
      dayInCycle = Math.min(Math.max(1, cycleLengthDays - daysUntilNext), cycleLengthDays)
    }
    let phaseLabel = 'Recovery'
    let phaseColor = '#10b981'
    if (dayInCycle <= 2) { phaseLabel = 'Infusion Days'; phaseColor = '#6366F1' }
    else if (dayInCycle >= 8 && dayInCycle <= 14) { phaseLabel = 'Nadir Period'; phaseColor = '#ef4444' }
    else if (dayInCycle >= cycleLengthDays - 3) { phaseLabel = 'Pre-Infusion'; phaseColor = '#f59e0b' }
    return { drugName: med.name, currentCycle, totalCycles, cycleLengthDays, dayInCycle, phaseLabel, phaseColor }
  }
  return null
}

const TOUR_STEPS = [
  {
    target: 'tab-chat',
    title: 'Your care assistant',
    body: "This is your care assistant. Ask anything — medications, appointments, what to expect next. I'll remember everything.",
  },
  {
    target: 'tab-care',
    title: 'Everything about care',
    body: "Everything about [patient name] lives here — medications, appointments, lab results, and your care team.",
  },
  {
    target: 'emergency-card',
    title: 'Emergency card',
    body: "Your emergency card is always ready. Share it with family or save it to your phone — it works without a login.",
  },
]

type TabKey = 'today' | 'care' | 'health'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'care', label: 'My Care' },
  { key: 'health', label: 'Health Data' },
]

interface CardItem {
  id: string
  variant: 'urgent' | 'upcoming' | 'alert' | 'quick-ask'
  label: string
  title: string
  subtitle: string
  priority: number
  action?: string
  href?: string
  expandedContent?: React.ReactNode
  isPriority?: boolean
  name?: string
  daysUntil?: number
}

interface CardGroup {
  groupId: string
  emoji: string
  label: string
  title: string
  previewSubtitle: string
  variant: 'urgent' | 'alert'
  items: CardItem[]
}

function SummaryGroupCard({
  group,
  expanded,
  onToggle,
  expandedChildId,
  onChildToggle,
}: {
  group: CardGroup
  expanded: boolean
  onToggle: () => void
  expandedChildId: string | null
  onChildToggle: (id: string | null) => void
}) {
  const isUrgent = group.variant === 'urgent'
  const borderAccent = isUrgent ? 'border-l-[#ef4444]' : 'border-l-[#fbbf24]'
  const labelColor = isUrgent ? 'text-[#ef4444]' : 'text-[#fbbf24]'
  const dotColor = isUrgent ? 'bg-[#ef4444]' : 'bg-[#fbbf24]'
  const countStyle = isUrgent
    ? 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]'
    : 'bg-[rgba(251,191,36,0.12)] text-[#fbbf24]'

  return (
    <div className="space-y-2">
      <div
        className={`bg-white/[0.04] border border-white/[0.06] border-l-2 ${borderAccent} rounded-xl p-4 cursor-pointer animate-press card-hover-glow`}
        onClick={onToggle}
        role="button"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor} ${isUrgent ? 'animate-dot-pulse' : ''}`} />
          <span className={`text-xs font-semibold ${labelColor}`}>{group.label}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${countStyle}`}>
            {group.items.length}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[var(--text)] text-sm font-semibold">
              {group.emoji} {group.title}
            </div>
            <div className="text-[var(--text-secondary)] text-xs mt-0.5">{group.previewSubtitle}</div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            <span className="text-xs text-[var(--text-muted)]">{expanded ? 'Less' : 'View all'}</span>
            <svg
              className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 pl-3 border-l-2 border-white/[0.08] ml-2">
          {group.items.map((card, i) => (
            <PriorityCard
              key={card.id}
              variant={card.variant}
              label={card.label}
              title={card.title}
              subtitle={card.subtitle}
              action={card.action}
              href={card.href}
              index={i}
              expanded={expandedChildId === card.id}
              onToggle={() => onChildToggle(expandedChildId === card.id ? null : card.id)}
              expandedContent={card.expandedContent}
              isPriority={card.isPriority}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DashboardView({
  patientName,
  userName,
  medications,
  appointments,
  labResults,
  claims,
  cancerType,
  cancerStage,
  treatmentPhase,
  priorities,
  profileId,
  onboardingComplete,
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('today')
  const [iOSBannerDismissed, setIOSBannerDismissed] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('ios_nudge_dismissed') === '1'
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null)
  const [showTourTooltip, setShowTourTooltip] = useState(false)
  const [weeklyUpdate, setWeeklyUpdate] = useState<{
    token: string; title: string | null; createdAt: Date | null; viewCount: number; shareUrl: string
  } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [weeklyUpdateError, setWeeklyUpdateError] = useState(false)
  const [careTeam, setCareTeam] = useState<{ display_name: string; role: string; email: string | null }[]>([])
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[] | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const timelineFetched = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('dashboard_tour_seen')) {
      setShowTourTooltip(true)
    }
  }, [])

  const fetchWeeklyUpdate = useCallback(() => {
    setWeeklyUpdateError(false)
    fetch('/api/share/weekly')
      .then(r => r.json())
      .then(d => { if (d.data?.token) setWeeklyUpdate(d.data) })
      .catch(() => { setWeeklyUpdateError(true) })
  }, [])

  useEffect(() => {
    fetchWeeklyUpdate()
  }, [fetchWeeklyUpdate])

  useEffect(() => {
    fetch('/api/care-team')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.members)) setCareTeam(d.members) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (activeTab !== 'care' || !profileId || timelineFetched.current) return
    timelineFetched.current = true
    setTimelineLoading(true)
    fetch(`/api/timeline?profileId=${encodeURIComponent(profileId)}`)
      .then(r => { if (!r.ok) throw new Error('failed'); return r.json(); })
      .then(d => { setTimelineEvents(Array.isArray(d.data) ? d.data : []) })
      .catch(() => { setTimelineEvents([]) })
      .finally(() => setTimelineLoading(false))
  }, [activeTab, profileId, timelineFetched])

  const dismissTooltip = () => {
    setShowTourTooltip(false)
    localStorage.setItem('dashboard_tour_seen', '1')
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const PRIORITY_TO_CARD_PREFIX: Record<string, string> = {
    side_effects: 'symptom',
    medications: 'med-',
    appointments: 'appt-',
    lab_results: 'lab-',
    insurance: 'claim-',
  }

  const isCardPriority = (cardId: string): boolean => {
    if (!priorities || priorities.length === 0) return false
    return priorities.some(p => {
      const prefix = PRIORITY_TO_CARD_PREFIX[p]
      return prefix && cardId.startsWith(prefix)
    })
  }

  const cards = useMemo(() => {
    const result: CardItem[] = []

    const now = new Date()

    medications.forEach((med) => {
      if (!med.refillDate) return
      const refillDate = new Date(med.refillDate)
      const daysLeft = Math.ceil((refillDate.getTime() - now.getTime()) / 86400000)
      if (daysLeft <= 3) {
        const isOverdue = daysLeft <= 0
        result.push({
          id: `med-${med.id}`,
          name: med.name,
          variant: isOverdue ? 'urgent' : 'alert',
          label: isOverdue ? 'OVERDUE' : 'REFILL DUE',
          title: `${med.name} refill ${isOverdue ? 'overdue' : daysLeft === 1 ? 'due tomorrow' : `due in ${daysLeft} days`}`,
          subtitle: `${med.prescribingDoctor || 'Your care team'} · refill needed`,
          priority: isOverdue ? 1 : 2,
          expandedContent: (
            <AlertInsights
              details={
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[var(--text-muted)]">Dose:</span> <span className="text-[var(--text)]">{med.dose}</span></div>
                    <div><span className="text-[var(--text-muted)]">Frequency:</span> <span className="text-[var(--text)]">{med.frequency}</span></div>
                    <div><span className="text-[var(--text-muted)]">Doctor:</span> <span className="text-[var(--text)]">{med.prescribingDoctor}</span></div>
                    <div><span className="text-[var(--text-muted)]">Notes:</span> <span className="text-[#fbbf24]">{med.notes || '—'}</span></div>
                  </div>
                  {med.pharmacyPhone && (
                    <a
                      href={`tel:${med.pharmacyPhone}`}
                      className="block w-full text-center py-2 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold transition-colors"
                    >
                      Call Pharmacy
                    </a>
                  )}
                </div>
              }
              insights={[
                { text: `Call your pharmacy now to request a refill for ${med.name}. Have your prescription number ready.` },
                { text: `Set a reminder ${isOverdue ? 'immediately' : 'today'} to follow up on refill for ${med.name}.` },
                { text: `If refills are denied, ask ${med.prescribingDoctor || 'your doctor'} for a new prescription or 90-day supply to avoid running out again.` },
              ]}
              chatPrompt={`Help me manage my ${med.name} refill — it's ${isOverdue ? 'overdue' : `due in ${daysLeft} days`}`}
            />
          ),
        })
      }
    })

    appointments.forEach((appt) => {
      if (!appt.dateTime) return
      const apptDate = new Date(appt.dateTime)
      if (apptDate.getTime() <= now.getTime()) return
      const daysUntil = Math.ceil((apptDate.getTime() - now.getTime()) / 86400000)
      if (daysUntil >= 0 && daysUntil <= 7) {
        const timeStr = apptDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        const dayStr = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`
        result.push({
          id: `appt-${appt.id}`,
          name: appt.doctorName || undefined,
          variant: 'upcoming',
          label: 'UPCOMING',
          title: `${appt.doctorName} — ${appt.specialty}`,
          subtitle: `${dayStr} at ${timeStr} · ${appt.purpose || ''}`,
          priority: 3,
          daysUntil,
          expandedContent: (
            <AlertInsights
              details={
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[var(--text-muted)]">Location:</span> <span className="text-[var(--text)]">{appt.location}</span></div>
                    <div><span className="text-[var(--text-muted)]">Purpose:</span> <span className="text-[var(--text)]">{appt.purpose}</span></div>
                  </div>
                  <div className="flex gap-2">
                    {appt.location && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(appt.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Get directions to ${appt.location} (opens in Maps)`}
                        className="flex-1 text-center py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-xs font-semibold"
                      >
                        Get Directions
                      </a>
                    )}
                  </div>
                </div>
              }
              insights={[
                { text: `Write down your top 3 questions for ${appt.doctorName} before you go — you'll forget in the moment.` },
                { text: `Bring a list of current medications and any new symptoms since your last visit.` },
                { text: `Arrive 10-15 minutes early ${appt.location ? `at ${appt.location}` : ''} — parking and check-in take time.` },
                { text: `Take notes during the visit or ask if you can record — details fade fast after you leave.` },
              ]}
              chatPrompt={`Help me prepare for my ${appt.specialty} appointment with ${appt.doctorName}${appt.purpose ? ` for ${appt.purpose}` : ''}`}
            />
          ),
        })
      }
    })

    labResults.forEach((lab) => {
      if (!lab.isAbnormal) return
      const parsed = parseLabValue(lab.value, lab.referenceRange || '')
      const labDirection = (
        parsed.numericValue !== null &&
        parsed.referenceMin !== null &&
        parsed.numericValue < parsed.referenceMin
      ) ? 'Below normal' : 'Above normal'
      result.push({
        id: `lab-${lab.id}`,
        name: lab.testName,
        variant: 'alert',
        label: 'ALERT',
        title: `${lab.testName} — ${lab.value} ${lab.unit}`,
        subtitle: `${labDirection} (${lab.referenceRange}) · ${lab.source || ''}`,
        priority: 4,
        expandedContent: (
          <AlertInsights
            details={
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-[var(--text-muted)]">Value:</span> <span className="text-[#ef4444]">{lab.value} {lab.unit}</span></div>
                  <div><span className="text-[var(--text-muted)]">Normal:</span> <span className="text-[var(--text)]">{lab.referenceRange}</span></div>
                  <div><span className="text-[var(--text-muted)]">Source:</span> <span className="text-[var(--text)]">{lab.source}</span></div>
                  <div><span className="text-[var(--text-muted)]">Date:</span> <span className="text-[var(--text)]">{lab.dateTaken ? new Date(lab.dateTaken).toLocaleDateString() : '—'}</span></div>
                </div>
                {parsed.progressPercent !== null && (
                  <div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] to-[#ef4444]"
                        style={{ width: `${Math.min(parsed.progressPercent, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                      <span>0</span>
                      <span>{parsed.referenceMax ? `Normal: <${parsed.referenceMax}` : ''}</span>
                    </div>
                  </div>
                )}
              </div>
            }
            insights={[
              { text: `Your ${lab.testName} is ${lab.value} ${lab.unit} — ${labDirection.toLowerCase()} the normal range of ${lab.referenceRange}. It's worth discussing this with your care team.` },
              { text: `Track this value over time — a single reading can be a fluke, but a trend tells the real story.` },
              { text: `Ask your doctor what lifestyle changes (diet, exercise, sleep) could help bring this number into range.` },
              { text: `If you're on medication for this, ask whether your dosage needs adjusting based on this result.` },
            ]}
            chatPrompt={`Explain my ${lab.testName} result of ${lab.value} ${lab.unit} — it's above the normal range of ${lab.referenceRange}. What should I do?`}
          />
        ),
      })
    })

    claims.forEach((claim) => {
      if (claim.status !== 'denied') return
      result.push({
        id: `claim-${claim.id}`,
        name: claim.providerName || undefined,
        variant: 'alert',
        label: 'ALERT',
        title: `Claim denied — ${claim.providerName}`,
        subtitle: `$${claim.patientResponsibility} patient responsibility · ${claim.denialReason || ''}`,
        priority: 4,
        expandedContent: (
          <>
          <AlertInsights
            details={
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-[var(--text-muted)]">Billed:</span> <span className="text-[var(--text)]">${claim.billedAmount}</span></div>
                <div><span className="text-[var(--text-muted)]">Paid:</span> <span className="text-[var(--text)]">${claim.paidAmount}</span></div>
                <div><span className="text-[var(--text-muted)]">Your cost:</span> <span className="text-[#ef4444]">${claim.patientResponsibility}</span></div>
                <div><span className="text-[var(--text-muted)]">Reason:</span> <span className="text-[#fbbf24]">{claim.denialReason}</span></div>
              </div>
            }
            insights={[
              { text: `Request the denial letter in writing — you have the right to a formal explanation and it starts the appeal clock.` },
              { text: `Call your insurance and ask exactly what documentation they need to overturn the denial. Get a reference number.` },
              { text: `Ask ${claim.providerName} if they can resubmit with different coding — many denials are coding errors, not coverage issues.` },
              { text: `You can file a formal appeal within 180 days. Most first appeals succeed when medical necessity is documented.` },
            ]}
            chatPrompt={`Help me understand and appeal this denied claim from ${claim.providerName} — denied for "${claim.denialReason}". I owe $${claim.patientResponsibility}.`}
          />
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <AppealGenerator
              claimId={claim.id}
              claimInfo={{
                provider_name: claim.providerName || 'Unknown',
                denial_reason: claim.denialReason || 'Not specified',
                billed_amount: claim.billedAmount || 0,
                patient_responsibility: claim.patientResponsibility || 0,
              }}
            />
          </div>
        </>
        ),
      })
    })

    result.forEach(card => {
      card.isPriority = isCardPriority(card.id)
    })

    result.sort((a, b) => {
      const aBoost = a.isPriority ? -100 : 0
      const bBoost = b.isPriority ? -100 : 0
      return (a.priority + aBoost) - (b.priority + bBoost)
    })
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medications, appointments, labResults, claims, priorities])

  const todayCards = useMemo(
    () => cards.filter(c => c.variant === 'urgent' || c.variant === 'alert'),
    [cards]
  )

  const upcomingCards = useMemo(
    () => cards.filter(c => c.variant === 'upcoming'),
    [cards]
  )

  const nextAppointment = useMemo(() => {
    const now = new Date()
    return appointments
      .filter(a => a.dateTime && new Date(a.dateTime) > now)
      .sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime())[0] ?? null
  }, [appointments])

  const contextualMessage = useMemo(() => {
    if (!nextAppointment?.dateTime) return null
    const days = Math.ceil((new Date(nextAppointment.dateTime).getTime() - Date.now()) / 86400000)
    const label = (nextAppointment.purpose || nextAppointment.specialty || 'appointment').replace(/\s*\(.*?\)\s*/g, '').trim()
    const short = label.length > 40 ? label.slice(0, 37) + '…' : label
    if (days === 0) return `${short} is today — make sure you're prepared`
    if (days === 1) return `${short} tomorrow — write down your questions tonight`
    if (days <= 4) return `${short} in ${days} days — here's what to prep`
    if (days <= 7) return `${short} in ${days} days — coming up this week`
    return null
  }, [nextAppointment])

  const cycleInfo = useMemo(() => parseCycleInfoFromMeds(medications), [medications])

  const groupedTodayCards = useMemo(() => {
    const medItems = todayCards.filter(c => c.id.startsWith('med-'))
    const labItems = todayCards.filter(c => c.id.startsWith('lab-'))
    const claimItems = todayCards.filter(c => c.id.startsWith('claim-'))
    const otherItems = todayCards.filter(
      c => !c.id.startsWith('med-') && !c.id.startsWith('lab-') && !c.id.startsWith('claim-')
    )

    const groups: CardGroup[] = []

    if (medItems.length >= 2) {
      const names = medItems.map(c => c.name).filter((n): n is string => !!n)
      const shownNames = names.slice(0, 2).join(', ')
      const overflow = names.length - 2
      const hasOverdue = medItems.some(c => c.variant === 'urgent')
      groups.push({
        groupId: 'group-med',
        emoji: '💊',
        label: hasOverdue ? 'OVERDUE' : 'REFILLS DUE',
        title: `${medItems.length} medication${medItems.length !== 1 ? 's' : ''} need refills`,
        previewSubtitle: overflow > 0 ? `${shownNames} +${overflow} more` : shownNames,
        variant: hasOverdue ? 'urgent' : 'alert',
        items: medItems,
      })
    }

    if (labItems.length >= 2) {
      const names = labItems.map(c => c.name).filter((n): n is string => !!n)
      const shownNames = names.slice(0, 2).join(', ')
      const overflow = names.length - 2
      groups.push({
        groupId: 'group-lab',
        emoji: '⚠️',
        label: 'ALERT',
        title: `${labItems.length} abnormal lab result${labItems.length !== 1 ? 's' : ''}`,
        previewSubtitle: overflow > 0 ? `${shownNames} +${overflow} more` : shownNames,
        variant: 'alert',
        items: labItems,
      })
    }

    if (claimItems.length >= 2) {
      const names = claimItems.map(c => c.name).filter((n): n is string => !!n)
      const shownNames = names.slice(0, 2).join(', ')
      const overflow = names.length - 2
      groups.push({
        groupId: 'group-claim',
        emoji: '📋',
        label: 'ALERT',
        title: `${claimItems.length} claim${claimItems.length !== 1 ? 's' : ''} denied`,
        previewSubtitle: overflow > 0 ? `${shownNames} +${overflow} more` : shownNames,
        variant: 'alert',
        items: claimItems,
      })
    }

    const singletons: CardItem[] = [
      ...(medItems.length === 1 ? medItems : []),
      ...(labItems.length === 1 ? labItems : []),
      ...(claimItems.length === 1 ? claimItems : []),
      ...otherItems,
    ].sort((a, b) => {
      const aBoost = a.isPriority ? -100 : 0
      const bBoost = b.isPriority ? -100 : 0
      return (a.priority + aBoost) - (b.priority + bBoost)
    })

    return { groups, singletons }
  }, [todayCards])

  const quickAskPrompts = useMemo(() => {
    const PRIORITY_PROMPTS: Record<string, string> = {
      side_effects: "Log today's side effects",
      medications: 'Check my upcoming refills',
      appointments: 'Prep for my next appointment',
      lab_results: 'Explain my latest lab results',
      insurance: 'Check my claim status',
    }
    const DEFAULT_PROMPTS = [
      "Log today's symptoms",
      'Prep for oncology appointment',
      'Track medication side effects',
      'Review my treatment timeline',
    ]

    if (!priorities || priorities.length === 0) return DEFAULT_PROMPTS

    const matched = priorities
      .map(p => PRIORITY_PROMPTS[p])
      .filter(Boolean)
    const remaining = DEFAULT_PROMPTS.filter(d => !matched.includes(d))
    return [...matched, ...remaining].slice(0, 4)
  }, [priorities])

  const totalTodayCount = todayCards.length

  return (
    <>
    <GuidedTour steps={TOUR_STEPS} patientName={patientName} />
    <div className="px-4 sm:px-5 py-5 sm:py-6">

      {/* iOS app nudge — shown to users who completed onboarding, dismissible */}
      {onboardingComplete && !iOSBannerDismissed && (
        <div
          className="flex items-center justify-between gap-3 mb-4 px-3.5 py-2.5 rounded-xl"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg flex-shrink-0">📱</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white/90 leading-tight">CareCompanion is on iOS</p>
              <p className="text-[11px] text-white/45 leading-tight mt-0.5 truncate">Track your health on the go — Apple Health sync included</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href="https://apps.apple.com/app/carecompanion/id6746841246"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
              style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
            >
              Get app
            </a>
            <button
              onClick={() => {
                localStorage.setItem('ios_nudge_dismissed', '1')
                setIOSBannerDismissed(true)
              }}
              className="text-white/25 hover:text-white/50 transition-colors text-base leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Slim tab bar — no glow */}
      <div
        className="flex gap-1 p-1 rounded-full border border-white/[0.06] mb-6"
        style={{ background: '#1a1d2e' }}
        role="tablist"
        aria-label="Dashboard sections"
      >
        {TABS.map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
              activeTab === tab.key
                ? 'text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
            style={activeTab === tab.key ? { background: '#6c63ff' } : undefined}
          >
            <span className="relative inline-flex items-center gap-1.5">
              {tab.label}
              {tab.key === 'today' && totalTodayCount > 0 && (
                <span className="min-w-[16px] h-[16px] px-0.5 bg-red-500 rounded-full text-[11px] text-white inline-flex items-center justify-center font-bold leading-none">
                  {totalTodayCount}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* ── TODAY TAB ── */}
      {activeTab === 'today' && (
        <>
          <h2 className="text-2xl font-bold text-white mb-1">
            {greeting}, {(userName || patientName || 'there').split(' ')[0]} 👋
          </h2>
          <p className="text-sm text-[#94a3b8] mb-4">
            {totalTodayCount > 0
              ? `${totalTodayCount} ${totalTodayCount === 1 ? 'item needs' : 'items need'} your attention`
              : 'All caught up — nothing needs attention.'}
          </p>

          {(cancerType || treatmentPhase) && (
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {cancerType && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#A78BFA]/10 text-[#A78BFA]">
                  {cancerType}{cancerStage && cancerStage !== 'Unsure' ? ` — ${cancerStage.startsWith('Stage') ? cancerStage : `Stage ${cancerStage}`}` : ''}
                </span>
              )}
              {treatmentPhase && PHASE_LABELS[treatmentPhase] && (
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${PHASE_LABELS[treatmentPhase].color}`}>
                  {PHASE_LABELS[treatmentPhase].label}
                </span>
              )}
            </div>
          )}
          {!cancerType && !treatmentPhase && <div className="mb-4" />}

          {/* Urgent / alert cards (grouped) or all-caught-up */}
          {totalTodayCount === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-white/[0.05] mb-6"
              style={{ background: '#1a1d2e' }}
              data-tour="dashboard-cards"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                style={{ background: 'rgba(108,99,255,0.12)' }}
              >
                <svg width="28" height="28" fill="none" stroke="#6c63ff" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-[var(--text)] text-base font-semibold mb-1">You&apos;re all caught up today.</p>
              <p className="text-[var(--text-muted)] text-sm">No urgent items need your attention.</p>
            </div>
          ) : (
            <div className="space-y-3 card-stagger mb-6" data-tour="dashboard-cards">
              {/* Grouped summary cards */}
              {groupedTodayCards.groups.map(group => (
                <SummaryGroupCard
                  key={group.groupId}
                  group={group}
                  expanded={expandedGroupId === group.groupId}
                  onToggle={() => {
                    setExpandedGroupId(expandedGroupId === group.groupId ? null : group.groupId)
                    setExpandedChildId(null)
                  }}
                  expandedChildId={expandedChildId}
                  onChildToggle={setExpandedChildId}
                />
              ))}
              {/* Singleton cards (count == 1 per type, or other types) */}
              {groupedTodayCards.singletons.map((card, i) => (
                <PriorityCard
                  key={card.id}
                  variant={card.variant}
                  label={card.label}
                  title={card.title}
                  subtitle={card.subtitle}
                  action={card.action}
                  href={card.href}
                  index={i}
                  expanded={expandedId === card.id}
                  onToggle={() => setExpandedId(expandedId === card.id ? null : card.id)}
                  expandedContent={card.expandedContent}
                  isPriority={card.isPriority}
                />
              ))}
            </div>
          )}

          {/* Quick Ask */}
          <div className="relative" id="quick-ask-section" data-tour="quick-ask">
            <div className="text-[var(--text-secondary)] text-[11px] uppercase tracking-wider mb-2">Quick Ask</div>
            <div className="flex flex-wrap gap-2">
              {quickAskPrompts.map((prompt) => (
                <a
                  key={prompt}
                  href={`/chat?prompt=${encodeURIComponent(prompt)}`}
                  className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#94a3b8] text-xs hover:bg-white/[0.08] transition-colors animate-press"
                >
                  {prompt}
                </a>
              ))}
            </div>
            {showTourTooltip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50">
                <div className="relative bg-[#6366F1] text-white rounded-xl px-4 py-3 shadow-lg max-w-[260px] text-center">
                  <p className="text-sm font-medium mb-2">Tap here to ask your AI care companion anything</p>
                  <button
                    onClick={dismissTooltip}
                    className="text-xs font-semibold bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1 transition-colors"
                  >
                    Got it
                  </button>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#6366F1]" />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── CARE TAB ── */}
      {activeTab === 'care' && (
        <>
          {/* Contextual message — derived from next upcoming appointment */}
          {contextualMessage && (
            <div className="flex items-start gap-2.5 mb-4 px-3.5 py-3 rounded-xl bg-[#6366F1]/[0.06] border border-[#6366F1]/[0.12]">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#818CF8]" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              <p className="text-xs text-[#a5b4fc] leading-relaxed">{contextualMessage}</p>
            </div>
          )}

          {/* Daily Check-in — primary action, indigo-violet gradient border */}
          {profileId && (
            <div className="relative mb-4">
              <div
                className="absolute inset-0 rounded-[1.25rem] pointer-events-none"
                style={{ boxShadow: '0 0 28px rgba(99,102,241,0.35), 0 0 56px rgba(99,102,241,0.12)' }}
                aria-hidden="true"
              />
              <div className="p-[2px] rounded-[1.25rem] bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#9333EA]">
                <div className="rounded-[1.15rem] overflow-hidden bg-[#0f1120]">
                  <CheckinCard careProfileId={profileId} />
                </div>
              </div>
            </div>
          )}

          {/* What's Next — future events only, timeline format */}
          <div className="mb-4">
            <div className="text-[var(--text-secondary)] text-[11px] uppercase tracking-wider mb-3">What&apos;s Next</div>
            {timelineLoading && (
              <div className="space-y-3 pl-8 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i}>
                    <div className="h-2.5 w-20 bg-white/[0.06] rounded mb-1.5" />
                    <div className="h-14 bg-white/[0.03] rounded-xl border border-white/[0.05]" />
                  </div>
                ))}
              </div>
            )}
            {!timelineLoading && timelineEvents !== null && (
              <TreatmentTimeline
                events={timelineEvents.filter(e => new Date(e.date) >= new Date())}
                hideHeader
                sortAscending
              />
            )}
          </div>

          {/* Upcoming appointment cards — colored left border by time urgency */}
          {upcomingCards.length > 0 && (
            <div className="space-y-3 mb-4">
              {upcomingCards.map((card, i) => {
                const days = card.daysUntil ?? 999
                const accentColor = days === 0 ? '#ef4444' : days === 1 ? '#fbbf24' : '#6366F1'
                return (
                  <PriorityCard
                    key={card.id}
                    variant={card.variant}
                    label={card.label}
                    title={card.title}
                    subtitle={card.subtitle}
                    action={card.action}
                    href={card.href}
                    index={i}
                    expanded={expandedId === card.id}
                    onToggle={() => setExpandedId(expandedId === card.id ? null : card.id)}
                    expandedContent={card.expandedContent}
                    isPriority={card.isPriority}
                    accentBorder={accentColor}
                  />
                )
              })}
            </div>
          )}

          {/* Treatment Cycle mini card — shown when cycle info detected in medication notes */}
          {cycleInfo && (
            <div className="mb-4 p-4 rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(99,102,241,0.04)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cycleInfo.phaseColor}1a` }}>
                  <svg width="20" height="20" fill="none" stroke={cycleInfo.phaseColor} strokeWidth="1.75" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">Treatment Cycle</p>
                  <p className="text-xs" style={{ color: cycleInfo.phaseColor }}>
                    Cycle {cycleInfo.currentCycle} of {cycleInfo.totalCycles} · Day {cycleInfo.dayInCycle} of {cycleInfo.cycleLengthDays}
                  </p>
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: `${cycleInfo.phaseColor}20`, color: cycleInfo.phaseColor }}
                >
                  {cycleInfo.phaseLabel}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((cycleInfo.dayInCycle / cycleInfo.cycleLengthDays) * 100)}%`,
                    background: cycleInfo.phaseColor,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-white/30">Day 1</span>
                <span className="text-[10px] text-white/30">Day {cycleInfo.cycleLengthDays}</span>
              </div>
              {cycleInfo.phaseLabel === 'Nadir Period' && (
                <div className="mt-3 p-2.5 rounded-xl border border-red-500/20" style={{ background: 'rgba(239,68,68,0.06)' }}>
                  <p className="text-xs text-red-400">Watch for fever &gt;100.4°F — immune system is at its lowest. Call your care team immediately if this occurs.</p>
                </div>
              )}
            </div>
          )}

          {/* Care Team row — avatars + invite */}
          <div className="mb-4 p-4 rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <svg width="20" height="20" fill="none" stroke="#818CF8" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Care Team</p>
                <p className="text-xs text-white/50">
                  {careTeam.length === 0
                    ? 'No members yet — invite family or doctors'
                    : `${careTeam.length} member${careTeam.length !== 1 ? 's' : ''} with access`}
                </p>
              </div>
              <div className="flex items-center">
                {careTeam.slice(0, 3).map((m, i) => (
                  <div
                    key={m.email ?? i}
                    title={m.display_name}
                    className="w-7 h-7 rounded-full bg-[#6366F1]/20 border-2 border-[#0f1120] flex items-center justify-center text-[10px] font-bold text-[#818CF8]"
                    style={{ marginLeft: i > 0 ? '-8px' : '0', zIndex: 3 - i, position: 'relative' }}
                  >
                    {(m.display_name || '?').charAt(0).toUpperCase()}
                  </div>
                ))}
                <a
                  href="/care-team"
                  title="Manage care team"
                  className="w-7 h-7 rounded-full bg-white/[0.06] border-2 border-[#0f1120] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
                  style={{ marginLeft: careTeam.length > 0 ? '-8px' : '0', position: 'relative', zIndex: 0 }}
                >
                  <svg width="12" height="12" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Weekly family update */}
          {weeklyUpdate && (
            <div className="mb-4 rounded-2xl border border-[#6366F1]/30 bg-gradient-to-r from-[#6366F1]/5 to-[#A78BFA]/5 p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">This week&apos;s update is ready</p>
                  <p className="text-xs text-white/50 mt-0.5">Share with family to keep everyone in the loop</p>
                  {weeklyUpdate.viewCount > 0 && (
                    <p className="text-xs text-white/30 mt-1">Viewed {weeklyUpdate.viewCount} time{weeklyUpdate.viewCount !== 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin + weeklyUpdate.shareUrl)
                      .then(() => { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000) })
                      .catch(() => {})
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-xs font-semibold text-white transition-colors"
                >
                  {copiedLink ? (
                    <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>Copied!</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.375" /></svg>Copy link</>
                  )}
                </button>
                <a
                  href={weeklyUpdate.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs font-medium text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  Preview
                </a>
              </div>
            </div>
          )}
          {weeklyUpdateError && (
            <div className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)]">Couldn&apos;t load this week&apos;s update.</p>
              <button
                onClick={fetchWeeklyUpdate}
                className="text-xs text-[#A78BFA] hover:text-white transition-colors flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}
        </>
      )}

      {/* ── HEALTH DATA TAB ── */}
      {activeTab === 'health' && (
        <div className="space-y-4 pb-2">
          <HealthDataChart />
        </div>
      )}

    </div>
    </>
  )
}
