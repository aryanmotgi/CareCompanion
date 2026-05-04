import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindFirst = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockValidateCsrf = vi.fn().mockResolvedValue({ valid: true })

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))
vi.mock('@/lib/csrf', () => ({
  validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args),
}))
vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    query: {
      careProfiles: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      users: { findFirst: vi.fn().mockResolvedValue(null) },
      careGroupMembers: { findFirst: vi.fn().mockResolvedValue(null) },
    },
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}))
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  onboardingRecapEmailHtml: vi.fn().mockReturnValue('<html/>'),
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_: unknown, v: unknown) => v),
  and: vi.fn((...args: unknown[]) => args),
}))
vi.mock('@/lib/db/schema', () => ({
  careProfiles: { id: 'id', userId: 'userId', onboardingCompleted: 'onboardingCompleted' },
  users: { id: 'id' },
  careGroupMembers: { userId: 'userId' },
  careGroups: { id: 'id' },
}))
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
    ),
  },
}))

beforeEach(() => vi.clearAllMocks())

function makeRequest(body: unknown, extra: Record<string, string> = {}) {
  return new Request('http://localhost/api/onboarding/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': 'tok', ...extra },
    body: JSON.stringify(body),
  })
}

describe('POST /api/onboarding/complete', () => {
  it('returns 403 when CSRF invalid', async () => {
    mockValidateCsrf.mockResolvedValueOnce({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Invalid CSRF token' }), { status: 403 }),
    })
    const { POST } = await import('../complete/route')
    const res = await POST(makeRequest({ careProfileId: 'cp-1' }))
    expect(res!.status).toBe(403)
  })

  it('returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as never)
    const { POST } = await import('../complete/route')
    const res = await POST(makeRequest({ careProfileId: 'cp-1' }))
    expect(res!.status).toBe(401)
  })

  it('returns 400 when careProfileId is missing', async () => {
    const { POST } = await import('../complete/route')
    const res = await POST(makeRequest({}))
    expect(res!.status).toBe(400)
  })

  it('returns 404 when profile does not belong to user (IDOR guard)', async () => {
    // users.select returns a user
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValueOnce([{ id: 'user-1' }])
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ limit: mockLimit })

    // careProfiles.findFirst returns null (profile not owned by user)
    mockFindFirst.mockResolvedValueOnce(null)

    const { POST } = await import('../complete/route')
    const res = await POST(makeRequest({ careProfileId: 'cp-owned-by-other-user' }))
    expect(res!.status).toBe(404)
    const json = await res!.json()
    expect(json.error).toBe('Not found')
  })

  it('returns 200 when profile is owned by user', async () => {
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValueOnce([{ id: 'user-1' }])
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ limit: mockLimit })

    // Profile exists and belongs to user
    mockFindFirst.mockResolvedValueOnce({ id: 'cp-1', userId: 'user-1', cancerType: 'Breast' })

    // db.update chain
    const mockSet = vi.fn().mockReturnThis()
    const mockUpdateWhere = vi.fn().mockResolvedValueOnce(undefined)
    mockUpdate.mockReturnValue({ set: mockSet })
    mockSet.mockReturnValue({ where: mockUpdateWhere })

    const { POST } = await import('../complete/route')
    const res = await POST(makeRequest({ careProfileId: 'cp-1' }))
    expect(res!.status).toBe(200)
    const json = await res!.json()
    expect(json.success).toBe(true)
  })
})
