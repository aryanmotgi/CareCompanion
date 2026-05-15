/**
 * GET /api/care-group/mine — list the care groups the authenticated user
 * belongs to. Used by mobile to surface the patient's group on the
 * share-invite onboarding step (without having to remember the id from
 * creation time).
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { careGroupMembers, careGroups } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberships = await db
      .select({ careGroupId: careGroupMembers.careGroupId, role: careGroupMembers.role })
      .from(careGroupMembers)
      .where(eq(careGroupMembers.userId, session.user.id))

    if (memberships.length === 0) {
      return NextResponse.json({ groups: [] })
    }

    const groupIds = memberships.map((m) => m.careGroupId)
    const groups = await db
      .select({ id: careGroups.id, name: careGroups.name, createdBy: careGroups.createdBy })
      .from(careGroups)
      .where(inArray(careGroups.id, groupIds))

    const enriched = groups.map((g) => {
      const m = memberships.find((mm) => mm.careGroupId === g.id)
      return {
        id: g.id,
        name: g.name,
        role: m?.role ?? 'member',
        isOwner: g.createdBy === session.user.id,
      }
    })

    return NextResponse.json({ groups: enriched })
  } catch (err) {
    console.error('[care-group/mine] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
