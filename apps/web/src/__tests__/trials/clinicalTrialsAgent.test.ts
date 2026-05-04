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
  matchScore: 85, matchReasons: ['HER2+'], disqualifyingFactors: [],
  uncertainFactors: [], eligibilityGaps: null, status: 'RECRUITING',
  locations: [], url: 'https://ct.gov/NCT00000001',
}
const scoredClose = {
  nct_id: 'NCT00000002', title: 'Trial B', matchCategory: 'close',
  matchScore: 55, matchReasons: [], disqualifyingFactors: [],
  uncertainFactors: [], eligibilityGaps: [{ gapType: 'measurable', description: 'PSA must drop' }],
  status: 'RECRUITING', locations: [], url: 'https://ct.gov/NCT00000002',
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(searchTrials as ReturnType<typeof vi.fn>).mockResolvedValue({ trials: [trialA] })
})

// ── CT.gov fetch and error handling ──────────────────────────────────────────
describe('CT.gov fetch and dedup', () => {
  it('returns mock fallback when no trials from CT.gov', async () => {
    ;(searchTrials as ReturnType<typeof vi.fn>).mockResolvedValue({ trials: [] })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched.length).toBeGreaterThan(0)
    expect(generateText).not.toHaveBeenCalled()
  })

  it('calls searchTrials once with pageSize 40 and RECRUITING status', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ text: '[]' })
    await runTrialsAgent(mockProfile)
    expect(searchTrials).toHaveBeenCalledTimes(1)
    expect(searchTrials).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 40, status: 'RECRUITING' })
    )
  })

  it('returns mock fallback when CT.gov returns an error object', async () => {
    ;(searchTrials as ReturnType<typeof vi.fn>).mockResolvedValue({ error: 'rate limited' })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched.length).toBeGreaterThan(0)
    expect(generateText).not.toHaveBeenCalled()
  })

  it('strips TEST suffix from cancerType before CT.gov search', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ text: '[]' })
    await runTrialsAgent({ ...mockProfile, cancerType: 'NSCLC (TEST abc)' })
    expect(searchTrials).toHaveBeenCalledWith(
      expect.objectContaining({ condition: 'NSCLC' })
    )
  })

  it('deduplicates trials with same nct_id across searches', async () => {
    ;(searchTrials as ReturnType<typeof vi.fn>).mockResolvedValue({ trials: [trialA] })
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify([scoredMatch]),
    })
    ;(isCloseTrial as ReturnType<typeof vi.fn>).mockReturnValue(false)
    await runTrialsAgent(mockProfile)
    const prompt = (generateText as ReturnType<typeof vi.fn>).mock.calls[0][0].prompt as string
    // The scored trials JSON should contain only ONE object with nct_id=NCT00000001
    const nctIdOccurrences = (prompt.match(/"nct_id":\s*"NCT00000001"/g) ?? []).length
    expect(nctIdOccurrences).toBe(1)
  })

  it('passes location filter when zipCode is set', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ text: '[]' })
    await runTrialsAgent(mockProfile)
    expect(searchTrials).toHaveBeenCalledWith(
      expect.objectContaining({ location: '94105' })
    )
  })

  it('passes no location filter when zipCode is null', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ text: '[]' })
    await runTrialsAgent({ ...mockProfile, zipCode: null })
    expect(searchTrials).toHaveBeenCalledWith(
      expect.objectContaining({ location: undefined })
    )
  })
})

// ── JSON parse ────────────────────────────────────────────────────────────────
describe('Claude response parsing', () => {
  beforeEach(() => {
    ;(isCloseTrial as ReturnType<typeof vi.fn>).mockReturnValue(false)
  })

  it('parses bare JSON array', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify([scoredMatch]),
    })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].nctId).toBe('NCT00000001')
  })

  it('parses code-fenced JSON array', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: '```json\n' + JSON.stringify([scoredMatch]) + '\n```',
    })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched).toHaveLength(1)
  })

  it('falls back to regex extraction on partial text surrounding array', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: 'Here are the results: ' + JSON.stringify([scoredMatch]) + ' end.',
    })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched).toHaveLength(1)
  })

  it('returns empty on total parse failure', async () => {
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({ text: 'not json at all' })
    const result = await runTrialsAgent(mockProfile)
    expect(result).toEqual({ matched: [], close: [] })
  })

  it('filters out excluded trials from output', async () => {
    const excluded = { ...scoredMatch, matchCategory: 'excluded' }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify([excluded]),
    })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched).toHaveLength(0)
    expect(result.close).toHaveLength(0)
  })
})

// ── Field mapping ─────────────────────────────────────────────────────────────
describe('field mapping and score clamping', () => {
  beforeEach(() => {
    ;(isCloseTrial as ReturnType<typeof vi.fn>).mockReturnValue(false)
  })

  it('clamps matchScore to 0-100 range', async () => {
    const overScore = { ...scoredMatch, matchScore: 150 }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify([overScore]),
    })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched[0].matchScore).toBe(100)
  })

  it('clamps negative matchScore to 0 (trial goes to close via gaps)', async () => {
    // Use eligibilityGaps so the trial ends up in close[], giving us a result to inspect
    ;(isCloseTrial as ReturnType<typeof vi.fn>).mockReturnValue(true)
    const negScore = { ...scoredClose, matchScore: -10 }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify([negScore]),
    })
    const result = await runTrialsAgent(mockProfile)
    expect(result.close[0].matchScore).toBe(0)
  })

  it('defaults empty arrays for missing array fields', async () => {
    const sparse = { nct_id: 'NCT00000001', title: 'T', matchCategory: 'matched', matchScore: 70, status: 'RECRUITING', locations: [], url: '' }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify([sparse]),
    })
    const result = await runTrialsAgent(mockProfile)
    const t = result.matched[0]
    expect(t.matchReasons).toEqual([])
    expect(t.disqualifyingFactors).toEqual([])
    expect(t.uncertainFactors).toEqual([])
    expect(t.eligibilityGaps).toBeNull()
  })
})

// ── matched / close split ─────────────────────────────────────────────────────
describe('matched vs close split', () => {
  it('routes close trials to close array via isCloseTrial', async () => {
    ;(isCloseTrial as ReturnType<typeof vi.fn>).mockImplementation(gaps => gaps?.length > 0)
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify([scoredClose]),
    })
    const result = await runTrialsAgent(mockProfile)
    expect(result.close).toHaveLength(1)
    expect(result.matched).toHaveLength(0)
    expect(result.close[0].nctId).toBe('NCT00000002')
  })

  it('routes matched trials with no gaps and score>=40 to matched array', async () => {
    ;(isCloseTrial as ReturnType<typeof vi.fn>).mockReturnValue(false)
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify([scoredMatch]),
    })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched).toHaveLength(1)
    expect(result.close).toHaveLength(0)
  })

  it('output includes matchCategory and phase fields', async () => {
    ;(isCloseTrial as ReturnType<typeof vi.fn>).mockReturnValue(false)
    const withPhase = { ...scoredMatch, phase: 'Phase 3', matchCategory: 'matched' }
    ;(generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify([withPhase]),
    })
    const result = await runTrialsAgent(mockProfile)
    expect(result.matched[0].matchCategory).toBe('matched')
    expect(result.matched[0].phase).toBe('Phase 3')
  })
})
