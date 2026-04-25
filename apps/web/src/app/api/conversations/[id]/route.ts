import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { conversations, messages } from '@/lib/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { apiError, apiSuccess } from '@/lib/api-response'

// GET — fetch messages for a specific conversation
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params

  // Verify ownership
  const [convo] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user!.id)))
    .limit(1)

  if (!convo) return apiError('Not found', 404)

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt))

  return apiSuccess({ conversation: convo, messages: msgs })
}

// DELETE — remove a conversation and all its messages
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params

  const [convo] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user!.id)))
    .limit(1)

  if (!convo) return apiError('Not found', 404)

  await db.delete(conversations).where(eq(conversations.id, id))
  return apiSuccess({ deleted: true })
}

// PATCH — update title/tags (called by auto-title after first exchange)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  const body = await req.json() as { title?: string; tags?: string[] }

  const [convo] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user!.id)))
    .limit(1)

  if (!convo) return apiError('Not found', 404)

  const [updated] = await db
    .update(conversations)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.tags !== undefined && { tags: body.tags }),
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, id))
    .returning()

  return apiSuccess(updated)
}
