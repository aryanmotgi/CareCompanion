import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Extract the raw encrypted session JWT from the cookie header.
  // This is exactly the token NextAuth validates — no re-encoding needed.
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  const sessionToken = match?.[1]

  if (!sessionToken) {
    return NextResponse.json({ error: 'Session cookie not found' }, { status: 400 })
  }

  const code = randomBytes(32).toString('hex')
  // Store code → raw session token for 60 seconds, single-use
  await redis.set(`mobile-auth:${code}`, sessionToken, { ex: 60 })

  return NextResponse.json({ code })
}
