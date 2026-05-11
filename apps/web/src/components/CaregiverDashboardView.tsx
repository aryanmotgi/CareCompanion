'use client'

import Link from 'next/link'
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

function formatDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(d: Date | string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

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
}: CaregiverDashboardViewProps) {
  const now = new Date()

  const upcomingAppts = appointments
    .filter(a => a.dateTime && new Date(a.dateTime) >= now)
    .slice(0, 3)

  const recentLabs = labResults.slice(0, 3)

  const takenCount = reminderLogs.filter(r => r.status === 'taken').length
  const totalDue = reminderLogs.length
  const allTaken = totalDue > 0 && takenCount === totalDue
  const noneTaken = totalDue > 0 && takenCount === 0
  const medStatusColor = allTaken ? '#34D399' : noneTaken ? '#f87171' : '#FBBF24'
  const medStatusLabel =
    totalDue === 0 ? 'No meds scheduled today' :
    allTaken ? 'All meds taken' :
    `${takenCount} of ${totalDue} taken`

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Patient header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(99,102,241,0.08) 100%)',
        border: '1px solid rgba(139,92,246,0.25)',
        borderRadius: 20,
        padding: '20px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.7)', marginBottom: 6 }}>
          Caring for
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.02em', marginBottom: 12 }}>
          {patientName}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {cancerType && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#A78BFA', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, padding: '4px 10px' }}>
              {cancerType}
            </span>
          )}
          {cancerStage && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 10px' }}>
              {cancerStage}
            </span>
          )}
          {treatmentPhase && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6EE7B7', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 8, padding: '4px 10px' }}>
              {treatmentPhase.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Medication status */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Today&apos;s Medications</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: medStatusColor }}>{medStatusLabel}</span>
        </div>
        {medications.length === 0 ? (
          <div style={{ padding: '14px 16px', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>No medications on file</div>
        ) : (
          <div>
            {medications.map((med) => {
              const log = reminderLogs.find(r => r.medicationName === med.name)
              const taken = log?.status === 'taken'
              return (
                <div key={med.id} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{med.name}</div>
                    {(med.dose || med.frequency) && (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        {med.dose}{med.frequency ? ` · ${med.frequency}` : ''}
                      </div>
                    )}
                  </div>
                  {log && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: taken ? '#34D399' : '#FBBF24',
                      background: taken ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
                      border: `1px solid ${taken ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.25)'}`,
                      borderRadius: 6,
                      padding: '3px 8px',
                    }}>
                      {taken ? 'Taken' : 'Due'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upcoming appointments */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Upcoming Appointments</span>
          <Link href="/care-hub" style={{ fontSize: 12, color: '#A78BFA', textDecoration: 'none' }}>See all</Link>
        </div>
        {upcomingAppts.length === 0 ? (
          <div style={{ padding: '14px 16px', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>No upcoming appointments</div>
        ) : (
          <div>
            {upcomingAppts.map((appt) => (
              <div key={appt.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  flexShrink: 0,
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#A78BFA', lineHeight: 1 }}>
                    {appt.dateTime ? new Date(appt.dateTime).getDate() : '—'}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(167,139,250,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {appt.dateTime ? new Date(appt.dateTime).toLocaleDateString('en-US', { month: 'short' }) : ''}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)', marginBottom: 2 }}>
                    {appt.purpose || appt.specialty || 'Appointment'}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    {appt.doctorName ? `${appt.doctorName} · ` : ''}{formatTime(appt.dateTime)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent labs */}
      {recentLabs.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Recent Labs</span>
          </div>
          <div>
            {recentLabs.map((lab) => (
              <div key={lab.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{lab.testName}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{formatDate(lab.dateTaken)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: lab.isAbnormal ? '#f87171' : 'rgba(255,255,255,0.75)' }}>
                    {lab.value ?? '—'}{lab.unit ? ` ${lab.unit}` : ''}
                  </div>
                  {lab.isAbnormal && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Abnormal
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emergency contact */}
      {emergencyContactName && emergencyContactPhone && (
        <div style={{
          background: 'rgba(248,113,113,0.06)',
          border: '1px solid rgba(248,113,113,0.18)',
          borderRadius: 16,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(248,113,113,0.7)', marginBottom: 4 }}>
              Emergency Contact
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{emergencyContactName}</div>
          </div>
          <a
            href={`tel:${emergencyContactPhone}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 10,
              background: 'rgba(248,113,113,0.12)',
              border: '1px solid rgba(248,113,113,0.25)',
              textDecoration: 'none',
              color: '#f87171',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Call
          </a>
        </div>
      )}

      {/* Chat shortcut */}
      <Link
        href="/chat"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '14px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(99,102,241,0.15) 100%)',
          border: '1px solid rgba(139,92,246,0.3)',
          textDecoration: 'none',
          color: '#A78BFA',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd" />
        </svg>
        Ask AI about {patientName}
      </Link>

    </div>
  )
}
