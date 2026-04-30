import { describe, it, expect } from 'vitest'
import { isCloseTrial, buildScoringSystemPrompt } from '@/lib/trials/gapAnalysis'
import type { EligibilityGap } from '@/lib/trials/assembleProfile'

describe('isCloseTrial', () => {
  it('returns true when all gaps are measurable', () => {
    const gaps: EligibilityGap[] = [{
      gapType: 'measurable', description: 'Hemoglobin too low',
      metric: 'hemoglobin', currentValue: '9.2', requiredValue: '10',
      unit: 'g/dL', verifiable: true, closureSignal: 'labResults.hemoglobin',
    }]
    expect(isCloseTrial(gaps)).toBe(true)
  })

  it('returns true when all gaps are conditional', () => {
    const gaps: EligibilityGap[] = [{
      gapType: 'conditional', description: 'Must stop Osimertinib',
      metric: null, currentValue: null, requiredValue: null,
      unit: null, verifiable: true, closureSignal: 'medications.Osimertinib',
    }]
    expect(isCloseTrial(gaps)).toBe(true)
  })

  it('returns true for mixed measurable + conditional', () => {
    const gaps: EligibilityGap[] = [
      { gapType: 'measurable', description: 'a', metric: null, currentValue: null, requiredValue: null, unit: null, verifiable: true, closureSignal: null },
      { gapType: 'conditional', description: 'b', metric: null, currentValue: null, requiredValue: null, unit: null, verifiable: true, closureSignal: null },
    ]
    expect(isCloseTrial(gaps)).toBe(true)
  })

  it('returns false when any gap is fixed', () => {
    const gaps: EligibilityGap[] = [
      { gapType: 'measurable', description: 'a', metric: null, currentValue: null, requiredValue: null, unit: null, verifiable: true, closureSignal: null },
      { gapType: 'fixed', description: 'Wrong cancer type', metric: null, currentValue: null, requiredValue: null, unit: null, verifiable: false, closureSignal: null },
    ]
    expect(isCloseTrial(gaps)).toBe(false)
  })

  it('returns false for empty array (no gaps = fully matched)', () => {
    expect(isCloseTrial([])).toBe(false)
  })
})

describe('buildScoringSystemPrompt', () => {
  const profile = {
    cancerType: 'NSCLC', cancerStage: 'Stage IV', age: 58,
    zipCode: '94105', city: 'San Francisco', state: 'CA',
    mutations: [{ name: 'EGFR', status: 'positive', source: 'lab_report', confidence: 'high' as const }],
    currentMedications: ['Osimertinib'],
    labResults: [{ testName: 'Hemoglobin', numericValue: 9.2, unit: 'g/dL', resultDate: '2025-01-15', isAbnormal: true }],
    priorTreatmentLines: [{ regimen: 'Carboplatin/Pemetrexed', startDate: '2023-01-01', cycleCount: 4 }],
    activeTreatment: null, conditions: null, allergies: null,
  }

  it('includes patient cancer type in prompt', () => {
    const prompt = buildScoringSystemPrompt(profile)
    expect(prompt).toContain('NSCLC')
  })

  it('includes mutation name and confidence', () => {
    const prompt = buildScoringSystemPrompt(profile)
    expect(prompt).toContain('EGFR')
    expect(prompt).toContain('lab_report')
  })

  it('includes medication name', () => {
    const prompt = buildScoringSystemPrompt(profile)
    expect(prompt).toContain('Osimertinib')
  })

  it('includes lab value', () => {
    const prompt = buildScoringSystemPrompt(profile)
    expect(prompt).toContain('9.2')
  })

  it('includes gap category descriptions', () => {
    const prompt = buildScoringSystemPrompt(profile)
    expect(prompt).toContain('measurable')
    expect(prompt).toContain('conditional')
    expect(prompt).toContain('fixed')
  })

  it('includes prior treatment line', () => {
    const prompt = buildScoringSystemPrompt(profile)
    expect(prompt).toContain('Carboplatin/Pemetrexed')
  })
})
