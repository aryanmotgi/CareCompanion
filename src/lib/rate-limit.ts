/**
 * Distributed rate limiter using Upstash Redis (sliding window).
 * Falls back to in-memory for local dev when KV env vars are absent.
 *
 * All API routes call `await limiter.check(key)` — async by design so the
 * same interface works with both Redis and the in-memory fallback.
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ---------------------------------------------------------------------------
// In-memory fallback (local dev / CI without Redis)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  tokens: number
  lastRefill: number
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const buckets = new Map<string, RateLimitEntry>()
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  buckets.forEach((entry, key) => {
    if (now - entry.lastRefill > windowMs * 2) buckets.delete(key)
  })
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: true; remaining: number } | { allowed: false; remaining: 0; retryAfterMs: number } {
  const now = Date.now()
  cleanup(config.windowMs)

  let entry = buckets.get(key)
  if (!entry) {
    entry = { tokens: config.maxRequests - 1, lastRefill: now }
    buckets.set(key, entry)
    return { allowed: true, remaining: config.maxRequests - 1 }
  }

  const elapsed = now - entry.lastRefill
  const refillRate = config.maxRequests / config.windowMs
  entry.tokens = Math.min(config.maxRequests, entry.tokens + elapsed * refillRate)
  entry.lastRefill = now

  if (entry.tokens >= 1) {
    entry.tokens -= 1
    return { allowed: true, remaining: Math.floor(entry.tokens) }
  }
  const retryAfterMs = Math.ceil((1 - entry.tokens) / refillRate)
  return { allowed: false, remaining: 0, retryAfterMs }
}

// ---------------------------------------------------------------------------
// Factory — returns an object with an async `check` method
// ---------------------------------------------------------------------------

export function rateLimit({
  interval,
  maxRequests,
  uniqueTokenPerInterval: _unusedToken = undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
}: {
  interval: number
  uniqueTokenPerInterval?: number
  maxRequests: number
}) {
  const hasRedis =
    typeof process !== 'undefined' &&
    !!process.env.KV_REST_API_URL &&
    !!process.env.KV_REST_API_TOKEN

  const windowSecs = Math.max(1, Math.ceil(interval / 1000))

  const redisLimiter = hasRedis
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(maxRequests, `${windowSecs} s`),
        prefix: 'cc:rl',
      })
    : null

  return {
    async check(token: string): Promise<{ success: boolean; remaining: number }> {
      if (redisLimiter) {
        const { success, remaining } = await redisLimiter.limit(token)
        return { success, remaining }
      }

      // In-memory fallback
      const result = checkRateLimit(token, { maxRequests, windowMs: interval })
      return { success: result.allowed, remaining: result.remaining }
    },
  }
}

/** Reset in-memory state (test helper — no-op against Redis). */
export function resetRateLimits() {
  buckets.clear()
}
