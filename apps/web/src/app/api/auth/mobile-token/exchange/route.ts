import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { code?: string }
  if (!body.code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 })
  }

  const key = `mobile-auth:${body.code}`
  const sessionToken = await redis.get<string>(key)
  if (!sessionToken) {
    return NextResponse.json({ error: 'Code expired or invalid' }, { status: 404 })
  }

  // Single-use: delete immediately
  await redis.del(key)
  return NextResponse.json({ sessionToken })
}
