'use client'

import { useState, useMemo, useEffect } from 'react'
import { PriorityCard } from './PriorityCard'
import { TreatmentCycleTracker } from './TreatmentCycleTracker'
import { AnimatedNumber } from './AnimatedNumber'
import { AlertInsights } from './AlertInsights'
import { NudgeManager } from './NudgeManager'
import { ProfileCompleteness } from './ProfileCompleteness'
import { AppealGenerator } from './AppealGenerator'
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
}

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  just_diagnosed: { label: 'Just Diagnosed', color: 'text-amber-400 bg-amber-500/10' },
  active_treatment: { label: 'Active Treatment', color: 'text-blue-400 bg-blue-500/10' },
  between_treatments: { label: 'Between Cycles', color: 'text-cyan-400 bg-cyan-500/10' },
  remission: { label: 'In Remission', color: 'text-emerald-400 bg-emerald-500/10' },
  unsure: { label: 'Evaluating', color: 'text-violet-400 bg-violet-500/10' },
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
  onboardingComplete = true,
  priorities,
  hasEmergencyContact = false,
  hasDocumentsScanned = false,
  profileCreatedAt,
  allergies,
  conditions,
  emergencyContactName,
  emergencyContactPhone,
  doctorCount = 0,
  profileId,
}: DashboardViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showTourTooltip, setShowTourTooltip] = useState(false)
  const [weeklyUpdate, setWeeklyUpdate] = useState<{
    token: string; title: string | null; createdAt: Date | null; viewCount: number; shareUrl: string
  } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('dashboard_tour_seen')) {
      setShowTourTooltip(true)
    }
  }, [])

  useEffect(() => {
    fetch('/api/share/weekly')
      .then(r => r.json())
      .then(d => { if (d.data?.token) setWeeklyUpdate(d.data) })
      .catch(() => {})
  }, [])

  const dismissTooltip = () => {
    setShowTourTooltip(false)
    localStorage.setItem('dashboard_tour_seen', '1')
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Map priority keys to card ID prefixes for matching
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

    // Medication refill cards
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
          subtitle: `${med.prescribingDoctor || 'Unknown doctor'} · refill needed`,
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
                      className="block w-full text-center py-2 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-xs font-semibold"
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

    // Appointment cards (next 7 days)
    appointments.forEach((appt) => {
      if (!appt.dateTime) return
      const apptDate = new Date(appt.dateTime)
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

    // Abnormal lab alerts
    labResults.forEach((lab) => {
      if (!lab.isAbnormal) return
      const parsed = parseLabValue(lab.value, lab.referenceRange || '')
      result.push({
        id: `lab-${lab.id}`,
        variant: 'alert',
        label: 'ALERT',
        title: `${lab.testName} — ${lab.value} ${lab.unit}`,
        subtitle: `${lab.isAbnormal ? 'Above normal' : 'Normal'} range (${lab.referenceRange}) · ${lab.source || ''}`,
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
                    <div className="flex justify-between text-[10px] text-[#64748b] mt-1">
                      <span>0</span>
                      <span>{parsed.referenceMax ? `Normal: <${parsed.referenceMax}` : ''}</span>
                    </div>
                  </div>
                )}
              </div>
            }
            insights={[
              { text: `Your ${lab.testName} is ${lab.value} ${lab.unit}, above the normal range of ${lab.referenceRange}. Schedule a follow-up to discuss this result.` },
              { text: `Track this value over time — a single reading can be a fluke, but a trend tells the real story.` },
              { text: `Ask your doctor what lifestyle changes (diet, exercise, sleep) could help bring this number into range.` },
              { text: `If you're on medication for this, ask whether your dosage needs adjusting based on this result.` },
            ]}
            chatPrompt={`Explain my ${lab.testName} result of ${lab.value} ${lab.unit} — it's above the normal range of ${lab.referenceRange}. What should I do?`}
          />
        ),
      })
    })

    // Denied claims
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

    // Quick-ask card (always last)
    result.push({
      id: 'quick-ask',
      variant: 'quick-ask',
      label: 'AI ASSISTANT',
      title: 'Ask CareCompanion',
      subtitle: 'Get help understanding your cancer care',
      priority: 99,
      action: 'Start a conversation',
      href: '/chat',
    })

    // Mark cards that match user priorities
    result.forEach(card => {
      card.isPriority = isCardPriority(card.id)
    })

    result.sort((a, b) => {
      // Quick-ask always last
      if (a.variant === 'quick-ask') return 1
      if (b.variant === 'quick-ask') return -1
      // Boost cards matching user priorities
      const aBoost = a.isPriority ? -100 : 0
      const bBoost = b.isPriority ? -100 : 0
      return (a.priority + aBoost) - (b.priority + bBoost)
    })
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medications, appointments, labResults, claims, priorities])

  const actionCount = cards.filter((c) => c.variant !== 'quick-ask').length

  // Personalized quick-ask prompts based on user priorities
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

    // Build prompts: priority-matched first, then fill with defaults
    const matched = priorities
      .map(p => PRIORITY_PROMPTS[p])
      .filter(Boolean)
    const remaining = DEFAULT_PROMPTS.filter(d => !matched.includes(d))
    return [...matched, ...remaining].slice(0, 4)
  }, [priorities])

  return (
    <>
    <div className="px-4 sm:px-5 py-5 sm:py-6">
      <div className="mb-1 text-[var(--text-secondary)] text-xs tracking-wider">{greeting}</div>
      <h2 className="text-fluid-xl font-bold mb-2 animate-greeting">
        {actionCount > 0 ? (
          <>
            <AnimatedNumber value={actionCount} /> {actionCount === 1 ? 'item needs' : 'items need'} attention
          </>
        ) : (
          `Looking good, ${(userName || 'there').split(' ')[0]}!`
        )}
      </h2>
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

      {/* Resume onboarding banner for users who skipped */}
      {onboardingComplete && !cancerType && (
        <a
          href={profileId ? `/onboarding?step=1&profileId=${profileId}` : '/onboarding?step=1'}
          className="block rounded-2xl bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-violet-500/20 p-4 mb-4 hover:border-violet-500/30 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Finish setting up your profile</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Add your diagnosis, medications, and priorities for a personalized experience</p>
            </div>
            <svg className="w-5 h-5 text-violet-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </div>
        </a>
      )}

      {/* Onboarding banner for existing users */}
      {!onboardingComplete && (
        <a
          href={profileId ? `/onboarding?step=1&profileId=${profileId}` : '/onboarding?step=1'}
          className="block mb-4 sm:mb-5 rounded-2xl border border-[#A78BFA]/30 bg-[#A78BFA]/5 p-4 hover:bg-[#A78BFA]/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#A78BFA]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Complete your profile</p>
              <p className="text-xs text-[var(--text-muted)]">Set up your cancer type, treatment phase, and preferences for a personalized experience</p>
            </div>
            <svg className="w-5 h-5 text-[#A78BFA] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </a>
      )}

      {/* Re-engagement nudges for skipped onboarding steps */}
      {onboardingComplete && profileCreatedAt && (
        <NudgeManager
          hasMedications={medications.length > 0}
          hasAppointments={appointments.length > 0}
          hasEmergencyContact={hasEmergencyContact}
          hasDocumentsScanned={hasDocumentsScanned}
          profileCreatedAt={profileCreatedAt}
        />
      )}

      {/* Profile Completeness Indicator */}
      <ProfileCompleteness
        patientName={patientName}
        cancerType={cancerType}
        cancerStage={cancerStage}
        treatmentPhase={treatmentPhase}
        allergies={allergies}
        conditions={conditions}
        emergencyContactName={emergencyContactName}
        emergencyContactPhone={emergencyContactPhone}
        medicationCount={medications.length}
        doctorCount={doctorCount}
        appointmentCount={appointments.length}
      />

      {/* Treatment Cycle Tracker */}
      <TreatmentCycleTracker medications={medications} patientName={patientName} />

      {/* Weekly family update — share card */}
      {weeklyUpdate && (
        <div className="mx-4 sm:mx-5 mb-4 rounded-2xl border border-[#6366F1]/30 bg-gradient-to-r from-[#6366F1]/5 to-[#A78BFA]/5 p-4">
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
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-xs font-semibold text-white hover:opacity-90 transition-opacity"
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

      {actionCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-tour="dashboard-cards">
          <div className="w-16 h-16 rounded-full bg-[#10b981]/10 flex items-center justify-center mb-4">
            <svg width="32" height="32" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="text-[var(--text)] text-lg font-semibold mb-1">All clear!</div>
          <div className="text-[var(--text-muted)] text-sm">No items need your attention right now.</div>

          {/* Quick-start cards for empty data */}
          {(medications.length === 0 || appointments.length === 0 || labResults.length === 0) && (
            <div className="w-full mt-8 space-y-3 text-left">
              <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2 text-center">Get Started</div>
              {medications.length === 0 && (
                <a
                  href="/care?tab=meds"
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" fill="none" stroke="#6366F1" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6v11a3 3 0 01-3 3v0a3 3 0 01-3-3V3z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17v4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">Add your first medication</p>
                    <p className="text-xs text-[var(--text-muted)]">Track doses, refills, and interactions</p>
                  </div>
                  <svg className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </a>
              )}
              {appointments.length === 0 && (
                <a
                  href="/care?tab=appts"
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#22d3ee]/10 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" fill="none" stroke="#22d3ee" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">Schedule an appointment</p>
                    <p className="text-xs text-[var(--text-muted)]">Keep track of upcoming visits and prep</p>
                  </div>
                  <svg className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </a>
              )}
              {labResults.length === 0 && (
                <a
                  href="/scans"
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                      <rect x="9" y="3" width="6" height="4" rx="1" />
                      <path strokeLinecap="round" d="M9 14l2 2 4-4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">Scan a lab report</p>
                    <p className="text-xs text-[var(--text-muted)]">Upload and get AI-powered insights</p>
                  </div>
                  <svg className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 card-stagger" data-tour="dashboard-cards">
          {cards.map((card, i) => (
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

      {/* Quick-ask prompts */}
      {actionCount > 0 && (
        <div className="mt-6 relative" id="quick-ask-section" data-tour="quick-ask">
          <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Quick Ask</div>
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
                {/* Arrow pointing down */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#6366F1]" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tooltip for quick-ask card when no action items */}
      {actionCount === 0 && showTourTooltip && (
        <div className="relative mt-6">
          <div className="flex justify-center">
            <div className="relative bg-[#6366F1] text-white rounded-xl px-4 py-3 shadow-lg max-w-[260px] text-center">
              <p className="text-sm font-medium mb-2">Tap here to ask your AI care companion anything</p>
              <button
                onClick={dismissTooltip}
                className="text-xs font-semibold bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1 transition-colors"
              >
                Got it
              </button>
              {/* Arrow pointing down */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#6366F1]" />
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  )
}
