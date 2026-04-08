/**
 * Drug interaction checking using Claude AI.
 * Takes a list of current medications and a new medication,
 * returns known interactions with severity classifications.
 */
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

const InteractionSchema = z.object({
  interactions: z.array(z.object({
    drug_a: z.string().describe('First medication name'),
    drug_b: z.string().describe('Second medication name'),
    severity: z.enum(['major', 'moderate', 'minor']).describe('Interaction severity'),
    description: z.string().describe('What happens when these drugs interact'),
    recommendation: z.string().describe('What the patient/caregiver should do'),
  })),
  allergy_warnings: z.array(z.object({
    medication: z.string(),
    allergy: z.string(),
    risk: z.string().describe('What could happen'),
  })),
  summary: z.string().describe('One-sentence summary of findings'),
  safe_to_combine: z.boolean().describe('False if any major interactions found'),
})

export type InteractionResult = z.infer<typeof InteractionSchema>

export async function checkDrugInteractions(
  currentMedications: Array<{ name: string; dose?: string | null }>,
  newMedication: { name: string; dose?: string | null },
  allergies?: string | null,
): Promise<InteractionResult> {
  const medList = currentMedications.map(m => `${m.name}${m.dose ? ` (${m.dose})` : ''}`).join(', ')

  const { object } = await generateObject({
    model: anthropic('claude-haiku-4-5-20251001'),
    schema: InteractionSchema,
    prompt: `You are a pharmacology expert. Check for drug interactions.

CURRENT MEDICATIONS: ${medList || 'None'}
NEW MEDICATION: ${newMedication.name}${newMedication.dose ? ` (${newMedication.dose})` : ''}
KNOWN ALLERGIES: ${allergies || 'None reported'}

Check for:
1. Drug-drug interactions between the new medication and EACH current medication
2. Allergy cross-reactivity (e.g., penicillin allergy + amoxicillin)
3. Common cancer treatment interactions (chemo drugs, supportive care, pain management)

Classify severity:
- major: Can cause serious harm, needs immediate medical attention
- moderate: Should be monitored, may need dose adjustment
- minor: Be aware, unlikely to cause problems

Only report real, documented interactions. Do NOT invent interactions.
If no interactions exist, return empty arrays and safe_to_combine=true.`,
  })

  return object
}

/**
 * Check all medications in a list against each other for interactions.
 */
export async function checkAllInteractions(
  medications: Array<{ name: string; dose?: string | null }>,
  allergies?: string | null,
): Promise<InteractionResult> {
  if (medications.length < 2) {
    return {
      interactions: [],
      allergy_warnings: [],
      summary: 'Only one medication — no interactions to check.',
      safe_to_combine: true,
    }
  }

  const medList = medications.map(m => `${m.name}${m.dose ? ` (${m.dose})` : ''}`).join(', ')

  const { object } = await generateObject({
    model: anthropic('claude-haiku-4-5-20251001'),
    schema: InteractionSchema,
    prompt: `You are a pharmacology expert. Check ALL pairwise drug interactions in this medication list.

MEDICATIONS: ${medList}
KNOWN ALLERGIES: ${allergies || 'None reported'}

Check every pair of medications for interactions. Also check each medication against the allergy list.
Focus on cancer treatment interactions (chemo drugs, supportive care, pain management, anti-nausea).

Classify severity: major (serious harm), moderate (monitor/adjust), minor (be aware).
Only report real, documented interactions. Do NOT invent interactions.`,
  })

  return object
}
