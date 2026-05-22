import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/api-helpers', () => ({ getAuthenticatedUser: vi.fn() }))
vi.mock('@/lib/db', () => {
  const txStub = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => {
          const p: Promise<unknown> & { returning: () => Promise<unknown[]> } = Promise.resolve([]) as never
          ;(p as { returning: () => Promise<unknown[]> }).returning = () => Promise.resolve([])
          return p
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => {
        const p: Promise<unknown> & { returning: () => Promise<unknown[]> } = Promise.resolve([]) as never
        ;(p as { returning: () => Promise<unknown[]> }).returning = () => Promise.resolve([])
        return p
      }),
    })),
  }
  return {
    db: {
      transaction: vi.fn(async (fn: (tx: typeof txStub) => Promise<void>) => fn(txStub)),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn().mockResolvedValue([]),
          returning: vi.fn().mockResolvedValue([{ id: 'auto-profile-1' }]),
        })),
      })),
      query: { careProfiles: { findFirst: vi.fn() } },
    },
  }
})
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

describe('POST /api/healthkit/replace', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as never)
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({ records: [] }),
    }))
    expect(res.status).toBe(401)
  })

  it('auto-creates care profile and returns 200 when no profile exists (new user)', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({ user: { id: 'user-1' }, error: null } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce(undefined as never)
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({ records: [] }),
    }))
    expect(res.status).toBe(200)
    // Verify insert was called to create the profile
    expect(db.insert).toHaveBeenCalled()
  })

  it('runs wipe in transaction and inserts records, returns counts', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({ user: { id: 'user-1' }, error: null } as never)
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
    expect(body.deleted).toEqual({ medications: 0, appointments: 0, labResults: 0, conditions: 0, allergies: 0, procedures: 0, immunizations: 0 })
  })

  it('logs replace_data audit entry with counts only', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({ user: { id: 'user-1' }, error: null } as never)
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

// ────────────────────────────────────────────────────────────────────────────
// Integration-style tests: rich mocks that record call patterns + arguments
// and verify the route's actual behavior beyond response shape.
// ────────────────────────────────────────────────────────────────────────────

describe('POST /api/healthkit/replace — integration behavior', () => {
  beforeEach(() => vi.clearAllMocks())
  // Helpers to build a tx mock that returns fake row IDs from .returning()
  function makeTxMock(returningRows: {
    medications: Array<{ id: string }>
    appointments: Array<{ id: string }>
    labResults: Array<{ id: string }>
  }) {
    const updateCalls: Array<{ table: string; setArg: Record<string, unknown> }> = []
    const deleteCalls: Array<{ table: string }> = []
    let updateIndex = 0 // medications=0, appointments=1, conditions=2, allergies=3, procedures=4, immunizations=5, careProfiles=6

    const tx = {
      update: vi.fn((table: { _: { name: string } } | unknown) => {
        const tableName = (table as { _: { name: string } })?._?.name ?? `tbl-${updateIndex}`
        return {
          set: vi.fn((arg: Record<string, unknown>) => {
            updateCalls.push({ table: tableName, setArg: arg })
            const myIndex = updateIndex++
            return {
              where: vi.fn(() => {
                const rows =
                  myIndex === 0 ? returningRows.medications :
                  myIndex === 1 ? returningRows.appointments :
                  []
                const p: Promise<unknown> & { returning: () => Promise<unknown[]> } = Promise.resolve([]) as never
                ;(p as { returning: () => Promise<unknown[]> }).returning = () => Promise.resolve(rows)
                return p
              }),
            }
          }),
        }
      }),
      delete: vi.fn((table: unknown) => {
        const tableName = (table as { _: { name: string } })?._?.name ?? 'tbl-delete'
        deleteCalls.push({ table: tableName })
        return {
          where: vi.fn(() => {
            const p: Promise<unknown> & { returning: () => Promise<unknown[]> } = Promise.resolve([]) as never
            ;(p as { returning: () => Promise<unknown[]> }).returning = () => Promise.resolve(returningRows.labResults)
            return p
          }),
        }
      }),
    }
    return { tx, updateCalls, deleteCalls }
  }

  it('reports real deleted counts based on rows returned from wipe ops', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({ user: { id: 'user-1' }, error: null } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce({ id: 'profile-1' } as never)

    const { tx } = makeTxMock({
      medications: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
      appointments: [{ id: 'a1' }],
      labResults: [{ id: 'l1' }, { id: 'l2' }],
    })
    vi.mocked(db.transaction).mockImplementationOnce((async (fn: (t: unknown) => Promise<void>) => fn(tx)) as never)

    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({ records: [] }),
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.deleted).toEqual({ medications: 3, appointments: 1, labResults: 2, conditions: 0, allergies: 0, procedures: 0, immunizations: 0 })
  })

  it('careProfile reset UPDATE includes all spec-required nulled fields', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({ user: { id: 'user-1' }, error: null } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce({ id: 'profile-1' } as never)

    const { tx, updateCalls } = makeTxMock({ medications: [], appointments: [], labResults: [] })
    vi.mocked(db.transaction).mockImplementationOnce((async (fn: (t: unknown) => Promise<void>) => fn(tx)) as never)

    const { POST } = await import('../route')
    await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({ records: [] }),
    }))

    // Seven update() calls: medications, appointments, conditions, allergies, procedures, immunizations (all deletedAt), then careProfiles (reset)
    expect(updateCalls).toHaveLength(7)
    const careProfileReset = updateCalls[6]!.setArg

    // All fields the spec says should be nulled
    expect(careProfileReset).toMatchObject({
      patientName: null,
      patientAge: null,
      relationship: null,
      cancerType: null,
      cancerStage: null,
      treatmentPhase: null,
      conditions: null,
      allergies: null,
      onboardingCompleted: false,
      onboardingPriorities: [],
      emergencyContactName: null,
      emergencyContactPhone: null,
      caregivingExperience: null,
      primaryConcern: null,
      city: null,
      state: null,
      zipCode: null,
      fieldOverrides: null,
    })
  })

  it('sync phase upserts records of all three types and returns total synced count', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({ user: { id: 'user-1' }, error: null } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce({ id: 'profile-1' } as never)

    const insertCalls: Array<{ values: Record<string, unknown> }> = []
    vi.mocked(db.insert).mockImplementation(() => ({
      values: vi.fn((v: Record<string, unknown>) => {
        insertCalls.push({ values: v })
        return { onConflictDoUpdate: vi.fn().mockResolvedValue([]) }
      }),
    }) as never)

    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({
        records: [
          { type: 'medication', healthkitFhirId: 'fhir-m', name: 'Tamoxifen', dose: '20mg', frequency: 'daily', prescribingDoctor: 'Dr. Patel' },
          { type: 'labResult', healthkitFhirId: 'fhir-l', testName: 'CBC', value: '5.2', unit: 'g/dL', referenceRange: '4-6', dateTaken: '2026-05-01' },
          { type: 'appointment', healthkitFhirId: 'fhir-a', doctorName: 'Dr. Patel', specialty: 'Oncology', dateTime: '2026-05-15T14:00:00Z', location: 'Mayo Clinic' },
          { type: 'medication', healthkitFhirId: null, name: 'Skip me', dose: null, frequency: null, prescribingDoctor: null }, // skipped
        ],
      }),
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.synced).toBe(3)
    expect(insertCalls).toHaveLength(3)
    expect(insertCalls[0]!.values).toMatchObject({ name: 'Tamoxifen', dose: '20mg', healthkitFhirId: 'fhir-m', careProfileId: 'profile-1' })
    expect(insertCalls[1]!.values).toMatchObject({ testName: 'CBC', value: '5.2', healthkitFhirId: 'fhir-l', userId: 'user-1', source: 'HealthKit' })
    expect(insertCalls[2]!.values).toMatchObject({ doctorName: 'Dr. Patel', specialty: 'Oncology', healthkitFhirId: 'fhir-a', careProfileId: 'profile-1' })
  })

  it('stores vitalSign records in labResults with source HealthKit/VitalSign', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({ user: { id: 'user-1' }, error: null } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce({ id: 'profile-1' } as never)

    const insertCalls: Array<{ values: Record<string, unknown> }> = []
    vi.mocked(db.insert).mockImplementation(() => ({
      values: vi.fn((v: Record<string, unknown>) => {
        insertCalls.push({ values: v })
        return { onConflictDoUpdate: vi.fn().mockResolvedValue([]) }
      }),
    }) as never)

    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({
        records: [
          {
            type: 'vitalSign',
            healthkitFhirId: 'fhir-v-1',
            code: '39156-5',
            display: 'Body Mass Index',
            value: '26.2',
            unit: 'kg/m2',
            effectiveDateTime: '2023-11-24T00:00:00Z',
          },
        ],
      }),
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.synced).toBe(1)
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]!.values).toMatchObject({
      testName: 'Body Mass Index',
      value: '26.2',
      unit: 'kg/m2',
      dateTaken: '2023-11-24',
      source: 'HealthKit/VitalSign',
      healthkitFhirId: 'fhir-v-1',
      userId: 'user-1',
    })
  })

  it('individual insert failures do not stop the loop and count toward errors', async () => {
    const { getAuthenticatedUser } = await import('@/lib/api-helpers')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({ user: { id: 'user-1' }, error: null } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce({ id: 'profile-1' } as never)

    let callCount = 0
    vi.mocked(db.insert).mockImplementation(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => {
          callCount++
          if (callCount === 2) return Promise.reject(new Error('simulated DB failure'))
          return Promise.resolve([])
        }),
      })),
    }) as never)

    // Suppress expected console.error noise from the in-loop catch
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({
        records: [
          { type: 'medication', healthkitFhirId: 'm1', name: 'A', dose: null, frequency: null, prescribingDoctor: null },
          { type: 'medication', healthkitFhirId: 'm2', name: 'B', dose: null, frequency: null, prescribingDoctor: null }, // fails
          { type: 'medication', healthkitFhirId: 'm3', name: 'C', dose: null, frequency: null, prescribingDoctor: null },
        ],
      }),
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.synced).toBe(2)
    expect(body.errors).toBe(1)
    expect(callCount).toBe(3) // loop did not stop after the failure
  })
})
