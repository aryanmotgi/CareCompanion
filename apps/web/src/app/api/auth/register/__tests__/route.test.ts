import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    query: { users: { findFirst: vi.fn() } },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'new-uuid' }]) })),
    })),
  },
}))
vi.mock('bcrypt', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed') } }))

describe('POST /api/auth/register', () => {
  it('returns 409 when email already registered', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ id: 'exists' } as never)
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'password123', displayName: 'Test' }),
    }))
    expect(res.status).toBe(409)
  })

  it('returns 400 for invalid input', async () => {
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-email', password: 'short' }),
    }))
    expect(res.status).toBe(400)
  })
})
