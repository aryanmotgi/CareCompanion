import { NextResponse } from 'next/server'
import { validateCsrf } from '@/lib/csrf'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { role } = body
  if (!['caregiver', 'patient', 'self'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  await db.update(users).set({ role }).where(eq(users.id, session.user.id))
  return NextResponse.json({ success: true })
}
