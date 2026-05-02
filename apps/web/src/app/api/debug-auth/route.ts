import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

// TEMP DEBUG ENDPOINT — remove after diagnosing login issue
export async function GET(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 })
  }
  const url = new URL(req.url)
  const email = url.searchParams.get('email') ?? 'aryan.motgi1@gmail.com'
  const setRole = url.searchParams.get('setRole')
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase().trim()),
      columns: { id: true, email: true, passwordHash: true, role: true },
    })
    if (!user) return NextResponse.json({ found: false })
    if (setRole && ['caregiver', 'patient', 'self'].includes(setRole)) {
      await db.update(users).set({ role: setRole }).where(eq(users.email, email.toLowerCase().trim()))
      return NextResponse.json({ updated: true, role: setRole })
    }
    const setPassword = url.searchParams.get('setPassword')
    if (setPassword) {
      const hash = await bcrypt.hash(setPassword, 12)
      await db.update(users).set({ passwordHash: hash }).where(eq(users.email, email.toLowerCase().trim()))
      return NextResponse.json({ updated: true, passwordSet: true })
    }
    return NextResponse.json({
      found: true,
      email: user.email,
      hasPasswordHash: !!user.passwordHash,
      role: user.role,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
