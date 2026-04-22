import { auth } from '@/lib/auth'
import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

export async function GET(req: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    const base = new URL(req.url).origin
    return Response.redirect(`${base}/login?callbackUrl=/mobile-callback`, 302)
  }

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value

  if (!sessionToken) {
    const base = new URL(req.url).origin
    return Response.redirect(`${base}/login?callbackUrl=/mobile-callback`, 302)
  }

  const code = randomBytes(32).toString('hex')
  await redis.set(`mobile-auth:${code}`, sessionToken, { ex: 60 })

  // Use raw Response so we can redirect to a custom URL scheme.
  // Next.js redirect() validates URLs and rejects non-http(s) schemes.
  return new Response(null, {
    status: 302,
    headers: { Location: `carecompanion://auth/callback?code=${code}` },
  })
}
