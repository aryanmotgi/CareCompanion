import { anthropic } from '@ai-sdk/anthropic'
import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import { searchTrials, getTrialDetails, searchByEligibility } from './tools'
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

const searchTrialsTool = tool({
  description: 'Search ClinicalTrials.gov for trials matching a condition',
  inputSchema: z.object({
    condition: z.string(),
    terms:     z.string().optional(),
    location:  z.string().optional(),
    status:    z.string().optional(),
    phase:     z.string().optional(),
    pageSize:  z.number().optional(),
  }),
  execute: async (params) => searchTrials(params),
})

const getTrialDetailsTool = tool({
  description: 'Get full protocol details for a specific clinical trial by NCT ID',
  inputSchema: z.object({ nct_id: z.string() }),
  execute: async ({ nct_id }: { nct_id: string }) => getTrialDetails(nct_id),
})

const searchByEligibilityTool = tool({
  description: 'Search trials filtered by patient eligibility — always uses RECRUITING status',
  inputSchema: z.object({
    condition: z.string(),
    terms:     z.string().optional(),
    age:       z.number().optional(),
    sex:       z.string().optional(),
    location:  z.string().optional(),
  }),
  execute: async (params) => searchByEligibility(params),
})

export async function runTrialsAgent(profile: PatientProfile): Promise<AgentMatchOutput> {
  const systemPrompt = buildScoringSystemPrompt(profile)
  const locationFilter = profile.zipCode ? `50mi:${profile.zipCode}` : undefined

  const userMessage = `Find and score clinical trials for this patient.
Search for trials matching: ${profile.cancerType ?? 'cancer'}, stage: ${profile.cancerStage ?? 'unknown'}.
${locationFilter ? `Filter by location: ${locationFilter}` : 'No location filter — patient zip code not provided.'}
Age: ${profile.age ?? 'unknown'}.

For each trial found, score it and output a JSON code block (\`\`\`json) with one object per trial containing: nct_id, title, matchCategory, matchScore, matchReasons, disqualifyingFactors, uncertainFactors, eligibilityGaps, status, locations, url.

Only output trials with matchCategory "matched" or "close". Skip "excluded" entirely.
Limit to top 20 trials across all tool calls.`

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    prompt: userMessage,
    tools: {
      search_trials:         searchTrialsTool,
      get_trial_details:     getTrialDetailsTool,
      search_by_eligibility: searchByEligibilityTool,
    },
    stopWhen: stepCountIs(10),
  })

  const jsonBlocks = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map(m => m[1])
  const results: TrialMatchResult[] = []

  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(block)
      const trials = Array.isArray(parsed) ? parsed : [parsed]
      for (const t of trials) {
        if (t.matchCategory === 'excluded') continue
        results.push({
          nctId:                t.nct_id ?? t.nctId ?? '',
          title:                t.title ?? '',
          matchScore:           Math.max(0, Math.min(100, Number(t.matchScore) || 0)),
          matchReasons:         Array.isArray(t.matchReasons) ? t.matchReasons : [],
          disqualifyingFactors: Array.isArray(t.disqualifyingFactors) ? t.disqualifyingFactors : [],
          uncertainFactors:     Array.isArray(t.uncertainFactors) ? t.uncertainFactors : [],
          eligibilityGaps:      Array.isArray(t.eligibilityGaps) ? t.eligibilityGaps : null,
          enrollmentStatus:     t.status ?? null,
          locations:            Array.isArray(t.locations) ? t.locations : [],
          trialUrl:             t.url ?? null,
        })
      }
    } catch { /* skip malformed block */ }
  }

  const matched = results.filter(r => {
    const isClose = r.eligibilityGaps && isCloseTrial(r.eligibilityGaps as EligibilityGap[])
    return !isClose && r.matchScore >= 40
  })
  const close = results.filter(r =>
    r.eligibilityGaps && isCloseTrial(r.eligibilityGaps as EligibilityGap[])
  )

  return { matched, close }
}
