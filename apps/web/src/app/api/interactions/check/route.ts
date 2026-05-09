/**
 * Medication interaction checker endpoint.
 * Two modes:
 * 1. Check a NEW medication against all current meds (POST with { medication })
 * 2. Check ALL current medications against each other (POST with { check_all: true })
 */
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { validateCsrf } from '@/lib/csrf'
import { db } from '@/lib/db'
import { careProfiles, medications } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { rateLimit } from '@/lib/rate-limit'
import { checkDrugInteractions, checkAllInteractions } from '@/lib/drug-interactions'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response'

const limiter = rateLimit({ interval: 60000, maxRequests: 10 })

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

    const [profile] = await db
      .select({ id: careProfiles.id, allergies: careProfiles.allergies })
      .from(careProfiles)
      .where(eq(careProfiles.userId, dbUser!.id))
      .limit(1)

    if (!profile) return ApiErrors.notFound('Care profile')

    const meds = await db
      .select({ name: medications.name, dose: medications.dose })
      .from(medications)
      .where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt)))

    const currentMeds = meds.map(m => ({ name: m.name, dose: m.dose }))

    if (body.check_all) {
      if (currentMeds.length < 2) {
        return apiSuccess({
          interactions: [],
          allergy_warnings: [],
          summary: 'You need at least 2 medications to check for interactions.',
          safe_to_combine: true,
        })
      }

      const result = await checkAllInteractions(currentMeds, profile.allergies)
      return apiSuccess(result)
    }

    if (!body.medication || typeof body.medication !== 'string') {
      return ApiErrors.badRequest('Provide { medication: "drug name" } or { check_all: true }')
    }

    const newMed = {
      name: body.medication.trim(),
      dose: body.dose?.trim() || null,
    }

    if (newMed.name.length > 200) {
      return ApiErrors.badRequest('Medication name too long (max 200 characters)')
    }

    if (currentMeds.length === 0) {
      return apiSuccess({
        interactions: [],
        allergy_warnings: [],
        summary: 'No current medications to check against.',
        safe_to_combine: true,
        checked_against: [],
        new_medication: newMed.name,
        disclaimer: 'This is for informational awareness only. Please confirm with your doctor or pharmacist before making any medication decisions.',
      })
    }

    const result = await checkDrugInteractions(currentMeds, newMed, profile.allergies)

    return apiSuccess({
      ...result,
      checked_against: currentMeds.map(m => m.name),
      new_medication: newMed.name,
      disclaimer: 'This is for informational awareness only. Please confirm with your doctor or pharmacist before making any medication decisions.',
    })
  } catch (error) {
    console.error('[interactions] Error:', error)
    return apiError('Interaction check failed', 500)
  }
}
