import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { careGroupMembers, users } from '@/lib/db/schema'
import { eq, and, ne, asc } from 'drizzle-orm'
import { auth } from '@/lib/auth'

interface Props { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Props) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: careGroupId } = await params

    // Verify the caller is actually a member of this group before revealing any data
    const callerMembership = await db.query.careGroupMembers.findFirst({
      where: and(
        eq(careGroupMembers.careGroupId, careGroupId),
        eq(careGroupMembers.userId, session.user.id),
      ),
    })
    if (!callerMembership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    // Find any member that is NOT the current user
    const otherMembers = await db
      .select({ userId: careGroupMembers.userId, displayName: users.displayName })
      .from(careGroupMembers)
      .innerJoin(users, eq(careGroupMembers.userId, users.id))
      .where(and(
        eq(careGroupMembers.careGroupId, careGroupId),
        ne(careGroupMembers.userId, session.user.id),
      ))
      .orderBy(asc(careGroupMembers.joinedAt))
      .limit(1)

    if (otherMembers.length === 0) {
      return NextResponse.json({ joined: false })
    }

    return NextResponse.json({
      joined: true,
      name: otherMembers[0].displayName ?? 'Your partner',
    })
  } catch (err) {
    console.error('[care-group/status] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
