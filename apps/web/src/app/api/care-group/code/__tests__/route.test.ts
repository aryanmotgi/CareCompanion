/**
 * Tests for POST/GET /api/care-group/code (generate / read current).
 *
 * Pattern: mock @/lib/db, @/lib/auth, @/lib/csrf, @/lib/care-group's
 * isGroupPatient, and @/lib/feature-flags. Then exercise the route handler.
 * Existing care-group tests follow the same shape — see
 * apps/web/src/app/api/care-group/__tests__/route.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-patient-1' } }),
}))
vi.mock('@/lib/csrf', () => ({
  validateCsrf: vi.fn().mockResolvedValue({ valid: true }),
}))
vi.mock('@/lib/feature-flags', () => ({
  isCaregiverCodeFlowEnabled: vi.fn().mockReturnValue(true),
}))
vi.mock('@/lib/care-group', async () => {
  const actual = await vi.importActual<typeof import('@/lib/care-group')>('@/lib/care-group')
  return {
    ...actual,
    isGroupPatient: vi.fn().mockResolvedValue(true),
  }
})

const dbMocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  insertReturning: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      careGroupCodes: { findFirst: dbMocks.findFirst },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: dbMocks.insertReturning })) })),
  },
}))
const dbQueryFindFirst = dbMocks.findFirst
const dbInsertReturning = dbMocks.insertReturning

import { POST, GET } from '../route'
import { isCaregiverCodeFlowEnabled } from '@/lib/feature-flags'
import { isGroupPatient } from '@/lib/care-group'

function makeReq(body: unknown): Request {
  return new Request('https://test/api/care-group/code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/care-group/code', () => {
  beforeEach(() => {
    dbQueryFindFirst.mockReset()
    dbInsertReturning.mockReset()
    vi.mocked(isCaregiverCodeFlowEnabled).mockReturnValue(true)
    vi.mocked(isGroupPatient).mockResolvedValue(true)
  })

  it('rejects when the feature flag is off (503)', async () => {
    vi.mocked(isCaregiverCodeFlowEnabled).mockReturnValue(false)
    const res = await POST(makeReq({ careGroupId: 'g1' }))
    expect(res.status).toBe(503)
  })

  it('rejects when the caller is not the patient (403)', async () => {
    vi.mocked(isGroupPatient).mockResolvedValueOnce(false)
    const res = await POST(makeReq({ careGroupId: 'g1' }))
    expect(res.status).toBe(403)
  })

  it('returns the existing active code (idempotent) instead of creating a new one', async () => {
    dbQueryFindFirst.mockResolvedValueOnce({
      code: 'AK7QM',
      expiresAt: new Date('2099-01-01'),
      useCount: 1,
      maxUses: 5,
    })
    const res = await POST(makeReq({ careGroupId: 'g1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.code).toBe('AK7QM')
    // No insert path should be taken
    expect(dbInsertReturning).not.toHaveBeenCalled()
  })

  it('400 when careGroupId is missing', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/care-group/code', () => {
  beforeEach(() => {
    dbQueryFindFirst.mockReset()
    vi.mocked(isCaregiverCodeFlowEnabled).mockReturnValue(true)
    vi.mocked(isGroupPatient).mockResolvedValue(true)
  })

  it('returns null when no active code exists', async () => {
    dbQueryFindFirst.mockResolvedValueOnce(undefined)
    const req = new Request('https://test/api/care-group/code?careGroupId=g1', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.code).toBeNull()
  })

  it('returns the active code when present', async () => {
    dbQueryFindFirst.mockResolvedValueOnce({
      code: 'BC9XY',
      expiresAt: new Date('2099-01-01'),
      useCount: 0,
      maxUses: 5,
    })
    const req = new Request('https://test/api/care-group/code?careGroupId=g1', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.code).toBe('BC9XY')
  })

  it('returns null when the code is at max uses', async () => {
    dbQueryFindFirst.mockResolvedValueOnce({
      code: 'BC9XY',
      expiresAt: new Date('2099-01-01'),
      useCount: 5,
      maxUses: 5,
    })
    const req = new Request('https://test/api/care-group/code?careGroupId=g1', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.code).toBeNull()
  })
})
