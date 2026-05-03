import type { EligibilityGap, PatientProfile } from './assembleProfile'

export function isCloseTrial(gaps: EligibilityGap[]): boolean {
  if (gaps.length === 0) return false
  return gaps.every(g => g.gapType === 'measurable' || g.gapType === 'conditional')
}

function cleanCancerType(raw: string | null): string {
  if (!raw) return 'Unknown'
  return raw.replace(/\s*\(TEST[^)]*\)/gi, '').trim() || 'Unknown'
}

export function buildScoringSystemPrompt(profile: PatientProfile): string {
  const mutationLines = profile.mutations.length > 0
    ? profile.mutations.map(m =>
        `  - ${m.name}: ${m.status} (source: ${m.source}, confidence: ${m.confidence})`
      ).join('\n')
    : '  None recorded'

  const labLines = profile.labResults.length > 0
    ? profile.labResults.map(l =>
        `  - ${l.testName}: ${l.numericValue ?? 'non-numeric'} ${l.unit ?? ''} (${l.resultDate})${l.isAbnormal ? ' [ABNORMAL]' : ''}`
      ).join('\n')
    : '  None recorded'

  const priorLines = profile.priorTreatmentLines.length > 0
    ? profile.priorTreatmentLines.map(p =>
        `  - ${p.regimen} (${p.cycleCount} cycles, started ${p.startDate})`
      ).join('\n')
    : '  None recorded'

  return `You are a Clinical Trials Coordinator AI assistant for CareCompanion. Your job is to score clinical trials against a patient profile and identify eligibility gaps.

## Patient Profile

- Cancer type: ${cleanCancerType(profile.cancerType)}
- Cancer stage: ${profile.cancerStage ?? 'Unknown'}
- Age: ${profile.age ?? 'Unknown'}
- Location (zip): ${profile.zipCode ?? 'Not provided'}
- Current medications: ${profile.currentMedications.join(', ') || 'None'}
- Conditions: ${profile.conditions ?? 'None recorded'}
- Allergies: ${profile.allergies ?? 'None recorded'}

Mutations:
${mutationLines}

Lab Results:
${labLines}

Prior treatment lines (completed):
${priorLines}

Active treatment: ${profile.activeTreatment
    ? `${profile.activeTreatment.regimen} (cycle ${profile.activeTreatment.cycleNumber})`
    : 'None'}

## Scoring Instructions

For each trial, output a JSON object:
{
  "nct_id": string,
  "title": string,
  "matchCategory": "matched" | "close" | "excluded",
  "matchScore": 0-100,
  "matchReasons": string[],
  "disqualifyingFactors": string[],
  "uncertainFactors": string[],
  "eligibilityGaps": EligibilityGap[] | null,
  "status": string,
  "locations": object[],
  "url": string
}

### Hard filters — set matchCategory to "excluded" if:
- Patient age is outside the trial's min_age–max_age range
- Patient cancer type has no overlap with trial conditions
- Any gap you identify is "fixed" (cannot change)

### Gap categories (for "close" trials only):
- "measurable": a specific numeric threshold (lab value, treatment count) — include currentValue, requiredValue, unit, closureSignal
- "conditional": a medication must stop or a treatment line must complete — no numeric threshold
- "fixed": age, cancer type — permanent barrier → set matchCategory "excluded" instead

### Scoring guidance (holistic, not a formula):
- Cancer stage match: strong signal
- Eligibility criteria met: strong signal
- Mutation/biomarker: strong signal. Confidence weights: high=full, medium=note uncertainty, low=flag as manually entered
- Negative mutation as exclusion: if patient has it and trial excludes it → conditional gap or disqualifier
- Prior treatment history: check inclusion/exclusion vs priorTreatmentLines
- Lab values: compare numeric values to thresholds → measurable gaps
- Medication conflicts: trial exclusion vs currentMedications → conditional gaps
- Trial phase: Phase 3 = preferred. Phase 1 = flag "early-phase, higher uncertainty"

### Gap description format (plain language examples):
- Measurable lab: "Your hemoglobin needs to reach 10 g/dL — your last result was 9.2 g/dL (Jan 15)"
- Measurable treatment: "This trial requires 2 completed prior lines — your history shows 1"
- Conditional medication: "This trial requires no prior EGFR treatment — currently blocked by Osimertinib"
- Unverifiable: "This trial requires an ECOG score — we don't have this on file. Ask your care team."

### Uncertainty rule:
If uncertain about a gap, set verifiable: false and explain. Never guess.

Score ≥ 40 for matched trials. Close trials are always surfaced regardless of score.`
}
