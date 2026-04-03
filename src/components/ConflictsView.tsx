'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { detectConflicts, getResolutionOptions, type Conflict, type ProfileAppointment } from '@/lib/conflicts'
import type { CareProfile, Appointment, CareTeamMember } from '@/lib/types'

interface ConflictsViewProps {
  profiles: CareProfile[]
  currentProfileId: string
  careTeamMembers: CareTeamMember[]
}

export function ConflictsView({ profiles, careTeamMembers }: ConflictsViewProps) {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function loadConflicts() {
      const supabase = createClient()
      const appointmentsByProfile = new Map<string, Appointment[]>()

      // Fetch appointments for ALL profiles in parallel
      const results = await Promise.all(
        profiles.map(async (profile) => {
          const { data } = await supabase
            .from('appointments')
            .select('*')
            .eq('care_profile_id', profile.id)
            .order('date_time', { ascending: true })
          return { profileId: profile.id, appointments: data || [] }
        })
      )

      for (const { profileId, appointments } of results) {
        appointmentsByProfile.set(profileId, appointments)
      }

      const detected = detectConflicts(profiles, appointmentsByProfile)
      setConflicts(detected)
      setLoading(false)
    }

    loadConflicts()
  }, [profiles])

  if (loading) {
    return (
      <div className="space-y-3 mt-5">
        <div className="h-20 rounded-xl bg-white/[0.02] skeleton-bone" />
        <div className="h-20 rounded-xl bg-white/[0.02] skeleton-bone" style={{ animationDelay: '0.15s' }} />
      </div>
    )
  }

  if (profiles.length < 2) {
    return (
      <div className="mt-5 text-center py-12">
        <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-[#64748b]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-1.053M18 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-9-3.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </div>
        <div className="text-[#f1f5f9] text-sm font-semibold mb-1">Add another care profile</div>
        <div className="text-[#64748b] text-xs max-w-[240px] mx-auto">Conflict detection works when you manage multiple people (e.g., a child and a grandparent)</div>
      </div>
    )
  }

  if (conflicts.length === 0) {
    return (
      <div className="mt-5 text-center py-12">
        <div className="w-14 h-14 rounded-full bg-[#10b981]/10 flex items-center justify-center mx-auto mb-3">
          <svg width="28" height="28" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="text-[#f1f5f9] text-sm font-semibold mb-1">No conflicts found</div>
        <div className="text-[#64748b] text-xs">All appointments across your {profiles.length} care profiles are clear</div>
      </div>
    )
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[#ef4444] text-[11px] uppercase tracking-wider font-semibold">
          {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Detected
        </div>
        <div className="text-[#64748b] text-[11px]">
          Across {profiles.length} profiles
        </div>
      </div>

      {conflicts.map((conflict, i) => {
        const isExpanded = expandedId === conflict.id
        const resolutions = getResolutionOptions(conflict, careTeamMembers)
        const [a, b] = conflict.appointments

        return (
          <div
            key={conflict.id}
            className={`rounded-xl border overflow-hidden ${
              conflict.severity === 'high'
                ? 'bg-[rgba(239,68,68,0.06)] border-[rgba(239,68,68,0.15)]'
                : 'bg-[rgba(251,191,36,0.06)] border-[rgba(251,191,36,0.15)]'
            }`}
            style={{ animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) both`, animationDelay: `${i * 80}ms` }}
          >
            {/* Conflict header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : conflict.id)}
              className="w-full p-4 text-left"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${conflict.severity === 'high' ? 'bg-[#ef4444] animate-dot-pulse' : 'bg-[#fbbf24]'}`} />
                <span className={`text-xs font-semibold ${conflict.severity === 'high' ? 'text-[#ef4444]' : 'text-[#fbbf24]'}`}>
                  {conflict.type === 'overlap' ? 'TIME CONFLICT' : 'BACK-TO-BACK'}
                </span>
                <span className="text-[#64748b] text-xs ml-auto">{conflict.date}</span>
              </div>

              {/* Two conflicting appointments */}
              <div className="space-y-2">
                <ConflictApptRow appt={a} />
                <div className="flex items-center gap-2 px-2">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[#ef4444] text-[10px] font-semibold">
                    {conflict.type === 'overlap' ? 'OVERLAPS WITH' : 'TIGHT GAP'}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <ConflictApptRow appt={b} />
              </div>

              <div className="flex items-center justify-center mt-2">
                <span className={`text-xs text-[#64748b] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </div>
            </button>

            {/* Resolution options */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-2 animate-slide-down">
                <div className="text-[#94a3b8] text-[11px] uppercase tracking-wider font-semibold mb-2">
                  Resolve This
                </div>
                {resolutions.map((option, j) => (
                  <ResolutionCard key={j} option={option} />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Find caregivers CTA */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🏥</span>
          </div>
          <div>
            <div className="text-[#f1f5f9] text-sm font-semibold">Find Care Services</div>
            <div className="text-[#64748b] text-xs">Search for local caregivers, adult day care, or childcare</div>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={`/chat?prompt=${encodeURIComponent('Help me find local caregiving services — I need care options for when I have scheduling conflicts between my family members')}`}
            className="flex-1 text-center py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-xs font-semibold shimmer-btn relative overflow-hidden"
          >
            Search with AI
          </a>
          <a
            href="/care-team"
            className="flex-1 text-center py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-xs font-semibold"
          >
            Ask Care Team
          </a>
        </div>
      </div>
    </div>
  )
}

function ConflictApptRow({ appt }: { appt: ProfileAppointment }) {
  const time = appt.date_time
    ? new Date(appt.date_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '—'

  return (
    <div className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-3 py-2.5">
      <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-[#94a3b8]">{appt.profileName.charAt(0)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[#f1f5f9] text-sm font-medium truncate">
          {appt.profileName} — {appt.doctor_name}
        </div>
        <div className="text-[#94a3b8] text-xs">
          {appt.specialty} · {time}{appt.location ? ` · ${appt.location}` : ''}
        </div>
      </div>
      <div className="text-[#64748b] text-xs font-medium flex-shrink-0">
        {appt.relationship || ''}
      </div>
    </div>
  )
}

function ResolutionCard({ option }: { option: { type: string; label: string; description: string; icon: string; href?: string } }) {
  const content = (
    <div className="flex items-start gap-3 bg-white/[0.03] rounded-lg px-3 py-3 hover:bg-white/[0.06] transition-colors cursor-pointer">
      <span className="text-lg mt-0.5 flex-shrink-0">{option.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[#f1f5f9] text-sm font-medium">{option.label}</div>
        <div className="text-[#64748b] text-xs leading-relaxed">{option.description}</div>
      </div>
      <span className="text-[#64748b] text-sm mt-1 flex-shrink-0">›</span>
    </div>
  )

  if (option.href) {
    return <a href={option.href}>{content}</a>
  }
  return content
}
