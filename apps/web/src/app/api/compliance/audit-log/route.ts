import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiSuccess, apiError } from '@/lib/api-response'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { eq, desc, count } from 'drizzle-orm'

/**
 * GET /api/compliance/audit-log
 *
 * Returns the authenticated user's audit log entries (paginated).
 * Users can only see their own logs (enforced by filtering on userId).
 *
 * Query params:
 *   - limit: max results per page (default 50, max 100)
 *   - offset: pagination offset (default 0)
 */
export async function GET(req: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const [logs, [{ total }]] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, user!.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(auditLogs)
        .where(eq(auditLogs.userId, user!.id)),
    ])

    return apiSuccess({ logs, total, limit, offset })
  } catch (err) {
    console.error('[audit-log] GET error:', err)
    return apiError('Internal server error', 500)
  }
}
