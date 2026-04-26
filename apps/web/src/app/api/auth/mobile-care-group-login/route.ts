import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { careGroups, careGroupMembers, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

export async function POST(req: Request) {
  try {
    const { groupName, groupPassword } = await req.json() as { groupName: string; groupPassword: string }

    if (!groupName?.trim() || !groupPassword) {
      return NextResponse.json({ error: 'Group name and password required' }, { status: 400 })
    }

    // Find care groups matching the name
    const groups = await db.query.careGroups.findMany({
      where: eq(careGroups.name, groupName.trim()),
      orderBy: (g, { asc }) => [asc(g.createdAt)],
    })

    let matchedGroup: typeof groups[0] | null = null
    for (const g of groups) {
      if (await bcrypt.compare(groupPassword, g.passwordHash)) {
        matchedGroup = g
        break
      }
    }

    if (!matchedGroup) {
      return NextResponse.json({ error: 'Invalid Care Group name or password' }, { status: 401 })
    }

    // Find the owner member
    const ownerMember = await db.query.careGroupMembers.findFirst({
      where: and(
        eq(careGroupMembers.careGroupId, matchedGroup.id),
        eq(careGroupMembers.role, 'owner'),
      ),
    })
    if (!ownerMember) {
      return NextResponse.json({ error: 'Care Group has no owner' }, { status: 500 })
    }

    const ownerUser = await db.query.users.findFirst({
      where: eq(users.id, ownerMember.userId),
    })
    if (!ownerUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 500 })
    }

    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    const token = await new SignJWT({
      sub: ownerUser.id,
      id: ownerUser.id,
      email: ownerUser.email ?? '',
      name: ownerUser.displayName ?? ownerUser.email ?? '',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)

    return NextResponse.json({ token })
  } catch (err) {
    console.error('[mobile-care-group-login] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
