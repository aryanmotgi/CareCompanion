'use client'

import { useState, useMemo } from 'react'
import { PriorityCard } from './PriorityCard'
import { TreatmentCycleTracker } from './TreatmentCycleTracker'
import { AnimatedNumber } from './AnimatedNumber'
import { AlertInsights } from './AlertInsights'
import { parseLabValue } from '@/lib/lab-parsing'
import type { Medication, Appointment, LabResult, Claim } from '@/lib/types'

interface DashboardViewProps {
  patientName: string
  medications: Medication[]
  appointments: Appointment[]
  labResults: LabResult[]
  claims: Claim[]
  cancerType?: string | null
  cancerStage?: string | null
  treatmentPhase?: string | null
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
  medications,
  appointments,
  labResults,
  claims,
  cancerType,
  cancerStage,
  treatmentPhase,
}: DashboardViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

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
    }[] = []

    const now = new Date()

    // Medication refill cards
    medications.forEach((med) => {
      if (!med.refill_date) return
      const refillDate = new Date(med.refill_date)
      const daysLeft = Math.ceil((refillDate.getTime() - now.getTime()) / 86400000)
      if (daysLeft <= 3) {
        result.push({
          id: `med-${med.id}`,
          variant: 'urgent',
          label: 'URGENT',
          title: `${med.name} refill ${daysLeft <= 0 ? 'overdue' : daysLeft === 1 ? 'due tomorrow' : `due in ${daysLeft} days`}`,
          subtitle: `${med.quantity_remaining ?? '?'} pills remaining · ${med.prescribing_doctor || 'Unknown doctor'}`,
          priority: 1,
          expandedContent: (
            <AlertInsights
              details={
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[var(--text-muted)]">Dose:</span> <span className="text-[var(--text)]">{med.dose}</span></div>
                    <div><span className="text-[var(--text-muted)]">Frequency:</span> <span className="text-[var(--text)]">{med.frequency}</span></div>
                    <div><span className="text-[var(--text-muted)]">Doctor:</span> <span className="text-[var(--text)]">{med.prescribing_doctor}</span></div>
                    <div><span className="text-[var(--text-muted)]">Remaining:</span> <span className="text-[#fbbf24]">{med.quantity_remaining} pills</span></div>
                  </div>
                  {med.pharmacy_phone && (
                    <a
                      href={`tel:${med.pharmacy_phone}`}
                      className="block w-full text-center py-2 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-xs font-semibold"
                    >
                      Call Pharmacy
                    </a>
                  )}
                </div>
              }
              insights={[
                { emoji: '📞', text: `Call your pharmacy now to request a refill for ${med.name}. Have your prescription number ready.` },
                { emoji: '⏰', text: `Set a reminder ${daysLeft <= 0 ? 'immediately' : 'today'} — ${med.quantity_remaining ?? 'few'} pills won't last long at your current dose.` },
                { emoji: '💬', text: `If refills are denied, ask ${med.prescribing_doctor || 'your doctor'} for a new prescription or 90-day supply to avoid running out again.` },
              ]}
              chatPrompt={`Help me manage my ${med.name} refill — I have ${med.quantity_remaining ?? 'few'} pills left and it's ${daysLeft <= 0 ? 'overdue' : `due in ${daysLeft} days`}`}
            />
          ),
        })
      }
    })

    // Appointment cards (next 7 days)
    appointments.forEach((appt) => {
      if (!appt.date_time) return
      const apptDate = new Date(appt.date_time)
      const daysUntil = Math.ceil((apptDate.getTime() - now.getTime()) / 86400000)
      if (daysUntil >= 0 && daysUntil <= 7) {
        const timeStr = apptDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        const dayStr = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`
        result.push({
          id: `appt-${appt.id}`,
          variant: 'upcoming',
          label: 'UPCOMING',
          title: `${appt.doctor_name} — ${appt.specialty}`,
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
                { emoji: '📝', text: `Write down your top 3 questions for ${appt.doctor_name} before you go — you'll forget in the moment.` },
                { emoji: '📋', text: `Bring a list of current medications and any new symptoms since your last visit.` },
                { emoji: '🕐', text: `Arrive 10-15 minutes early ${appt.location ? `at ${appt.location}` : ''} — parking and check-in take time.` },
                { emoji: '📱', text: `Take notes during the visit or ask if you can record — details fade fast after you leave.` },
              ]}
              chatPrompt={`Help me prepare for my ${appt.specialty} appointment with ${appt.doctor_name}${appt.purpose ? ` for ${appt.purpose}` : ''}`}
            />
          ),
        })
      }
    })

    // Abnormal lab alerts
    labResults.forEach((lab) => {
      if (!lab.is_abnormal) return
      const parsed = parseLabValue(lab.value, lab.reference_range || '')
      result.push({
        id: `lab-${lab.id}`,
        variant: 'alert',
        label: 'ALERT',
        title: `${lab.test_name} — ${lab.value} ${lab.unit}`,
        subtitle: `${lab.is_abnormal ? 'Above normal' : 'Normal'} range (${lab.reference_range}) · ${lab.source || ''}`,
        priority: 3,
        expandedContent: (
          <AlertInsights
            details={
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-[var(--text-muted)]">Value:</span> <span className="text-[#ef4444]">{lab.value} {lab.unit}</span></div>
                  <div><span className="text-[var(--text-muted)]">Normal:</span> <span className="text-[var(--text)]">{lab.reference_range}</span></div>
                  <div><span className="text-[var(--text-muted)]">Source:</span> <span className="text-[var(--text)]">{lab.source}</span></div>
                  <div><span className="text-[var(--text-muted)]">Date:</span> <span className="text-[var(--text)]">{lab.date_taken ? new Date(lab.date_taken).toLocaleDateString() : '—'}</span></div>
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
              { emoji: '🩺', text: `Your ${lab.test_name} is ${lab.value} ${lab.unit}, above the normal range of ${lab.reference_range}. Schedule a follow-up to discuss this result.` },
              { emoji: '📊', text: `Track this value over time — a single reading can be a fluke, but a trend tells the real story.` },
              { emoji: '🥗', text: `Ask your doctor what lifestyle changes (diet, exercise, sleep) could help bring this number into range.` },
              { emoji: '💊', text: `If you're on medication for this, ask whether your dosage needs adjusting based on this result.` },
            ]}
            chatPrompt={`Explain my ${lab.test_name} result of ${lab.value} ${lab.unit} — it's above the normal range of ${lab.reference_range}. What should I do?`}
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
        title: `Claim denied — ${claim.provider_name}`,
        subtitle: `$${claim.patient_responsibility} patient responsibility · ${claim.denial_reason || ''}`,
        priority: 3,
        expandedContent: (
          <AlertInsights
            details={
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-[var(--text-muted)]">Billed:</span> <span className="text-[var(--text)]">${claim.billed_amount}</span></div>
                <div><span className="text-[var(--text-muted)]">Paid:</span> <span className="text-[var(--text)]">${claim.paid_amount}</span></div>
                <div><span className="text-[var(--text-muted)]">Your cost:</span> <span className="text-[#ef4444]">${claim.patient_responsibility}</span></div>
                <div><span className="text-[var(--text-muted)]">Reason:</span> <span className="text-[#fbbf24]">{claim.denial_reason}</span></div>
              </div>
            }
            insights={[
              { emoji: '📄', text: `Request the denial letter in writing — you have the right to a formal explanation and it starts the appeal clock.` },
              { emoji: '📞', text: `Call your insurance and ask exactly what documentation they need to overturn the denial. Get a reference number.` },
              { emoji: '🏥', text: `Ask ${claim.provider_name} if they can resubmit with different coding — many denials are coding errors, not coverage issues.` },
              { emoji: '⚖️', text: `You can file a formal appeal within 180 days. Most first appeals succeed when medical necessity is documented.` },
            ]}
            chatPrompt={`Help me understand and appeal this denied claim from ${claim.provider_name} — denied for "${claim.denial_reason}". I owe $${claim.patient_responsibility}.`}
          />
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

    result.sort((a, b) => a.priority - b.priority)
    return result
  }, [medications, appointments, labResults, claims])

  const actionCount = cards.filter((c) => c.variant !== 'quick-ask').length

  return (
    <div className="px-4 sm:px-5 py-5 sm:py-6">
      <div className="mb-1 text-[var(--text-secondary)] text-xs uppercase tracking-wider">{greeting}</div>
      <h2 className="text-fluid-xl font-bold mb-2 animate-greeting">
        {actionCount > 0 ? (
          <>
            <AnimatedNumber value={actionCount} /> {actionCount === 1 ? 'item needs' : 'items need'} attention
          </>
        ) : (
          `Looking good, ${patientName.split(' ')[0]}!`
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

      {/* Treatment Cycle Tracker */}
      <TreatmentCycleTracker medications={medications} patientName={patientName} />

      {actionCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#10b981]/10 flex items-center justify-center mb-4">
            <svg width="32" height="32" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="text-[var(--text)] text-lg font-semibold mb-1">All clear!</div>
          <div className="text-[var(--text-muted)] text-sm">No items need your attention right now.</div>
        </div>
      ) : (
        <div className="space-y-3">
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
            />
          ))}
        </div>
      )}

      {/* Quick-ask prompts */}
      {actionCount > 0 && (
        <div className="mt-6">
          <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Quick Ask</div>
          <div className="flex flex-wrap gap-2">
            {['Log today\'s symptoms', 'Prep for oncology appointment', 'Track medication side effects', 'Review my treatment timeline'].map((prompt) => (
              <a
                key={prompt}
                href={`/chat?prompt=${encodeURIComponent(prompt)}`}
                className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#94a3b8] text-xs hover:bg-white/[0.08] transition-colors animate-press"
              >
                {prompt}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
