import { auth } from '@/lib/auth'
import { getToken } from 'next-auth/jwt'
import { SignJWT } from 'jose'

// No Redis — the code is a short-lived signed JWT containing the session token.
// Exchange endpoint verifies the JWT and returns the session token. Zero storage needed.

export async function GET(req: Request) {
  const session = await auth()
  const base = new URL(req.url).origin

  if (!session?.user?.id) {
    return Response.redirect(`${base}/login?error=mobile_auth`, 302)
  }

  // getToken with raw:true handles chunked JWT cookies that cookieStore.get() misses.
  const rawToken = await getToken({
    req: req as Parameters<typeof getToken>[0]['req'],
    secret: process.env.NEXTAUTH_SECRET!,
    secureCookie: process.env.NODE_ENV === 'production',
    raw: true,
  })

  if (!rawToken) {
    return Response.redirect(`${base}/login?error=mobile_auth`, 302)
  }

  // Sign a short-lived JWT (60s) whose payload is the session token.
  // The exchange endpoint verifies this JWT and returns the session token.
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
  const code = await new SignJWT({ t: rawToken })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(secret)

  return new Response(null, {
    status: 302,
    headers: { Location: `carecompanion://auth/callback?code=${encodeURIComponent(code)}` },
  })
}
