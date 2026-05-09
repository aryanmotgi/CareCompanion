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

describe('lab-trends extended', () => {
  describe('analyzeTrend edge cases', () => {
    it('returns null for empty input array', () => {
      expect(analyzeTrend([])).toBeNull()
    })

    it('returns insufficient_data for single value', () => {
      const result = analyzeTrend([makeLab({ value: '7000' })])
      expect(result).not.toBeNull()
      expect(result?.trend).toBe('insufficient_data')
      expect(result?.current_value).toBe(7000)
      expect(result?.previous_value).toBeNull()
      expect(result?.change_percent).toBeNull()
      expect(result?.prediction_7d).toBeNull()
    })

    it('detects stable trend when all values identical', () => {
      const results = [
        makeLab({ value: '5000', dateTaken: '2026-03-01' }),
        makeLab({ value: '5000', dateTaken: '2026-03-15' }),
        makeLab({ value: '5000', dateTaken: '2026-04-01' }),
      ]
      const trend = analyzeTrend(results)
      expect(trend?.trend).toBe('stable')
      // changePercent is 0.0 — should be reported as 0, not null
      expect(trend?.change_percent).toBe(0)
    })

    it('detects rapid decline when drop exceeds 20%', () => {
      const results = [
        makeLab({ value: '10000', dateTaken: '2026-03-01' }),
        makeLab({ value: '7000', dateTaken: '2026-04-01' }),
      ]
      const trend = analyzeTrend(results)
      expect(trend?.trend).toBe('rapid_decline')
      expect(trend?.change_percent).toBeLessThan(-20)
      // Should also have a rapid decline alert
      expect(trend?.alerts.some(a => a.message.includes('dropped'))).toBe(true)
    })

    it('returns null when all values are non-numeric', () => {
      const results = [
        makeLab({ value: 'negative' }),
        makeLab({ value: 'positive' }),
      ]
      expect(analyzeTrend(results)).toBeNull()
    })

    it('handles mixed numeric and non-numeric values', () => {
      const results = [
        makeLab({ value: 'negative', dateTaken: '2026-03-01' }),
        makeLab({ value: '5000', dateTaken: '2026-04-01' }),
      ]
      // Only the numeric value survives parsing, so it's like a single value
      const trend = analyzeTrend(results)
      expect(trend?.trend).toBe('insufficient_data')
      expect(trend?.current_value).toBe(5000)
    })

    it('generates prediction that continues a downward linear trend', () => {
      // Three equally spaced points declining linearly: 9000, 6000, 3000
      const results = [
        makeLab({ value: '9000', dateTaken: '2026-03-15' }),
        makeLab({ value: '6000', dateTaken: '2026-03-22' }),
        makeLab({ value: '3000', dateTaken: '2026-03-29' }),
      ]
      const trend = analyzeTrend(results)
      expect(trend?.prediction_7d).not.toBeNull()
      // With a linear decline of -3000/week, 7 days later should be ~0
      expect(trend!.prediction_7d!).toBeLessThanOrEqual(0)
    })

    it('clamps prediction to 0 for non-negative lab values', () => {
      // Steep decline that would predict negative
      const results = [
        makeLab({ value: '9000', dateTaken: '2026-03-15' }),
        makeLab({ value: '6000', dateTaken: '2026-03-22' }),
        makeLab({ value: '3000', dateTaken: '2026-03-29' }),
      ]
      const trend = analyzeTrend(results)
      expect(trend!.prediction_7d).toBeGreaterThanOrEqual(0)
    })
  })

  describe('analyzeAllTrends red flags', () => {
    it('detects neutropenia + low WBC red flag combination', () => {
      const results = [
        makeLab({ testName: 'ANC', value: '400', dateTaken: '2026-04-01', isAbnormal: true }),
        makeLab({ testName: 'WBC', value: '1500', dateTaken: '2026-04-01', isAbnormal: true }),
      ]
      const analysis = analyzeAllTrends(results)
      expect(analysis.red_flags.length).toBeGreaterThan(0)
      expect(analysis.red_flags[0]).toContain('neutropenia')
      expect(analysis.overall_status).toBe('critical')
    })

    it('detects anemia + thrombocytopenia red flag', () => {
      const results = [
        makeLab({ testName: 'Hemoglobin', value: '7', unit: 'g/dL', dateTaken: '2026-04-01', isAbnormal: true }),
        makeLab({ testName: 'Platelets', value: '40000', unit: '/mcL', dateTaken: '2026-04-01', isAbnormal: true }),
      ]
      const analysis = analyzeAllTrends(results)
      expect(analysis.red_flags.length).toBeGreaterThan(0)
      expect(analysis.red_flags[0]).toContain('pancytopenia')
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

    it('handles empty input', () => {
      const analysis = analyzeAllTrends([])
      expect(analysis.trends).toEqual([])
      expect(analysis.red_flags).toEqual([])
      expect(analysis.overall_status).toBe('good')
    })

    it('groups results by test name case-insensitively', () => {
      const results = [
        makeLab({ testName: 'WBC', value: '5000', dateTaken: '2026-03-01' }),
        makeLab({ testName: 'wbc', value: '5100', dateTaken: '2026-04-01' }),
      ]
      const analysis = analyzeAllTrends(results)
      // Both should be in the same group
      expect(analysis.trends.length).toBe(1)
    })
  })
})
