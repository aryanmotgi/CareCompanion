import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, userIdentities, auditLogs } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { jwtVerify, createRemoteJWKSet, SignJWT } from 'jose'

/**
 * POST /api/auth/social
 *
 * Accepts a social identity token from the mobile app (Apple or Google),
 * verifies it, looks up / creates the linked user, and returns a session.
 *
 * Account-linking rules (via user_identities table):
 *   1. Match by (provider, providerSub) — same-provider re-login.
 *   2. Else, look up identities by email:
 *        - password identity exists → 409 PASSWORD_ACCOUNT_EXISTS
 *        - different social provider exists → 409 PROVIDER_MISMATCH
 *        - same provider but different sub OR no existing identities → link / create.
 */
export async function POST(req: Request) {
  const startedAt = Date.now()
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null
  try {
    const body = await req.json()
    const { provider, identityToken, email: providedEmail, displayName } = body

    if (!provider || !identityToken) {
      return NextResponse.json(
        { error: 'Missing provider or identityToken' },
        { status: 400 },
      )
    }
    if (provider !== 'apple' && provider !== 'google') {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
    }

    let verifiedEmail: string
    let providerSub: string

    if (provider === 'apple') {
      const appleJWKS = createRemoteJWKSet(
        new URL('https://appleid.apple.com/auth/keys'),
      )
      const { payload } = await jwtVerify(identityToken, appleJWKS, {
        issuer: 'https://appleid.apple.com',
        audience: process.env.APPLE_CLIENT_ID ?? process.env.APPLE_BUNDLE_ID,
      })
      verifiedEmail = (payload.email as string)?.toLowerCase().trim()
      providerSub = payload.sub as string
      if (!verifiedEmail) {
        verifiedEmail = providedEmail?.toLowerCase().trim()
      }
    } else {
      const googleJWKS = createRemoteJWKSet(
        new URL('https://www.googleapis.com/oauth2/v3/certs'),
      )
      const { payload } = await jwtVerify(identityToken, googleJWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: process.env.GOOGLE_CLIENT_ID,
      })
      verifiedEmail = (payload.email as string)?.toLowerCase().trim()
      providerSub = payload.sub as string
    }

    if (!verifiedEmail) {
      return NextResponse.json(
        { error: 'Could not determine email from identity token' },
        { status: 400 },
      )
    }

    // 1) Match by (provider, providerSub) — same-provider re-login.
    const [bySub] = await db
      .select()
      .from(userIdentities)
      .where(and(eq(userIdentities.provider, provider), eq(userIdentities.providerSub, providerSub)))
      .limit(1)

    let userId: string
    let matchedBy: 'providerSub' | 'email' | 'created'
    let linkedNewIdentity = false

    if (bySub) {
      userId = bySub.userId
      matchedBy = 'providerSub'
    } else {
      // 2) Look up identities by email.
      const byEmail = await db
        .select()
        .from(userIdentities)
        .where(eq(userIdentities.email, verifiedEmail))

      const passwordRow = byEmail.find((i) => i.provider === 'password')
      if (passwordRow) {
        return NextResponse.json(
          {
            error: 'This email has a password account. Sign in with your password then link Apple/Google from settings.',
            code: 'PASSWORD_ACCOUNT_EXISTS',
          },
          { status: 409 },
        )
      }
      const otherProvider = byEmail.find((i) => i.provider !== provider)
      if (otherProvider) {
        return NextResponse.json(
          {
            error: 'Account exists with a different sign-in method.',
            code: 'PROVIDER_MISMATCH',
            existingProvider: otherProvider.provider,
          },
          { status: 409 },
        )
      }

      if (byEmail.length > 0) {
        // Same provider, different sub — link new identity to existing user.
        userId = byEmail[0].userId
        await db.insert(userIdentities).values({
          userId,
          provider,
          providerSub,
          email: verifiedEmail,
        })
        linkedNewIdentity = true
        matchedBy = 'email'
      } else {
        // 5) Create new user + identity.
        const [newUser] = await db
          .insert(users)
          .values({
            email: verifiedEmail,
            displayName: displayName ?? verifiedEmail,
            providerSub,
          })
          .returning()
        userId = newUser.id
        await db.insert(userIdentities).values({
          userId,
          provider,
          providerSub,
          email: verifiedEmail,
        })
        matchedBy = 'created'
      }
    }

    // Fetch the user record for the JWT payload.
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user) {
      return NextResponse.json({ error: 'User not found after sign-in' }, { status: 500 })
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

    // Audit any sign-in that touched an existing user record via email match,
    // and brand-new account creations. Same-provider re-logins (matchedBy ===
    // 'providerSub') are skipped to keep the log signal-rich.
    if (matchedBy !== 'providerSub') {
      void db.insert(auditLogs).values({
        userId: user.id,
        action: matchedBy === 'created' ? 'social_login_created' : 'social_login_linked',
        resource: 'user',
        resourceId: user.id,
        ipAddress: ip,
        method: 'POST',
        path: '/api/auth/social',
        statusCode: 200,
        durationMs: Date.now() - startedAt,
        metadata: { provider, matchedBy, linkedNewIdentity },
      }).catch((e) => console.error('[social-auth] audit insert failed:', e))
    }

    return NextResponse.json(
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          provider,
        },
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[social-auth]', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Social authentication failed. Please try again.' },
      { status: 500 },
    )
  }
}
