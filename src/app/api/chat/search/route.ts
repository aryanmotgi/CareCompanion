/**
 * Chat history search endpoint.
 * Full-text search across past conversations.
 */
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

    const url = new URL(req.url)
    const query = url.searchParams.get('q')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    if (!query || query.trim().length < 2) {
      return ApiErrors.badRequest('Search query must be at least 2 characters')
    }

    // Use Supabase ilike for text search (works without full-text index)
    const searchTerm = `%${query.trim()}%`

    const { data: messages, error, count } = await supabase
      .from('messages')
      .select('id, role, content, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .ilike('content', searchTerm)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[chat-search] Error:', error)
      return ApiErrors.internal('Search failed')
    }

    return apiSuccess({
      query: query.trim(),
      results: messages || [],
      total: count || 0,
      has_more: (count || 0) > offset + limit,
      offset,
      limit,
    })
  } catch (error) {
    console.error('[chat-search] Error:', error)
    return ApiErrors.internal()
  }
}
