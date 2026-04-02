import { describe, it, expect } from 'vitest'
import { calculateHealthScore } from '../health-score'
import type { Medication, LabResult, Appointment } from '../types'

describe('calculateHealthScore', () => {
  it('returns neutral score with no data', () => {
    const score = calculateHealthScore([], [], [])
    expect(score).toBe(35)
  })

  it('returns high score with good data', () => {
    const meds = [{ id: '1', name: 'Test', care_profile_id: 'p1' }] as Medication[]
    const labs = [
      { id: '1', test_name: 'LDL', value: '90', is_abnormal: false, user_id: 'u1' },
      { id: '2', test_name: 'A1C', value: '5.2', is_abnormal: false, user_id: 'u1' },
    ] as LabResult[]
    const appts = [
      { id: '1', date_time: new Date(Date.now() + 86400000).toISOString() },
    ] as Appointment[]
    const logs = Array.from({ length: 7 }, (_, i) => ({
      medication_id: '1',
      taken_at: new Date(Date.now() - i * 86400000).toISOString(),
    }))

    const score = calculateHealthScore(meds, labs, appts, logs)
    expect(score).toBeGreaterThanOrEqual(80)
  })

  it('returns lower score with abnormal labs', () => {
    const labs = [
      { id: '1', test_name: 'LDL', value: '200', is_abnormal: true, user_id: 'u1' },
      { id: '2', test_name: 'A1C', value: '8.5', is_abnormal: true, user_id: 'u1' },
    ] as LabResult[]

    const score = calculateHealthScore([], labs, [])
    expect(score).toBeLessThan(50)
  })

  it('caps at 100', () => {
    const meds = [{ id: '1' }] as Medication[]
    const labs = [{ id: '1', is_abnormal: false }] as LabResult[]
    const appts = [{ id: '1', date_time: new Date(Date.now() + 86400000).toISOString() }] as Appointment[]
    const logs = Array.from({ length: 50 }, (_, i) => ({
      medication_id: '1',
      taken_at: new Date(Date.now() - i * 86400000).toISOString(),
    }))

    const score = calculateHealthScore(meds, labs, appts, logs)
    expect(score).toBeLessThanOrEqual(100)
  })
})
