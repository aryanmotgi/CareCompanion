/**
 * E2E-only authentication endpoint for the production monitor.
 *
 * Creates a NextAuth session JWT for the E2E monitor account by looking up
 * the user in the database (by email) and encoding a valid session token.
 * This bypasses the Cognito OAuth redirect flow that cannot be automated
 * against a live production site.
 *
 * Security model:
 *  - Only works for the address stored in E2E_MONITOR_EMAIL (one account).
 *  - Requires AUTH_SECRET on the server to mint a valid token; the client
 *    never sees or supplies the secret.
 *  - The test account has no elevated privileges, so worst-case exposure is
 *    read-only access to that single account's data.
 */
// GET /api/e2e/signin — liveness probe used by CI to detect when the new
// deployment is live.  Returns a stable JSON response that old versions of
// this route (which had no GET handler) would not return.
export async function GET() {
  return Response.json({ ready: true })
}

import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { encode } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

const E2E_EMAIL = process.env.E2E_MONITOR_EMAIL

export async function POST(req: Request) {
  if (!E2E_EMAIL) {
    return NextResponse.json({ error: 'E2E_MONITOR_EMAIL not configured' }, { status: 500 })
  }

  const authSecret = process.env.AUTH_SECRET
  if (!authSecret) {
    return NextResponse.json({ error: 'AUTH_SECRET not set' }, { status: 500 })
  }

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const { email } = body
  if (!email) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  // Only allow sessions for the designated E2E monitor account.
  if (email !== E2E_EMAIL) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Look up the user in the database to get their cognitoSub.
  // The test user must have logged in at least once via normal OAuth so that
  // their record exists in the users table.
  let cognitoSub: string
  let displayName: string
  try {
    const [user] = await db
      .select({ cognitoSub: users.cognitoSub, displayName: users.displayName })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: 'user not found in database' }, { status: 404 })
    }
    cognitoSub = user.cognitoSub
    displayName = user.displayName ?? email
  } catch (err) {
    const e = err as { message?: string }
    console.error('[e2e/signin] DB error:', e.message)
    return NextResponse.json({ error: 'database error' }, { status: 500 })
  }

  // NextAuth v5 derives the encryption key from (AUTH_SECRET + salt) where
  // salt === the cookie name. HTTPS (production) uses the __Secure- prefix.
  const isProd = process.env.NODE_ENV === 'production'
  const cookieName = isProd
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

  const token = await encode({
    token: {
      sub: cognitoSub,
      email,
      name: displayName,
      cognitoSub,
      displayName,
      isDemo: false,
    },
    secret: authSecret,
    salt: cookieName,
    maxAge: 60 * 60, // 1 hour
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  })
  return res
}
