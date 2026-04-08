import { describe, it, expect } from 'vitest'
import { analyzeTrend, analyzeAllTrends } from '@/lib/lab-trends'
import type { LabResult } from '@/lib/types'

function makeLab(overrides: Partial<LabResult> = {}): LabResult {
  return {
    id: '1',
    user_id: 'u1',
    test_name: 'WBC',
    value: '5000',
    unit: 'cells/mcL',
    reference_range: '4000-11000',
    is_abnormal: false,
    date_taken: '2026-04-01',
    source: 'conversation',
    created_at: '2026-04-01T00:00:00Z',
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
        makeLab({ value: '8000', date_taken: '2026-03-01' }),
        makeLab({ value: '6500', date_taken: '2026-04-01' }),
      ]
      const trend = analyzeTrend(results)
      expect(trend?.trend).toBe('declining')
      expect(trend?.change_percent).toBeLessThan(0)
    })

    it('detects rapid decline', () => {
      const results = [
        makeLab({ value: '10000', date_taken: '2026-03-01' }),
        makeLab({ value: '3000', date_taken: '2026-04-01' }),
      ]
      const trend = analyzeTrend(results)
      expect(trend?.trend).toBe('rapid_decline')
    })

    it('detects stable values', () => {
      const results = [
        makeLab({ value: '5000', date_taken: '2026-03-01' }),
        makeLab({ value: '5100', date_taken: '2026-04-01' }),
      ]
      const trend = analyzeTrend(results)
      expect(trend?.trend).toBe('stable')
    })

    it('alerts on low WBC', () => {
      const results = [
        makeLab({ value: '5000', date_taken: '2026-03-01' }),
        makeLab({ value: '3000', date_taken: '2026-04-01', is_abnormal: true }),
      ]
      const trend = analyzeTrend(results)
      expect(trend?.alerts.length).toBeGreaterThan(0)
      expect(trend?.alerts[0].severity).toBe('warning')
    })

    it('generates 7-day prediction with 3+ data points', () => {
      const results = [
        makeLab({ value: '8000', date_taken: '2026-03-15' }),
        makeLab({ value: '6000', date_taken: '2026-03-22' }),
        makeLab({ value: '4000', date_taken: '2026-03-29' }),
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
        makeLab({ test_name: 'WBC', value: '5000', date_taken: '2026-04-01' }),
        makeLab({ test_name: 'Hemoglobin', value: '12', date_taken: '2026-04-01' }),
        makeLab({ test_name: 'WBC', value: '6000', date_taken: '2026-03-01' }),
      ]
      const analysis = analyzeAllTrends(results)
      expect(analysis.trends.length).toBe(2)
    })

    it('detects red flag combinations', () => {
      const results = [
        makeLab({ test_name: 'ANC', value: '400', date_taken: '2026-04-01', is_abnormal: true }),
        makeLab({ test_name: 'WBC', value: '1500', date_taken: '2026-04-01', is_abnormal: true }),
      ]
      const analysis = analyzeAllTrends(results)
      expect(analysis.red_flags.length).toBeGreaterThan(0)
      expect(analysis.overall_status).toBe('critical')
    })

    it('returns good status when no issues', () => {
      const results = [
        makeLab({ test_name: 'WBC', value: '7000', date_taken: '2026-04-01' }),
        makeLab({ test_name: 'Hemoglobin', value: '14', date_taken: '2026-04-01' }),
      ]
      const analysis = analyzeAllTrends(results)
      expect(analysis.overall_status).toBe('good')
      expect(analysis.red_flags.length).toBe(0)
    })
  })
})
