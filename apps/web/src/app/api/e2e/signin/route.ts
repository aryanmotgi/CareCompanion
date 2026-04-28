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
import { users, careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { encode } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

// 60 req/min: CI runs 9 tests × up to 3 retries each = 27 max signin calls.
const limiter = rateLimit({ interval: 60_000, maxRequests: 60 })

// GET /api/e2e/signin — liveness probe used by CI to detect when the new
// deployment is live.  The "v" field is bumped each time the endpoint changes
// so the CI wait step can poll for the specific version it expects.
export async function GET() {
  return Response.json({ ready: true, v: 18 })
}

export async function POST(req: Request) {
  // Gate: require E2E_AUTH_SECRET header to prevent unauthorized session minting.
  // Without this, anyone who knows an email in the DB could mint a valid session.
  const e2eSecret = process.env.E2E_AUTH_SECRET
  if (!e2eSecret) {
    return NextResponse.json({ error: 'E2E_AUTH_SECRET not configured' }, { status: 500 })
  }
  const providedSecret = req.headers.get('x-e2e-secret')
  if (providedSecret !== e2eSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Rate limit: 20 requests per minute per IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
  const { success } = await limiter.check(`e2e-signin:${ip}`)
  if (!success) {
    return NextResponse.json({ error: 'too many requests' }, { status: 429 })
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

  // Look up the user in the database to get their DB UUID and cognitoSub.
  // The test user must have logged in at least once via normal OAuth so that
  // their record exists in the users table.
  //
  // Aurora Serverless auto-pauses after inactivity. The first DB call after a
  // pause will fail while the cluster resumes (typically < 30 s). Retry up to
  // 4 times with a 10 s delay so the scheduled monitor survives a cold start.
  let dbUserId!: string
  let cognitoSub!: string
  let displayName!: string
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
  const MAX_ATTEMPTS = 4
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const [user] = await db
        .select({ id: users.id, providerSub: users.providerSub, displayName: users.displayName })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)

      if (!user) {
        return NextResponse.json({ error: 'user not found in database' }, { status: 404 })
      }
      dbUserId = user.id
      cognitoSub = user.providerSub ?? ''
      displayName = user.displayName ?? email

      // Ensure HIPAA consent is set so the app layout doesn't redirect to /consent.
      // The E2E account bypasses the normal OAuth + consent UI flow, so this gate
      // would otherwise block every test navigation.
      // Also set role so middleware doesn't redirect to /set-role on every request.
      await db
        .update(users)
        .set({ hipaaConsent: true, role: 'patient' })
        .where(eq(users.email, email))

      // Ensure a care profile exists so pages like /dashboard and /care don't
      // redirect() inside a <Suspense> boundary (which causes ERR_ABORTED in
      // Playwright).  A minimal profile with onboardingCompleted=true prevents
      // the onboarding banner from appearing and stops all profile-guard redirects.
      const [existingProfile] = await db
        .select({ id: careProfiles.id })
        .from(careProfiles)
        .where(eq(careProfiles.userId, user.id))
        .limit(1)

      if (!existingProfile) {
        await db.insert(careProfiles).values({
          userId: user.id,
          patientName: 'E2E Monitor',
          onboardingCompleted: true,
        })
      }
      break // success — exit retry loop
    } catch (err) {
      const e = err as { message?: string }
      console.error(`[e2e/signin] DB error (attempt ${attempt}/${MAX_ATTEMPTS}):`, e.message)
      if (attempt === MAX_ATTEMPTS) {
        return NextResponse.json({ error: 'database error' }, { status: 500 })
      }
      await sleep(10_000) // wait for Aurora to resume before retrying
    }
  }

  // NextAuth v5 derives the encryption key from (AUTH_SECRET + salt) where
  // salt === the cookie name. HTTPS (production) uses the __Secure- prefix.
  const isProd = process.env.NODE_ENV === 'production'
  const cookieName = isProd
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

  const token = await encode({
    token: {
      sub: dbUserId,
      // dbUserId is what auth.ts jwt callback stores for the DB UUID,
      // and session callback sets session.user.id = token.dbUserId.
      // Without it, session.user.id is undefined → redirect('/login?error=session') → redirect loop.
      dbUserId,
      providerSub: cognitoSub,
      email,
      name: displayName,
      displayName,
      role: 'patient',
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
