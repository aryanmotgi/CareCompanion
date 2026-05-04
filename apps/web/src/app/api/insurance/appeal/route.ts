/**
 * Insurance appeal letter generator.
 * Takes a denied claim and generates a structured appeal letter using AI.
 */
import { generateText, Output } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { validateCsrf } from '@/lib/csrf'
import { db } from '@/lib/db'
import { claims, careProfiles, insurance } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
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
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = await limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    const body = await req.json()
    const bodySchema = z.object({
      claim_id: z.string().uuid('claim_id must be a valid UUID'),
      additional_context: z.string().max(2000).optional(),
    })
    const parseResult = bodySchema.safeParse(body)
    if (!parseResult.success) return ApiErrors.badRequest(parseResult.error.issues[0]?.message || 'Invalid request body')
    const { claim_id, additional_context } = parseResult.data

    const [claim] = await db
      .select()
      .from(claims)
      .where(and(eq(claims.id, claim_id), eq(claims.userId, dbUser!.id)))
      .limit(1)

    if (!claim) return ApiErrors.notFound('Claim')
    if (claim.status !== 'denied') return ApiErrors.badRequest('Only denied claims can be appealed')

    const [[profile], [ins]] = await Promise.all([
      db.select({ patientName: careProfiles.patientName, cancerType: careProfiles.cancerType, cancerStage: careProfiles.cancerStage, conditions: careProfiles.conditions })
        .from(careProfiles).where(eq(careProfiles.userId, dbUser!.id)).limit(1),
      db.select({ provider: insurance.provider, memberId: insurance.memberId, groupNumber: insurance.groupNumber })
        .from(insurance).where(eq(insurance.userId, dbUser!.id)).limit(1),
    ])

    const { output: appeal } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      output: Output.object({ schema: AppealLetterSchema }),
      prompt: `You are a patient advocacy expert. Generate an insurance appeal letter for a denied claim.

DENIED CLAIM:
- Provider: ${claim.providerName || 'Unknown'}
- Service date: ${claim.serviceDate || 'Unknown'}
- Billed amount: $${claim.billedAmount || 'Unknown'}
- Denial reason: ${claim.denialReason || 'Not specified'}
- EOB URL: ${claim.eobUrl || 'N/A'}

PATIENT CONTEXT:
- Name: ${profile?.patientName || 'Patient'}
- Cancer type: ${profile?.cancerType || 'Not specified'}
- Cancer stage: ${profile?.cancerStage || 'Not specified'}
- Conditions: ${profile?.conditions || 'Not specified'}

INSURANCE:
- Provider: ${ins?.provider || 'Unknown'}
- Member ID: ${ins?.memberId || 'Unknown'}
- Group: ${ins?.groupNumber || 'Unknown'}

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
      denial_reason: claim.denialReason,
      disclaimer: 'This appeal letter is AI-generated and should be reviewed before sending. Consider consulting a patient advocate for complex appeals.',
    })
  } catch (error) {
    console.error('[appeal] Error:', error)
    return apiError('Appeal generation failed', 500)
  }
}
