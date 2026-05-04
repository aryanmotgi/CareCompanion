'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { PriorityCard } from './PriorityCard'
import { AlertInsights } from './AlertInsights'
import { AppealGenerator } from './AppealGenerator'
import { CheckinCard } from './CheckinCard'
import { HealthDataChart } from './HealthDataChart'
import GuidedTour from './GuidedTour'
import { parseLabValue } from '@/lib/lab-parsing'
import type { Medication, Appointment, LabResult, Claim } from '@/lib/types'

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
  shareHealthCard,
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('today')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showTourTooltip, setShowTourTooltip] = useState(false)
  const [weeklyUpdate, setWeeklyUpdate] = useState<{
    token: string; title: string | null; createdAt: Date | null; viewCount: number; shareUrl: string
  } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [weeklyUpdateError, setWeeklyUpdateError] = useState(false)

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
    const result: {
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
    }[] = []

    const now = new Date()

    medications.forEach((med) => {
      if (!med.refillDate) return
      const refillDate = new Date(med.refillDate)
      const daysLeft = Math.ceil((refillDate.getTime() - now.getTime()) / 86400000)
      if (daysLeft <= 3) {
        result.push({
          id: `med-${med.id}`,
          variant: 'urgent',
          label: 'URGENT',
          title: `${med.name} refill ${daysLeft <= 0 ? 'overdue' : daysLeft === 1 ? 'due tomorrow' : `due in ${daysLeft} days`}`,
          subtitle: `${med.prescribingDoctor || 'Your care team'} · refill needed`,
          priority: 1,
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
                { text: `Set a reminder ${daysLeft <= 0 ? 'immediately' : 'today'} to follow up on refill for ${med.name}.` },
                { text: `If refills are denied, ask ${med.prescribingDoctor || 'your doctor'} for a new prescription or 90-day supply to avoid running out again.` },
              ]}
              chatPrompt={`Help me manage my ${med.name} refill — it's ${daysLeft <= 0 ? 'overdue' : `due in ${daysLeft} days`}`}
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
          variant: 'upcoming',
          label: 'UPCOMING',
          title: `${appt.doctorName} — ${appt.specialty}`,
          subtitle: `${dayStr} at ${timeStr} · ${appt.purpose || ''}`,
          priority: 2,
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
        variant: 'alert',
        label: 'ALERT',
        title: `${lab.testName} — ${lab.value} ${lab.unit}`,
        subtitle: `${labDirection} (${lab.referenceRange}) · ${lab.source || ''}`,
        priority: 3,
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
        variant: 'alert',
        label: 'ALERT',
        title: `Claim denied — ${claim.providerName}`,
        subtitle: `$${claim.patientResponsibility} patient responsibility · ${claim.denialReason || ''}`,
        priority: 3,
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

  // Today tab: urgent + alert only
  const todayCards = useMemo(
    () => cards.filter(c => c.variant === 'urgent' || c.variant === 'alert'),
    [cards]
  )

  // Care tab: upcoming appointments
  const upcomingCards = useMemo(
    () => cards.filter(c => c.variant === 'upcoming'),
    [cards]
  )

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

  return (
    <>
    <GuidedTour steps={TOUR_STEPS} patientName={patientName} />
    <div className="px-4 sm:px-5 py-5 sm:py-6">

      {/* Pill tab bar */}
      <div
        className="flex gap-1 p-1 rounded-full border border-white/[0.06] mb-5"
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
            className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all duration-200 relative ${
              activeTab === tab.key
                ? 'text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
            style={activeTab === tab.key ? {
              background: '#6c63ff',
              boxShadow: '0 0 16px rgba(108, 99, 255, 0.45), 0 0 32px rgba(108, 99, 255, 0.15)',
              paddingLeft: '1.25rem',
              paddingRight: '1.25rem',
            } : undefined}
          >
            <span className="relative inline-flex items-center gap-1.5">
              {tab.label}
              {tab.key === 'today' && todayCards.length > 0 && (
                <span className="min-w-[15px] h-[15px] px-0.5 bg-red-500 rounded-full text-[9px] text-white inline-flex items-center justify-center font-bold leading-none">
                  {todayCards.length}
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
            {greeting}, {(userName || 'Sarah').split(' ')[0]} 👋
          </h2>
          <p className="text-sm text-[#94a3b8] mb-5">
            {todayCards.length > 0
              ? `${todayCards.length} ${todayCards.length === 1 ? 'item needs' : 'items need'} your attention`
              : 'All caught up — nothing needs attention.'}
          </p>

          {(cancerType || treatmentPhase) && (
            <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-5">
              {cancerType && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#A78BFA]/10 text-[#A78BFA]">
                  {cancerType}{cancerStage && cancerStage !== 'Unsure' ? ` — Stage ${cancerStage}` : ''}
                </span>
              )}
              {treatmentPhase && PHASE_LABELS[treatmentPhase] && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PHASE_LABELS[treatmentPhase].color}`}>
                  {PHASE_LABELS[treatmentPhase].label}
                </span>
              )}
            </div>
          )}
          {!cancerType && !treatmentPhase && <div className="mb-3 sm:mb-4" />}

          {/* Urgent / alert cards or all-caught-up empty state */}
          {todayCards.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-white/[0.05] mb-5"
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
            <div className="space-y-3 card-stagger mb-5" data-tour="dashboard-cards">
              {todayCards.map((card, i) => (
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
          {/* Daily Check-in */}
          {profileId && <CheckinCard careProfileId={profileId} />}

          {/* Care Timeline */}
          <a
            href="/timeline"
            className="flex items-center gap-3 p-4 rounded-2xl border border-white/[0.06] mt-4 mb-4 transition-colors hover:bg-white/[0.06] active:scale-[0.98]"
            style={{ background: 'rgba(99,102,241,0.06)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
              <svg width="20" height="20" fill="none" stroke="#A78BFA" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Care Timeline</p>
              <p className="text-xs text-white/50">Medications, appointments &amp; milestones</p>
            </div>
            <svg width="16" height="16" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </a>

          {/* Next appointment cards */}
          {upcomingCards.length > 0 && (
            <div className="space-y-3 mb-4">
              {upcomingCards.map((card, i) => (
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

          {/* Static upcoming appointment */}
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-[#6c63ff]/20 bg-[#6c63ff]/5 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(108,99,255,0.15)' }}
            >
              <svg width="20" height="20" fill="none" stroke="#A78BFA" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Oncology Follow-up</p>
              <p className="text-xs text-white/50">Dr. Patel &middot; May 8, 2:30 PM</p>
            </div>
            <svg width="16" height="16" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
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

          {/* Share Health Summary */}
          {shareHealthCard}
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
