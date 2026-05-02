import axios from 'axios'

const CT_BASE = 'https://clinicaltrials.gov/api/v2'
const TIMEOUT = 15_000

const client = axios.create({ baseURL: CT_BASE, timeout: TIMEOUT })

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [2000, 4000, 8000]
  let lastErr: unknown
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastErr = err
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 429 && i < delays.length) {
        await new Promise(r => setTimeout(r, delays[i]))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

function formatLocations(locations: unknown[], max: number): object[] {
  return (locations ?? []).slice(0, max).map((loc: unknown) => {
    const l = loc as Record<string, unknown>
    const contacts = ((l.contacts ?? []) as Array<Record<string, string>>)
      .map(c => ({ name: c.name ?? null, phone: c.phone ?? null, email: c.email ?? null }))
    return { facility: l.facility, city: l.city, state: l.state, country: l.country, status: l.status, contacts }
  })
}

export type SearchTrialsParams = {
  condition: string
  terms?:    string
  location?: string
  status?:   string
  phase?:    string
  pageSize?: number
}

export async function searchTrials(params: SearchTrialsParams): Promise<{ count: number; trials: object[] } | { error: string }> {
  try {
    const { data } = await withRetry(() =>
      client.get('/studies', {
        params: {
          'query.cond':           params.condition,
          'query.term':           params.terms,
          'filter.geo':           params.location,
          'filter.overallStatus': params.status,
          'filter.phase':         params.phase,
          pageSize:               Math.min(params.pageSize ?? 20, 100),
          format:                 'json',
        },
      })
    )
    const studies = data.studies ?? []
    return {
      count: data.totalCount ?? studies.length,
      trials: studies.map((s: Record<string, unknown>) => {
        const p = s.protocolSection as Record<string, Record<string, unknown>>
        return {
          nct_id:               p?.identificationModule?.nctId,
          title:                p?.identificationModule?.briefTitle,
          status:               p?.statusModule?.overallStatus,
          phase:                (p?.designModule?.phases as string[] | undefined)?.[0] ?? 'N/A',
          conditions:           (p?.conditionsModule?.conditions as string[] | undefined)?.join(', ') ?? '',
          brief_summary:        ((p?.descriptionModule?.briefSummary as string | undefined) ?? '').slice(0, 400),
          eligibility_criteria: ((p?.eligibilityModule?.eligibilityCriteria as string | undefined) ?? '').slice(0, 600),
          min_age:              p?.eligibilityModule?.minimumAge,
          max_age:              p?.eligibilityModule?.maximumAge,
          sex:                  p?.eligibilityModule?.sex,
          locations:            formatLocations((p?.contactsLocationsModule?.locations ?? []) as unknown[], 5),
          url:                  `https://clinicaltrials.gov/study/${p?.identificationModule?.nctId}`,
        }
      }),
    }
  } catch (err) {
    return { error: (err as Error).message ?? 'ClinicalTrials.gov API error' }
  }
}

export async function getTrialDetails(nctId: string): Promise<Record<string, unknown>> {
  try {
    const { data } = await withRetry(() => client.get(`/studies/${nctId}`, { params: { format: 'json' } }))
    const p = data.protocolSection as Record<string, Record<string, unknown>>
    return {
      nct_id:               p?.identificationModule?.nctId,
      title:                p?.identificationModule?.briefTitle,
      official_title:       p?.identificationModule?.officialTitle,
      organization:         (p?.sponsorCollaboratorsModule?.leadSponsor as Record<string, unknown>)?.name,
      status:               p?.statusModule?.overallStatus,
      phase:                (p?.designModule?.phases as string[] | undefined)?.[0] ?? 'N/A',
      study_type:           p?.designModule?.studyType,
      enrollment:           (p?.designModule?.enrollmentInfo as Record<string, unknown>)?.count,
      conditions:           (p?.conditionsModule?.conditions as string[] | undefined)?.join(', '),
      brief_summary:        p?.descriptionModule?.briefSummary,
      detailed_description: ((p?.descriptionModule?.detailedDescription as string | undefined) ?? '').slice(0, 1000),
      eligibility_criteria: p?.eligibilityModule?.eligibilityCriteria,
      min_age:              p?.eligibilityModule?.minimumAge,
      max_age:              p?.eligibilityModule?.maximumAge,
      sex:                  p?.eligibilityModule?.sex,
      interventions: (p?.armsInterventionsModule?.interventions as Array<Record<string, string>> | undefined)
        ?.map(i => ({ type: i.type, name: i.name, description: (i.description ?? '').slice(0, 300) })),
      primary_outcomes: (p?.outcomesModule?.primaryOutcomes as Array<Record<string, string>> | undefined)
        ?.map(o => o.measure),
      central_contacts: ((p?.contactsLocationsModule?.centralContacts ?? []) as Array<Record<string, string>>)
        .map(c => ({ name: c.name ?? null, phone: c.phone ?? null, email: c.email ?? null, role: c.role ?? null })),
      locations: formatLocations((p?.contactsLocationsModule?.locations ?? []) as unknown[], 10),
      url: `https://clinicaltrials.gov/study/${p?.identificationModule?.nctId}`,
    }
  } catch (err) {
    return { error: (err as Error).message ?? 'ClinicalTrials.gov API error' }
  }
}

export type SearchByEligibilityParams = {
  condition: string
  terms?:    string
  age?:      number
  sex?:      string
  location?: string
}

export async function searchByEligibility(params: SearchByEligibilityParams) {
  return searchTrials({
    condition: params.condition,
    terms:     params.terms,
    location:  params.location,
    status:    'RECRUITING',
  })
}
