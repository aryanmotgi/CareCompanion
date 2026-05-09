import { describe, it, expect } from 'vitest'
import { calculateHealthScore } from '../health-score'
import type { Medication, LabResult, Appointment } from '../types'

describe('calculateHealthScore', () => {
  it('returns neutral score with no data', () => {
    const score = calculateHealthScore([], [], [])
    expect(score).toBe(35)
  })

  it('returns high score with good data', () => {
    const meds = [{ id: '1', name: 'Test', careProfileId: 'p1' }] as unknown as Medication[]
    const labs = [
      { id: '1', testName: 'LDL', value: '90', isAbnormal: false, userId: 'u1' },
      { id: '2', testName: 'A1C', value: '5.2', isAbnormal: false, userId: 'u1' },
    ] as unknown as LabResult[]
    const appts = [
      { id: '1', dateTime: new Date(Date.now() + 86400000) },
    ] as unknown as Appointment[]
    const logs = Array.from({ length: 7 }, (_, i) => ({
      medication_id: '1',
      taken_at: new Date(Date.now() - i * 86400000).toISOString(),
    }))

    const score = calculateHealthScore(meds, labs, appts, logs)
    expect(score).toBeGreaterThanOrEqual(80)
  })

  it('returns lower score with abnormal labs', () => {
    const labs = [
      { id: '1', testName: 'LDL', value: '200', isAbnormal: true, userId: 'u1' },
      { id: '2', testName: 'A1C', value: '8.5', isAbnormal: true, userId: 'u1' },
    ] as unknown as LabResult[]

    const score = calculateHealthScore([], labs, [])
    expect(score).toBeLessThan(50)
  })

  it('caps at 100', () => {
    const meds = [{ id: '1' }] as unknown as Medication[]
    const labs = [{ id: '1', isAbnormal: false }] as unknown as LabResult[]
    const appts = [{ id: '1', dateTime: new Date(Date.now() + 86400000) }] as unknown as Appointment[]
    const logs = Array.from({ length: 50 }, (_, i) => ({
      medication_id: '1',
      taken_at: new Date(Date.now() - i * 86400000).toISOString(),
    }))

    const score = calculateHealthScore(meds, labs, appts, logs)
    expect(score).toBeLessThanOrEqual(100)
  })
})
