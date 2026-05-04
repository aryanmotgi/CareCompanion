// Regression: ISSUE-002 — GET /api/checkins had no ownership check
// Any authenticated user could read any care profile's check-in data by passing a foreign careProfileId.
// Found by /qa on 2026-05-02
// Report: TODO.md Dashboard Flow Audit section

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api-helpers', () => ({
  getAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/api-response', () => ({
  apiError: vi.fn((msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status })
  ),
  apiSuccess: vi.fn((data: unknown) =>
    new Response(JSON.stringify({ data }), { status: 200 })
  ),
}))

const mockSelect = vi.fn()
vi.mock('@/lib/db', () => ({
  db: { select: mockSelect },
}))

vi.mock('@/lib/db/schema', () => ({
  wellnessCheckins: { careProfileId: 'careProfileId', checkedInAt: 'checkedInAt' },
  careProfiles: { id: 'id', userId: 'userId', checkinStreak: 'checkinStreak' },
  careTeamMembers: { careProfileId: 'careProfileId', userId: 'userId' },
  careTeamActivityLog: {},
  notificationDeliveries: {},
  pushSubscriptions: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  gte: vi.fn((a: unknown, b: unknown) => ({ gte: [a, b] })),
  desc: vi.fn((a: unknown) => ({ desc: a })),
  sql: Object.assign(vi.fn(), { join: vi.fn() }),
}))

vi.mock('@/lib/checkin-validation', () => ({
  validateCheckin: vi.fn(),
  sanitizeNotes: vi.fn((n: string) => n),
}))

vi.mock('@/lib/push', () => ({ sendPushNotification: vi.fn() }))

function makeSelectChain(resolveWith: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: vi.fn((cb: (rows: unknown[]) => unknown) => Promise.resolve(cb(resolveWith))),
    orderBy: vi.fn(() => chain),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/checkins — ownership check', () => {
  it('returns 404 when care profile does not exist', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: 'user-1' } as never,
      error: null,
    })

    mockSelect.mockReturnValueOnce(makeSelectChain([]))

    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/checkins?careProfileId=unknown-profile')
    const res = await GET(req as never)
    expect(res.status).toBe(404)
  })

  it('returns 200 when user owns the profile', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: 'owner-id' } as never,
      error: null,
    })

    // First select: careProfiles — returns profile owned by this user
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'profile-1', userId: 'owner-id', checkinStreak: 3 }]))
      // Second select: wellnessCheckins — no checkin today
      .mockReturnValueOnce(makeSelectChain([]))

    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/checkins?careProfileId=profile-1')
    const res = await GET(req as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.streak).toBe(3)
  })

  it('returns 403 when user does not own profile and is not a team member', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: 'intruder-id' } as never,
      error: null,
    })

    // First select: careProfiles — profile owned by someone else
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'profile-1', userId: 'other-owner', checkinStreak: 0 }]))
      // Second select: careTeamMembers — no membership
      .mockReturnValueOnce(makeSelectChain([]))

    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/checkins?careProfileId=profile-1')
    const res = await GET(req as never)
    expect(res.status).toBe(403)
  })

  it('returns 200 when user is a care team member (non-owner)', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: 'caregiver-id' } as never,
      error: null,
    })

    // First select: careProfiles — profile owned by patient
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'profile-1', userId: 'patient-id', checkinStreak: 5 }]))
      // Second select: careTeamMembers — membership found
      .mockReturnValueOnce(makeSelectChain([{ userId: 'caregiver-id', role: 'viewer' }]))
      // Third select: wellnessCheckins today
      .mockReturnValueOnce(makeSelectChain([]))

    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/checkins?careProfileId=profile-1')
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })
})
