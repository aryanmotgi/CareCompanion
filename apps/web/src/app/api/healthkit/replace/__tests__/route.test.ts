import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => {
  const txStub = {
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
  }
  return {
    db: {
      transaction: vi.fn(async (fn: (tx: typeof txStub) => Promise<void>) => fn(txStub)),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue([]) })),
      })),
      query: { careProfiles: { findFirst: vi.fn() } },
    },
  }
})
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

describe('POST /api/healthkit/replace', () => {
  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as never)
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({ records: [] }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 404 when no care profile', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'user-1' } } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce(undefined as never)
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({ records: [] }),
    }))
    expect(res.status).toBe(404)
  })

  it('runs wipe in transaction and inserts records, returns counts', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'user-1' } } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce({ id: 'profile-1' } as never)

    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({
        records: [
          { type: 'medication', healthkitFhirId: 'fhir-m-1', name: 'Aspirin', dose: null, frequency: null, prescribingDoctor: null },
          { type: 'labResult', healthkitFhirId: 'fhir-l-1', testName: 'CBC', value: '5', unit: 'g/dL', referenceRange: null, dateTaken: '2026-05-01' },
        ],
      }),
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(body.synced).toBe(2)
    expect(body.deleted).toEqual({ medications: 0, appointments: 0, labResults: 0 })
  })

  it('logs replace_data audit entry with counts only', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'user-1' } } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce({ id: 'profile-1' } as never)
    const { logAudit } = await import('@/lib/audit')

    const { POST } = await import('../route')
    await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({ records: [] }),
    }))

    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      action: 'replace_data',
      resource_type: 'healthkit',
      details: expect.objectContaining({
        deleted: expect.any(Object),
        synced: expect.any(Object),
        careProfileReset: true,
      }),
    }))
  })
})
