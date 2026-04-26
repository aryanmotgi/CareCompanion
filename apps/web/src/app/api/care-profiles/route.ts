import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { careProfiles, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// POST — create a blank care profile for a new user (idempotent)
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [dbUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, session.user.email!)).limit(1)
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Return existing profile if one already exists (idempotent)
  const existing = await db.query.careProfiles.findFirst({
    where: eq(careProfiles.userId, dbUser.id),
  })
  if (existing) return NextResponse.json({ id: existing.id }, { status: 200 })

  const [profile] = await db.insert(careProfiles).values({
    userId: dbUser.id,
    onboardingCompleted: false,
  }).returning({ id: careProfiles.id })

  return NextResponse.json({ id: profile.id }, { status: 201 })
}
