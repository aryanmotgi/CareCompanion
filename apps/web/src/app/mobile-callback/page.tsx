import { auth } from '@/lib/auth'
import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

export default async function MobileCallbackPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/mobile-callback')
  }

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value

  if (!sessionToken) {
    redirect('/login?callbackUrl=/mobile-callback')
  }

  const code = randomBytes(32).toString('hex')
  await redis.set(`mobile-auth:${code}`, sessionToken, { ex: 60 })

  redirect(`carecompanion://auth/callback?code=${code}`)
}
