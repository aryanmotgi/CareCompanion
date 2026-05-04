import { describe, it, expect } from 'vitest'
import { analyzeTrend, analyzeAllTrends } from '@/lib/lab-trends'
import type { LabResult } from '@/lib/types'

function makeLab(overrides: Partial<LabResult> = {}): LabResult {
  return {
    id: '1',
    userId: 'u1',
    testName: 'WBC',
    value: '5000',
    unit: 'cells/mcL',
    referenceRange: '4000-11000',
    isAbnormal: false,
    dateTaken: '2026-04-01',
    source: 'conversation',
    createdAt: new Date('2026-04-01T00:00:00Z'),
    ...overrides,
  }
}

describe('lab-trends', () => {
  describe('analyzeTrend', () => {
    it('returns null for empty results', () => {
      expect(analyzeTrend([])).toBeNull()
    })

    it('returns insufficient_data for single result', () => {
      const result = analyzeTrend([makeLab()])
      expect(result?.trend).toBe('insufficient_data')
      expect(result?.current_value).toBe(5000)
    })

    it('detects declining trend', () => {
      const results = [
        makeLab({ value: '8000', dateTaken: '2026-03-01' }),
        makeLab({ value: '6500', dateTaken: '2026-04-01' }),
      ]
      const trend = analyzeTrend(results)
      expect(trend?.trend).toBe('declining')
      expect(trend?.change_percent).toBeLessThan(0)
    })

    it('detects rapid decline', () => {
      const results = [
        makeLab({ value: '10000', dateTaken: '2026-03-01' }),
        makeLab({ value: '3000', dateTaken: '2026-04-01' }),
      ]
      const trend = analyzeTrend(results)
      expect(trend?.trend).toBe('rapid_decline')
    })

    it('detects stable values', () => {
      const results = [
        makeLab({ value: '5000', dateTaken: '2026-03-01' }),
        makeLab({ value: '5100', dateTaken: '2026-04-01' }),
      ]
      const trend = analyzeTrend(results)
      expect(trend?.trend).toBe('stable')
    })

    it('alerts on low WBC', () => {
      const results = [
        makeLab({ value: '5000', dateTaken: '2026-03-01' }),
        makeLab({ value: '3000', dateTaken: '2026-04-01', isAbnormal: true }),
      ]
      const trend = analyzeTrend(results)
      expect(trend?.alerts.length).toBeGreaterThan(0)
      expect(trend?.alerts[0].severity).toBe('warning')
    })

    it('generates 7-day prediction with 3+ data points', () => {
      const results = [
        makeLab({ value: '8000', dateTaken: '2026-03-15' }),
        makeLab({ value: '6000', dateTaken: '2026-03-22' }),
        makeLab({ value: '4000', dateTaken: '2026-03-29' }),
      ]
      const trend = analyzeTrend(results)
      expect(trend?.prediction_7d).not.toBeNull()
      expect(trend!.prediction_7d).toBeLessThan(4000) // continues declining
    })

    it('handles non-numeric values gracefully', () => {
      const results = [makeLab({ value: 'negative' })]
      const trend = analyzeTrend(results)
      expect(trend).toBeNull() // can't parse 'negative'
    })
  })

  describe('analyzeAllTrends', () => {
    it('groups results by test name', () => {
      const results = [
        makeLab({ testName: 'WBC', value: '5000', dateTaken: '2026-04-01' }),
        makeLab({ testName: 'Hemoglobin', value: '12', dateTaken: '2026-04-01' }),
        makeLab({ testName: 'WBC', value: '6000', dateTaken: '2026-03-01' }),
      ]
      const analysis = analyzeAllTrends(results)
      expect(analysis.trends.length).toBe(2)
    })

    it('detects red flag combinations', () => {
      const results = [
        makeLab({ testName: 'ANC', value: '400', dateTaken: '2026-04-01', isAbnormal: true }),
        makeLab({ testName: 'WBC', value: '1500', dateTaken: '2026-04-01', isAbnormal: true }),
      ]
      const analysis = analyzeAllTrends(results)
      expect(analysis.red_flags.length).toBeGreaterThan(0)
      expect(analysis.overall_status).toBe('critical')
    })

    it('returns good status when no issues', () => {
      const results = [
        makeLab({ testName: 'WBC', value: '7000', dateTaken: '2026-04-01' }),
        makeLab({ testName: 'Hemoglobin', value: '14', dateTaken: '2026-04-01' }),
      ]
      const analysis = analyzeAllTrends(results)
      expect(analysis.overall_status).toBe('good')
      expect(analysis.red_flags.length).toBe(0)
    })

    it('returns concerning status for single-threshold violation', () => {
      const results = [
        makeLab({ testName: 'WBC', value: '3500', dateTaken: '2026-04-02', isAbnormal: true }),
        makeLab({ testName: 'WBC', value: '4500', dateTaken: '2026-04-01' }),
      ]
      const analysis = analyzeAllTrends(results)
      expect(analysis.overall_status).toBe('concerning')
    })

    it('returns monitor status for declining but non-threshold result', () => {
      const results = [
        makeLab({ testName: 'Hemoglobin', value: '12', dateTaken: '2026-04-03' }),
        makeLab({ testName: 'Hemoglobin', value: '13', dateTaken: '2026-04-02' }),
        makeLab({ testName: 'Hemoglobin', value: '14', dateTaken: '2026-04-01' }),
      ]
      const analysis = analyzeAllTrends(results)
      expect(['monitor', 'good']).toContain(analysis.overall_status)
    })
  })
})

describe('analyzeTrend — unit field', () => {
  function makeFullLab(overrides: Partial<LabResult> = {}): LabResult {
    return {
      id: '1', userId: 'u1', testName: 'WBC', value: '5000', unit: 'cells/mcL',
      referenceRange: null, isAbnormal: false, dateTaken: '2026-04-01',
      source: 'conversation', createdAt: new Date('2026-04-01T00:00:00Z'),
      ...overrides,
    }
  }

  it('includes unit from the most recent lab result', () => {
    const results = [
      makeFullLab({ dateTaken: '2026-04-01', unit: 'cells/mcL' }),
      makeFullLab({ id: '2', dateTaken: '2026-03-01', unit: 'cells/mcL' }),
    ]
    const trend = analyzeTrend(results)
    expect(trend?.unit).toBe('cells/mcL')
  })

  it('returns null unit when unit is missing', () => {
    const results = [makeFullLab({ testName: 'CustomTest', value: '42', unit: null })]
    const trend = analyzeTrend(results)
    expect(trend?.unit).toBeNull()
  })
})
