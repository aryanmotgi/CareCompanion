import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression: documents/[id] DELETE — ownership-verified soft-delete
// Found by /qa on 2026-05-02
// Report: TODO.md — Scan & Document Upload Flow Audit

const mocks = vi.hoisted(() => {
  const mockLimit = vi.fn()
  const mockWhere = vi.fn(() => ({ limit: mockLimit }))
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined)
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }))
  const mockUpdate = vi.fn((_arg: unknown) => ({ set: mockUpdateSet }))

  return {
    validateCsrf: vi.fn().mockResolvedValue({ valid: true }),
    getAuthenticatedUser: vi.fn().mockResolvedValue({ user: { id: 'user-1' }, error: null }),
    apiError: vi.fn((msg: string, status: number) => Response.json({ error: msg }, { status })),
    apiSuccess: vi.fn((data: unknown) => Response.json(data)),
    mockLimit,
    mockWhere,
    mockFrom,
    mockUpdate,
    mockUpdateSet,
    mockUpdateWhere,
  }
})

vi.mock('@/lib/csrf', () => ({ validateCsrf: mocks.validateCsrf }))
vi.mock('@/lib/api-helpers', () => ({ getAuthenticatedUser: mocks.getAuthenticatedUser }))
vi.mock('@/lib/api-response', () => ({ apiError: mocks.apiError, apiSuccess: mocks.apiSuccess }))
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({ from: mocks.mockFrom })),
    update: (arg: unknown) => mocks.mockUpdate(arg),
  },
}))
vi.mock('@/lib/db/schema', () => ({
  documents: { id: 'id', careProfileId: 'care_profile_id', deletedAt: 'deleted_at' },
  careProfiles: { id: 'id', userId: 'user_id' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => ({ eq: a })),
  and: vi.fn((...a: unknown[]) => ({ and: a })),
  isNull: vi.fn((c: unknown) => ({ isNull: c })),
}))

import { DELETE } from '../[id]/route'

function call(id = 'doc-123') {
  const req = new Request(`http://localhost/api/documents/${id}`, {
    method: 'DELETE',
    headers: { 'x-csrf-token': 'tok', cookie: 'cc-csrf-token=tok' },
  })
  return DELETE(req, { params: Promise.resolve({ id }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.validateCsrf.mockResolvedValue({ valid: true })
  mocks.getAuthenticatedUser.mockResolvedValue({ user: { id: 'user-1' }, error: null })
  mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit })
  mocks.mockLimit
    .mockResolvedValueOnce([{ id: 'profile-1' }])  // profile lookup
    .mockResolvedValueOnce([{ id: 'doc-123' }])     // doc lookup
  mocks.mockUpdate.mockReturnValue({ set: mocks.mockUpdateSet })
  mocks.mockUpdateSet.mockReturnValue({ where: mocks.mockUpdateWhere })
  mocks.mockUpdateWhere.mockResolvedValue(undefined)
})

describe('DELETE /api/documents/[id]', () => {
  it('returns 403 when CSRF token invalid', async () => {
    mocks.validateCsrf.mockResolvedValue({
      valid: false,
      error: Response.json({ error: 'Invalid CSRF token' }, { status: 403 }),
    })
    expect((await call()).status).toBe(403)
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({
      user: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    expect((await call()).status).toBe(401)
  })

  it('returns 400 when care profile not found', async () => {
    mocks.mockLimit.mockReset().mockResolvedValueOnce([])
    const res = await call()
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/care profile/i)
  })

  it('returns 404 when document not found or wrong owner', async () => {
    mocks.mockLimit.mockReset()
      .mockResolvedValueOnce([{ id: 'profile-1' }])
      .mockResolvedValueOnce([])
    expect((await call()).status).toBe(404)
  })

  it('soft-deletes document and returns { deleted: true }', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ deleted: true })
    expect(mocks.mockUpdate).toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setArg = (mocks.mockUpdateSet.mock.calls[0] as any)?.[0] as { deletedAt: unknown }
    expect(setArg?.deletedAt).toBeInstanceOf(Date)
  })

  it('returns 500 on DB error', async () => {
    mocks.mockLimit.mockReset().mockRejectedValue(new Error('connection lost'))
    expect((await call()).status).toBe(500)
  })
})
