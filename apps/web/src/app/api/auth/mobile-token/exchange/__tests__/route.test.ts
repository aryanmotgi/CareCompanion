import { describe, it, expect, vi } from 'vitest'

vi.mock('@upstash/redis', () => {
  class MockRedis {
    get = vi.fn().mockResolvedValue(null)
    del = vi.fn().mockResolvedValue(1)
  }
  return { Redis: MockRedis }
})

describe('POST /api/auth/mobile-token/exchange', () => {
  it('returns 400 for missing code', async () => {
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/auth/mobile-token/exchange', {
      method: 'POST',
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown or expired code', async () => {
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/auth/mobile-token/exchange', {
      method: 'POST',
      body: JSON.stringify({ code: 'expired-code' }),
    }))
    expect(res.status).toBe(404)
  })
})
