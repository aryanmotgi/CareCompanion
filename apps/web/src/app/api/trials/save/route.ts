import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { savedTrials, careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({
  nctId:          z.string().min(1),
  interestStatus: z.enum(['interested', 'applied', 'enrolled', 'dismissed']).default('interested'),
})

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = schema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const [profile] = await db.select({ id: careProfiles.id })
    .from(careProfiles).where(eq(careProfiles.userId, user.id)).limit(1)
  if (!profile) return NextResponse.json({ error: 'No care profile' }, { status: 404 })

  const [row] = await db.insert(savedTrials)
    .values({
      careProfileId:  profile.id,
      nctId:          body.data.nctId,
      interestStatus: body.data.interestStatus,
    })
    .onConflictDoUpdate({
      target: [savedTrials.careProfileId, savedTrials.nctId],
      set: { interestStatus: body.data.interestStatus, savedAt: new Date() },
    })
    .returning()

  return NextResponse.json(row)
}
