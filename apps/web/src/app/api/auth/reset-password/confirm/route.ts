import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return `${local?.slice(0, 3)}***@${domain}`
}

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    // Verify JWT signature and expiry
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '')
    let payload: { email?: string; nonce?: string }
    try {
      const result = await jwtVerify(token, secret)
      payload = result.payload as { email?: string; nonce?: string }
    } catch {
      return NextResponse.json({ error: 'Invalid or expired reset link. Please request a new one.' }, { status: 400 })
    }

    if (!payload.email || !payload.nonce) {
      return NextResponse.json({ error: 'Invalid reset token.' }, { status: 400 })
    }

    // Look up user and verify nonce matches (single-use)
    const user = await db.query.users.findFirst({ where: eq(users.email, payload.email) })
    if (!user || user.resetNonce !== payload.nonce) {
      return NextResponse.json({ error: 'This reset link has already been used or is invalid.' }, { status: 400 })
    }

    // Hash new password and update, clear nonce to prevent reuse
    const passwordHash = await bcrypt.hash(password, 12)
    await db
      .update(users)
      .set({ passwordHash, resetNonce: null })
      .where(eq(users.id, user.id))

    console.log(`[reset-password-confirm] Password reset for ${maskEmail(payload.email)}`)
    return NextResponse.json({ message: 'Password reset successfully.' })
  } catch (err) {
    console.error('[reset-password-confirm]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
