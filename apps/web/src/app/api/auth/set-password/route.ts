import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({ password: z.string().min(8) })

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  await db.update(users).set({ passwordHash }).where(eq(users.id, session.user.id))
  return NextResponse.json({ ok: true })
}
