/**
 * Tests for POST /api/care-group/join-by-code.
 *
 * Critical security properties under test:
 *   - Error parity: all four invalid-code conditions return identical
 *     status+message (no enumeration leak).
 *   - Rate limit: 5 attempts/min/IP per session.
 *   - Atomic redemption: when the UPDATE WHERE doesn't match, the response
 *     is the same invalid-code message regardless of WHY it didn't match.
 *
 * Pattern: mock @/lib/db, @/lib/auth, @/lib/csrf, @/lib/rate-limit,
 * @/lib/feature-flags, @/lib/care-group's joinCareGroup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'caregiver-1' } }),
}))
vi.mock('@/lib/csrf', () => ({
  validateCsrf: vi.fn().mockResolvedValue({ valid: true }),
}))
vi.mock('@/lib/feature-flags', () => ({
  isCaregiverCodeFlowEnabled: vi.fn().mockReturnValue(true),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 5 }),
}))

const careGroupMocks = vi.hoisted(() => ({
  joinCareGroup: vi.fn().mockResolvedValue({ ok: true, careGroupId: 'group-1' }),
}))
vi.mock('@/lib/care-group', async () => {
  const actual = await vi.importActual<typeof import('@/lib/care-group')>('@/lib/care-group')
  return { ...actual, joinCareGroup: careGroupMocks.joinCareGroup }
})

const dbMocks = vi.hoisted(() => ({
  updateReturning: vi.fn(),
  findFirst: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: dbMocks.updateReturning })) })),
    })),
    query: {
      careGroups: { findFirst: dbMocks.findFirst },
      users: { findFirst: dbMocks.findFirst },
    },
  },
}))

import { POST } from '../route'
import { checkRateLimit } from '@/lib/rate-limit'

const INVALID_CODE_MSG = "That code didn't work. Ask the patient for a new one."

function makeReq(body: unknown): Request {
  return new Request('https://test/api/care-group/join-by-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/care-group/join-by-code', () => {
  beforeEach(() => {
    dbMocks.updateReturning.mockReset()
    dbMocks.findFirst.mockReset()
    careGroupMocks.joinCareGroup.mockReset()
    careGroupMocks.joinCareGroup.mockResolvedValue({ ok: true, careGroupId: 'group-1' })
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 5 })
  })

  it('429 when rate-limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, retryAfterMs: 30_000 })
    const res = await POST(makeReq({ code: 'AK-7QM', relationship: 'spouse' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('400 when relationship is missing', async () => {
    const res = await POST(makeReq({ code: 'AK-7QM' }))
    expect(res.status).toBe(400)
  })

  it('400 when relationship is invalid', async () => {
    const res = await POST(makeReq({ code: 'AK-7QM', relationship: 'enemy' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 + parity msg when code is malformed', async () => {
    const res = await POST(makeReq({ code: '0000', relationship: 'spouse' }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe(INVALID_CODE_MSG)
  })

  it('returns 404 + parity msg when the atomic UPDATE finds no matching row (any of: not-found, expired, revoked, used-up)', async () => {
    // Single UPDATE that returns empty → all four invalid-code conditions
    // are indistinguishable to the caller.
    dbMocks.updateReturning.mockResolvedValueOnce([])
    const res = await POST(makeReq({ code: 'AK-7QM', relationship: 'spouse' }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe(INVALID_CODE_MSG)
  })

  it('returns 200 + careGroupId on successful redemption', async () => {
    dbMocks.updateReturning.mockResolvedValueOnce([{ careGroupId: 'group-1', code: 'AK7QM' }])
    // group lookup for patient name
    dbMocks.findFirst.mockResolvedValueOnce({ id: 'group-1', createdBy: 'patient-1' })
    dbMocks.findFirst.mockResolvedValueOnce({ id: 'patient-1', displayName: 'Margaret' })

    const res = await POST(makeReq({ code: 'AK-7QM', relationship: 'spouse' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.careGroupId).toBe('group-1')
    expect(body.patientName).toBe('Margaret')
  })

  it('409 when the caregiver is already a member of the group', async () => {
    dbMocks.updateReturning.mockResolvedValueOnce([{ careGroupId: 'group-1', code: 'AK7QM' }])
    careGroupMocks.joinCareGroup.mockResolvedValueOnce({ ok: false, reason: 'already-member' })
    const res = await POST(makeReq({ code: 'AK-7QM', relationship: 'spouse' }))
    expect(res.status).toBe(409)
  })

  it('503 when the feature flag is off', async () => {
    const { isCaregiverCodeFlowEnabled } = await import('@/lib/feature-flags')
    vi.mocked(isCaregiverCodeFlowEnabled).mockReturnValueOnce(false)
    const res = await POST(makeReq({ code: 'AK-7QM', relationship: 'spouse' }))
    expect(res.status).toBe(503)
  })
})
