import { describe, it, expect } from 'vitest'
import { detectConflicts, getResolutionOptions } from '@/lib/conflicts'
import type { CareProfile, Appointment, CareTeamMember } from '@/lib/types'

// Helper: create a future Date at a given hour
function futureDate(daysFromNow: number, hour: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d
}

function makeProfile(id: string, name: string): CareProfile {
  return {
    id,
    userId: 'user-1',
    patientName: name,
    patientAge: 70,
    relationship: 'parent',
    createdAt: new Date(),
  }
}

function makeAppointment(id: string, profileId: string, dateTime: Date, doctor?: string): Appointment {
  return {
    id,
    careProfileId: profileId,
    doctorName: doctor || 'Dr. Smith',
    specialty: null,
    dateTime,
    location: null,
    purpose: null,
    createdAt: new Date(),
  }
}

describe('conflicts', () => {
  describe('detectConflicts', () => {
    it('returns empty array when no appointments', () => {
      const profiles = [makeProfile('p1', 'Mom')]
      const appts = new Map<string, Appointment[]>()
      expect(detectConflicts(profiles, appts)).toEqual([])
    })

    it('returns empty when appointments are on same profile (not cross-profile)', () => {
      const profiles = [makeProfile('p1', 'Mom')]
      const appts = new Map([
        ['p1', [
          makeAppointment('a1', 'p1', futureDate(3, 10)),
          makeAppointment('a2', 'p1', futureDate(3, 10)),
        ]],
      ])
      expect(detectConflicts(profiles, appts)).toEqual([])
    })

    it('detects overlapping cross-profile appointments', () => {
      const profiles = [makeProfile('p1', 'Mom'), makeProfile('p2', 'Dad')]
      const appts = new Map([
        ['p1', [makeAppointment('a1', 'p1', futureDate(3, 14), 'Dr. A')]],
        ['p2', [makeAppointment('a2', 'p2', futureDate(3, 14), 'Dr. B')]],
      ])
      const result = detectConflicts(profiles, appts)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('overlap')
      expect(result[0].severity).toBe('high')
      expect(result[0].appointments).toHaveLength(2)
    })

    it('detects back-to-back appointments within 30 min buffer', () => {
      const profiles = [makeProfile('p1', 'Mom'), makeProfile('p2', 'Dad')]
      // 1 hour apart (appointment 1: 10:00-11:00, appointment 2: 11:15)
      // Gap = 15 min, which is < 30 min buffer
      const appts = new Map([
        ['p1', [makeAppointment('a1', 'p1', futureDate(3, 10), 'Dr. A')]],
        ['p2', [makeAppointment('a2', 'p2', futureDate(3, 11), 'Dr. B')]],
      ])
      const result = detectConflicts(profiles, appts)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('back-to-back')
      expect(result[0].severity).toBe('medium')
    })

    it('no conflict when appointments are well-spaced', () => {
      const profiles = [makeProfile('p1', 'Mom'), makeProfile('p2', 'Dad')]
      // 3 hours apart — no overlap, no back-to-back
      const appts = new Map([
        ['p1', [makeAppointment('a1', 'p1', futureDate(3, 9), 'Dr. A')]],
        ['p2', [makeAppointment('a2', 'p2', futureDate(3, 13), 'Dr. B')]],
      ])
      expect(detectConflicts(profiles, appts)).toEqual([])
    })

    it('ignores past appointments', () => {
      const profiles = [makeProfile('p1', 'Mom'), makeProfile('p2', 'Dad')]
      const pastDate = new Date(Date.now() - 86400000) // yesterday
      const appts = new Map([
        ['p1', [makeAppointment('a1', 'p1', pastDate, 'Dr. A')]],
        ['p2', [makeAppointment('a2', 'p2', pastDate, 'Dr. B')]],
      ])
      expect(detectConflicts(profiles, appts)).toEqual([])
    })

    it('skips appointments without dateTime', () => {
      const profiles = [makeProfile('p1', 'Mom'), makeProfile('p2', 'Dad')]
      const appts = new Map([
        ['p1', [{ ...makeAppointment('a1', 'p1', futureDate(3, 10)), dateTime: null }]],
        ['p2', [makeAppointment('a2', 'p2', futureDate(3, 10), 'Dr. B')]],
      ])
      expect(detectConflicts(profiles, appts)).toEqual([])
    })
  })

  describe('getResolutionOptions', () => {
    const conflict = {
      id: 'c1',
      type: 'overlap' as const,
      appointments: [
        { ...makeAppointment('a1', 'p1', futureDate(3, 10), 'Dr. A'), profileName: 'Mom', relationship: 'parent' },
        { ...makeAppointment('a2', 'p2', futureDate(3, 10), 'Dr. B'), profileName: 'Dad', relationship: 'parent' },
      ],
      date: 'Friday, Apr 6',
      timeRange: '10:00 AM - 12:00 PM',
      severity: 'high' as const,
    }

    it('includes delegate option when care team exists', () => {
      const team: CareTeamMember[] = [{
        id: 'tm1',
        userId: 'u2',
        role: 'editor',
        careProfileId: 'p1',
        invitedBy: 'u1',
        joinedAt: new Date(),
        createdAt: new Date(),
        email: 'jane@example.com',
        displayName: 'Jane',
      }]
      const options = getResolutionOptions(conflict, team)
      expect(options.some(o => o.type === 'delegate')).toBe(true)
    })

    it('excludes delegate option when no care team', () => {
      const options = getResolutionOptions(conflict, [])
      expect(options.some(o => o.type === 'delegate')).toBe(false)
    })

    it('always includes find-caregiver, chat, and reschedule', () => {
      const options = getResolutionOptions(conflict, [])
      expect(options.some(o => o.type === 'find-caregiver')).toBe(true)
      expect(options.some(o => o.type === 'chat')).toBe(true)
      expect(options.some(o => o.type === 'reschedule')).toBe(true)
    })

    it('chat option includes pre-filled prompt with names', () => {
      const options = getResolutionOptions(conflict, [])
      const chatOption = options.find(o => o.type === 'chat')
      expect(chatOption?.href).toContain('Mom')
      expect(chatOption?.href).toContain('Dad')
    })
  })
})
