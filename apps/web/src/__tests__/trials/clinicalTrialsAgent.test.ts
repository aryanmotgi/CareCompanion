import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('@/lib/trials/tools', () => ({
  searchTrials: vi.fn(),
}))
vi.mock('@/lib/trials/gapAnalysis', () => ({
  buildScoringSystemPrompt: vi.fn().mockReturnValue('system prompt'),
  isCloseTrial: vi.fn((gaps: unknown[]) => gaps.length > 0),
}))
vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn().mockReturnValue('mock-output-spec'),
  },
}))
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn().mockReturnValue('mock-model'),
}))

import { searchTrials } from '@/lib/trials/tools'
import { generateText } from 'ai'
import { isCloseTrial } from '@/lib/trials/gapAnalysis'
import { runTrialsAgent } from '@/lib/trials/clinicalTrialsAgent'

const mockProfile = {
  cancerType: 'NSCLC', cancerStage: 'Stage IV', age: 58,
  zipCode: '94105', city: 'SF', state: 'CA',
  mutations: [], currentMedications: [], labResults: [],
  priorTreatmentLines: [], activeTreatment: null,
  conditions: null, allergies: null,
}

const trialA = { nct_id: 'NCT00000001', title: 'Trial A', status: 'RECRUITING', locations: [], url: 'https://ct.gov/NCT00000001' }

const scoredMatch = {
  nct_id: 'NCT00000001', title: 'Trial A', matchCategory: 'matched',
  matchScore: 85,
  whyItMatches: 'NSCLC Stage IV aligns with trial eligibility criteria',
  matchReasons: ['HER2+ status meets biomarker inclusion'],
  hardExclusions: [],
  softExclusions: [],
  dataGaps: [],
  requiresTreatmentStop: false,
  eligibilityGaps: null,
  phase: 'Phase 3',
  status: 'RECRUITING',
  locations: [],
  url: 'https://ct.gov/NCT00000001',
}

const scoredClose = {
  nct_id: 'NCT00000002', title: 'Trial B', matchCategory: 'close',
  matchScore: 55,
  whyItMatches: 'Close match — PSA threshold not yet met',
  matchReasons: [],
  hardExclusions: [],
  softExclusions: [],
  dataGaps: [],
  requiresTreatmentStop: false,
  eligibilityGaps: [{ gapType: 'measurable', description: 'PSA must drop', metric: 'PSA', currentValue: '8', requiredValue: '4', unit: 'ng/mL', verifiable: true, closureSignal: 'Next PSA result' }],
  phase: null,
  status: 'RECRUITING',
  locations: [],
  url: 'https://ct.gov/NCT00000002',
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(searchTrials as ReturnType<typeof vi.fn>).mockResolvedValue({ trials: [trialA] })
  ;(isCloseTrial as ReturnType<typeof vi.fn>).mockReturnValue(false)
})

// ── CT.gov fetch and error handling ──────────────────────────────────────────
describe('CT.gov fetch and dedup', () => {
  it('returns empty result (not mock fallback) when no trials from CT.gov', async () => {
    ;(searchTrials as ReturnType<typeof vi.fn>).mockResolvedValue({ trials: [] })
    const result = await runTrialsAgent(mockProfile)
    expect(result).toEqual({ matched: [], close: [] })
    expect(generateText).not.toHaveBeenCalled()
  })

  it('calls searchTrials once with pageSize 40 and RECRUITING status', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [] } })
    await runTrialsAgent(mockProfile)
    expect(searchTrials).toHaveBeenCalledTimes(1)
    expect(searchTrials).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 40, status: 'RECRUITING' })
    )
  })

  it('returns empty result (not mock fallback) when CT.gov returns an error object', async () => {
    ;(searchTrials as ReturnType<typeof vi.fn>).mockResolvedValue({ error: 'rate limited' })
    const result = await runTrialsAgent(mockProfile)
    expect(result).toEqual({ matched: [], close: [] })
    expect(generateText).not.toHaveBeenCalled()
  })

  it('strips TEST suffix from cancerType before CT.gov search', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [] } })
    await runTrialsAgent({ ...mockProfile, cancerType: 'NSCLC (TEST abc)' })
    expect(searchTrials).toHaveBeenCalledWith(
      expect.objectContaining({ condition: 'NSCLC' })
    )
  })

  it('deduplicates trials with same nct_id across searches', async () => {
    ;(searchTrials as ReturnType<typeof vi.fn>).mockResolvedValue({ trials: [trialA] })
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [scoredMatch] } })
    await runTrialsAgent(mockProfile)
    const prompt = (generateText as ReturnType<typeof vi.fn>).mock.calls[0][0].prompt as string
    const nctIdOccurrences = (prompt.match(/"nct_id":\s*"NCT00000001"/g) ?? []).length
    expect(nctIdOccurrences).toBe(1)
  })

  it('passes location filter when zipCode is set', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [] } })
    await runTrialsAgent(mockProfile)
    expect(searchTrials).toHaveBeenCalledWith(
      expect.objectContaining({ location: '94105' })
    )
  })

  it('passes no location filter when zipCode is null', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [] } })
    await runTrialsAgent({ ...mockProfile, zipCode: null })
    expect(searchTrials).toHaveBeenCalledWith(
      expect.objectContaining({ location: undefined })
    )
  })
})

// ── Structured output field mapping ──────────────────────────────────────────
describe('structured output mapping', () => {
  it('maps whyItMatches as first entry in matchReasons', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [scoredMatch] } })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched[0].matchReasons[0]).toBe(scoredMatch.whyItMatches)
  })

  it('filters out excluded trials from output', async () => {
    const excluded = { ...scoredMatch, matchCategory: 'excluded' }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [excluded] } })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched).toHaveLength(0)
    expect(result.close).toHaveLength(0)
  })

  it('returns empty on null or missing trials array', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [] } })
    const result = await runTrialsAgent(mockProfile)
    expect(result).toEqual({ matched: [], close: [] })
  })

  it('defaults empty arrays for missing optional array fields', async () => {
    const sparse = {
      nct_id: 'NCT00000001', title: 'T', matchCategory: 'matched', matchScore: 70,
      whyItMatches: 'Good match', matchReasons: [], hardExclusions: [],
      softExclusions: [], dataGaps: [], requiresTreatmentStop: false,
      eligibilityGaps: null, phase: null, status: 'RECRUITING', locations: [], url: null,
    }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [sparse] } })
    const result = await runTrialsAgent(mockProfile)
    const t = result.matched[0]
    expect(t.disqualifyingFactors).toEqual([])
    expect(t.uncertainFactors).toEqual([])
    expect(t.eligibilityGaps).toBeNull()
  })
})

// ── Score capping ─────────────────────────────────────────────────────────────
describe('field mapping and score clamping', () => {
  it('clamps matchScore to 0-100 range', async () => {
    const overScore = { ...scoredMatch, matchScore: 150 }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [overScore] } })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched[0].matchScore).toBe(100)
  })

  it('clamps negative matchScore to 0 (trial goes to close via gaps)', async () => {
    ;(isCloseTrial as ReturnType<typeof vi.fn>).mockReturnValue(true)
    const negScore = { ...scoredClose, matchScore: -10 }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [negScore] } })
    const result = await runTrialsAgent(mockProfile)
    expect(result.close[0].matchScore).toBe(0)
  })

  it('caps score at 70 when softExclusions are present', async () => {
    const withSoft = { ...scoredMatch, matchScore: 90, softExclusions: ['Prior EGFR therapy — needs verification'] }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [withSoft] } })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched[0].matchScore).toBe(70)
  })

  it('caps score at 70 when dataGaps are present', async () => {
    const withGap = { ...scoredMatch, matchScore: 88, dataGaps: ["We don't have the patient's BRCA status"] }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [withGap] } })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched[0].matchScore).toBe(70)
  })

  it('does not cap score when no soft exclusions or data gaps', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [scoredMatch] } })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched[0].matchScore).toBe(85)
  })

  it('adds treatment stop warning to disqualifyingFactors when requiresTreatmentStop is true', async () => {
    const stopRequired = { ...scoredMatch, requiresTreatmentStop: true }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [stopRequired] } })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched[0].disqualifyingFactors).toContain('⚠️ Requires stopping current active treatment')
  })

  it('prefixes dataGaps with DATA GAP: in uncertainFactors', async () => {
    const withGap = { ...scoredMatch, matchScore: 60, dataGaps: ["We don't have BRCA status"] }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [withGap] } })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched[0].uncertainFactors).toContain("DATA GAP: We don't have BRCA status")
  })
})

// ── matched / close split ─────────────────────────────────────────────────────
describe('matched vs close split', () => {
  it('routes close trials to close array via isCloseTrial', async () => {
    ;(isCloseTrial as ReturnType<typeof vi.fn>).mockImplementation((gaps: unknown[]) => gaps?.length > 0)
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [scoredClose] } })
    const result = await runTrialsAgent(mockProfile)
    expect(result.close).toHaveLength(1)
    expect(result.matched).toHaveLength(0)
    expect(result.close[0].nctId).toBe('NCT00000002')
  })

  it('routes matched trials with no gaps and score>=40 to matched array', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [scoredMatch] } })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched).toHaveLength(1)
    expect(result.close).toHaveLength(0)
  })

  it('output includes matchCategory and phase fields', async () => {
    const withPhase = { ...scoredMatch, phase: 'Phase 3', matchCategory: 'matched' }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ output: { trials: [withPhase] } })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched[0].matchCategory).toBe('matched')
    expect(result.matched[0].phase).toBe('Phase 3')
  })
})
