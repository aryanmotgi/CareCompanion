import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { savedTrials, careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const { user, error } = await getAuthenticatedUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile] = await db.select({ id: careProfiles.id })
    .from(careProfiles).where(eq(careProfiles.userId, user.id)).limit(1)
  if (!profile) return NextResponse.json([])

  const rows = await db.select().from(savedTrials)
    .where(eq(savedTrials.careProfileId, profile.id))

  return NextResponse.json(rows)
}
