import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}))

import { deriveConfidence, validateZip, buildPriorTreatmentLines } from '@/lib/trials/assembleProfile'

describe('deriveConfidence', () => {
  it('returns high for lab_report', () => expect(deriveConfidence('lab_report')).toBe('high'))
  it('returns medium for fhir', () => expect(deriveConfidence('fhir')).toBe('medium'))
  it('returns low for manual', () => expect(deriveConfidence('manual')).toBe('low'))
  it('returns low for unknown source', () => expect(deriveConfidence('other')).toBe('low'))
})

describe('validateZip', () => {
  it('accepts valid 5-digit zip', () => expect(validateZip('94105')).toBe(true))
  it('rejects 4-digit zip', () => expect(validateZip('9410')).toBe(false))
  it('rejects zip with letters', () => expect(validateZip('9410A')).toBe(false))
  it('rejects null', () => expect(validateZip(null)).toBe(false))
  it('rejects empty string', () => expect(validateZip('')).toBe(false))
  it('rejects undefined', () => expect(validateZip(undefined)).toBe(false))
})

describe('buildPriorTreatmentLines', () => {
  it('groups cycles by regimen and picks max cycleNumber', () => {
    const cycles = [
      { regimenName: 'FOLFOX', startDate: '2024-01-01', cycleNumber: 1, isActive: false },
      { regimenName: 'FOLFOX', startDate: '2024-01-01', cycleNumber: 4, isActive: false },
      { regimenName: 'FOLFIRI', startDate: '2024-06-01', cycleNumber: 2, isActive: false },
    ]
    const result = buildPriorTreatmentLines(cycles)
    expect(result).toHaveLength(2)
    expect(result.find(r => r.regimen === 'FOLFOX')?.cycleCount).toBe(4)
    expect(result.find(r => r.regimen === 'FOLFIRI')?.cycleCount).toBe(2)
  })

  it('excludes active cycles', () => {
    const cycles = [
      { regimenName: 'FOLFOX', startDate: '2024-01-01', cycleNumber: 3, isActive: false },
      { regimenName: 'Active', startDate: '2025-01-01', cycleNumber: 1, isActive: true },
    ]
    const result = buildPriorTreatmentLines(cycles)
    expect(result).toHaveLength(1)
    expect(result[0].regimen).toBe('FOLFOX')
  })

  it('excludes cycles with null regimenName', () => {
    const cycles = [
      { regimenName: null, startDate: '2024-01-01', cycleNumber: 1, isActive: false },
    ]
    expect(buildPriorTreatmentLines(cycles)).toHaveLength(0)
  })
})
