import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/lib/system-prompt'
import type { CareProfile, Medication, Doctor, Appointment } from '@/lib/types'

const baseProfile: CareProfile = {
  id: 'p1',
  user_id: 'u1',
  patient_name: 'Sarah Johnson',
  patient_age: 72,
  relationship: 'mother',
  conditions: 'Type 2 Diabetes, Hypertension',
  allergies: 'Penicillin, Sulfa drugs',
  created_at: '2026-01-01',
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
    expect(result).toContain('Type 2 Diabetes, Hypertension')
    expect(result).toContain('Penicillin, Sulfa drugs')
  })

  it('includes medication details', () => {
    const meds: Medication[] = [{
      id: 'm1',
      care_profile_id: 'p1',
      name: 'Metformin',
      dose: '500mg',
      frequency: 'Twice daily',
      prescribing_doctor: 'Dr. Lee',
      refill_date: '2026-04-15',
      start_date: null,
      quantity_remaining: null,
      notes: null,
      created_at: '2026-01-01',
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
      care_profile_id: 'p1',
      name: 'Dr. Chen',
      specialty: 'Endocrinology',
      phone: '555-0100',
      address: null,
      notes: null,
      created_at: '2026-01-01',
    }]
    const result = buildSystemPrompt(baseProfile, null, docs, null)
    expect(result).toContain('Dr. Chen')
    expect(result).toContain('Endocrinology')
    expect(result).toContain('555-0100')
  })

  it('includes appointment details', () => {
    const appts: Appointment[] = [{
      id: 'a1',
      care_profile_id: 'p1',
      doctor_name: 'Dr. Patel',
      specialty: null,
      date_time: '2026-05-01T14:00:00Z',
      location: null,
      purpose: 'Blood pressure check',
      prep_notes: null,
      follow_up_notes: null,
      created_at: '2026-01-01',
    }]
    const result = buildSystemPrompt(baseProfile, null, null, appts)
    expect(result).toContain('Dr. Patel')
    expect(result).toContain('Blood pressure check')
  })

  it('includes lab results with abnormal flag', () => {
    const result = buildSystemPrompt(baseProfile, null, null, null, {
      labResults: [{
        id: 'l1',
        user_id: 'u1',
        test_name: 'LDL Cholesterol',
        value: '180',
        unit: 'mg/dL',
        reference_range: '<100',
        is_abnormal: true,
        date_taken: '2026-03-15',
        source: 'lab',
        created_at: '2026-03-15',
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
        user_id: 'u1',
        provider_name: 'City Hospital',
        billed_amount: 1200,
        paid_amount: 0,
        patient_responsibility: 1200,
        denial_reason: 'Out of network',
        status: 'denied',
        service_date: '2026-02-15',
        eob_url: null,
        created_at: '2026-02-15',
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
        user_id: 'u1',
        type: 'medication_reminder',
        title: 'Time to take Metformin',
        message: '500mg — morning dose',
        is_read: false,
        created_at: '2026-04-03',
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
          user_id: 'u1',
          care_profile_id: 'p1',
          fact: 'Sarah prefers to take meds with breakfast',
          category: 'preference',
          source: 'conversation',
          confidence: 'high',
          last_referenced: new Date().toISOString(),
          created_at: '2026-01-01',
        },
        {
          id: 'mem2',
          user_id: 'u1',
          care_profile_id: 'p1',
          fact: 'Diagnosed with Type 2 Diabetes in 2018',
          category: 'condition',
          source: 'conversation',
          confidence: 'high',
          last_referenced: new Date().toISOString(),
          created_at: '2026-01-01',
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
