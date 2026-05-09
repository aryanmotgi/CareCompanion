import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { rateLimit } from '@/lib/rate-limit'

const mobileLimiter = rateLimit({ interval: 60 * 60 * 1000, maxRequests: 5 })

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
    const { success } = await mobileLimiter.check(`mobile-login:${ip}`)
    if (!success) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
    }

    const { email, password } = await req.json() as { email: string; password: string }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1)

    if (!user?.passwordHash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    const token = await new SignJWT({
      sub: user.id,
      id: user.id,
      email: user.email ?? '',
      name: user.displayName ?? user.email ?? '',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)

    return NextResponse.json({ token })
  } catch (err) {
    console.error('[mobile-login] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
