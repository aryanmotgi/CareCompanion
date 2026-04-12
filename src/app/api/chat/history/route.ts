import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiSuccess, apiError } from '@/lib/api-response'

/**
 * GET /api/chat/history
 *
 * Retrieve past chat messages for the current user.
 * Supports pagination via `limit` and `before` (cursor) query params.
 */
export async function GET(req: Request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const url = new URL(req.url)
    const rawLimit = parseInt(url.searchParams.get('limit') || '50', 10)
    const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, 100) : 50
    const before = url.searchParams.get('before') // ISO timestamp cursor

    let query = supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data, error } = await query

    if (error) {
      console.error('[chat/history] GET error:', error.message)
      return apiError('Failed to load chat history', 500)
    }

    const messages = (data || []).reverse() // Return in chronological order

    return apiSuccess({
      messages,
      has_more: messages.length === limit,
      cursor: messages.length > 0 ? messages[0].created_at : null,
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
    const { user, supabase, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('[chat/history] DELETE error:', error.message)
      return apiError('Failed to clear chat history', 500)
    }

    return apiSuccess({ success: true })
  } catch (err) {
    console.error('[chat/history] DELETE error:', err)
    return apiError('Internal server error', 500)
  }
}
