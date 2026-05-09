import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { validateCsrf } from '@/lib/csrf'
import { db } from '@/lib/db'
import { careGroups, careGroupMembers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, password } = await req.json()

    if (!name?.trim() || !password || password.length < 4) {
      return NextResponse.json({ error: 'Group name and password (min 4 chars) are required' }, { status: 400 })
    }

    const trimmedName = name.trim()
    const passwordHash = await bcrypt.hash(password, 12)

    // Check for name+password collision (warn — don't block)
    const existingGroups = await db.query.careGroups.findMany({
      where: eq(careGroups.name, trimmedName),
    })
    for (const g of existingGroups) {
      const collision = await bcrypt.compare(password, g.passwordHash)
      if (collision) {
        return NextResponse.json(
          { error: 'A Care Group with this name and password already exists. Choose a different name or password.' },
          { status: 409 }
        )
      }
    }

    const [group] = await db.insert(careGroups)
      .values({ name: trimmedName, passwordHash, createdBy: session.user.id })
      .returning({ id: careGroups.id, name: careGroups.name })

    // Creator becomes owner
    await db.insert(careGroupMembers).values({
      careGroupId: group.id,
      userId: session.user.id,
      role: 'owner',
    })

    return NextResponse.json({ id: group.id, name: group.name }, { status: 201 })
  } catch (err) {
    console.error('[care-group] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
