import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/lib/system-prompt'
import type { CareProfile, Medication, Doctor, Appointment } from '@/lib/types'

const baseProfile: CareProfile = {
  id: 'p1',
  userId: 'u1',
  patientName: 'Sarah Johnson',
  patientAge: 72,
  relationship: 'mother',
  role: 'caregiver',
  createdAt: new Date('2026-01-01'),
}

describe('buildSystemPrompt', () => {
  it('returns base prompt when no profile', () => {
    const result = buildSystemPrompt(null, null, null, null)
    expect(result).toContain('You are CareCompanion')
    expect(result).not.toContain('CARE PROFILE')
  })

  it('includes patient info from profile', () => {
    const result = buildSystemPrompt(baseProfile, null, null, null)
    expect(result).toContain('Sarah Johnson')
    expect(result).toContain('Age: 72')
    expect(result).toContain('mother')
  })

  it('includes medication details', () => {
    const meds: Medication[] = [{
      id: 'm1',
      careProfileId: 'p1',
      name: 'Metformin',
      dose: '500mg',
      frequency: 'Twice daily',
      prescribingDoctor: 'Dr. Lee',
      refillDate: '2026-04-15',
      notes: null,
      createdAt: new Date('2026-01-01'),
    }]
    const result = buildSystemPrompt(baseProfile, meds, null, null)
    expect(result).toContain('Metformin')
    expect(result).toContain('500mg')
    expect(result).toContain('Twice daily')
    expect(result).toContain('Dr. Lee')
    expect(result).toContain('refill: 2026-04-15')
  })

  it('shows "No medications" when list is empty', () => {
    const result = buildSystemPrompt(baseProfile, [], null, null)
    expect(result).toContain('No medications recorded yet')
  })

  it('includes doctor details', () => {
    const docs: Doctor[] = [{
      id: 'd1',
      careProfileId: 'p1',
      name: 'Dr. Chen',
      specialty: 'Endocrinology',
      phone: '555-0100',
      notes: null,
      createdAt: new Date('2026-01-01'),
    }]
    const result = buildSystemPrompt(baseProfile, null, docs, null)
    expect(result).toContain('Dr. Chen')
    expect(result).toContain('Endocrinology')
    expect(result).toContain('555-0100')
  })

  it('includes appointment details', () => {
    const appts: Appointment[] = [{
      id: 'a1',
      careProfileId: 'p1',
      doctorName: 'Dr. Patel',
      specialty: null,
      dateTime: new Date('2026-05-01T14:00:00Z'),
      location: null,
      purpose: 'Blood pressure check',
      createdAt: new Date('2026-01-01'),
    }]
    const result = buildSystemPrompt(baseProfile, null, null, appts)
    expect(result).toContain('Dr. Patel')
    expect(result).toContain('Blood pressure check')
  })

  it('includes lab results with abnormal flag', () => {
    const result = buildSystemPrompt(baseProfile, null, null, null, {
      labResults: [{
        id: 'l1',
        userId: 'u1',
        testName: 'LDL Cholesterol',
        value: '180',
        unit: 'mg/dL',
        referenceRange: '<100',
        isAbnormal: true,
        dateTaken: '2026-03-15',
        source: 'lab',
        createdAt: new Date('2026-03-15'),
      }],
    })
    expect(result).toContain('LDL Cholesterol')
    expect(result).toContain('180')
    expect(result).toContain('ABNORMAL')
    expect(result).toContain('1 ABNORMAL result')
  })

  it('includes denied claims', () => {
    const result = buildSystemPrompt(baseProfile, null, null, null, {
      claims: [{
        id: 'c1',
        userId: 'u1',
        providerName: 'City Hospital',
        billedAmount: '1200',
        paidAmount: '0',
        patientResponsibility: '1200',
        denialReason: 'Out of network',
        status: 'denied',
        serviceDate: '2026-02-15',
        eobUrl: null,
        createdAt: new Date('2026-02-15'),
      }],
    })
    expect(result).toContain('DENIED CLAIMS')
    expect(result).toContain('City Hospital')
    expect(result).toContain('Out of network')
  })

  it('includes unread notifications', () => {
    const result = buildSystemPrompt(baseProfile, null, null, null, {
      notifications: [{
        id: 'n1',
        userId: 'u1',
        type: 'medication_reminder',
        title: 'Time to take Metformin',
        message: '500mg — morning dose',
        isRead: false,
        createdAt: new Date('2026-04-03'),
      }],
    })
    expect(result).toContain('UNREAD ALERTS')
    expect(result).toContain('Time to take Metformin')
  })

  it('includes long-term memories grouped by category', () => {
    const result = buildSystemPrompt(baseProfile, null, null, null, {
      memories: [
        {
          id: 'mem1',
          userId: 'u1',
          careProfileId: 'p1',
          fact: 'Sarah prefers to take meds with breakfast',
          category: 'preference',
          source: 'conversation',
          confidence: 'high',
          lastReferenced: new Date(),
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'mem2',
          userId: 'u1',
          careProfileId: 'p1',
          fact: 'Diagnosed with Type 2 Diabetes in 2018',
          category: 'condition',
          source: 'conversation',
          confidence: 'high',
          lastReferenced: new Date(),
          createdAt: new Date('2026-01-01'),
        },
      ],
    })
    expect(result).toContain('LONG-TERM MEMORY')
    expect(result).toContain('Sarah prefers to take meds with breakfast')
    expect(result).toContain('Diagnosed with Type 2 Diabetes in 2018')
    expect(result).toContain('Caregiver Preferences')
    expect(result).toContain('Conditions')
  })

  it('always includes safety rules', () => {
    const result = buildSystemPrompt(baseProfile, null, null, null)
    expect(result).toContain('NEVER diagnose conditions')
    expect(result).toContain('Call 911')
    expect(result).toContain('MEDICATION INTERACTION CHECKING')
  })
})
