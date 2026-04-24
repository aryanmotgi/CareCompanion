import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { jwtVerify, createRemoteJWKSet } from 'jose'

/**
 * POST /api/auth/social
 *
 * Accepts a social identity token from the mobile app (Apple or Google),
 * verifies it, creates or finds the user, and returns a session.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { provider, identityToken, email: providedEmail, displayName } = body

    if (!provider || !identityToken) {
      return NextResponse.json(
        { error: 'Missing provider or identityToken' },
        { status: 400 },
      )
    }

    let verifiedEmail: string
    let providerSub: string

    if (provider === 'apple') {
      // Verify Apple identity token using Apple's public keys
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
        // Apple may not provide email on subsequent sign-ins; use provided email
        verifiedEmail = providedEmail?.toLowerCase().trim()
      }
    } else if (provider === 'google') {
      // Verify Google identity token using Google's public keys
      const googleJWKS = createRemoteJWKSet(
        new URL('https://www.googleapis.com/oauth2/v3/certs'),
      )
      const { payload } = await jwtVerify(identityToken, googleJWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: process.env.GOOGLE_CLIENT_ID,
      })

      verifiedEmail = (payload.email as string)?.toLowerCase().trim()
      providerSub = payload.sub as string
    } else {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
    }

    if (!verifiedEmail) {
      return NextResponse.json(
        { error: 'Could not determine email from identity token' },
        { status: 400 },
      )
    }

    // Find or create user
    let user = await db.query.users.findFirst({
      where: eq(users.email, verifiedEmail),
    })

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({
          email: verifiedEmail,
          displayName: displayName ?? verifiedEmail,
          providerSub,
        })
        .returning()
      user = newUser
    }

    // Return user info for the mobile app to establish a session
    // The mobile app will use this to call the NextAuth credentials callback
    // or store the session directly
    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        provider,
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
