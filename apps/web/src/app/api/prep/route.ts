import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiError, apiSuccess } from '@/lib/api-response'
import { db } from '@/lib/db'
import { appointments, careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// In-memory cache — resets on cold start, acceptable since checklist content is stable
const prepCache = new Map<string, string[]>()

export async function GET(req: Request) {
  try {
    const { user: dbUser, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const url = new URL(req.url)
    const appointmentId = url.searchParams.get('appointmentId')
    if (!appointmentId) return apiError('appointmentId required', 400)

    if (prepCache.has(appointmentId)) {
      return apiSuccess({ items: prepCache.get(appointmentId) })
    }

    const [row] = await db
      .select({
        specialty: appointments.specialty,
        purpose: appointments.purpose,
        doctorName: appointments.doctorName,
        careProfileId: appointments.careProfileId,
        cancerType: careProfiles.cancerType,
        cancerStage: careProfiles.cancerStage,
        treatmentPhase: careProfiles.treatmentPhase,
        profileUserId: careProfiles.userId,
      })
      .from(appointments)
      .innerJoin(careProfiles, eq(appointments.careProfileId, careProfiles.id))
      .where(eq(appointments.id, appointmentId))
      .limit(1)

    if (!row) return apiError('Appointment not found', 404)
    if (row.profileUserId !== dbUser!.id) return apiError('Access denied', 403)

    const patientCtx = [
      row.cancerType || 'cancer',
      row.cancerStage ? `stage ${row.cancerStage}` : null,
      row.treatmentPhase ? `treatment phase: ${row.treatmentPhase}` : null,
    ].filter(Boolean).join(', ')

    const apptCtx = [
      row.specialty || 'medical visit',
      row.doctorName ? `with Dr. ${row.doctorName}` : null,
      row.purpose ? `for ${row.purpose}` : null,
    ].filter(Boolean).join(' ')

    const prompt = `Patient: ${patientCtx}.
Appointment: ${apptCtx}.

Generate a focused pre-appointment checklist of 4-6 specific, actionable items. Be specific to this appointment type and patient context — no generic advice like "bring ID". Return ONLY a JSON array of strings, each a short imperative sentence. No markdown, no explanation, no wrapper object.`

    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt,
      maxOutputTokens: 400,
    })

    let items: string[] = []
    try {
      const parsed = JSON.parse(text.trim())
      if (Array.isArray(parsed)) items = parsed.filter((s): s is string => typeof s === 'string').slice(0, 6)
    } catch {
      items = text
        .split('\n')
        .map(l => l.replace(/^[-•*\d.)\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 6)
    }

    if (items.length > 0) prepCache.set(appointmentId, items)
    return apiSuccess({ items })
  } catch (err) {
    console.error('[prep] GET error:', err)
    return apiError('Internal server error', 500)
  }
}
