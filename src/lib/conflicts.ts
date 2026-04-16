import type { Appointment, CareProfile, CareTeamMember } from '@/lib/types'

export interface ProfileAppointment extends Appointment {
  profileName: string
  relationship: string | null
}

export interface Conflict {
  id: string
  type: 'overlap' | 'back-to-back'
  appointments: ProfileAppointment[]
  date: string
  timeRange: string
  severity: 'high' | 'medium'
}

export interface ResolutionOption {
  type: 'delegate' | 'find-caregiver' | 'reschedule' | 'chat'
  label: string
  description: string
  icon: string
  href?: string
}

const ASSUMED_DURATION_MS = 60 * 60 * 1000 // 1 hour default
const BACK_TO_BACK_BUFFER_MS = 30 * 60 * 1000 // 30 min travel buffer

export function detectConflicts(
  profiles: CareProfile[],
  appointmentsByProfile: Map<string, Appointment[]>
): Conflict[] {
  // Flatten all appointments with profile info
  const allAppts: ProfileAppointment[] = []

  for (const profile of profiles) {
    const appts = appointmentsByProfile.get(profile.id) || []
    for (const appt of appts) {
      if (!appt.dateTime) continue
      allAppts.push({
        ...appt,
        profileName: profile.patientName || 'Unknown',
        relationship: profile.relationship,
      })
    }
  }

  // Sort by date_time
  allAppts.sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime())

  const conflicts: Conflict[] = []
  const now = new Date()

  // Compare each pair (only future appointments)
  for (let i = 0; i < allAppts.length; i++) {
    const a = allAppts[i]
    const aStart = new Date(a.dateTime!)
    if (aStart < now) continue
    const aEnd = new Date(aStart.getTime() + ASSUMED_DURATION_MS)

    for (let j = i + 1; j < allAppts.length; j++) {
      const b = allAppts[j]
      const bStart = new Date(b.dateTime!)
      if (bStart < now) continue

      // Skip if same profile (not a cross-profile conflict)
      if (a.careProfileId === b.careProfileId) continue

      // Check for overlap
      const bEnd = new Date(bStart.getTime() + ASSUMED_DURATION_MS)
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({
          id: `conflict-${a.id}-${b.id}`,
          type: 'overlap',
          appointments: [a, b],
          date: aStart.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }),
          timeRange: `${aStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${bEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
          severity: 'high',
        })
        continue
      }

      // Check for back-to-back (within 30 min buffer)
      const gapMs = bStart.getTime() - aEnd.getTime()
      if (gapMs >= 0 && gapMs < BACK_TO_BACK_BUFFER_MS) {
        conflicts.push({
          id: `conflict-${a.id}-${b.id}`,
          type: 'back-to-back',
          appointments: [a, b],
          date: aStart.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }),
          timeRange: `${aStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${bEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
          severity: 'medium',
        })
      }
    }
  }

  return conflicts
}

export function getResolutionOptions(
  conflict: Conflict,
  careTeamMembers: CareTeamMember[]
): ResolutionOption[] {
  const [a, b] = conflict.appointments
  const options: ResolutionOption[] = []

  // Delegate to family/care team
  if (careTeamMembers.length > 0) {
    options.push({
      type: 'delegate',
      label: 'Ask Family to Help',
      description: `Message your care team to see who can take ${b.profileName} to their ${b.specialty || 'appointment'}`,
      icon: '👨‍👩‍👦',
      href: `/care-team`,
    })
  }

  // Find caregivers
  options.push({
    type: 'find-caregiver',
    label: 'Find a Caregiver Nearby',
    description: `Search for ${a.relationship === 'child' || a.relationship === 'son' || a.relationship === 'daughter' ? 'childcare' : 'home care'} services available on ${conflict.date}`,
    icon: '🔍',
  })

  // Ask AI for help
  options.push({
    type: 'chat',
    label: 'Ask AI for Solutions',
    description: `Get personalized suggestions for managing both ${a.profileName}'s and ${b.profileName}'s appointments`,
    icon: '💬',
    href: `/chat?prompt=${encodeURIComponent(`I have a scheduling conflict: ${a.profileName} has a ${a.specialty || 'doctor'} appointment and ${b.profileName} has a ${b.specialty || 'doctor'} appointment at the same time on ${conflict.date}. What are my options?`)}`,
  })

  // Reschedule
  options.push({
    type: 'reschedule',
    label: 'Reschedule One',
    description: `Move ${b.profileName}'s ${b.specialty || 'appointment'} to a different time`,
    icon: '📅',
    href: '/care',
  })

  return options
}
