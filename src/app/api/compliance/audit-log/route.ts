import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiSuccess, apiError } from '@/lib/api-response'

/**
 * GET /api/compliance/audit-log
 *
 * Returns the authenticated user's audit log entries (paginated).
 * Users can only see their own logs (enforced by filtering on user_id).
 *
 * Query params:
 *   - limit: max results per page (default 50, max 100)
 *   - offset: pagination offset (default 0)
 */
export async function GET(req: Request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const { data, count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    return apiSuccess({ logs: data || [], total: count || 0, limit, offset })
  } catch (err) {
    console.error('[audit-log] GET error:', err)
    return apiError('Internal server error', 500)
  }
}
