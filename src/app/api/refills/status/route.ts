/**
 * Medication refill status endpoint.
 * Returns refill status for all medications with urgency levels.
 */
import { createClient } from '@/lib/supabase/server'
import { checkRefillStatus } from '@/lib/refill-tracker'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

    const { data: profile } = await supabase
      .from('care_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!profile) return ApiErrors.notFound('Care profile')

    const statuses = await checkRefillStatus(profile.id)

    const overdue = statuses.filter(s => s.status === 'overdue').length
    const dueSoon = statuses.filter(s => s.status === 'due_soon' || s.status === 'due_today').length

    return apiSuccess({
      medications: statuses,
      summary: {
        total: statuses.length,
        overdue,
        due_soon: dueSoon,
        ok: statuses.filter(s => s.status === 'ok').length,
        unknown: statuses.filter(s => s.status === 'unknown').length,
      },
      message: overdue > 0
        ? `${overdue} medication refill(s) overdue!`
        : dueSoon > 0
          ? `${dueSoon} refill(s) due soon`
          : 'All refills are up to date',
    })
  } catch (error) {
    console.error('[refills] Error:', error)
    return ApiErrors.internal()
  }
}
