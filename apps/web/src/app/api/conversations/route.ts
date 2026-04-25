import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { conversations, messages } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { apiSuccess } from '@/lib/api-response'
import { NextResponse } from 'next/server'

// GET — list conversations for the current user
export async function GET() {
  const { user, error } = await getAuthenticatedUser()
  if (error) return error

  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      tags: conversations.tags,
      lastMessagePreview: conversations.lastMessagePreview,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      messageCount: sql<number>`count(${messages.id})::int`,
    })
    .from(conversations)
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.userId, user!.id))
    .groupBy(conversations.id)
    .orderBy(desc(conversations.updatedAt))
    .limit(50)

  return apiSuccess(rows)
}

// POST — create a new conversation
export async function POST() {
  const { user, error } = await getAuthenticatedUser()
  if (error) return error

  const [convo] = await db
    .insert(conversations)
    .values({ userId: user!.id })
    .returning()

  return NextResponse.json(convo, { status: 201 })
}
