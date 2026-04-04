import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/chat/history
 *
 * Retrieve past chat messages for the current user.
 * Supports pagination via `limit` and `before` (cursor) query params.
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
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
    return Response.json({ error: error.message }, { status: 500 })
  }

  const messages = (data || []).reverse() // Return in chronological order

  return Response.json({
    messages,
    has_more: messages.length === limit,
    cursor: messages.length > 0 ? messages[0].created_at : null,
  })
}

/**
 * DELETE /api/chat/history
 *
 * Clear all chat messages for the current user.
 */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
