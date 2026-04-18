/**
 * E2E-only authentication endpoint for the production monitor.
 *
 * Uses Cognito USER_PASSWORD_AUTH to authenticate the test account and creates
 * a NextAuth session JWT directly, bypassing the OAuth redirect flow that the
 * normal UI uses (which cannot be automated against a live production site).
 *
 * This endpoint is completely inert unless E2E_AUTH_SECRET is set on the server,
 * which should only be configured in environments that allow E2E testing.
 */
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { encode } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const e2eSecret = process.env.E2E_AUTH_SECRET
  if (!e2eSecret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { email?: string; password?: string; secret?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const { email, password, secret } = body
  if (!email || !password || !secret) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (secret !== e2eSecret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const cognitoRegion = process.env.COGNITO_REGION ?? 'us-east-1'
  const clientId = process.env.COGNITO_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'cognito not configured' }, { status: 500 })
  }

  try {
    const client = new CognitoIdentityProviderClient({ region: cognitoRegion })
    const result = await client.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: { USERNAME: email, PASSWORD: password },
      }),
    )

    const idToken = result.AuthenticationResult?.IdToken
    if (!idToken) {
      return NextResponse.json({ error: 'no id_token returned' }, { status: 401 })
    }

    // Decode the Cognito ID token (it is a signed JWT; we only read the payload here)
    const [, payloadB64] = idToken.split('.')
    const decoded = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8'),
    ) as Record<string, string>
    const sub = decoded.sub

    const authSecret = process.env.AUTH_SECRET
    if (!authSecret) {
      return NextResponse.json({ error: 'AUTH_SECRET not set' }, { status: 500 })
    }

    // Build a NextAuth v5-compatible session JWT
    const token = await encode({
      token: {
        sub,
        email: decoded.email,
        name: decoded['custom:display_name'] || decoded.name || decoded.email,
        cognitoSub: sub,
        displayName: decoded['custom:display_name'] || decoded.name || decoded.email,
        isDemo: false,
      },
      secret: authSecret,
      // encode() expects salt when NextAuth v5 uses the default "cookie" strategy.
      // The salt NextAuth uses is the cookie name.
      salt: 'authjs.session-token',
      maxAge: 60 * 60, // 1 hour
    })

    const res = NextResponse.json({ ok: true })
    // NextAuth v5 uses "authjs.session-token" on HTTP and
    // "__Secure-authjs.session-token" on HTTPS (production).
    const isProd = process.env.NODE_ENV === 'production'
    const cookieName = isProd ? '__Secure-authjs.session-token' : 'authjs.session-token'
    res.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60,
    })
    return res
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string }
    if (e.name === 'NotAuthorizedException') {
      return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
    }
    if (e.name === 'UserNotFoundException') {
      return NextResponse.json({ error: 'user not found' }, { status: 401 })
    }
    console.error('[e2e/signin] error:', e.message)
    return NextResponse.json({ error: e.message ?? 'auth failed' }, { status: 500 })
  }
}
