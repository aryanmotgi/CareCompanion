import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiError, ApiErrors } from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 })

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    await logAudit({
      user_id: user.id,
      action: 'export_data',
      ip_address: req.headers.get('x-forwarded-for') || undefined,
    })

    const { data: profile } = await supabase.from('care_profiles').select('*').eq('user_id', user.id).single()
    const profileId = profile?.id

    const [medications, appointments, doctors, labResults, claims, documents, notifications] = await Promise.all([
      profileId ? supabase.from('medications').select('*').eq('care_profile_id', profileId) : { data: [] },
      profileId ? supabase.from('appointments').select('*').eq('care_profile_id', profileId) : { data: [] },
      profileId ? supabase.from('doctors').select('*').eq('care_profile_id', profileId) : { data: [] },
      supabase.from('lab_results').select('*').eq('user_id', user.id),
      supabase.from('claims').select('*').eq('user_id', user.id),
      profileId ? supabase.from('documents').select('*').eq('care_profile_id', profileId) : { data: [] },
      supabase.from('notifications').select('*').eq('user_id', user.id),
    ])

    const exportData = {
      exported_at: new Date().toISOString(),
      profile,
      medications: medications.data,
      appointments: appointments.data,
      doctors: doctors.data,
      lab_results: labResults.data,
      claims: claims.data,
      documents: documents.data,
      notifications: notifications.data,
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="carecompanion-data.json"',
      },
    })
  } catch (error) {
    console.error('[export-data] Error:', error)
    return apiError('Internal server error', 500)
  }
}
