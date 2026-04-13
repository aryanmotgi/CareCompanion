/**
 * AI Symptom Triage endpoint.
 * Structured symptom input → urgency classification.
 * The "2am nausea" use case — fast, structured, actionable.
 */
import { generateText, Output } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response'

const limiter = rateLimit({ interval: 60000, maxRequests: 10 })

const TriageInputSchema = z.object({
  symptoms: z.array(z.string().min(1).max(200)).min(1).max(10),
  severity: z.number().min(1).max(10).optional(),
  duration: z.string().max(100).optional(),
  additional_context: z.string().max(1000).optional(),
})

const TriageResultSchema = z.object({
  urgency: z.enum(['emergency', 'urgent', 'routine', 'informational']).describe(
    'emergency=call 911, urgent=contact oncologist within hours, routine=discuss at next visit, informational=monitor'
  ),
  urgency_reason: z.string().describe('Why this urgency level was assigned'),
  recommended_actions: z.array(z.object({
    action: z.string().describe('What to do'),
    priority: z.enum(['immediate', 'today', 'this_week', 'next_visit']),
    who: z.string().describe('Who to contact or what to do — e.g., oncologist, ER, nurse line'),
  })),
  cancer_context: z.string().describe('How these symptoms relate to cancer treatment if applicable'),
  red_flags: z.array(z.string()).describe('Warning signs that would escalate urgency'),
  comfort_measures: z.array(z.string()).describe('Things to try at home while waiting'),
  questions_for_doctor: z.array(z.string()).describe('Questions to ask at the next appointment'),
})

export type TriageResult = z.infer<typeof TriageResultSchema>

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

    const body = await req.json()
    const parsed = TriageInputSchema.safeParse(body)
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input: ' + parsed.error.issues.map(i => i.message).join(', '))
    }

    const { symptoms, severity, duration, additional_context } = parsed.data

    // Fetch patient context for personalized triage
    const { data: profile } = await supabase
      .from('care_profiles')
      .select('id, cancer_type, cancer_stage, treatment_phase, conditions, allergies')
      .eq('user_id', user.id)
      .single()

    const { data: medications } = await supabase
      .from('medications')
      .select('name, dose')
      .eq('care_profile_id', profile?.id || '')

    const patientContext = profile
      ? `Cancer type: ${profile.cancer_type || 'unknown'}. Stage: ${profile.cancer_stage || 'unknown'}. Phase: ${profile.treatment_phase || 'unknown'}. Other conditions: ${profile.conditions || 'none'}. Allergies: ${profile.allergies || 'none'}. Current meds: ${(medications || []).map(m => m.name).join(', ') || 'none'}.`
      : 'No patient profile available.'

    const { output: triage } = await generateText({
      model: anthropic('claude-haiku-4.5'),
      output: Output.object({ schema: TriageResultSchema }),
      prompt: `You are an oncology triage nurse AI. Assess the following symptoms and provide structured triage guidance.

PATIENT CONTEXT: ${patientContext}

SYMPTOMS: ${symptoms.join(', ')}
${severity ? `SEVERITY (1-10): ${severity}` : ''}
${duration ? `DURATION: ${duration}` : ''}
${additional_context ? `ADDITIONAL CONTEXT: ${additional_context}` : ''}

TRIAGE RULES:
- EMERGENCY: fever >100.4°F with ANC <500 (neutropenic fever), severe bleeding, difficulty breathing, chest pain, sudden confusion, signs of sepsis, severe allergic reaction
- URGENT: fever 100-100.4°F during chemo, uncontrolled vomiting (>24h), severe dehydration, new neurological symptoms, pain >8/10 unresponsive to meds
- ROUTINE: manageable nausea, mild fatigue, constipation, mild neuropathy, appetite changes, sleep issues
- INFORMATIONAL: general questions, expected side effects on schedule, emotional concerns

ALWAYS err on the side of caution for cancer patients.
ALWAYS mention calling 911 for emergencies.
Include cancer-specific context (e.g., "nausea is common on day 3-5 of FOLFOX").`,
    })

    return apiSuccess(triage)
  } catch (error) {
    console.error('[triage] Error:', error)
    return apiError('Triage assessment failed', 500)
  }
}
