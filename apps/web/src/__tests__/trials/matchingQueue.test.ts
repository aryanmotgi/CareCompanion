import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsert, mockUpdate, mockSelect } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
  },
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

// Set up chainable mock returns
beforeEach(() => {
  vi.clearAllMocks()
  // insert().values().onConflictDoNothing()
  mockInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      returning: vi.fn().mockResolvedValue([]),
    }),
  })
  // update().set().where().returning()
  mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  })
  // select().from().where()
  mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
      limit: vi.fn().mockResolvedValue([]),
    }),
  })
})

import { enqueueMatchingRun, releaseStaleClaimedRows } from '@/lib/trials/matchingQueue'

describe('enqueueMatchingRun', () => {
  it('inserts into matchingQueue with onConflictDoNothing', async () => {
    await enqueueMatchingRun('profile-abc', 'new_medication')
    expect(mockInsert).toHaveBeenCalled()
    const insertCall = mockInsert.mock.results[0].value
    expect(insertCall.values).toHaveBeenCalledWith(
      expect.objectContaining({ careProfileId: 'profile-abc', reason: 'new_medication', status: 'pending' })
    )
  })
})

describe('releaseStaleClaimedRows', () => {
  it('updates rows with status claimed to pending', async () => {
    await releaseStaleClaimedRows()
    expect(mockUpdate).toHaveBeenCalled()
    const updateCall = mockUpdate.mock.results[0].value
    expect(updateCall.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', claimedAt: null })
    )
  })
})
