// Regression: ISSUE-AUTH-003 — register endpoint must return 429 after 5 attempts per IP
// Found by /security-review on 2026-05-02
// Report: TODO.md Auth Audit section

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue({
    check: vi.fn().mockResolvedValue({ success: false }),
  }),
}))

vi.mock('@/lib/db', () => ({
  db: {
    query: { users: { findFirst: vi.fn().mockResolvedValue(undefined) } },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'new-uuid' }]),
      })),
    })),
  },
}))
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed-pw') } }))
vi.mock('@/lib/db/schema', () => ({ users: { email: 'email', id: 'id' } }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((...args: unknown[]) => args) }))
vi.mock('@carecompanion/utils', async () => {
  const { z } = await import('zod')
  return {
    registerSchema: z.object({
      email: z.string().email(),
      password: z.string().min(8),
      displayName: z.string().min(1),
    }),
  }
})

beforeEach(() => vi.clearAllMocks())

describe('POST /api/auth/register — rate limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'x-forwarded-for': '1.2.3.4' },
        body: JSON.stringify({ email: 'a@b.com', password: 'password123', displayName: 'Test' }),
      }),
    )
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toContain('Too many')
  })
})
