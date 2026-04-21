import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      })),
    })),
    query: { careProfiles: { findFirst: vi.fn() } },
  },
}))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

describe('POST /api/healthkit/sync', () => {
  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as never)
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/sync', {
      method: 'POST',
      body: JSON.stringify({ records: [] }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 200 with synced count', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'user-uuid', email: 'a@b.com' } } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce({ id: 'profile-uuid' } as never)

    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/sync', {
      method: 'POST',
      body: JSON.stringify({
        records: [
          { type: 'medication', healthkitFhirId: 'fhir-1', name: 'Aspirin', dose: null, frequency: null, prescribingDoctor: null },
        ],
      }),
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.synced).toBe(1)
  })
})
