/**
 * Upstash Redis JSON cache helper for read-through API caching.
 * Falls back to a no-op cache when KV env vars are absent (local dev/CI).
 *
 * Mirrors the connection pattern in src/lib/rate-limit.ts: same env vars
 * (KV_REST_API_URL, KV_REST_API_TOKEN), single Redis.fromEnv() client.
 */
import { Redis } from '@upstash/redis'

const hasRedis =
  typeof process !== 'undefined' &&
  !!process.env.KV_REST_API_URL &&
  !!process.env.KV_REST_API_TOKEN

const redis = hasRedis ? Redis.fromEnv() : null

async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try {
    const value = await redis.get<T>(key)
    return value ?? null
  } catch (err) {
    console.error('[cache] get failed', { key, err })
    return null
  }
}

async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (!redis) return
  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch (err) {
    console.error('[cache] set failed', { key, err })
  }
}

async function cacheDel(key: string): Promise<void> {
  if (!redis) return
  try {
    await redis.del(key)
  } catch (err) {
    console.error('[cache] del failed', { key, err })
  }
}

/**
 * Read-through cache wrapper. On miss, runs `loader`, stores the result,
 * returns it. On Redis failure the loader still runs — cache is best-effort.
 */
export async function cacheReadThrough<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key)
  if (hit !== null) return hit
  const fresh = await loader()
  await cacheSet(key, fresh, ttlSeconds)
  return fresh
}

export const CACHE_TTL = {
  ONE_HOUR: 60 * 60,
  FIVE_MIN: 5 * 60,
} as const

export const cacheKeys = {
  chatProfile: (userId: string) => `cc:chat:profile:${userId}`,
  chatMeds: (careProfileId: string) => `cc:chat:meds:${careProfileId}`,
}

/**
 * Invalidate the chat-context cache after a user mutates their profile or
 * medications. Call after writes to careProfiles / medications. Either
 * argument may be null when the caller does not have one of the IDs yet.
 */
export async function invalidateChatCache(userId: string | null, careProfileId: string | null): Promise<void> {
  const ops: Promise<unknown>[] = []
  if (userId) ops.push(cacheDel(cacheKeys.chatProfile(userId)))
  if (careProfileId) ops.push(cacheDel(cacheKeys.chatMeds(careProfileId)))
  await Promise.all(ops)
}
