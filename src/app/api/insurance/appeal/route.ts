/**
 * Insurance appeal letter generator.
 * Takes a denied claim and generates a structured appeal letter using AI.
 */
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response'

const limiter = rateLimit({ interval: 60000, maxRequests: 5 })

const AppealLetterSchema = z.object({
  subject_line: z.string().describe('Subject line for the appeal letter'),
  letter_body: z.string().describe('Full appeal letter text, ready to send'),
  key_arguments: z.array(z.string()).describe('The main arguments in the appeal'),
  supporting_evidence_needed: z.array(z.string()).describe('Documents or evidence the patient should gather'),
  next_steps: z.array(z.string()).describe('What to do after sending the appeal'),
  deadline_warning: z.string().optional().describe('Any deadline information for filing the appeal'),
})

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

    const body = await req.json()
    const { claim_id, additional_context } = body

    if (!claim_id) return ApiErrors.badRequest('claim_id is required')

    // Fetch the denied claim
    const { data: claim } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claim_id)
      .eq('user_id', user.id)
      .single()

    if (!claim) return ApiErrors.notFound('Claim')
    if (claim.status !== 'denied') return ApiErrors.badRequest('Only denied claims can be appealed')

    // Fetch patient context
    const [{ data: profile }, { data: insurance }] = await Promise.all([
      supabase.from('care_profiles').select('patient_name, cancer_type, cancer_stage, conditions').eq('user_id', user.id).single(),
      supabase.from('insurance').select('provider, member_id, group_number').eq('user_id', user.id).single(),
    ])

    const { object: appeal } = await generateObject({
      model: anthropic('claude-haiku-4-5-20251001'),
      schema: AppealLetterSchema,
      prompt: `You are a patient advocacy expert. Generate an insurance appeal letter for a denied claim.

DENIED CLAIM:
- Provider: ${claim.provider_name || 'Unknown'}
- Service date: ${claim.service_date || 'Unknown'}
- Billed amount: $${claim.billed_amount || 'Unknown'}
- Denial reason: ${claim.denial_reason || 'Not specified'}
- EOB URL: ${claim.eob_url || 'N/A'}

PATIENT CONTEXT:
- Name: ${profile?.patient_name || 'Patient'}
- Cancer type: ${profile?.cancer_type || 'Not specified'}
- Cancer stage: ${profile?.cancer_stage || 'Not specified'}
- Conditions: ${profile?.conditions || 'Not specified'}

INSURANCE:
- Provider: ${insurance?.provider || 'Unknown'}
- Member ID: ${insurance?.member_id || 'Unknown'}
- Group: ${insurance?.group_number || 'Unknown'}

${additional_context ? `ADDITIONAL CONTEXT: ${additional_context}` : ''}

Write a professional, factual appeal letter. Include:
1. Patient identification and claim reference
2. Clear statement of what is being appealed
3. Medical necessity arguments (cite the cancer diagnosis)
4. Reference to relevant coverage provisions
5. Request for specific remedy
6. Professional but firm tone

IMPORTANT: This is a template. Advise the patient to have their doctor provide a letter of medical necessity to accompany this appeal.`,
    })

    return apiSuccess({
      ...appeal,
      claim_id,
      claim_status: claim.status,
      denial_reason: claim.denial_reason,
      disclaimer: 'This appeal letter is AI-generated and should be reviewed before sending. Consider consulting a patient advocate for complex appeals.',
    })
  } catch (error) {
    console.error('[appeal] Error:', error)
    return apiError('Appeal generation failed', 500)
  }
}
