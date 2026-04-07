/**
 * Cached health summary endpoint.
 * GET: Returns cached summary if fresh (< 24h), otherwise generates new one.
 * POST: Force-regenerate the health summary.
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateHealthScore } from '@/lib/health-score'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

    // Check for fresh cached summary
    const { data: cached } = await supabase
      .from('health_summaries')
      .select('*')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (cached) {
      return apiSuccess({
        ...cached.summary,
        health_score: cached.health_score,
        generated_at: cached.generated_at,
        cached: true,
      })
    }

    // No fresh cache — generate new summary
    return generateAndCache(user.id, supabase)
  } catch (error) {
    console.error('[health-summary-cache] GET error:', error)
    return ApiErrors.internal()
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

    return generateAndCache(user.id, supabase)
  } catch (error) {
    console.error('[health-summary-cache] POST error:', error)
    return ApiErrors.internal()
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateAndCache(userId: string, supabase: any) {
  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id, patient_name, cancer_type, cancer_stage, treatment_phase, conditions, allergies')
    .eq('user_id', userId)
    .single()

  if (!profile) return ApiErrors.notFound('Care profile')

  const [
    { data: medications },
    { data: appointments },
    { data: labResults },
    { data: notifications },
  ] = await Promise.all([
    supabase.from('medications').select('*').eq('care_profile_id', profile.id),
    supabase.from('appointments').select('*').eq('care_profile_id', profile.id),
    supabase.from('lab_results').select('*').eq('user_id', userId).order('date_taken', { ascending: false }).limit(20),
    supabase.from('notifications').select('*').eq('user_id', userId).eq('is_read', false).limit(5),
  ])

  const healthScore = calculateHealthScore(
    medications || [],
    labResults || [],
    appointments || [],
  )

  const now = new Date()
  const futureAppts = (appointments || []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any) => a.date_time && new Date(a.date_time) > now
  )
  const abnormalLabs = (labResults || []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (l: any) => l.is_abnormal
  )

  const summary = {
    patient_name: profile.patient_name,
    cancer_type: profile.cancer_type,
    cancer_stage: profile.cancer_stage,
    treatment_phase: profile.treatment_phase,
    medication_count: (medications || []).length,
    upcoming_appointments: futureAppts.length,
    abnormal_labs: abnormalLabs.length,
    unread_notifications: (notifications || []).length,
    conditions: profile.conditions,
    allergies: profile.allergies,
  }

  // Cache the result
  const admin = createAdminClient()
  await admin.from('health_summaries').insert({
    user_id: userId,
    care_profile_id: profile.id,
    summary,
    health_score: healthScore,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })

  return apiSuccess({
    ...summary,
    health_score: healthScore,
    generated_at: now.toISOString(),
    cached: false,
  })
}
