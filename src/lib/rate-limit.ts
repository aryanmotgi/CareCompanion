/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach with per-key token buckets.
 *
 * Note: This is per-instance. In a multi-instance deployment (e.g., Vercel),
 * each serverless function instance has its own bucket. For stricter limits,
 * use Redis or Upstash.
 */

interface RateLimitEntry {
  tokens: number
  lastRefill: number
}

interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number
  /** Window duration in milliseconds */
  windowMs: number
}

const buckets = new Map<string, RateLimitEntry>()

// Clean up stale entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  buckets.forEach((entry, key) => {
    if (now - entry.lastRefill > windowMs * 2) {
      buckets.delete(key)
    }
  })
}

/**
 * Check if a request is within rate limits.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now()
  cleanup(config.windowMs)

  let entry = buckets.get(key)

  if (!entry) {
    entry = { tokens: config.maxRequests - 1, lastRefill: now }
    buckets.set(key, entry)
    return { allowed: true }
  }

  // Refill tokens based on elapsed time
  const elapsed = now - entry.lastRefill
  const refillRate = config.maxRequests / config.windowMs
  const tokensToAdd = elapsed * refillRate
  entry.tokens = Math.min(config.maxRequests, entry.tokens + tokensToAdd)
  entry.lastRefill = now

  if (entry.tokens >= 1) {
    entry.tokens -= 1
    return { allowed: true }
  }

  // Calculate when 1 token will be available
  const retryAfterMs = Math.ceil((1 - entry.tokens) / refillRate)
  return { allowed: false, retryAfterMs }
}

/**
 * Reset rate limit state (useful for testing).
 */
export function resetRateLimits() {
  buckets.clear()
}

/**
 * Factory that returns a limiter with a `check` method.
 * Compatible with the pattern:
 *   const limiter = rateLimit({ interval, maxRequests });
 *   const { success, remaining } = limiter.check(token);
 */
export function rateLimit({
  interval,
  maxRequests,
}: {
  interval: number
  uniqueTokenPerInterval?: number
  maxRequests: number
}) {
  return {
    check(token: string): { success: boolean; remaining: number } {
      const result = checkRateLimit(token, {
        maxRequests,
        windowMs: interval,
      })
      if (result.allowed) {
        const entry = buckets.get(token)
        return { success: true, remaining: entry ? Math.floor(entry.tokens) : maxRequests - 1 }
      }
      return { success: false, remaining: 0 }
    },
  }
}
