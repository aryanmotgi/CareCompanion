import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { encode } from 'next-auth/jwt'

export async function POST(req: Request) {
  try {
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

    // Create a NextAuth-compatible JWT token
    const secret = process.env.NEXTAUTH_SECRET!
    const token = await encode({
      token: {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.displayName ?? user.email,
      },
      secret,
    })

    return NextResponse.json({ token })
  } catch (err) {
    console.error('[mobile-login] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
