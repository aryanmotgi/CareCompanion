import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.hoisted(() => vi.fn())
vi.mock('axios', () => ({
  default: { create: vi.fn(() => ({ get: mockGet })), get: mockGet },
}))

import { searchTrials, getTrialDetails, searchByEligibility } from '@/lib/trials/tools'

describe('searchTrials', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls /studies with condition param', async () => {
    mockGet.mockResolvedValueOnce({ data: { studies: [], totalCount: 0 } })
    const result = await searchTrials({ condition: 'colorectal cancer' })
    expect(mockGet).toHaveBeenCalledWith(
      '/studies',
      expect.objectContaining({ params: expect.objectContaining({ 'query.cond': 'colorectal cancer' }) })
    )
    expect(result).toMatchObject({ count: 0, trials: [] })
  })

  it('returns error object on API failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'))
    const result = await searchTrials({ condition: 'breast cancer' })
    expect(result).toHaveProperty('error')
  })

  it('caps pageSize at 100', async () => {
    mockGet.mockResolvedValueOnce({ data: { studies: [], totalCount: 0 } })
    await searchTrials({ condition: 'cancer', pageSize: 200 })
    expect(mockGet).toHaveBeenCalledWith(
      '/studies',
      expect.objectContaining({ params: expect.objectContaining({ pageSize: 100 }) })
    )
  })
})

describe('getTrialDetails', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls /studies/:nctId', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        protocolSection: {
          identificationModule: { nctId: 'NCT123', briefTitle: 'Test Trial', officialTitle: 'Official' },
          statusModule: { overallStatus: 'RECRUITING' },
          descriptionModule: { briefSummary: 'Summary', detailedDescription: 'Detail' },
          eligibilityModule: { eligibilityCriteria: 'Must be 18+', minimumAge: '18 Years', maximumAge: '75 Years', sex: 'ALL' },
          contactsLocationsModule: { locations: [] },
          designModule: { studyType: 'INTERVENTIONAL', phases: ['Phase 3'], enrollmentInfo: { count: 100 } },
          armsInterventionsModule: { interventions: [] },
          conditionsModule: { conditions: ['Colorectal Cancer'] },
          outcomesModule: { primaryOutcomes: [] },
          sponsorCollaboratorsModule: { leadSponsor: { name: 'NIH' } },
        },
      },
    })
    const result = await getTrialDetails('NCT123')
    expect(mockGet).toHaveBeenCalledWith('/studies/NCT123', expect.any(Object))
    expect(result).toMatchObject({ nct_id: 'NCT123', title: 'Test Trial' })
  })

  it('returns error on API failure', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 404 } })
    const result = await getTrialDetails('INVALID')
    expect(result).toHaveProperty('error')
  })
})

describe('searchByEligibility', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls searchTrials with RECRUITING status', async () => {
    mockGet.mockResolvedValueOnce({ data: { studies: [], totalCount: 0 } })
    await searchByEligibility({ condition: 'lung cancer', age: 55 })
    expect(mockGet).toHaveBeenCalledWith(
      '/studies',
      expect.objectContaining({ params: expect.objectContaining({ 'filter.overallStatus': 'RECRUITING' }) })
    )
  })
})
