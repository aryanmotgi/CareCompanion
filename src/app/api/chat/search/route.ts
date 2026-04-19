/**
 * Chat history search endpoint.
 * Full-text search across past conversations.
 */
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { and, eq, desc, sql } from 'drizzle-orm'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

export async function GET(req: Request) {
  try {
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    const url = new URL(req.url)
    const query = url.searchParams.get('q')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    if (!query || query.trim().length < 2) {
      return ApiErrors.badRequest('Search query must be at least 2 characters')
    }

    const searchTerm = `%${escapeLike(query.trim())}%`

    const results = await db
      .select({ id: messages.id, role: messages.role, content: messages.content, createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.userId, dbUser!.id), sql`${messages.content} ilike ${searchTerm}`))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset)

    return apiSuccess({
      query: query.trim(),
      results,
      total: results.length,
      has_more: results.length === limit,
      offset,
      limit,
    })
  } catch (error) {
    console.error('[chat-search] Error:', error)
    return ApiErrors.internal()
  }
}
