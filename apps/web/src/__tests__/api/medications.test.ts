import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// Mock the auth helper at the layer actually used by the route
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
          limit: vi.fn(() => Promise.resolve([{ id: 'profile-1' }])),
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
        orderBy: vi.fn(() => Promise.resolve([])),
      })),
    })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([])) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([])) })) })) })),
  },
}))

vi.mock('@/lib/csrf', () => ({ validateCsrf: vi.fn(() => Promise.resolve({ valid: true, error: null })) }))
vi.mock('@/lib/soft-delete', () => ({ softDelete: vi.fn(() => Promise.resolve({})) }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(() => ({ check: vi.fn(() => Promise.resolve({ success: true })) })) }))

describe('Medications API — /api/records/medications', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns medications for authenticated user', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: 'test-user-id', email: 'tester1@test.carecompanionai.org' } as never,
      error: null,
    })

    const { db } = await import('@/lib/db')
    // Simulate returning two medications from the DB
    const mockMeds = [
      { id: 'med-1', name: 'Test Medication A', careProfileId: 'profile-1' },
      { id: 'med-2', name: 'Test Medication B', careProfileId: 'profile-1' },
    ]
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{ id: 'profile-1' }])),
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
        orderBy: vi.fn(() => Promise.resolve([])),
      })),
    } as never)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve(mockMeds)),
        })),
      })),
    } as never)

    const { GET } = await import('@/app/api/records/medications/route')
    const req = new Request('http://localhost:3000/api/records/medications?care_profile_id=profile-1')
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
      error: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }),
    })

    const { GET } = await import('@/app/api/records/medications/route')
    const req = new Request('http://localhost:3000/api/records/medications?care_profile_id=profile-1')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when care_profile_id is missing', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: 'test-user-id', email: 'tester1@test.carecompanionai.org' } as never,
      error: null,
    })

    const { GET } = await import('@/app/api/records/medications/route')
    const req = new Request('http://localhost:3000/api/records/medications')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
