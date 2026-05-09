import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, resetRateLimits } from '@/lib/rate-limit'

describe('rate-limit', () => {
  beforeEach(() => {
    resetRateLimits()
  })

  it('allows requests within the limit', () => {
    const config = { maxRequests: 3, windowMs: 60_000 }

    expect(checkRateLimit('user-1', config)).toEqual(expect.objectContaining({ allowed: true }))
    expect(checkRateLimit('user-1', config)).toEqual(expect.objectContaining({ allowed: true }))
    expect(checkRateLimit('user-1', config)).toEqual(expect.objectContaining({ allowed: true }))
  })

  it('blocks requests over the limit', () => {
    const config = { maxRequests: 2, windowMs: 60_000 }

    expect(checkRateLimit('user-1', config)).toEqual(expect.objectContaining({ allowed: true }))
    expect(checkRateLimit('user-1', config)).toEqual(expect.objectContaining({ allowed: true }))

    const result = checkRateLimit('user-1', config)
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0)
    }
  })

  it('tracks keys independently', () => {
    const config = { maxRequests: 1, windowMs: 60_000 }

    expect(checkRateLimit('user-1', config)).toEqual(expect.objectContaining({ allowed: true }))
    expect(checkRateLimit('user-2', config)).toEqual(expect.objectContaining({ allowed: true }))

    const result1 = checkRateLimit('user-1', config)
    expect(result1.allowed).toBe(false)

    // user-2 is also exhausted
    const result2 = checkRateLimit('user-2', config)
    expect(result2.allowed).toBe(false)
  })

  it('refills tokens over time', async () => {
    const config = { maxRequests: 2, windowMs: 100 } // 100ms window for fast test

    expect(checkRateLimit('user-1', config)).toEqual(expect.objectContaining({ allowed: true }))
    expect(checkRateLimit('user-1', config)).toEqual(expect.objectContaining({ allowed: true }))

    // Should be blocked now
    expect(checkRateLimit('user-1', config).allowed).toBe(false)

    // Wait for the window to pass
    await new Promise(resolve => setTimeout(resolve, 120))

    // Should be allowed again after refill
    expect(checkRateLimit('user-1', config)).toEqual(expect.objectContaining({ allowed: true }))
  })

  it('resetRateLimits clears all state', () => {
    const config = { maxRequests: 1, windowMs: 60_000 }

    expect(checkRateLimit('user-1', config)).toEqual(expect.objectContaining({ allowed: true }))
    expect(checkRateLimit('user-1', config).allowed).toBe(false)

    resetRateLimits()

    // After reset, should be allowed again
    expect(checkRateLimit('user-1', config)).toEqual(expect.objectContaining({ allowed: true }))
  })
})
