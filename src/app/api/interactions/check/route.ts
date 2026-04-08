/**
 * Medication interaction checker endpoint.
 * Two modes:
 * 1. Check a NEW medication against all current meds (POST with { medication })
 * 2. Check ALL current medications against each other (POST with { check_all: true })
 */
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { checkDrugInteractions, checkAllInteractions } from '@/lib/drug-interactions'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response'

const limiter = rateLimit({ interval: 60000, maxRequests: 10 })

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

    const body = await req.json()

    // Get user's profile and current medications
    const { data: profile } = await supabase
      .from('care_profiles')
      .select('id, allergies')
      .eq('user_id', user.id)
      .single()

    if (!profile) return ApiErrors.notFound('Care profile')

    const { data: medications } = await supabase
      .from('medications')
      .select('name, dose')
      .eq('care_profile_id', profile.id)

    const currentMeds = (medications || []).map(m => ({ name: m.name, dose: m.dose }))

    // Mode 1: Check all current meds against each other
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

    // Mode 2: Check a new medication against current meds
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
