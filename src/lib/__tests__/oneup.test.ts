import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Set env vars before importing the module
vi.stubEnv('ONEUP_CLIENT_ID', 'test-client-id')
vi.stubEnv('ONEUP_CLIENT_SECRET', 'test-client-secret')
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')

import {
  createOneUpUser,
  buildAuthUrl,
  exchangeCode,
  refreshToken,
  fhirFetch,
  fhirSearchAll,
  fetchPatientEverything,
  getProviderName,
} from '@/lib/oneup'

// === FAKE FHIR DATA ===

const fakeFhirPatient = {
  resourceType: 'Patient',
  name: [{ given: ['Jane'], family: 'Doe', text: 'Jane Doe' }],
  birthDate: '1985-06-15',
  gender: 'female',
}

const fakeFhirMedication = {
  resourceType: 'MedicationRequest',
  status: 'active',
  medicationCodeableConcept: { text: 'Tamoxifen 20mg' },
  dosageInstruction: [{
    text: 'Take once daily',
    timing: { repeat: { frequency: 1, period: 1, periodUnit: 'd' } },
    doseAndRate: [{ doseQuantity: { value: 20, unit: 'mg' } }],
  }],
  requester: { display: 'Dr. Smith' },
}

const fakeFhirCondition = {
  resourceType: 'Condition',
  clinicalStatus: { coding: [{ code: 'active' }] },
  code: { text: 'Breast Cancer', coding: [{ display: 'Breast Cancer' }] },
}

const fakeFhirAllergy = {
  resourceType: 'AllergyIntolerance',
  code: { text: 'Penicillin', coding: [{ display: 'Penicillin allergy' }] },
}

const fakeFhirObservation = {
  resourceType: 'Observation',
  code: { text: 'LDL Cholesterol', coding: [{ display: 'LDL Cholesterol' }] },
  valueQuantity: { value: 145, unit: 'mg/dL' },
  referenceRange: [{ low: { value: 0, unit: 'mg/dL' }, high: { value: 100, unit: 'mg/dL' } }],
  interpretation: [{ coding: [{ code: 'H' }] }],
  effectiveDateTime: '2026-03-15T10:00:00Z',
}

const fakeFhirAppointment = {
  resourceType: 'Appointment',
  status: 'booked',
  start: '2026-05-01T14:00:00Z',
  description: 'Oncology follow-up',
  participant: [{ actor: { display: 'Dr. Chen', reference: 'Practitioner/123' } }],
}

const fakeFhirPractitioner = {
  resourceType: 'Practitioner',
  name: [{ given: ['Sarah'], family: 'Chen', text: 'Dr. Sarah Chen' }],
  qualification: [{ code: { text: 'Oncology' } }],
  telecom: [{ system: 'phone', value: '555-0199' }],
}

const fakeFhirEOB = {
  resourceType: 'ExplanationOfBenefit',
  billablePeriod: { start: '2026-02-15' },
  provider: { display: 'City Hospital' },
  outcome: 'complete',
  total: [
    { category: { coding: [{ code: 'submitted' }] }, amount: { value: 1200 } },
    { category: { coding: [{ code: 'benefit' }] }, amount: { value: 900 } },
    { category: { coding: [{ code: 'deductible' }] }, amount: { value: 300 } },
  ],
}

const fakeFhirCoverage = {
  resourceType: 'Coverage',
  status: 'active',
  payor: [{ display: 'Blue Cross Blue Shield' }],
  subscriberId: 'MEM-123456',
  class: [{ type: { coding: [{ code: 'group' }] }, value: 'GRP-500' }],
}

// Helper to create a mock Response
function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function fhirBundle(resources: Record<string, unknown>[], nextUrl?: string) {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    entry: resources.map((r) => ({ resource: r })),
    link: nextUrl
      ? [{ relation: 'self', url: 'http://test' }, { relation: 'next', url: nextUrl }]
      : [{ relation: 'self', url: 'http://test' }],
  }
}

// === TESTS ===

describe('1upHealth API integrator (oneup.ts)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --- Provider detection ---
  describe('getProviderName', () => {
    it('returns "1upHealth" when ONEUP_CLIENT_ID is set', () => {
      expect(getProviderName()).toBe('1upHealth')
    })
  })

  // --- User creation ---
  describe('createOneUpUser', () => {
    it('creates a 1upHealth user and returns oneup_user_id', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ oneup_user_id: 'oneup-user-abc123', code: 'ok' })
      )

      const result = await createOneUpUser('app-user-42')

      expect(result).toBe('oneup-user-abc123')
      expect(mockFetch).toHaveBeenCalledOnce()

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.1up.health/user-management/v1/user')
      expect(opts.method).toBe('POST')

      const body = JSON.parse(opts.body)
      expect(body.client_id).toBe('test-client-id')
      expect(body.client_secret).toBe('test-client-secret')
      expect(body.app_user_id).toBe('app-user-42')
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: 'invalid_client' }, 401)
      )

      await expect(createOneUpUser('bad-user')).rejects.toThrow(
        '1upHealth user creation failed: 401'
      )
    })
  })

  // --- Auth URL ---
  describe('buildAuthUrl', () => {
    it('builds 1upHealth connect URL with state and redirect', () => {
      const url = buildAuthUrl('user-123', 'oneup-user-456')
      const parsed = new URL(url)

      expect(parsed.origin + parsed.pathname).toBe(
        'https://api.1up.health/connect/system/clinical/start'
      )
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id')
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3000/api/fhir/callback'
      )
      expect(parsed.searchParams.get('oneup_user_id')).toBe('oneup-user-456')

      // Decode state
      const state = parsed.searchParams.get('state')!
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
      expect(decoded.userId).toBe('user-123')
      expect(decoded.provider).toBe('1uphealth')
    })

    it('works without oneup_user_id', () => {
      const url = buildAuthUrl('user-789')
      const parsed = new URL(url)
      expect(parsed.searchParams.has('oneup_user_id')).toBe(false)
    })
  })

  // --- Token exchange ---
  describe('exchangeCode', () => {
    it('exchanges auth code for tokens', async () => {
      const tokenData = {
        access_token: 'fake-access-token',
        refresh_token: 'fake-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        patient: 'Patient/12345',
      }
      mockFetch.mockResolvedValueOnce(mockResponse(tokenData))

      const result = await exchangeCode('auth-code-xyz')

      expect(result.access_token).toBe('fake-access-token')
      expect(result.refresh_token).toBe('fake-refresh-token')
      expect(result.expires_in).toBe(3600)

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.1up.health/oauth2/token')
      expect(opts.method).toBe('POST')
      expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded')

      const body = new URLSearchParams(opts.body)
      expect(body.get('grant_type')).toBe('authorization_code')
      expect(body.get('code')).toBe('auth-code-xyz')
      expect(body.get('client_id')).toBe('test-client-id')
      expect(body.get('client_secret')).toBe('test-client-secret')
    })

    it('throws on token exchange failure', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'invalid_grant' }, 400))

      await expect(exchangeCode('bad-code')).rejects.toThrow(
        'Token exchange failed (1uphealth): 400'
      )
    })
  })

  // --- Token refresh ---
  describe('refreshToken', () => {
    it('refreshes an expired token', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        })
      )

      const result = await refreshToken('old-refresh-token')

      expect(result.access_token).toBe('new-access-token')
      expect(result.refresh_token).toBe('new-refresh-token')

      const body = new URLSearchParams(mockFetch.mock.calls[0][1].body)
      expect(body.get('grant_type')).toBe('refresh_token')
      expect(body.get('refresh_token')).toBe('old-refresh-token')
    })

    it('throws on refresh failure', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}, 401))

      await expect(refreshToken('expired-token')).rejects.toThrow(
        'Token refresh failed (1uphealth): 401'
      )
    })
  })

  // --- FHIR fetch ---
  describe('fhirFetch', () => {
    it('fetches a FHIR resource with Bearer token', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(fakeFhirPatient))

      const result = await fhirFetch('Patient/123', 'my-token')

      expect(result.resourceType).toBe('Patient')
      expect((result.name as Array<{ text: string }>)[0].text).toBe('Jane Doe')

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.1up.health/r4/Patient/123')
      expect(opts.headers.Authorization).toBe('Bearer my-token')
      expect(opts.headers.Accept).toBe('application/fhir+json')
    })

    it('uses full URL when path starts with http', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(fakeFhirPatient))

      await fhirFetch('https://custom.fhir.server/Patient/1', 'tok')

      expect(mockFetch.mock.calls[0][0]).toBe('https://custom.fhir.server/Patient/1')
    })

    it('throws on FHIR fetch error', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ issue: [{ severity: 'error', code: 'not-found' }] }, 404)
      )

      await expect(fhirFetch('Patient/999', 'tok')).rejects.toThrow('FHIR fetch failed: 404')
    })
  })

  // --- FHIR search all (pagination) ---
  describe('fhirSearchAll', () => {
    it('returns resources from a single-page bundle', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(fhirBundle([fakeFhirMedication, fakeFhirCondition]))
      )

      const results = await fhirSearchAll('MedicationRequest', 'status=active', 'tok')

      expect(results).toHaveLength(2)
      expect(results[0].resourceType).toBe('MedicationRequest')
      expect(results[1].resourceType).toBe('Condition')
    })

    it('follows pagination links', async () => {
      // Page 1 has a next link
      mockFetch.mockResolvedValueOnce(
        mockResponse(fhirBundle([fakeFhirMedication], 'https://api.1up.health/r4?page=2'))
      )
      // Page 2 has no next link
      mockFetch.mockResolvedValueOnce(
        mockResponse(fhirBundle([fakeFhirAllergy]))
      )

      const results = await fhirSearchAll('MedicationRequest', 'status=active', 'tok')

      expect(results).toHaveLength(2)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('returns empty array for bundle with no entries', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ resourceType: 'Bundle', type: 'searchset' })
      )

      const results = await fhirSearchAll('Condition', '', 'tok')
      expect(results).toEqual([])
    })
  })

  // --- Patient $everything ---
  describe('fetchPatientEverything', () => {
    it('fetches all resources via $everything', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          resourceType: 'Bundle',
          entry: [
            { resource: fakeFhirPatient },
            { resource: fakeFhirMedication },
            { resource: fakeFhirCondition },
            { resource: fakeFhirAllergy },
            { resource: fakeFhirObservation },
            { resource: fakeFhirAppointment },
            { resource: fakeFhirPractitioner },
            { resource: fakeFhirEOB },
            { resource: fakeFhirCoverage },
          ],
        })
      )

      const results = await fetchPatientEverything('my-token')

      expect(results).toHaveLength(9)

      const types = results.map((r) => r.resourceType)
      expect(types).toContain('Patient')
      expect(types).toContain('MedicationRequest')
      expect(types).toContain('Condition')
      expect(types).toContain('AllergyIntolerance')
      expect(types).toContain('Observation')
      expect(types).toContain('Appointment')
      expect(types).toContain('Practitioner')
      expect(types).toContain('ExplanationOfBenefit')
      expect(types).toContain('Coverage')

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.1up.health/r4/Patient/$everything')
    })

    it('returns empty array when bundle has no entries', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ resourceType: 'Bundle' })
      )

      const results = await fetchPatientEverything('tok')
      expect(results).toEqual([])
    })

    it('throws on server error', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'server_error' }, 500))

      await expect(fetchPatientEverything('tok')).rejects.toThrow(
        'Patient/$everything failed: 500'
      )
    })
  })

  // --- Fake data shape validation ---
  describe('fake FHIR data shapes', () => {
    it('medication has expected fields', () => {
      expect(fakeFhirMedication.medicationCodeableConcept.text).toBe('Tamoxifen 20mg')
      expect(fakeFhirMedication.dosageInstruction[0].doseAndRate![0].doseQuantity!.value).toBe(20)
      expect(fakeFhirMedication.requester.display).toBe('Dr. Smith')
    })

    it('observation has abnormal interpretation', () => {
      expect(fakeFhirObservation.interpretation[0].coding[0].code).toBe('H')
      expect(fakeFhirObservation.valueQuantity.value).toBe(145)
    })

    it('EOB has billing totals', () => {
      const submitted = fakeFhirEOB.total.find(
        (t) => t.category.coding[0].code === 'submitted'
      )
      const benefit = fakeFhirEOB.total.find(
        (t) => t.category.coding[0].code === 'benefit'
      )
      expect(submitted!.amount.value).toBe(1200)
      expect(benefit!.amount.value).toBe(900)
    })

    it('coverage has insurance details', () => {
      expect(fakeFhirCoverage.payor[0].display).toBe('Blue Cross Blue Shield')
      expect(fakeFhirCoverage.subscriberId).toBe('MEM-123456')
    })
  })
})
