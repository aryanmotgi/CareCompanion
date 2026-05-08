import { anthropic } from '@ai-sdk/anthropic'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { searchTrials } from './tools'
import { buildScoringSystemPrompt, isCloseTrial } from './gapAnalysis'
import type { PatientProfile, EligibilityGap } from './assembleProfile'

export type TrialMatchResult = {
  nctId:                string
  title:                string
  matchCategory:        'matched' | 'close'
  matchScore:           number
  matchReasons:         string[]
  disqualifyingFactors: string[]
  uncertainFactors:     string[]
  eligibilityGaps:      EligibilityGap[] | null
  phase:                string | null
  enrollmentStatus:     string | null
  locations:            object[]
  trialUrl:             string | null
}

type AgentMatchOutput = {
  matched: TrialMatchResult[]
  close:   TrialMatchResult[]
}

const EligibilityGapSchema = z.object({
  gapType:       z.enum(['measurable', 'conditional', 'fixed']),
  description:   z.string(),
  metric:        z.string().nullable(),
  currentValue:  z.string().nullable(),
  requiredValue: z.string().nullable(),
  unit:          z.string().nullable(),
  verifiable:    z.boolean(),
  closureSignal: z.string().nullable(),
})

const TrialScoringSchema = z.object({
  trials: z.array(z.object({
    nct_id:               z.string(),
    title:                z.string(),
    matchCategory:        z.enum(['matched', 'close', 'excluded']),
    matchScore:           z.number().min(0).max(100),
    whyItMatches:         z.string(),
    matchReasons:         z.array(z.string()),
    hardExclusions:       z.array(z.string()),
    softExclusions:       z.array(z.string()),
    dataGaps:             z.array(z.string()),
    requiresTreatmentStop: z.boolean(),
    eligibilityGaps:      z.array(EligibilityGapSchema).nullable(),
    phase:                z.string().nullable(),
    status:               z.string(),
    locations:            z.array(z.record(z.string(), z.unknown())),
    url:                  z.string().nullable(),
  }))
})

export async function runTrialsAgent(profile: PatientProfile): Promise<AgentMatchOutput> {
  const t0 = Date.now()
  const systemPrompt = buildScoringSystemPrompt(profile)
  const locationFilter = profile.zipCode ?? undefined
  const condition = (profile.cancerType ?? 'cancer').replace(/\s*\(TEST[^)]*\)/gi, '').trim() || 'cancer'

  console.log('[trials-agent] starting CT.gov fetch')
  const result = await searchTrials({ condition, location: locationFilter, status: 'RECRUITING', pageSize: 40 })
  console.log(`[trials-agent] CT.gov fetch done in ${Date.now() - t0}ms`)

  if ('error' in result) {
    console.warn('[trials-agent] CT.gov error, returning empty result:', result.error)
    return { matched: [], close: [] }
  }

  const allTrials: object[] = result.trials

  if (allTrials.length === 0) {
    console.log('[trials-agent] no trials found from CT.gov')
    return { matched: [], close: [] }
  }

  console.log(`[trials-agent] scoring ${allTrials.length} trials with Sonnet`)
  const t1 = Date.now()

  const { output } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    output: Output.object({ schema: TrialScoringSchema }),
    system: systemPrompt,
    prompt: `Score each of the following clinical trials for this patient. For each trial you evaluate, include it in the output only if matchCategory is "matched" or "close" — skip "excluded" trials entirely.

Every entry must include nct_id (exact, never omit), whyItMatches, hardExclusions, softExclusions, dataGaps, and requiresTreatmentStop.

Trials to score:
${JSON.stringify(allTrials, null, 2)}`,
  })

  console.log(`[trials-agent] Claude scoring done in ${Date.now() - t1}ms, total ${Date.now() - t0}ms`)

  // NCT IDs must be NCT + 4+ digits
  const NCT_RE = /^NCT\d{4,}$/

  const results: TrialMatchResult[] = (output.trials ?? [])
    .filter(t => t.matchCategory !== 'excluded')
    .filter(t => {
      const id = String(t.nct_id ?? '').trim()
      if (!NCT_RE.test(id)) {
        console.warn('[trials-agent] skipping trial with invalid nctId:', id)
        return false
      }
      return true
    })
    .map(t => {
      const rawCat = t.matchCategory
      const gaps = Array.isArray(t.eligibilityGaps) ? (t.eligibilityGaps as EligibilityGap[]) : null

      let category: 'matched' | 'close'
      if (rawCat === 'close') {
        category = 'close'
      } else if (rawCat === 'matched') {
        category = 'matched'
      } else {
        category = gaps && isCloseTrial(gaps) ? 'close' : 'matched'
      }

      // Enforce 70% cap when unverified criteria exist
      const hasUnverified = t.softExclusions.length > 0 || t.dataGaps.length > 0
      const rawScore = Math.max(0, Math.min(100, t.matchScore))
      const matchScore = hasUnverified ? Math.min(rawScore, 70) : rawScore

      // Map new schema fields onto existing TrialMatchResult shape
      const matchReasons = [t.whyItMatches, ...t.matchReasons].filter(Boolean)
      const disqualifyingFactors = [
        ...t.hardExclusions,
        ...(t.requiresTreatmentStop ? ['⚠️ Requires stopping current active treatment'] : []),
      ]
      const uncertainFactors = [
        ...t.softExclusions,
        ...t.dataGaps.map(g => `DATA GAP: ${g}`),
      ]

      return {
        nctId:                String(t.nct_id).trim(),
        title:                t.title,
        matchCategory:        category,
        matchScore,
        matchReasons,
        disqualifyingFactors,
        uncertainFactors,
        eligibilityGaps:      gaps,
        phase:                t.phase ? String(t.phase).slice(0, 50) : null,
        enrollmentStatus:     t.status,
        locations:            Array.isArray(t.locations) ? (t.locations as object[]) : [],
        trialUrl:             t.url && /^https:\/\//i.test(t.url) ? t.url : null,
      }
    })

  const matched = results
    .filter(r => r.matchCategory === 'matched')
    .sort((a, b) => b.matchScore - a.matchScore)
  const close = results.filter(r => r.matchCategory === 'close')

  console.log(`[trials-agent] returned ${matched.length} matched, ${close.length} close (from ${output.trials?.length ?? 0} scored)`)
  return { matched, close }
}
