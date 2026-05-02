import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
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

export type AgentMatchOutput = {
  matched: TrialMatchResult[]
  close:   TrialMatchResult[]
}

export async function runTrialsAgent(profile: PatientProfile): Promise<AgentMatchOutput> {
  const t0 = Date.now()
  const systemPrompt = buildScoringSystemPrompt(profile)
  const locationFilter = profile.zipCode ? `50mi:${profile.zipCode}` : undefined
  // Strip test/seed suffixes so CT.gov gets a clean search term
  const condition = (profile.cancerType ?? 'cancer').replace(/\s*\(TEST[^)]*\)/gi, '').trim() || 'cancer'

  // Single CT.gov search — searchByEligibility passed age but tools.ts ignored it,
  // making it identical to the broad search. One call with pageSize 40 is cleaner.
  console.log('[trials-agent] starting CT.gov fetch')
  const result = await searchTrials({ condition, location: locationFilter, status: 'RECRUITING', pageSize: 40 })
  console.log(`[trials-agent] CT.gov fetch done in ${Date.now() - t0}ms`)

  const allTrials: object[] = 'trials' in result ? result.trials : []

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

Each object must have: nct_id, title, matchCategory, matchScore (0-100), matchReasons (string[]), disqualifyingFactors (string[]), uncertainFactors (string[]), eligibilityGaps (array or null), phase (string or null, pass through from input), status, locations (array), url.

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

  // NCT IDs are NCT + exactly 8 digits. Accept 4+ to tolerate minor LLM formatting variation.
  // Reject empty strings, wildcards (% _), and anything that isn't an NCT identifier.
  const NCT_RE = /^NCT\d{4,}$/
  const results: TrialMatchResult[] = rawArray
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .filter(t => t.matchCategory !== 'excluded')
    .filter(t => {
      const id = String(t.nct_id ?? t.nctId ?? '').trim()
      if (!NCT_RE.test(id)) {
        console.warn('[trials-agent] skipping trial with invalid nctId:', id)
        return false
      }
      return true
    })
    .map(t => {
      const rawCat = String(t.matchCategory ?? '').toLowerCase()
      const gaps   = Array.isArray(t.eligibilityGaps) ? (t.eligibilityGaps as EligibilityGap[]) : null
      // Trust Haiku's classification. Only use gap analysis as fallback when
      // Haiku returned an unrecognised category (neither 'matched' nor 'close').
      let category: 'matched' | 'close'
      if (rawCat === 'close') {
        category = 'close'
      } else if (rawCat === 'matched') {
        category = 'matched'
      } else {
        category = gaps && isCloseTrial(gaps) ? 'close' : 'matched'
      }
      return {
        nctId:                String(t.nct_id ?? t.nctId ?? '').trim(),
        title:                String(t.title ?? ''),
        matchCategory:        category,
        matchScore:           Math.max(0, Math.min(100, Number(t.matchScore) || 0)),
        matchReasons:         Array.isArray(t.matchReasons) ? t.matchReasons : [],
        disqualifyingFactors: Array.isArray(t.disqualifyingFactors) ? t.disqualifyingFactors : [],
        uncertainFactors:     Array.isArray(t.uncertainFactors) ? t.uncertainFactors : [],
        eligibilityGaps:      gaps,
        phase:                t.phase ? String(t.phase) : null,
        enrollmentStatus:     String(t.status ?? ''),
        locations:            Array.isArray(t.locations) ? t.locations : [],
        trialUrl:             t.url ? String(t.url) : null,
      }
    })

  const matched = results
    .filter(r => r.matchCategory === 'matched')
    .sort((a, b) => b.matchScore - a.matchScore)
  const close   = results.filter(r => r.matchCategory === 'close')

  console.log(`[trials-agent] returned ${matched.length} matched, ${close.length} close (from ${rawArray.length} scored)`)
  return { matched, close }
}
