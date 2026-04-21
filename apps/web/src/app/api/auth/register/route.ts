import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { registerSchema } from '@carecompanion/utils'

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { email, password, displayName } = parsed.data
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const [newUser] = await db
    .insert(users)
    .values({ email, displayName, passwordHash })  // cognitoSub is null for email-only users
    .returning({ id: users.id })

  return NextResponse.json({ id: newUser.id }, { status: 201 })
}
