import { describe, it, expect } from 'vitest'
import { parseLabValue } from '../lab-parsing'

describe('parseLabValue', () => {
  it('returns dash for null value', () => {
    const result = parseLabValue(null, null)
    expect(result.displayValue).toBe('—')
    expect(result.isNumeric).toBe(false)
    expect(result.progressPercent).toBeNull()
  })

  it('returns dash for undefined value', () => {
    const result = parseLabValue(undefined, undefined)
    expect(result.displayValue).toBe('—')
  })

  it('parses simple numeric value', () => {
    const result = parseLabValue('165', '< 100')
    expect(result.numericValue).toBe(165)
    expect(result.isNumeric).toBe(true)
    expect(result.referenceMax).toBe(100)
    expect(result.progressPercent).toBeGreaterThan(100)
  })

  it('parses blood pressure format', () => {
    const result = parseLabValue('142/88', '< 120/80')
    expect(result.numericValue).toBe(142)
    expect(result.isNumeric).toBe(true)
    expect(result.referenceMax).toBe(120)
    expect(result.displayValue).toBe('142/88')
  })

  it('parses decimal value (A1C)', () => {
    const result = parseLabValue('7.2', '< 5.7')
    expect(result.numericValue).toBe(7.2)
    expect(result.referenceMax).toBe(5.7)
  })

  it('parses range reference (60-100)', () => {
    const result = parseLabValue('72', '60-100')
    expect(result.referenceMin).toBe(60)
    expect(result.referenceMax).toBe(100)
    expect(result.progressPercent).toBe(72)
  })

  it('handles non-numeric value', () => {
    const result = parseLabValue('Positive', '')
    expect(result.isNumeric).toBe(false)
    expect(result.numericValue).toBeNull()
    expect(result.displayValue).toBe('Positive')
    expect(result.progressPercent).toBeNull()
  })

  it('handles empty reference range', () => {
    const result = parseLabValue('100', '')
    expect(result.numericValue).toBe(100)
    expect(result.referenceMax).toBeNull()
    expect(result.progressPercent).toBeNull()
  })

  it('caps progress at 150%', () => {
    const result = parseLabValue('300', '< 100')
    expect(result.progressPercent).toBeLessThanOrEqual(150)
  })
})
