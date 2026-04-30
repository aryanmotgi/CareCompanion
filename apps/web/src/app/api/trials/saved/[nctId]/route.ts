import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { savedTrials, careProfiles } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({
  interestStatus: z.enum(['interested', 'applied', 'enrolled', 'dismissed']),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ nctId: string }> }
) {
  const { user, error } = await getAuthenticatedUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = schema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const [profile] = await db.select({ id: careProfiles.id })
    .from(careProfiles).where(eq(careProfiles.userId, user.id)).limit(1)
  if (!profile) return NextResponse.json({ error: 'No care profile' }, { status: 404 })

  const { nctId } = await params
  const [row] = await db.update(savedTrials)
    .set({ interestStatus: body.data.interestStatus })
    .where(and(eq(savedTrials.careProfileId, profile.id), eq(savedTrials.nctId, nctId)))
    .returning()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}
