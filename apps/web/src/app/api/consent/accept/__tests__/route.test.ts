// Regression: ISSUE-AUTH-001 — consent/accept must use user ID not email for WHERE clause
// Apple Sign-In users may have null email; using email in WHERE silently skips consent recording.
// Fixed: eq(users.id, session.user.id) instead of eq(users.email, session.user.email)
// Found by /security-review on 2026-05-02

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/csrf', () => ({
  validateCsrf: vi.fn().mockResolvedValue({ valid: true, error: null }),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-uuid-123', email: null },
  }),
}))

const mockWhere = vi.fn().mockResolvedValue([])
const mockSet = vi.fn(() => ({ where: mockWhere }))
const mockUpdate = vi.fn(() => ({ set: mockSet }))

vi.mock('@/lib/db', () => ({
  db: { update: mockUpdate },
}))

vi.mock('@/lib/db/schema', () => ({
  users: { id: 'id_col', email: 'email_col' },
}))

const mockEq = vi.fn((col: unknown, val: unknown) => ({ col, val }))
vi.mock('drizzle-orm', () => ({ eq: mockEq }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('POST /api/consent/accept', () => {
  it('returns 200 and uses user ID (not email) in WHERE clause', async () => {
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/consent/accept', { method: 'POST' }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)

    // Verify eq() was called with users.id column and the session user ID
    expect(mockEq).toHaveBeenCalledWith('id_col', 'user-uuid-123')
    // Verify it was NOT called with the email column
    const callArgs = mockEq.mock.calls.map(([col]) => col)
    expect(callArgs).not.toContain('email_col')
  })

  it('returns 401 when no session', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as never)

    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/consent/accept', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when DB update throws', async () => {
    mockWhere.mockRejectedValueOnce(new Error('DB down'))

    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/consent/accept', { method: 'POST' }))
    expect(res.status).toBe(500)
  })
})
