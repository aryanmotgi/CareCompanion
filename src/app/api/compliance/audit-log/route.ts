import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')

  const { data, count } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  return NextResponse.json({ logs: data || [], total: count || 0, limit, offset })
}
