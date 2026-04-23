import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    query: { users: { findFirst: vi.fn() } },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'new-uuid' }]),
      })),
    })),
  },
}))
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed-pw') } }))
vi.mock('@/lib/db/schema', () => ({
  users: { email: 'email', id: 'id' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
}))
vi.mock('@carecompanion/utils', () => {
  const { z } = require('zod')
  return {
    registerSchema: z.object({
      email: z.string().email('Valid email required'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      displayName: z.string().min(1, 'Display name is required'),
    }),
  }
})

beforeEach(() => vi.clearAllMocks())

describe('POST /api/auth/register', () => {
  it('returns 400 for invalid input', async () => {
    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email', password: 'short' }),
      }),
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 409 when email already registered', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ id: 'exists' } as never)

    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', password: 'password123', displayName: 'Test' }),
      }),
    )
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe('Email already registered')
  })

  it('returns 201 on success with hipaaConsent fields', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined as never)

    const returningMock = vi.fn().mockResolvedValue([{ id: 'new-uuid' }])
    const valuesMock = vi.fn(() => ({ returning: returningMock }))
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as never)

    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'password123',
          displayName: 'Test User',
          hipaaConsent: true,
        }),
      }),
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('new-uuid')

    // Verify the values call included HIPAA consent fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertedValues = (valuesMock as any).mock.calls[0][0]
    expect(insertedValues.hipaaConsent).toBe(true)
    expect(insertedValues.hipaaConsentAt).toBeInstanceOf(Date)
    expect(insertedValues.hipaaConsentVersion).toBe('1.0')
  })

  it('returns 201 on success without hipaaConsent fields', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined as never)

    const returningMock = vi.fn().mockResolvedValue([{ id: 'new-uuid' }])
    const valuesMock = vi.fn(() => ({ returning: returningMock }))
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as never)

    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'password123',
          displayName: 'Test User',
        }),
      }),
    )
    expect(res.status).toBe(201)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertedValues = (valuesMock as any).mock.calls[0][0]
    expect(insertedValues.hipaaConsent).toBeUndefined()
    expect(insertedValues.hipaaConsentAt).toBeUndefined()
    expect(insertedValues.hipaaConsentVersion).toBeUndefined()
  })

  it('normalizes email by trimming and lowercasing', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined as never)

    const returningMock = vi.fn().mockResolvedValue([{ id: 'new-uuid' }])
    const valuesMock = vi.fn(() => ({ returning: returningMock }))
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as never)

    const { POST } = await import('../route')
    await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'User@Example.COM',
          password: 'password123',
          displayName: 'Test',
        }),
      }),
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertedValues = (valuesMock as any).mock.calls[0][0]
    expect(insertedValues.email).toBe('user@example.com')
  })

  it('returns 500 when bcrypt throws', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined as never)

    const bcrypt = await import('bcryptjs')
    vi.mocked(bcrypt.default.hash).mockRejectedValueOnce(new Error('bcrypt boom'))

    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'password123',
          displayName: 'Test',
        }),
      }),
    )
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('Something went wrong')
  })

  it('returns 500 when DB insert throws', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined as never)
    vi.mocked(db.insert).mockImplementationOnce(() => {
      throw new Error('DB insert boom')
    })

    const { POST } = await import('../route')
    const res = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'password123',
          displayName: 'Test',
        }),
      }),
    )
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('Something went wrong')
  })
})
