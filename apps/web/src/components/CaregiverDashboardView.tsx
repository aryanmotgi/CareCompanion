'use client'

import { useState, useMemo, useEffect } from 'react'
import { PriorityCard } from './PriorityCard'
import { AlertInsights } from './AlertInsights'
import { MedicationReminders } from './MedicationReminders'
import { CheckinCard } from './CheckinCard'
import { parseLabValue } from '@/lib/lab-parsing'
import type { Medication, Appointment, LabResult, ReminderLog } from '@/lib/types'

interface CaregiverDashboardViewProps {
  patientName: string
  medications: Medication[]
  appointments: Appointment[]
  labResults: LabResult[]
  reminderLogs: ReminderLog[]
  cancerType: string | null
  cancerStage: string | null
  treatmentPhase: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  profileId: string
}

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  just_diagnosed:    { label: 'Just Diagnosed',   color: 'text-amber-400 bg-amber-500/10' },
  active_treatment:  { label: 'Active Treatment', color: 'text-blue-400 bg-blue-500/10' },
  between_treatments:{ label: 'Between Cycles',   color: 'text-cyan-400 bg-cyan-500/10' },
  remission:         { label: 'In Remission',     color: 'text-emerald-400 bg-emerald-500/10' },
  unsure:            { label: 'Evaluating',        color: 'text-violet-400 bg-violet-500/10' },
}

type TabKey = 'today' | 'care'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'care',  label: 'Care Plan' },
]

export function CaregiverDashboardView({
  patientName,
  medications,
  appointments,
  labResults,
  reminderLogs,
  cancerType,
  cancerStage,
  treatmentPhase,
  emergencyContactName,
  emergencyContactPhone,
  profileId,
}: CaregiverDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('today')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [careTeam, setCareTeam] = useState<{ display_name: string; role: string; email: string | null }[]>([])

  useEffect(() => {
    fetch('/api/care-team')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.members)) setCareTeam(d.members) })
      .catch(() => {})
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const urgentCards = useMemo(() => {
    const now = new Date()
    const result: {
      id: string
      variant: 'urgent' | 'alert'
      label: string
      title: string
      subtitle: string
      expandedContent: React.ReactNode
    }[] = []

    for (const med of medications) {
      if (!med.refillDate) continue
      const refillDate = new Date(med.refillDate)
      const daysLeft = Math.ceil((refillDate.getTime() - now.getTime()) / 86400000)
      if (daysLeft > 3) continue
      const isOverdue = daysLeft <= 0
      result.push({
        id: `med-${med.id}`,
        variant: isOverdue ? 'urgent' : 'alert',
        label: isOverdue ? 'OVERDUE' : 'REFILL DUE',
        title: `${med.name} refill ${isOverdue ? 'overdue' : daysLeft === 1 ? 'due tomorrow' : `due in ${daysLeft} days`}`,
        subtitle: `${med.prescribingDoctor || 'Care team'} · refill needed`,
        expandedContent: (
          <AlertInsights
            details={
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-[var(--text-muted)]">Dose:</span> <span className="text-[var(--text)]">{med.dose}</span></div>
                <div><span className="text-[var(--text-muted)]">Freq:</span> <span className="text-[var(--text)]">{med.frequency}</span></div>
                {med.pharmacyPhone && (
                  <div className="col-span-2">
                    <a href={`tel:${med.pharmacyPhone}`} className="block text-center py-2 rounded-lg bg-[#6366F1] text-white text-xs font-semibold">
                      Call Pharmacy
                    </a>
                  </div>
                )}
              </div>
            }
            insights={[
              { text: `Call the pharmacy to request a refill for ${med.name}.` },
              { text: `Ask ${med.prescribingDoctor || 'the prescribing doctor'} for a 90-day supply to reduce refill frequency.` },
            ]}
            chatPrompt={`Help me refill ${patientName}'s ${med.name} — it is ${isOverdue ? 'overdue' : `due in ${daysLeft} days`}`}
          />
        ),
      })
    }

    for (const lab of labResults) {
      if (!lab.isAbnormal) continue
      const parsed = parseLabValue(lab.value, lab.referenceRange || '')
      const dir =
        parsed.numericValue !== null && parsed.referenceMin !== null && parsed.numericValue < parsed.referenceMin
          ? 'Below normal'
          : 'Above normal'
      result.push({
        id: `lab-${lab.id}`,
        variant: 'alert',
        label: 'ALERT',
        title: `${lab.testName} — ${lab.value} ${lab.unit}`,
        subtitle: `${dir} (${lab.referenceRange}) · ${lab.source || ''}`,
        expandedContent: (
          <AlertInsights
            details={
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-[var(--text-muted)]">Value:</span> <span className="text-[#ef4444]">{lab.value} {lab.unit}</span></div>
                <div><span className="text-[var(--text-muted)]">Normal:</span> <span className="text-[var(--text)]">{lab.referenceRange}</span></div>
              </div>
            }
            insights={[
              { text: `${patientName}'s ${lab.testName} is ${lab.value} ${lab.unit} — ${dir.toLowerCase()}. Worth discussing with the care team.` },
            ]}
            chatPrompt={`Explain ${patientName}'s ${lab.testName} result of ${lab.value} ${lab.unit}`}
          />
        ),
      })
    }

    return result
  }, [medications, labResults, patientName])

  const upcomingAppointments = useMemo(() => {
    const now = new Date()
    return appointments
      .filter(a => a.dateTime && new Date(a.dateTime) > now)
      .sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime())
      .slice(0, 5)
  }, [appointments])

  const totalUrgent = urgentCards.length

  return (
    <div className="px-4 sm:px-5 py-5 sm:py-6">
      <div
        className="flex gap-1 p-1 rounded-full border border-white/[0.06] mb-6"
        style={{ background: '#1a1d2e' }}
        role="tablist"
      >
        {TABS.map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
              activeTab === tab.key ? 'text-white' : 'text-white/40 hover:text-white/60'
            }`}
            style={activeTab === tab.key ? { background: '#6c63ff' } : undefined}
          >
            <span className="relative inline-flex items-center gap-1.5">
              {tab.label}
              {tab.key === 'today' && totalUrgent > 0 && (
                <span className="min-w-[16px] h-[16px] px-0.5 bg-red-500 rounded-full text-[11px] text-white inline-flex items-center justify-center font-bold leading-none">
                  {totalUrgent}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {activeTab === 'today' && (
        <>
          <h2 className="text-2xl font-bold text-white mb-1">
            {greeting} {'\u{1F44B}'}
          </h2>
          <p className="text-sm text-[#94a3b8] mb-4">
            Checking in on {patientName}
            {totalUrgent > 0
              ? ` — ${totalUrgent} item${totalUrgent !== 1 ? 's' : ''} need${totalUrgent === 1 ? 's' : ''} attention`
              : ' — all clear today'}
          </p>

          {(cancerType || treatmentPhase) && (
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {cancerType && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#A78BFA]/10 text-[#A78BFA]">
                  {cancerType}{cancerStage && cancerStage !== 'Unsure' ? ` — Stage ${cancerStage}` : ''}
                </span>
              )}
              {treatmentPhase && PHASE_LABELS[treatmentPhase] && (
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${PHASE_LABELS[treatmentPhase].color}`}>
                  {PHASE_LABELS[treatmentPhase].label}
                </span>
              )}
            </div>
          )}

          {reminderLogs.length > 0 && (
            <div className="mb-5">
              <MedicationReminders reminders={reminderLogs} />
            </div>
          )}

          {totalUrgent === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-white/[0.05] mb-6"
              style={{ background: '#1a1d2e' }}
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(108,99,255,0.12)' }}>
                <svg width="28" height="28" fill="none" stroke="#6c63ff" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-[var(--text)] text-base font-semibold mb-1">All clear for {patientName}.</p>
              <p className="text-[var(--text-muted)] text-sm">No urgent items need attention.</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {urgentCards.map((card, i) => (
                <PriorityCard
                  key={card.id}
                  variant={card.variant}
                  label={card.label}
                  title={card.title}
                  subtitle={card.subtitle}
                  index={i}
                  expanded={expandedId === card.id}
                  onToggle={() => setExpandedId(expandedId === card.id ? null : card.id)}
                  expandedContent={card.expandedContent}
                />
              ))}
            </div>
          )}

          <div>
            <div className="text-[var(--text-secondary)] text-[11px] uppercase tracking-wider mb-2">Quick Ask</div>
            <div className="flex flex-wrap gap-2">
              {[
                `What does ${patientName} have coming up this week?`,
                `Are any of ${patientName}'s medications due for refill?`,
                `Summarize ${patientName}'s recent lab results`,
                `Help me prep for ${patientName}'s next appointment`,
              ].map(prompt => (
                <a
                  key={prompt}
                  href={`/chat?prompt=${encodeURIComponent(prompt)}`}
                  className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#94a3b8] text-xs hover:bg-white/[0.08] transition-colors"
                >
                  {prompt}
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'care' && (
        <>
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

          {upcomingAppointments.length > 0 && (
            <div className="mb-5">
              <div className="text-[var(--text-secondary)] text-[11px] uppercase tracking-wider mb-3">Upcoming Appointments</div>
              <div className="space-y-3">
                {upcomingAppointments.map((appt, i) => {
                  const apptDate = new Date(appt.dateTime!)
                  const daysUntil = Math.ceil((apptDate.getTime() - Date.now()) / 86400000)
                  const timeStr = apptDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                  const dayStr = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`
                  const accentColor = daysUntil === 0 ? '#ef4444' : daysUntil === 1 ? '#fbbf24' : '#6366F1'
                  return (
                    <PriorityCard
                      key={appt.id}
                      variant="upcoming"
                      label="UPCOMING"
                      title={`${appt.doctorName} — ${appt.specialty}`}
                      subtitle={`${dayStr} at ${timeStr} · ${appt.purpose || ''}`}
                      index={i}
                      expanded={expandedId === `appt-${appt.id}`}
                      onToggle={() => setExpandedId(expandedId === `appt-${appt.id}` ? null : `appt-${appt.id}`)}
                      expandedContent={
                        <AlertInsights
                          details={
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div><span className="text-[var(--text-muted)]">Location:</span> <span className="text-[var(--text)]">{appt.location}</span></div>
                              <div><span className="text-[var(--text-muted)]">Purpose:</span> <span className="text-[var(--text)]">{appt.purpose}</span></div>
                            </div>
                          }
                          insights={[
                            { text: `Write down your top questions for ${appt.doctorName} before you go.` },
                            { text: `Bring a list of current medications and any new symptoms since the last visit.` },
                          ]}
                          chatPrompt={`Help me prepare for ${patientName}'s ${appt.specialty} appointment with ${appt.doctorName}`}
                        />
                      }
                      accentBorder={accentColor}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {(emergencyContactName || emergencyContactPhone) && (
            <div className="mb-4 p-4 rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(239,68,68,0.04)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.12)' }}>
                  <svg width="20" height="20" fill="none" stroke="#ef4444" strokeWidth="1.75" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">Emergency Contact</p>
                  <p className="text-xs text-white/50">{emergencyContactName}</p>
                </div>
                {emergencyContactPhone && (
                  <a
                    href={`tel:${emergencyContactPhone}`}
                    className="px-3 py-1.5 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] text-xs font-semibold hover:bg-[#ef4444]/20 transition-colors"
                  >
                    Call
                  </a>
                )}
              </div>
            </div>
          )}

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
        </>
      )}
    </div>
  )
}
