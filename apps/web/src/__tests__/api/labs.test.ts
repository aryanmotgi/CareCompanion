import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-helpers', () => ({
  getAuthenticatedUser: vi.fn(() =>
    Promise.resolve({
      user: { id: 'test-user-id', email: 'tester1@test.carecompanionai.org' },
      error: null,
    })
  ),
  parseBody: vi.fn(),
  validateBody: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
          limit: vi.fn(() => Promise.resolve([])),
        })),
        orderBy: vi.fn(() => Promise.resolve([])),
      })),
    })),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ check: vi.fn(() => Promise.resolve({ success: true })) })),
}))

vi.mock('@/lib/lab-trends', () => ({
  analyzeAllTrends: vi.fn(() => ({
    trends: [],
    red_flags: [],
    overall_status: 'good',
  })),
}))

describe('Labs API — /api/records/labs', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns lab results for authenticated user', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: 'test-user-id', email: 'tester1@test.carecompanionai.org' } as never,
      error: null,
    })

    const { db } = await import('@/lib/db')
    const mockLabs = [
      { id: 'lab-1', userId: 'test-user-id', dateTaken: new Date().toISOString() },
      { id: 'lab-2', userId: 'test-user-id', dateTaken: new Date().toISOString() },
    ]
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve(mockLabs)),
        })),
      })),
    } as never)

    const { GET } = await import('@/app/api/records/labs/route')
    const req = new Request('http://localhost:3000/api/records/labs?care_profile_id=profile-1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('rejects unauthenticated requests', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: null,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const { GET } = await import('@/app/api/records/labs/route')
    const req = new Request('http://localhost:3000/api/records/labs?care_profile_id=profile-1')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when care_profile_id is missing', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: 'test-user-id', email: 'tester1@test.carecompanionai.org' } as never,
      error: null,
    })

    const { GET } = await import('@/app/api/records/labs/route')
    const req = new Request('http://localhost:3000/api/records/labs')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})

describe('Labs Trends API — /api/labs/trends', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns trend data for authenticated user', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: 'test-user-id', email: 'tester1@test.carecompanionai.org' } as never,
      error: null,
    })

    const { db } = await import('@/lib/db')
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    } as never)

    // Mock rate limiter for this route
    vi.doMock('@/lib/rate-limit', () => ({
      rateLimit: vi.fn(() => ({ check: vi.fn(() => Promise.resolve({ success: true })) })),
    }))

    const { GET } = await import('@/app/api/labs/trends/route')
    const req = new Request('http://localhost:3000/api/labs/trends', {
      headers: { 'x-forwarded-for': '127.0.0.1' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
  })

  it('rejects unauthenticated requests for trends', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: null,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const { GET } = await import('@/app/api/labs/trends/route')
    const req = new Request('http://localhost:3000/api/labs/trends', {
      headers: { 'x-forwarded-for': '127.0.0.1' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})
