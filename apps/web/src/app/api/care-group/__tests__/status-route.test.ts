import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindFirst = vi.fn()
const mockSelect = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      careGroupMembers: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    },
    select: (...args: unknown[]) => mockSelect(...args),
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_: unknown, v: unknown) => v),
  and: vi.fn((...args: unknown[]) => args),
  ne: vi.fn((_: unknown, v: unknown) => v),
  asc: vi.fn((v: unknown) => v),
}))
vi.mock('@/lib/db/schema', () => ({
  careGroupMembers: { careGroupId: 'careGroupId', userId: 'userId', joinedAt: 'joinedAt' },
  users: { id: 'id', displayName: 'displayName' },
}))
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
    ),
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('GET /api/care-group/[id]/status', () => {
  it('returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as never)

    const { GET } = await import('../[id]/status/route')
    const res = await GET(
      new Request('http://localhost/api/care-group/grp-1/status'),
      { params: Promise.resolve({ id: 'grp-1' }) },
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 when caller is not a group member (IDOR guard)', async () => {
    mockFindFirst.mockResolvedValueOnce(null) // callerMembership = null

    const { GET } = await import('../[id]/status/route')
    const res = await GET(
      new Request('http://localhost/api/care-group/grp-1/status'),
      { params: Promise.resolve({ id: 'grp-1' }) },
    )
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('Not a member')
  })

  it('returns { joined: false } when caller is the only member', async () => {
    mockFindFirst.mockResolvedValueOnce({ careGroupId: 'grp-1', userId: 'user-1' }) // caller is a member
    // db.select chain for otherMembers
    const mockFrom = vi.fn().mockReturnThis()
    const mockInnerJoin = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValueOnce([]) // no other members
    mockSelect.mockReturnValue({
      from: mockFrom,
      innerJoin: mockInnerJoin,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
    })
    mockFrom.mockReturnValue({ innerJoin: mockInnerJoin })
    mockInnerJoin.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ orderBy: mockOrderBy })
    mockOrderBy.mockReturnValue({ limit: mockLimit })

    const { GET } = await import('../[id]/status/route')
    const res = await GET(
      new Request('http://localhost/api/care-group/grp-1/status'),
      { params: Promise.resolve({ id: 'grp-1' }) },
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.joined).toBe(false)
  })

  it('returns { joined: true, name } when another member exists', async () => {
    mockFindFirst.mockResolvedValueOnce({ careGroupId: 'grp-1', userId: 'user-1' })
    const mockFrom = vi.fn()
    const mockInnerJoin = vi.fn()
    const mockWhere = vi.fn()
    const mockOrderBy = vi.fn()
    const mockLimit = vi.fn().mockResolvedValueOnce([{ userId: 'user-2', displayName: 'Dr. Jane' }])
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ innerJoin: mockInnerJoin })
    mockInnerJoin.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ orderBy: mockOrderBy })
    mockOrderBy.mockReturnValue({ limit: mockLimit })

    const { GET } = await import('../[id]/status/route')
    const res = await GET(
      new Request('http://localhost/api/care-group/grp-1/status'),
      { params: Promise.resolve({ id: 'grp-1' }) },
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.joined).toBe(true)
    expect(json.name).toBe('Dr. Jane')
  })
})
