import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiSuccess, apiError } from '@/lib/api-response'
import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { eq, lt, desc, and } from 'drizzle-orm'

/**
 * GET /api/chat/history
 *
 * Retrieve past chat messages for the current user.
 * Supports pagination via `limit` and `before` (cursor) query params.
 */
export async function GET(req: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const url = new URL(req.url)
    const rawLimit = parseInt(url.searchParams.get('limit') || '50', 10)
    const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, 100) : 50
    const before = url.searchParams.get('before') // ISO timestamp cursor

    const whereClause = before
      ? and(eq(messages.userId, user!.id), lt(messages.createdAt, new Date(before)))
      : eq(messages.userId, user!.id)

    const rows = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(whereClause)
      .orderBy(desc(messages.createdAt))
      .limit(limit)

    const result = rows.reverse() // Return in chronological order

    return apiSuccess({
      messages: result,
      has_more: result.length === limit,
      cursor: result.length > 0 ? result[0].createdAt : null,
    })
  } catch (err) {
    console.error('[chat/history] GET error:', err)
    return apiError('Internal server error', 500)
  }
}

/**
 * DELETE /api/chat/history
 *
 * Clear all chat messages for the current user.
 */
export async function DELETE() {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    await db.delete(messages).where(eq(messages.userId, user!.id))

    return apiSuccess({ success: true })
  } catch (err) {
    console.error('[chat/history] DELETE error:', err)
    return apiError('Internal server error', 500)
  }
}
