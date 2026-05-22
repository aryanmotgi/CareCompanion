import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { conversations } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
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
      messageCount: conversations.messageCount,
    })
    .from(conversations)
    .where(eq(conversations.userId, user!.id))
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
