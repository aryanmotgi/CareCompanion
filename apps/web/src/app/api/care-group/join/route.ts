import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { careGroups, careGroupMembers } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { auth } from '@/lib/auth'

const MAX_MEMBERS = 10

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, password } = await req.json()
    if (!name?.trim() || !password) {
      return NextResponse.json({ error: 'Group name and password are required' }, { status: 400 })
    }

    // Find matching group — oldest first (tiebreak for name+pwd collision)
    const groups = await db.query.careGroups.findMany({
      where: eq(careGroups.name, name.trim()),
      orderBy: (g, { asc }) => [asc(g.createdAt)],
    })

    let matchedGroup: typeof groups[0] | null = null
    for (const g of groups) {
      if (await bcrypt.compare(password, g.passwordHash)) {
        matchedGroup = g
        break
      }
    }

    if (!matchedGroup) {
      return NextResponse.json(
        { error: 'No Care Group found with that name and password. Check with whoever created the group.' },
        { status: 404 }
      )
    }

    // Wrap membership check + insert in a transaction to prevent concurrent double-joins
    let joinError: 'ALREADY_MEMBER' | 'GROUP_FULL' | null = null
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ userId: careGroupMembers.userId })
        .from(careGroupMembers)
        .where(and(
          eq(careGroupMembers.careGroupId, matchedGroup!.id),
          eq(careGroupMembers.userId, session.user!.id),
        ))
        .limit(1)
      if (existing) { joinError = 'ALREADY_MEMBER'; return }

      const [{ value: memberCount }] = await tx
        .select({ value: count() })
        .from(careGroupMembers)
        .where(eq(careGroupMembers.careGroupId, matchedGroup!.id))
      if (memberCount >= MAX_MEMBERS) { joinError = 'GROUP_FULL'; return }

      await tx.insert(careGroupMembers).values({
        careGroupId: matchedGroup!.id,
        userId: session.user!.id,
        role: 'member',
      })
    })

    if (joinError === 'ALREADY_MEMBER') {
      return NextResponse.json({ error: 'You are already in this Care Group.' }, { status: 409 })
    }
    if (joinError === 'GROUP_FULL') {
      return NextResponse.json({ error: 'This Care Group is full (max 10 members).' }, { status: 400 })
    }

    return NextResponse.json({ id: matchedGroup.id, name: matchedGroup.name }, { status: 200 })
  } catch (err) {
    console.error('[care-group/join] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
