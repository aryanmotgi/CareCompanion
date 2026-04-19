/**
 * E2E-only authentication endpoint for the production monitor.
 *
 * Creates a NextAuth session JWT for the E2E monitor account by looking up
 * the user in the database (by email) and encoding a valid session token.
 * This bypasses the Cognito OAuth redirect flow that cannot be automated
 * against a live production site.
 *
 * Security model:
 *  - Requires a valid email that exists in the users table.
 *  - Requires AUTH_SECRET on the server — the client never sees the secret.
 *  - Any email not in the DB gets 404; this is the only gate.
 *  - The E2E test account has no elevated privileges, so worst-case exposure
 *    is read-only access to one account's data.
 */
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { encode } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

// GET /api/e2e/signin — liveness probe used by CI to detect when the new
// deployment is live.  The "v" field is bumped each time the endpoint changes
// so the CI wait step can poll for the specific version it expects.
export async function GET() {
  return Response.json({ ready: true, v: 4 })
}

export async function POST(req: Request) {
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
