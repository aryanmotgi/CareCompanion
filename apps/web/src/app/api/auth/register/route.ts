import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { registerSchema } from '@carecompanion/utils'
import { rateLimit } from '@/lib/rate-limit'

const registerLimiter = rateLimit({ interval: 60 * 60 * 1000, maxRequests: 5 })

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { email, password, displayName } = parsed.data
    const normalizedEmail = email.trim().toLowerCase()

    // Rate limit by IP: 5 registrations per hour
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const { success: rateLimitOk } = await registerLimiter.check(ip)
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Too many registration attempts. Try again later.' }, { status: 429 })
    }

    const existing = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const hipaaConsent = body.hipaaConsent === true

    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        displayName,
        passwordHash,
        role: parsed.data.role ?? null,
        ...(hipaaConsent && {
          hipaaConsent: true,
          hipaaConsentAt: new Date(),
          hipaaConsentVersion: '1.0',
        }),
      })
      .returning({ id: users.id })

    return NextResponse.json({ id: newUser.id }, { status: 201 })
  } catch (err) {
    const masked = 'Something went wrong. Please try again.'
    console.error('[register]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: masked }, { status: 500 })
  }
}
