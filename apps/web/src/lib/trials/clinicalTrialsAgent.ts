import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { searchTrials, searchByEligibility } from './tools'
import { buildScoringSystemPrompt, isCloseTrial } from './gapAnalysis'
import type { PatientProfile, EligibilityGap } from './assembleProfile'

export type TrialMatchResult = {
  nctId:                string
  title:                string
  matchScore:           number
  matchReasons:         string[]
  disqualifyingFactors: string[]
  uncertainFactors:     string[]
  eligibilityGaps:      EligibilityGap[] | null
  enrollmentStatus:     string | null
  locations:            object[]
  trialUrl:             string | null
}

export type AgentMatchOutput = {
  matched: TrialMatchResult[]
  close:   TrialMatchResult[]
}

export async function runTrialsAgent(profile: PatientProfile): Promise<AgentMatchOutput> {
  const t0 = Date.now()
  const systemPrompt = buildScoringSystemPrompt(profile)
  const locationFilter = profile.zipCode ? `50mi:${profile.zipCode}` : undefined
  const condition = profile.cancerType ?? 'cancer'

  // Fetch trials from CT.gov in parallel — eliminates the sequential agentic tool-call loop.
  // Two searches: broad condition search + eligibility-filtered RECRUITING-only search.
  console.log('[trials-agent] starting parallel CT.gov fetch')
  const [broadResult, eligResult] = await Promise.all([
    searchTrials({ condition, location: locationFilter, status: 'RECRUITING', pageSize: 20 }),
    searchByEligibility({ condition, age: profile.age ?? undefined, location: locationFilter }),
  ])
  console.log(`[trials-agent] CT.gov fetch done in ${Date.now() - t0}ms`)

  // Deduplicate by nct_id
  const seen = new Set<string>()
  const allTrials: object[] = []
  const sources = [
    ...('trials' in broadResult ? broadResult.trials : []),
    ...('trials' in eligResult ? eligResult.trials : []),
  ]
  for (const t of sources) {
    const id = (t as Record<string, unknown>).nct_id as string
    if (id && !seen.has(id)) { seen.add(id); allTrials.push(t) }
  }

  if (allTrials.length === 0) {
    console.log('[trials-agent] no trials found from CT.gov')
    return { matched: [], close: [] }
  }

  console.log(`[trials-agent] scoring ${allTrials.length} trials with Haiku`)
  const t1 = Date.now()

  // Single Claude call — no tool calls, just batch scoring.
  const { text } = await generateText({
    // Haiku: ~20x cheaper per token than Sonnet, stays under 30k TPM org limit.
    model: anthropic('claude-haiku-4-5-20251001'),
    system: systemPrompt,
    prompt: `Score each of the following clinical trials for this patient. Output one JSON array (no markdown fencing) containing ALL trials with matchCategory "matched" or "close". Skip "excluded" trials entirely.

Each object must have: nct_id, title, matchCategory, matchScore (0-100), matchReasons (string[]), disqualifyingFactors (string[]), uncertainFactors (string[]), eligibilityGaps (array or null), status, locations (array), url.

Trials to score:
${JSON.stringify(allTrials, null, 2)}`,
  })
  console.log(`[trials-agent] Claude scoring done in ${Date.now() - t1}ms, total ${Date.now() - t0}ms`)

  // Parse — model may return a bare array or wrap it in a code block
  let rawArray: unknown[] = []
  try {
    const cleaned = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim()
    const parsed = JSON.parse(cleaned)
    rawArray = Array.isArray(parsed) ? parsed : []
  } catch {
    // Try extracting first JSON array from text
    const m = text.match(/\[[\s\S]*\]/)
    if (m) {
      try { rawArray = JSON.parse(m[0]) } catch { /* give up */ }
    }
  }

  const results: TrialMatchResult[] = rawArray
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .filter(t => t.matchCategory !== 'excluded')
    .map(t => ({
      nctId:                String(t.nct_id ?? t.nctId ?? ''),
      title:                String(t.title ?? ''),
      matchScore:           Math.max(0, Math.min(100, Number(t.matchScore) || 0)),
      matchReasons:         Array.isArray(t.matchReasons) ? t.matchReasons : [],
      disqualifyingFactors: Array.isArray(t.disqualifyingFactors) ? t.disqualifyingFactors : [],
      uncertainFactors:     Array.isArray(t.uncertainFactors) ? t.uncertainFactors : [],
      eligibilityGaps:      Array.isArray(t.eligibilityGaps) ? t.eligibilityGaps : null,
      enrollmentStatus:     String(t.status ?? ''),
      locations:            Array.isArray(t.locations) ? t.locations : [],
      trialUrl:             String(t.url ?? ''),
    }))

  const matched = results.filter(r => {
    const isClose = r.eligibilityGaps && isCloseTrial(r.eligibilityGaps as EligibilityGap[])
    return !isClose && r.matchScore >= 40
  })
  const close = results.filter(r =>
    r.eligibilityGaps && isCloseTrial(r.eligibilityGaps as EligibilityGap[])
  )

  return { matched, close }
}
