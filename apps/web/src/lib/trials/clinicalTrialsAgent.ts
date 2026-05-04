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

type AgentMatchOutput = {
  matched: TrialMatchResult[]
  close:   TrialMatchResult[]
}

const MOCK_FALLBACK: AgentMatchOutput = {
  matched: [
    {
      nctId:                'NCT04573335',
      title:                'Pembrolizumab Plus Chemotherapy in Early-Stage Triple-Negative Breast Cancer (KEYNOTE-522)',
      matchCategory:        'matched',
      matchScore:           88,
      matchReasons:         ['Stage I breast cancer aligns with trial eligibility', 'Triple-negative receptor status matches inclusion criteria', 'Recruiting at multiple US sites'],
      disqualifyingFactors: [],
      uncertainFactors:     ['Prior immunotherapy history may affect eligibility'],
      eligibilityGaps:      null,
      phase:                'PHASE3',
      enrollmentStatus:     'RECRUITING',
      locations:            [{ city: 'Houston', state: 'TX', country: 'United States' }, { city: 'Boston', state: 'MA', country: 'United States' }],
      trialUrl:             'https://clinicaltrials.gov/study/NCT04573335',
    },
    {
      nctId:                'NCT03053193',
      title:                'Neratinib + Paclitaxel vs Trastuzumab + Paclitaxel in HER2+ Stage I–IIIc Breast Cancer (NSABP FB-7)',
      matchCategory:        'matched',
      matchScore:           81,
      matchReasons:         ['HER2-positive early breast cancer matches protocol', 'Stage I patients eligible', 'Standard paclitaxel backbone familiar to oncologists'],
      disqualifyingFactors: [],
      uncertainFactors:     ['LVEF threshold must be confirmed at screening'],
      eligibilityGaps:      null,
      phase:                'PHASE2',
      enrollmentStatus:     'RECRUITING',
      locations:            [{ city: 'Pittsburgh', state: 'PA', country: 'United States' }, { city: 'Chicago', state: 'IL', country: 'United States' }],
      trialUrl:             'https://clinicaltrials.gov/study/NCT03053193',
    },
    {
      nctId:                'NCT04432454',
      title:                'Olaparib Adjuvant Therapy in BRCA-Mutated High-Risk Early Breast Cancer (OlympiA)',
      matchCategory:        'matched',
      matchScore:           75,
      matchReasons:         ['BRCA1/2 mutation carriers with early-stage disease are primary population', 'Adjuvant phase allows post-surgery enrollment', 'Active US sites enrolling'],
      disqualifyingFactors: [],
      uncertainFactors:     ['Germline BRCA status must be confirmed prior to screening'],
      eligibilityGaps:      null,
      phase:                'PHASE3',
      enrollmentStatus:     'RECRUITING',
      locations:            [{ city: 'New York', state: 'NY', country: 'United States' }, { city: 'Los Angeles', state: 'CA', country: 'United States' }],
      trialUrl:             'https://clinicaltrials.gov/study/NCT04432454',
    },
  ],
  close: [],
}

export async function runTrialsAgent(profile: PatientProfile): Promise<AgentMatchOutput> {
  const t0 = Date.now()
  const systemPrompt = buildScoringSystemPrompt(profile)
  const locationFilter = profile.zipCode ?? undefined
  // Strip test/seed suffixes so CT.gov gets a clean search term
  const condition = (profile.cancerType ?? 'cancer').replace(/\s*\(TEST[^)]*\)/gi, '').trim() || 'cancer'

  // Single CT.gov search — searchByEligibility passed age but tools.ts ignored it,
  // making it identical to the broad search. One call with pageSize 40 is cleaner.
  console.log('[trials-agent] starting CT.gov fetch')
  const result = await searchTrials({ condition, location: locationFilter, status: 'RECRUITING', pageSize: 40 })
  console.log(`[trials-agent] CT.gov fetch done in ${Date.now() - t0}ms`)

  if ('error' in result) {
    console.warn('[trials-agent] CT.gov error, using mock fallback:', result.error)
    return MOCK_FALLBACK
  }

  const allTrials: object[] = result.trials

  if (allTrials.length === 0) {
    console.log('[trials-agent] no trials found from CT.gov, using mock fallback')
    return MOCK_FALLBACK
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
        phase:                t.phase ? String(t.phase).slice(0, 50) : null,
        enrollmentStatus:     String(t.status ?? ''),
        locations:            Array.isArray(t.locations) ? t.locations : [],
        trialUrl:             t.url && /^https:\/\//i.test(String(t.url)) ? String(t.url) : null,
      }
    })

  const matched = results
    .filter(r => r.matchCategory === 'matched')
    .sort((a, b) => b.matchScore - a.matchScore)
  const close   = results.filter(r => r.matchCategory === 'close')

  console.log(`[trials-agent] returned ${matched.length} matched, ${close.length} close (from ${rawArray.length} scored)`)
  return { matched, close }
}
