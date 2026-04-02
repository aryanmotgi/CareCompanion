'use client'

import { useState } from 'react'
import { PriorityCard } from './PriorityCard'
import { AnimatedNumber } from './AnimatedNumber'
import { parseLabValue } from '@/lib/lab-parsing'
import type { Medication, Appointment, LabResult, Claim } from '@/lib/types'

interface DashboardViewProps {
  patientName: string
  medications: Medication[]
  appointments: Appointment[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  notifications: any[]
  labResults: LabResult[]
  claims: Claim[]
}

export function DashboardView({
  patientName,
  medications,
  appointments,
  labResults,
  claims,
}: DashboardViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const cards: {
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

  // Medication refill cards
  const now = new Date()
  medications.forEach((med) => {
    if (!med.refill_date) return
    const refillDate = new Date(med.refill_date)
    const daysLeft = Math.ceil((refillDate.getTime() - now.getTime()) / 86400000)
    if (daysLeft <= 3) {
      cards.push({
        id: `med-${med.id}`,
        variant: 'urgent',
        label: 'URGENT',
        title: `${med.name} refill ${daysLeft <= 0 ? 'overdue' : daysLeft === 1 ? 'due tomorrow' : `due in ${daysLeft} days`}`,
        subtitle: `${med.quantity_remaining ?? '?'} pills remaining • ${med.prescribing_doctor || 'Unknown doctor'}`,
        priority: 1,
        expandedContent: (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-[#64748b]">Dose:</span> <span className="text-[#e2e8f0]">{med.dose}</span></div>
              <div><span className="text-[#64748b]">Frequency:</span> <span className="text-[#e2e8f0]">{med.frequency}</span></div>
              <div><span className="text-[#64748b]">Doctor:</span> <span className="text-[#e2e8f0]">{med.prescribing_doctor}</span></div>
              <div><span className="text-[#64748b]">Remaining:</span> <span className="text-[#fbbf24]">{med.quantity_remaining} pills</span></div>
            </div>
            {med.pharmacy_phone && (
              <a
                href={`tel:${med.pharmacy_phone}`}
                className="block w-full text-center py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-xs font-semibold"
              >
                Call Pharmacy
              </a>
            )}
          </div>
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
      cards.push({
        id: `appt-${appt.id}`,
        variant: 'upcoming',
        label: 'UPCOMING',
        title: `${appt.doctor_name} — ${appt.specialty}`,
        subtitle: `${dayStr} at ${timeStr} • ${appt.purpose || ''}`,
        priority: 2,
        expandedContent: (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-[#64748b]">Location:</span> <span className="text-[#e2e8f0]">{appt.location}</span></div>
              <div><span className="text-[#64748b]">Purpose:</span> <span className="text-[#e2e8f0]">{appt.purpose}</span></div>
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
              <a
                href={`/chat?prompt=${encodeURIComponent(`Help me prepare for my ${appt.specialty} appointment with ${appt.doctor_name}`)}`}
                className="flex-1 text-center py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-xs font-semibold"
              >
                Prepare with AI
              </a>
            </div>
          </div>
        ),
      })
    }
  })

  // Abnormal lab alerts
  labResults.forEach((lab) => {
    if (!lab.is_abnormal) return
    const parsed = parseLabValue(lab.value, lab.reference_range || '')
    cards.push({
      id: `lab-${lab.id}`,
      variant: 'alert',
      label: 'ALERT',
      title: `${lab.test_name} — ${lab.value} ${lab.unit}`,
      subtitle: `${lab.is_abnormal ? 'Above normal' : 'Normal'} range (${lab.reference_range}) • ${lab.source || ''}`,
      priority: 3,
      expandedContent: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-[#64748b]">Value:</span> <span className="text-[#ef4444]">{lab.value} {lab.unit}</span></div>
            <div><span className="text-[#64748b]">Normal:</span> <span className="text-[#e2e8f0]">{lab.reference_range}</span></div>
            <div><span className="text-[#64748b]">Source:</span> <span className="text-[#e2e8f0]">{lab.source}</span></div>
            <div><span className="text-[#64748b]">Date:</span> <span className="text-[#e2e8f0]">{lab.date_taken ? new Date(lab.date_taken).toLocaleDateString() : '—'}</span></div>
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
      ),
    })
  })

  // Denied claims
  claims.forEach((claim) => {
    if (claim.status !== 'denied') return
    cards.push({
      id: `claim-${claim.id}`,
      variant: 'alert',
      label: 'ALERT',
      title: `Claim denied — ${claim.provider_name}`,
      subtitle: `$${claim.patient_responsibility} patient responsibility • ${claim.denial_reason || ''}`,
      priority: 3,
      expandedContent: (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-[#64748b]">Billed:</span> <span className="text-[#e2e8f0]">${claim.billed_amount}</span></div>
          <div><span className="text-[#64748b]">Paid:</span> <span className="text-[#e2e8f0]">${claim.paid_amount}</span></div>
          <div><span className="text-[#64748b]">Your cost:</span> <span className="text-[#ef4444]">${claim.patient_responsibility}</span></div>
          <div><span className="text-[#64748b]">Reason:</span> <span className="text-[#fbbf24]">{claim.denial_reason}</span></div>
        </div>
      ),
    })
  })

  // Quick-ask card (always last)
  cards.push({
    id: 'quick-ask',
    variant: 'quick-ask',
    label: 'AI ASSISTANT',
    title: 'Ask CareCompanion',
    subtitle: 'Get help understanding your health data',
    priority: 99,
    action: 'Start a conversation',
    href: '/chat',
  })

  cards.sort((a, b) => a.priority - b.priority)
  const actionCount = cards.filter((c) => c.variant !== 'quick-ask').length

  return (
    <div className="px-5 py-6">
      <div className="mb-1 text-[#94a3b8] text-xs uppercase tracking-wider">{greeting}</div>
      <h2 className="text-[#f1f5f9] text-xl font-bold mb-5">
        {actionCount > 0 ? (
          <>
            <AnimatedNumber value={actionCount} /> {actionCount === 1 ? 'item needs' : 'items need'} attention
          </>
        ) : (
          `Looking good, ${patientName.split(' ')[0]}!`
        )}
      </h2>

      {actionCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#10b981]/10 flex items-center justify-center mb-4">
            <svg width="32" height="32" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="text-[#f1f5f9] text-lg font-semibold mb-1">All clear!</div>
          <div className="text-[#64748b] text-sm">No items need your attention right now.</div>
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
            {['Prepare for my appointment', 'Explain my lab results', 'What should I ask my doctor?'].map((prompt) => (
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
