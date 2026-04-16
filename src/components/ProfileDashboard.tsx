'use client'

import { AnimatedNumber } from './AnimatedNumber'
import { parseLabValue } from '@/lib/lab-parsing'
import type { CareProfile, Doctor, LabResult } from '@/lib/types'

interface ProfileDashboardProps {
  profile: CareProfile
  doctors: Doctor[]
  labResults: LabResult[]
}

export function ProfileDashboard({ profile, doctors, labResults }: ProfileDashboardProps) {
  const initials = (profile.patientName || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Get latest vitals from lab results
  const getLatestLab = (testName: string) =>
    labResults.find((l) => l.testName.toLowerCase().includes(testName.toLowerCase()))

  const vitals = [
    { label: 'WBC', lab: getLatestLab('WBC') || getLatestLab('White Blood') },
    { label: 'Hemoglobin', lab: getLatestLab('Hemoglobin') || getLatestLab('Hgb') },
    { label: 'Platelets', lab: getLatestLab('Platelet') },
  ]

  return (
    <div className="px-5 py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] mx-auto mb-3 flex items-center justify-center text-white text-[22px] font-bold">
          {initials}
        </div>
        <div className="text-[#f1f5f9] text-xl font-bold">{profile.patientName}</div>
        <div className="text-[#64748b] text-sm">
          {profile.patientAge ? `Age ${profile.patientAge}` : ''}
          {profile.patientAge && profile.relationship ? ' • ' : ''}
          {profile.relationship || ''}
        </div>
      </div>


      {/* Vitals Snapshot */}
      {labResults.length > 0 && (
        <div className="mb-6">
          <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Blood Count Snapshot</div>
          <div className="grid grid-cols-3 gap-2">
            {vitals.map((v) => {
              const parsed = v.lab ? parseLabValue(v.lab.value, v.lab.referenceRange || '') : null
              return (
                <div
                  key={v.label}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center"
                >
                  <div className={`text-lg font-bold ${v.lab?.isAbnormal ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>
                    {v.lab ? (
                      parsed?.isNumeric ? (
                        <AnimatedNumber value={parsed.numericValue!} decimals={v.label === 'A1C' ? 1 : 0} suffix={v.label === 'Blood Pressure' ? `/${v.lab.value!.split('/')[1] || ''}` : ''} />
                      ) : (
                        v.lab.value
                      )
                    ) : (
                      <span className="text-[#64748b]">—</span>
                    )}
                  </div>
                  <div className="text-[#64748b] text-[10px] mt-0.5">{v.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Care Team */}
      {doctors.length > 0 && (
        <div className="mb-6">
          <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Care Team</div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
            {doctors.map((doc) => {
              const docInitials = (doc.name || '?')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
              return (
                <div key={doc.id} className="flex items-center gap-3 p-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-semibold">
                    {docInitials}
                  </div>
                  <div className="flex-1">
                    <div className="text-[#e2e8f0] text-sm font-semibold">{doc.name}</div>
                    <div className="text-[#64748b] text-xs">{doc.specialty}</div>
                  </div>
                  {doc.phone && (
                    <a
                      href={`tel:${doc.phone}`}
                      aria-label={`Call ${doc.name}`}
                      className="w-8 h-8 rounded-full bg-[rgba(34,211,238,0.15)] flex items-center justify-center min-w-[44px] min-h-[44px]"
                    >
                      <svg width="14" height="14" fill="none" stroke="#22d3ee" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                      </svg>
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}


      {/* Emergency Contact */}
      {(profile.emergencyContactName || profile.emergencyContactPhone) && (
        <div className="mb-6">
          <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2">Emergency Contact</div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[#e2e8f0] text-sm font-semibold">{profile.emergencyContactName || 'Unknown'}</div>
              {profile.emergencyContactPhone && (
                <div className="text-[#64748b] text-xs">{profile.emergencyContactPhone}</div>
              )}
            </div>
            {profile.emergencyContactPhone && (
              <a
                href={`tel:${profile.emergencyContactPhone}`}
                aria-label={`Call ${profile.emergencyContactName || 'emergency contact'}`}
                className="w-8 h-8 rounded-full bg-[rgba(34,211,238,0.15)] flex items-center justify-center min-w-[44px] min-h-[44px]"
              >
                <svg width="14" height="14" fill="none" stroke="#22d3ee" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile */}
      <a
        href="/profile/edit"
        className="block w-full text-center py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-sm font-semibold animate-press"
      >
        Edit Profile
      </a>
    </div>
  )
}
