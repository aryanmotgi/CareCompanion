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

const mockProfile = {
  id: 'profile-1',
  userId: 'test-user-id',
  patientName: 'Test Patient',
  patientAge: 45,
  relationship: 'self',
  cancerType: null,
  cancerStage: null,
  treatmentPhase: null,
  conditions: null,
  allergies: null,
  onboardingCompleted: true,
  onboardingPriorities: [],
}

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([mockProfile])),
          orderBy: vi.fn(() => Promise.resolve([mockProfile])),
        })),
        orderBy: vi.fn(() => Promise.resolve([mockProfile])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([mockProfile])) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([mockProfile])) })),
      })),
    })),
  },
}))

vi.mock('@/lib/csrf', () => ({
  validateCsrf: vi.fn(() => Promise.resolve({ valid: true, error: null })),
}))

describe('Care Profile API — /api/records/profile', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns care profile for authenticated user', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: 'test-user-id', email: 'tester1@test.carecompanionai.org' } as never,
      error: null,
    })

    const { GET } = await import('@/app/api/records/profile/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('id', 'profile-1')
  })

  it('rejects unauthenticated GET requests', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: null,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const { GET } = await import('@/app/api/records/profile/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 404 when no care profile exists', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: 'test-user-id', email: 'tester1@test.carecompanionai.org' } as never,
      error: null,
    })

    const { db } = await import('@/lib/db')
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    } as never)

    const { GET } = await import('@/app/api/records/profile/route')
    const res = await GET()
    expect(res.status).toBe(404)
  })
})

describe('Me API — /api/me (care profile summary)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns user and profile data for authenticated user', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: 'test-user-id', email: 'tester1@test.carecompanionai.org' } as never,
      error: null,
    })

    const { GET } = await import('@/app/api/me/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('userId', 'test-user-id')
    expect(body).toHaveProperty('email', 'tester1@test.carecompanionai.org')
  })

  it('rejects unauthenticated requests', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: null,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const { GET } = await import('@/app/api/me/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })
})
