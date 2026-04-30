import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB mock ──────────────────────────────────────────────────────────────────
// saveMatchResults has complex query chains:
//   select().from().where()           — awaitable, no .limit()
//   select().from().where().limit(n)  — awaitable with .limit()
//   insert().values().onConflictDoUpdate()
//   insert().values().catch(fn)       — notification inserts
//   update().set().where().returning()

function limitablePromise(rows: unknown[]) {
  const p = Promise.resolve(rows) as Promise<unknown[]> & { limit: (n: number) => Promise<unknown[]> }
  p.limit = (n: number) => Promise.resolve(rows.slice(0, n))
  return p
}

const { mockInsert, mockUpdate, mockSelect } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: { insert: mockInsert, update: mockUpdate, select: mockSelect },
}))
vi.mock('@/lib/trials/assembleProfile', () => ({
  assembleProfile: vi.fn().mockResolvedValue({
    cancerType: 'NSCLC', cancerStage: 'Stage IV', age: 58,
    zipCode: '94105', city: 'SF', state: 'CA',
    mutations: [], currentMedications: [], labResults: [],
    priorTreatmentLines: [], activeTreatment: null,
    conditions: null, allergies: null,
  }),
}))
vi.mock('@/lib/trials/clinicalTrialsAgent', () => ({
  runTrialsAgent: vi.fn().mockResolvedValue({ matched: [], close: [] }),
}))

function insertMock() {
  const chain = {
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    onConflictDoUpdate:  vi.fn().mockResolvedValue([]),
    returning:           vi.fn().mockResolvedValue([]),
    catch:               vi.fn().mockResolvedValue(undefined),
  }
  return { values: vi.fn().mockReturnValue(chain) }
}

function updateMock(returning: unknown[] = []) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(returning),
      }),
    }),
  }
}

function selectMock(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(limitablePromise(rows)),
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Use mockImplementation (not mockReturnValue) so each db.insert() call gets its own
  // fresh mock object with independent call history — required to distinguish N upserts
  // from the notification insert that follows.
  mockInsert.mockImplementation(() => insertMock())
  mockUpdate.mockReturnValue(updateMock())
  mockSelect.mockReturnValue(selectMock([]))
})

import {
  enqueueMatchingRun,
  releaseStaleClaimedRows,
  saveMatchResults,
} from '@/lib/trials/matchingQueue'

// ── Fixtures ─────────────────────────────────────────────────────────────────
const matchedTrial = {
  nctId: 'NCT001',
  title: 'HER2+ Phase II Study',
  matchScore: 85,
  matchReasons: ['HER2+', 'Stage III'],
  disqualifyingFactors: [],
  uncertainFactors: [],
  eligibilityGaps: null,
  enrollmentStatus: 'RECRUITING',
  locations: [],
  trialUrl: 'https://clinicaltrials.gov/study/NCT001',
}

const closeTrial = {
  ...matchedTrial,
  nctId: 'NCT002',
  title: 'Ovarian Trial',
  matchScore: 60,
  eligibilityGaps: [{
    gapType: 'measurable',
    description: 'CA-125 must drop below 35',
    metric: 'CA-125',
    currentValue: '52',
    requiredValue: '35',
    unit: 'U/mL',
    verifiable: true,
    closureSignal: null,
  }],
}

// ── enqueueMatchingRun ────────────────────────────────────────────────────────
describe('enqueueMatchingRun', () => {
  it('updates existing pending/claimed row rather than silently dropping', async () => {
    mockUpdate.mockReturnValue(updateMock([{ id: 'row-1' }]))
    await enqueueMatchingRun('profile-abc', 'new_medication')
    expect(mockUpdate).toHaveBeenCalled()
    const setArg = mockUpdate.mock.results[0].value.set.mock.calls[0][0]
    expect(setArg).toMatchObject({ status: 'pending', reason: 'new_medication', claimedAt: null })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('inserts fresh row when no pending/claimed row exists', async () => {
    mockUpdate.mockReturnValue(updateMock([]))
    await enqueueMatchingRun('profile-abc', 'new_lab')
    expect(mockInsert).toHaveBeenCalled()
    const valuesArg = mockInsert.mock.results[0].value.values.mock.calls[0][0]
    expect(valuesArg).toMatchObject({ careProfileId: 'profile-abc', reason: 'new_lab', status: 'pending' })
  })
})

// ── releaseStaleClaimedRows ───────────────────────────────────────────────────
describe('releaseStaleClaimedRows', () => {
  it('resets claimed rows older than 10 min back to pending', async () => {
    await releaseStaleClaimedRows()
    const setArg = mockUpdate.mock.results[0].value.set.mock.calls[0][0]
    expect(setArg).toMatchObject({ status: 'pending', claimedAt: null })
  })
})

// ── saveMatchResults ──────────────────────────────────────────────────────────
describe('saveMatchResults', () => {
  it('upserts matched trials with eligibilityGaps=null', async () => {
    await saveMatchResults('profile-abc', [matchedTrial], [])
    const valuesArg = mockInsert.mock.results[0].value.values.mock.calls[0][0]
    expect(valuesArg).toMatchObject({ nctId: 'NCT001', matchCategory: 'matched', eligibilityGaps: null })
  })

  it('upserts close trials with eligibilityGaps populated', async () => {
    await saveMatchResults('profile-abc', [], [closeTrial])
    const valuesArg = mockInsert.mock.results[0].value.values.mock.calls[0][0]
    expect(valuesArg).toMatchObject({
      nctId: 'NCT002',
      matchCategory: 'close',
      eligibilityGaps: closeTrial.eligibilityGaps,
    })
  })

  it('fires gap_closed notification with gap description when trial moves close→matched', async () => {
    let selectCall = 0
    mockSelect.mockImplementation(() => {
      selectCall++
      if (selectCall === 1) {
        // Snapshot: NCT002 was 'close'
        return selectMock([{ nctId: 'NCT002', matchCategory: 'close', eligibilityGaps: closeTrial.eligibilityGaps, title: closeTrial.title }])
      }
      if (selectCall === 2) {
        // careProfiles lookup → userId
        return selectMock([{ userId: 'user-xyz' }])
      }
      // dedup check → no recent notification
      return selectMock([])
    })

    const nowMatched = { ...closeTrial, eligibilityGaps: null }
    await saveMatchResults('profile-abc', [nowMatched], [])

    // Find the gap_closed notification insert among all insert calls
    const allInsertValues = mockInsert.mock.results.map(r => r?.value?.values?.mock?.calls?.[0]?.[0])
    const gapNotif = allInsertValues.find(v => v?.type === 'trial_gap_closed')

    expect(gapNotif).toBeDefined()
    expect(gapNotif.userId).toBe('user-xyz')
    expect(gapNotif.message).toContain('NCT002')
    expect(gapNotif.message).toContain('CA-125 must drop below 35')
  })

  it('does NOT fire gap_closed notification when trial was already matched', async () => {
    // Snapshot: NCT001 was already 'matched'
    mockSelect.mockImplementation(() =>
      selectMock([{ nctId: 'NCT001', matchCategory: 'matched', eligibilityGaps: null, title: matchedTrial.title }])
    )

    await saveMatchResults('profile-abc', [matchedTrial], [])

    const allInsertValues = mockInsert.mock.results.map(r => r?.value?.values?.mock?.calls?.[0]?.[0])
    const gapNotif = allInsertValues.find(v => v?.type === 'trial_gap_closed')
    expect(gapNotif).toBeUndefined()
  })

  it('does not double-notify: skips gap_closed if one was sent in last 24h', async () => {
    let selectCall = 0
    mockSelect.mockImplementation(() => {
      selectCall++
      if (selectCall === 1) return selectMock([{ nctId: 'NCT002', matchCategory: 'close', eligibilityGaps: closeTrial.eligibilityGaps, title: closeTrial.title }])
      if (selectCall === 2) return selectMock([{ userId: 'user-xyz' }])
      // Dedup check returns a recent notification → should skip
      return selectMock([{ id: 'notif-recent' }])
    })

    const nowMatched = { ...closeTrial, eligibilityGaps: null }
    await saveMatchResults('profile-abc', [nowMatched], [])

    const allInsertValues = mockInsert.mock.results.map(r => r?.value?.values?.mock?.calls?.[0]?.[0])
    const gapNotif = allInsertValues.find(v => v?.type === 'trial_gap_closed')
    expect(gapNotif).toBeUndefined()
  })
})
