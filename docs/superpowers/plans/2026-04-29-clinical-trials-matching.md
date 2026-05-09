# Clinical Trials Matching Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate clinical trial matching into CareCompanion so patients automatically see trials they qualify for (and trials they're close to qualifying for) using their existing health profile.

**Architecture:** Lift the 3 ClinicalTrials.gov MCP tools from the ClinicalTrialsMatching repo and add them to CareCompanion's existing Claude agent system as a 7th specialist. Patient profile data (cancer type, stage, mutations, labs, medications, treatment history) is auto-assembled from the DB and injected into Claude context — no patient re-entry needed. A nightly cron pre-fetches matches; trigger-based queue fires immediately on profile changes. Gap analysis detects why a patient doesn't yet qualify and monitors for when they do.

**Tech Stack:** Next.js App Router, Drizzle ORM (Aurora Serverless), Claude claude-sonnet-4.6 via `@ai-sdk/anthropic`, Vercel Cron (300s timeout), Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-29-clinical-trials-matching-design.md`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `apps/web/src/lib/trials/tools.ts` | 3 Claude tools calling ClinicalTrials.gov API v2 |
| `apps/web/src/lib/trials/assembleProfile.ts` | Build PatientProfile struct from DB for a careProfileId |
| `apps/web/src/lib/trials/gapAnalysis.ts` | EligibilityGap types + Claude prompt helpers |
| `apps/web/src/lib/trials/matchingQueue.ts` | Queue insert (deduplicated) + processMatchingQueueForProfile |
| `apps/web/src/lib/agents/clinicalTrialsAgent.ts` | Clinical Trials Coordinator specialist runner |
| `apps/web/src/app/api/trials/matches/route.ts` | GET stored matches (paginated, stale-flagged) |
| `apps/web/src/app/api/trials/match/route.ts` | POST live match run |
| `apps/web/src/app/api/trials/[nctId]/route.ts` | GET live trial detail + coordinator contacts |
| `apps/web/src/app/api/trials/save/route.ts` | POST save/upsert savedTrials |
| `apps/web/src/app/api/trials/saved/route.ts` | GET saved trials list |
| `apps/web/src/app/api/trials/saved/[nctId]/route.ts` | PATCH update interestStatus |
| `apps/web/src/app/api/cron/trials-match/route.ts` | Nightly patient matching cron |
| `apps/web/src/app/api/cron/trials-status/route.ts` | Nightly saved-trial status monitoring cron |
| `apps/web/src/components/trials/TrialMatchCard.tsx` | Card for a fully matched trial |
| `apps/web/src/components/trials/CloseMatchCard.tsx` | Card for a "close to qualifying" trial |
| `apps/web/src/components/trials/TrialsDashboardCard.tsx` | Dashboard summary widget |
| `apps/web/src/components/trials/ZipCodePrompt.tsx` | Banner shown when zip missing/invalid |
| `apps/web/src/components/trials/TrialsTab.tsx` | Full trials page layout (both sections) |
| `apps/web/src/app/(app)/trials/page.tsx` | Route for /trials |
| `apps/web/src/__tests__/trials/assembleProfile.test.ts` | Unit tests for profile assembly |
| `apps/web/src/__tests__/trials/tools.test.ts` | Unit tests for ClinicalTrials.gov tool wrappers |
| `apps/web/src/__tests__/trials/gapAnalysis.test.ts` | Unit tests for gap categorization helpers |
| `apps/web/src/__tests__/trials/matchingQueue.test.ts` | Unit tests for queue insert deduplication |

### Modified files
| File | Change |
|---|---|
| `apps/web/src/lib/db/schema.ts` | Add 5 new tables + 3 fields on careProfiles |
| `apps/web/src/lib/agents/specialists.ts` | Add `'trials'` to SpecialistType + SPECIALISTS record |
| `apps/web/src/lib/agents/router.ts` | Add trial trigger phrases to routing schema enum |
| `apps/web/src/lib/agents/orchestrator.ts` | Add trials to PatientContext (pass trialMatches count) |
| `vercel.json` (root) | Add 2 cron entries |
| `apps/web/src/app/api/records/medications/route.ts` | Fire queue insert after successful medication write |
| `apps/web/src/app/api/labs/route.ts` | Fire queue insert after successful lab write |
| `apps/web/src/app/api/care-profiles/route.ts` | Fire queue insert after profile update |

---

## Chunk 1: Database Schema

### Task 1: Add new tables and fields to schema.ts

**Files:**
- Modify: `apps/web/src/lib/db/schema.ts`

- [ ] **Step 1: Add 3 fields to careProfiles table**

In `schema.ts`, inside the `careProfiles` pgTable definition, add after `primaryConcern`:

```ts
city:    text('city'),
state:   text('state'),
zipCode: text('zip_code'),
```

- [ ] **Step 2: Add `mutations` table**

After the `careProfiles` table definition:

```ts
export const mutations = pgTable('mutations', {
  id:            uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  mutationName:  text('mutation_name').notNull(),
  status:        text('status').notNull().default('unknown'),
  confirmedDate: date('confirmed_date'),
  source:        text('source').notNull().default('manual'),
  createdAt:     timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

- [ ] **Step 3: Add `trialMatches` table**

```ts
export const trialMatches = pgTable('trial_matches', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  careProfileId:        uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  nctId:                text('nct_id').notNull(),
  title:                text('title'),
  matchCategory:        text('match_category').notNull().default('matched'),
  matchScore:           integer('match_score'),
  matchReasons:         text('match_reasons').array().default(sql`'{}'`),
  disqualifyingFactors: text('disqualifying_factors').array().default(sql`'{}'`),
  uncertainFactors:     text('uncertain_factors').array().default(sql`'{}'`),
  eligibilityGaps:      jsonb('eligibility_gaps'),
  enrollmentStatus:     text('enrollment_status'),
  locations:            jsonb('locations'),
  trialUrl:             text('trial_url'),
  notifiedAt:           timestamp('notified_at', { withTimezone: true }),
  lastCheckedAt:        timestamp('last_checked_at', { withTimezone: true }).defaultNow(),
  createdAt:            timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  careProfileNctUniq: uniqueIndex('trial_matches_care_profile_nct_idx').on(table.careProfileId, table.nctId),
}))
```

- [ ] **Step 4: Add `savedTrials` table**

```ts
export const savedTrials = pgTable('saved_trials', {
  id:                        uuid('id').primaryKey().defaultRandom(),
  careProfileId:             uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  nctId:                     text('nct_id').notNull(),
  savedAt:                   timestamp('saved_at', { withTimezone: true }).defaultNow(),
  interestStatus:            text('interest_status').notNull().default('interested'),
  lastKnownEnrollmentStatus: text('last_known_enrollment_status'),
  lastStatusCheckedAt:       timestamp('last_status_checked_at', { withTimezone: true }),
  notifiedOfChangeAt:        timestamp('notified_of_change_at', { withTimezone: true }),
}, (table) => ({
  careProfileNctUniq: uniqueIndex('saved_trials_care_profile_nct_idx').on(table.careProfileId, table.nctId),
}))
```

- [ ] **Step 5: Add `matchingQueue` table**

```ts
export const matchingQueue = pgTable('matching_queue', {
  id:            uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  reason:        text('reason').notNull().default('profile_update'),
  status:        text('status').notNull().default('pending'),
  triggeredAt:   timestamp('triggered_at', { withTimezone: true }).defaultNow(),
  claimedAt:     timestamp('claimed_at', { withTimezone: true }),
  processedAt:   timestamp('processed_at', { withTimezone: true }),
  errorMessage:  text('error_message'),
  retryCount:    integer('retry_count').notNull().default(0),
})
```

- [ ] **Step 6: Add `cronState` table**

```ts
export const cronState = pgTable('cron_state', {
  key:       text('key').primaryKey(),
  value:     text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
```

- [ ] **Step 7: Push schema to DB**

```bash
cd apps/web && npm run db:push
```

Expected: each new table created, no errors.

- [ ] **Step 8: Verify schema**

```bash
cd apps/web && npm run db:studio
```

Confirm all 5 new tables appear with correct columns.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/db/schema.ts
git commit -m "feat(trials): add schema — mutations, trialMatches, savedTrials, matchingQueue, cronState"
```

---

## Chunk 2: Patient Profile Assembly

### Task 2: assembleProfile.ts

**Files:**
- Create: `apps/web/src/lib/trials/assembleProfile.ts`
- Create: `apps/web/src/__tests__/trials/assembleProfile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/trials/assembleProfile.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}))

// We'll test the pure helper functions separately from DB calls
import { deriveConfidence, validateZip, buildPriorTreatmentLines } from '@/lib/trials/assembleProfile'

describe('deriveConfidence', () => {
  it('returns high for lab_report', () => {
    expect(deriveConfidence('lab_report')).toBe('high')
  })
  it('returns medium for fhir', () => {
    expect(deriveConfidence('fhir')).toBe('medium')
  })
  it('returns low for manual', () => {
    expect(deriveConfidence('manual')).toBe('low')
  })
})

describe('validateZip', () => {
  it('returns true for valid 5-digit zip', () => {
    expect(validateZip('94105')).toBe(true)
  })
  it('returns false for 4-digit zip', () => {
    expect(validateZip('9410')).toBe(false)
  })
  it('returns false for zip with letters', () => {
    expect(validateZip('9410A')).toBe(false)
  })
  it('returns false for null', () => {
    expect(validateZip(null)).toBe(false)
  })
  it('returns false for empty string', () => {
    expect(validateZip('')).toBe(false)
  })
})

describe('buildPriorTreatmentLines', () => {
  it('groups treatment cycles by regimen and picks max cycleNumber', () => {
    const cycles = [
      { regimenName: 'FOLFOX', startDate: '2024-01-01', cycleNumber: 1, isActive: false },
      { regimenName: 'FOLFOX', startDate: '2024-01-01', cycleNumber: 4, isActive: false },
      { regimenName: 'FOLFIRI', startDate: '2024-06-01', cycleNumber: 2, isActive: false },
    ]
    const result = buildPriorTreatmentLines(cycles)
    expect(result).toHaveLength(2)
    const folfox = result.find(r => r.regimen === 'FOLFOX')
    expect(folfox?.cycleCount).toBe(4)
    const folfiri = result.find(r => r.regimen === 'FOLFIRI')
    expect(folfiri?.cycleCount).toBe(2)
  })

  it('excludes active cycles', () => {
    const cycles = [
      { regimenName: 'FOLFOX', startDate: '2024-01-01', cycleNumber: 3, isActive: false },
      { regimenName: 'Active', startDate: '2025-01-01', cycleNumber: 1, isActive: true },
    ]
    const result = buildPriorTreatmentLines(cycles)
    expect(result).toHaveLength(1)
    expect(result[0].regimen).toBe('FOLFOX')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npm run test:run -- src/__tests__/trials/assembleProfile.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/trials/assembleProfile'`

- [ ] **Step 3: Create assembleProfile.ts**

Create `apps/web/src/lib/trials/assembleProfile.ts`:

```ts
import { db } from '@/lib/db'
import {
  careProfiles, medications, labResults, mutations,
  treatmentCycles,
} from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

export type MutationConfidence = 'high' | 'medium' | 'low'

export type EligibilityGap = {
  gapType:       'measurable' | 'conditional' | 'fixed'
  description:   string
  metric:        string | null
  currentValue:  string | null
  requiredValue: string | null
  unit:          string | null
  verifiable:    boolean
  closureSignal: string | null
}

export type LabResultEntry = {
  testName:     string
  numericValue: number | null
  unit:         string | null
  resultDate:   string
  isAbnormal:   boolean
}

export type PriorTreatmentLine = {
  regimen:    string
  startDate:  string
  cycleCount: number
}

export type PatientProfile = {
  cancerType:          string | null
  cancerStage:         string | null
  age:                 number | null
  zipCode:             string | null
  city:                string | null
  state:               string | null
  mutations:           Array<{ name: string; status: string; source: string; confidence: MutationConfidence }>
  currentMedications:  string[]
  labResults:          LabResultEntry[]
  priorTreatmentLines: PriorTreatmentLine[]
  activeTreatment:     { regimen: string; startDate: string; cycleNumber: number } | null
  conditions:          string | null
  allergies:           string | null
}

export function deriveConfidence(source: string): MutationConfidence {
  if (source === 'lab_report') return 'high'
  if (source === 'fhir') return 'medium'
  return 'low'
}

export function validateZip(zip: string | null | undefined): boolean {
  if (!zip) return false
  return /^\d{5}$/.test(zip)
}

export function buildPriorTreatmentLines(
  cycles: Array<{ regimenName: string | null; startDate: string; cycleNumber: number; isActive: boolean }>
): PriorTreatmentLine[] {
  const prior = cycles.filter(c => !c.isActive && c.regimenName)
  const grouped: Record<string, { startDate: string; maxCycle: number }> = {}
  for (const c of prior) {
    const key = c.regimenName!
    if (!grouped[key] || c.cycleNumber > grouped[key].maxCycle) {
      grouped[key] = { startDate: c.startDate, maxCycle: c.cycleNumber }
    }
  }
  return Object.entries(grouped).map(([regimen, { startDate, maxCycle }]) => ({
    regimen,
    startDate,
    cycleCount: maxCycle,
  }))
}

export async function assembleProfile(careProfileId: string): Promise<PatientProfile> {
  const [profile] = await db.select().from(careProfiles).where(eq(careProfiles.id, careProfileId)).limit(1)
  if (!profile) throw new Error(`careProfile not found: ${careProfileId}`)

  const [meds, labs, muts, cycles] = await Promise.all([
    db.select().from(medications)
      .where(and(eq(medications.careProfileId, careProfileId), isNull(medications.deletedAt))),
    db.select().from(labResults).where(eq(labResults.careProfileId, careProfileId)),
    db.select().from(mutations).where(eq(mutations.careProfileId, careProfileId)),
    db.select().from(treatmentCycles).where(eq(treatmentCycles.careProfileId, careProfileId)),
  ])

  const activeCycle = cycles.find(c => c.isActive) ?? null

  return {
    cancerType:   profile.cancerType,
    cancerStage:  profile.cancerStage,
    age:          profile.patientAge,
    zipCode:      validateZip(profile.zipCode) ? profile.zipCode! : null,
    city:         profile.city ?? null,
    state:        profile.state ?? null,
    mutations: muts.map(m => ({
      name:       m.mutationName,
      status:     m.status,
      source:     m.source,
      confidence: deriveConfidence(m.source),
    })),
    currentMedications: meds.map(m => m.name),
    labResults: labs.map(l => {
      const numeric = parseFloat(l.value ?? '')
      return {
        testName:     l.name,
        numericValue: isNaN(numeric) ? null : numeric,
        unit:         l.unit ?? null,
        resultDate:   l.date ?? '',
        isAbnormal:   l.isAbnormal ?? false,
      }
    }),
    priorTreatmentLines: buildPriorTreatmentLines(cycles),
    activeTreatment: activeCycle ? {
      regimen:     activeCycle.regimenName ?? '',
      startDate:   activeCycle.startDate,
      cycleNumber: activeCycle.cycleNumber,
    } : null,
    conditions: profile.conditions,
    allergies:  profile.allergies,
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npm run test:run -- src/__tests__/trials/assembleProfile.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && npm run typecheck
```

Expected: No errors in new file.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/trials/assembleProfile.ts apps/web/src/__tests__/trials/assembleProfile.test.ts
git commit -m "feat(trials): add assembleProfile with profile assembly, zip validation, and mutation confidence"
```

---

## Chunk 3: ClinicalTrials.gov Tools

### Task 3: tools.ts — 3 Claude tools wrapping ClinicalTrials.gov API v2

**Files:**
- Create: `apps/web/src/lib/trials/tools.ts`
- Create: `apps/web/src/__tests__/trials/tools.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/trials/tools.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock axios before importing tools
const mockGet = vi.fn()
vi.mock('axios', () => ({
  default: { get: mockGet, create: vi.fn(() => ({ get: mockGet })) },
}))

import { searchTrials, getTrialDetails, searchByEligibility } from '@/lib/trials/tools'

describe('searchTrials', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls ClinicalTrials.gov API with correct params', async () => {
    mockGet.mockResolvedValueOnce({
      data: { studies: [], totalCount: 0 },
    })
    const result = await searchTrials({ condition: 'colorectal cancer', pageSize: 5 })
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('/studies'),
      expect.objectContaining({ params: expect.objectContaining({ 'query.cond': 'colorectal cancer' }) })
    )
    expect(result.count).toBe(0)
    expect(result.trials).toHaveLength(0)
  })

  it('returns error object on API failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'))
    const result = await searchTrials({ condition: 'breast cancer' })
    expect(result).toHaveProperty('error')
  })
})

describe('getTrialDetails', () => {
  it('returns formatted trial detail for a valid NCT ID', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        protocolSection: {
          identificationModule: { nctId: 'NCT123', briefTitle: 'Test Trial', officialTitle: 'Official' },
          statusModule: { overallStatus: 'RECRUITING' },
          descriptionModule: { briefSummary: 'Summary', detailedDescription: 'Detail' },
          eligibilityModule: { eligibilityCriteria: 'Must be 18+', minimumAge: '18 Years', maximumAge: '75 Years', sex: 'ALL' },
          contactsLocationsModule: { locations: [] },
          designModule: { studyType: 'INTERVENTIONAL', enrollmentInfo: { count: 100 } },
          armsInterventionsModule: { interventions: [] },
          conditionsModule: { conditions: ['Colorectal Cancer'] },
          outcomesModule: { primaryOutcomes: [] },
          sponsorCollaboratorsModule: { leadSponsor: { name: 'NIH' } },
        },
      },
    })
    const result = await getTrialDetails('NCT123')
    expect(result.nct_id).toBe('NCT123')
    expect(result.title).toBe('Test Trial')
    expect(result.eligibility_criteria).toContain('18+')
  })

  it('returns error on invalid NCT ID', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 404 } })
    const result = await getTrialDetails('INVALID')
    expect(result).toHaveProperty('error')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npm run test:run -- src/__tests__/trials/tools.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/trials/tools'`

- [ ] **Step 3: Install axios if not present**

```bash
cd apps/web && grep '"axios"' package.json || bun add axios
```

- [ ] **Step 4: Create tools.ts**

Create `apps/web/src/lib/trials/tools.ts`:

```ts
import axios from 'axios'

const CT_BASE = 'https://clinicaltrials.gov/api/v2'
const TIMEOUT = 15_000

const client = axios.create({ baseURL: CT_BASE, timeout: TIMEOUT })

// Retry on 429 with exponential backoff
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [2000, 4000, 8000]
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 429 && i < delays.length) {
        await new Promise(r => setTimeout(r, delays[i]))
        continue
      }
      throw err
    }
  }
  throw new Error('withRetry exhausted')
}

function formatLocations(locations: unknown[]): object[] {
  return (locations ?? []).slice(0, 10).map((loc: unknown) => {
    const l = loc as Record<string, unknown>
    return {
      facility: l.facility,
      city:     l.city,
      state:    l.state,
      country:  l.country,
      status:   l.status,
    }
  })
}

// ── Tool 1: search_trials ─────────────────────────────────────────────────────

export type SearchTrialsParams = {
  condition:  string
  terms?:     string
  location?:  string   // e.g. "50mi:94105"
  status?:    string   // e.g. "RECRUITING"
  phase?:     string
  pageSize?:  number
}

export async function searchTrials(params: SearchTrialsParams) {
  try {
    const { data } = await withRetry(() =>
      client.get('/studies', {
        params: {
          'query.cond':    params.condition,
          'query.term':    params.terms,
          'filter.geo':    params.location,
          'filter.overallStatus': params.status,
          'filter.phase':  params.phase,
          pageSize:        Math.min(params.pageSize ?? 20, 20),
          format:          'json',
          fields:          [
            'NCTId', 'BriefTitle', 'OverallStatus', 'Phase',
            'Condition', 'InterventionName', 'BriefSummary',
            'EligibilityCriteria', 'MinimumAge', 'MaximumAge',
            'Sex', 'LocationFacility', 'LocationCity', 'LocationState',
            'LocationCountry', 'LocationStatus',
          ].join(','),
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
          interventions:        (p?.armsInterventionsModule?.interventions as Array<Record<string,string>> | undefined)
                                  ?.map(i => `${i.type}: ${i.name}`).join('; ') ?? '',
          brief_summary:        (p?.descriptionModule?.briefSummary as string | undefined)?.slice(0, 400) ?? '',
          eligibility_criteria: (p?.eligibilityModule?.eligibilityCriteria as string | undefined)?.slice(0, 600) ?? '',
          min_age:              p?.eligibilityModule?.minimumAge,
          max_age:              p?.eligibilityModule?.maximumAge,
          sex:                  p?.eligibilityModule?.sex,
          locations:            formatLocations((p?.contactsLocationsModule?.locations ?? []) as unknown[]).slice(0, 5),
          url:                  `https://clinicaltrials.gov/study/${p?.identificationModule?.nctId}`,
        }
      }),
    }
  } catch (err) {
    return { error: (err as Error).message ?? 'ClinicalTrials.gov API error' }
  }
}

// ── Tool 2: get_trial_details ─────────────────────────────────────────────────

export async function getTrialDetails(nctId: string) {
  try {
    const { data } = await withRetry(() => client.get(`/studies/${nctId}`, { params: { format: 'json' } }))
    const p = data.protocolSection as Record<string, Record<string, unknown>>
    return {
      nct_id:               p?.identificationModule?.nctId,
      title:                p?.identificationModule?.briefTitle,
      official_title:       p?.identificationModule?.officialTitle,
      organization:         (p?.sponsorCollaboratorsModule?.leadSponsor as Record<string,unknown>)?.name,
      status:               p?.statusModule?.overallStatus,
      phase:                (p?.designModule?.phases as string[] | undefined)?.[0] ?? 'N/A',
      study_type:           p?.designModule?.studyType,
      enrollment:           (p?.designModule?.enrollmentInfo as Record<string,unknown>)?.count,
      conditions:           (p?.conditionsModule?.conditions as string[] | undefined)?.join(', '),
      brief_summary:        p?.descriptionModule?.briefSummary,
      detailed_description: (p?.descriptionModule?.detailedDescription as string | undefined)?.slice(0, 1000),
      eligibility_criteria: p?.eligibilityModule?.eligibilityCriteria,
      min_age:              p?.eligibilityModule?.minimumAge,
      max_age:              p?.eligibilityModule?.maximumAge,
      sex:                  p?.eligibilityModule?.sex,
      interventions: (p?.armsInterventionsModule?.interventions as Array<Record<string,string>> | undefined)
        ?.map(i => ({ type: i.type, name: i.name, description: (i.description ?? '').slice(0, 300) })),
      primary_outcomes: (p?.outcomesModule?.primaryOutcomes as Array<Record<string,string>> | undefined)
        ?.map(o => o.measure),
      locations: formatLocations((p?.contactsLocationsModule?.locations ?? []) as unknown[]),
      url: `https://clinicaltrials.gov/study/${p?.identificationModule?.nctId}`,
    }
  } catch (err) {
    return { error: (err as Error).message ?? 'ClinicalTrials.gov API error' }
  }
}

// ── Tool 3: search_by_eligibility ─────────────────────────────────────────────

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
```

- [ ] **Step 5: Run tests**

```bash
cd apps/web && npm run test:run -- src/__tests__/trials/tools.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Typecheck**

```bash
cd apps/web && npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/trials/tools.ts apps/web/src/__tests__/trials/tools.test.ts
git commit -m "feat(trials): add ClinicalTrials.gov tools — search_trials, get_trial_details, search_by_eligibility"
```

---

## Chunk 4: Gap Analysis + Scoring Rubric

### Task 4: gapAnalysis.ts — gap types and scoring prompt builder

**Files:**
- Create: `apps/web/src/lib/trials/gapAnalysis.ts`
- Create: `apps/web/src/__tests__/trials/gapAnalysis.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/__tests__/trials/gapAnalysis.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildScoringSystemPrompt, isCloseTrial } from '@/lib/trials/gapAnalysis'
import type { EligibilityGap } from '@/lib/trials/assembleProfile'

describe('isCloseTrial', () => {
  it('returns true when all gaps are measurable or conditional', () => {
    const gaps: EligibilityGap[] = [
      { gapType: 'measurable', description: 'Hemoglobin too low', metric: 'hemoglobin',
        currentValue: '9.2', requiredValue: '10', unit: 'g/dL', verifiable: true, closureSignal: 'labResults.hemoglobin' },
    ]
    expect(isCloseTrial(gaps)).toBe(true)
  })

  it('returns false when any gap is fixed', () => {
    const gaps: EligibilityGap[] = [
      { gapType: 'fixed', description: 'Wrong cancer type', metric: null,
        currentValue: null, requiredValue: null, unit: null, verifiable: false, closureSignal: null },
    ]
    expect(isCloseTrial(gaps)).toBe(false)
  })

  it('returns false for empty gaps array (no gaps = fully matched, not close)', () => {
    expect(isCloseTrial([])).toBe(false)
  })
})

describe('buildScoringSystemPrompt', () => {
  it('includes the patient profile data in the prompt', () => {
    const prompt = buildScoringSystemPrompt({
      cancerType: 'NSCLC', cancerStage: 'Stage IV', age: 58,
      zipCode: '94105', city: 'San Francisco', state: 'CA',
      mutations: [{ name: 'EGFR', status: 'positive', source: 'lab_report', confidence: 'high' }],
      currentMedications: ['Osimertinib'],
      labResults: [],
      priorTreatmentLines: [{ regimen: 'Carboplatin/Pemetrexed', startDate: '2023-01-01', cycleCount: 4 }],
      activeTreatment: null,
      conditions: null,
      allergies: null,
    })
    expect(prompt).toContain('NSCLC')
    expect(prompt).toContain('EGFR')
    expect(prompt).toContain('Osimertinib')
    expect(prompt).toContain('lab_report')
    expect(prompt).toContain('measurable')
    expect(prompt).toContain('conditional')
    expect(prompt).toContain('fixed')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/web && npm run test:run -- src/__tests__/trials/gapAnalysis.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create gapAnalysis.ts**

Create `apps/web/src/lib/trials/gapAnalysis.ts`:

```ts
import type { EligibilityGap, PatientProfile } from './assembleProfile'

export type { EligibilityGap }

export function isCloseTrial(gaps: EligibilityGap[]): boolean {
  if (gaps.length === 0) return false
  return gaps.every(g => g.gapType === 'measurable' || g.gapType === 'conditional')
}

export function buildScoringSystemPrompt(profile: PatientProfile): string {
  const mutationLines = profile.mutations.map(m =>
    `  - ${m.name}: ${m.status} (source: ${m.source}, confidence: ${m.confidence})`
  ).join('\n') || '  None recorded'

  const labLines = profile.labResults.map(l =>
    `  - ${l.testName}: ${l.numericValue ?? 'non-numeric'} ${l.unit ?? ''} (${l.resultDate})${l.isAbnormal ? ' [ABNORMAL]' : ''}`
  ).join('\n') || '  None recorded'

  const priorLines = profile.priorTreatmentLines.map(p =>
    `  - ${p.regimen} (${p.cycleCount} cycles, started ${p.startDate})`
  ).join('\n') || '  None recorded'

  return `You are a Clinical Trials Coordinator AI assistant for CareCompanion. Your job is to score clinical trials against a patient's profile and identify eligibility gaps.

## Patient Profile

- Cancer type: ${profile.cancerType ?? 'Unknown'}
- Cancer stage: ${profile.cancerStage ?? 'Unknown'}
- Age: ${profile.age ?? 'Unknown'}
- Location (zip): ${profile.zipCode ?? 'Not provided'}
- Current medications: ${profile.currentMedications.join(', ') || 'None'}
- Conditions: ${profile.conditions ?? 'None recorded'}
- Allergies: ${profile.allergies ?? 'None recorded'}

Mutations:
${mutationLines}

Lab Results:
${labLines}

Prior treatment lines (completed):
${priorLines}

Active treatment: ${profile.activeTreatment ? `${profile.activeTreatment.regimen} (cycle ${profile.activeTreatment.cycleNumber})` : 'None'}

## Scoring Instructions

For each trial, output a JSON object:
{
  "matchCategory": "matched" | "close" | "excluded",
  "matchScore": 0-100,
  "matchReasons": string[],
  "disqualifyingFactors": string[],
  "uncertainFactors": string[],
  "eligibilityGaps": EligibilityGap[] | null
}

### Hard filters — set matchCategory to "excluded", do NOT include in output if:
- Patient age is outside the trial's min_age–max_age range
- Patient cancer type has no overlap with trial conditions
- Any gap you determine is "fixed" (cannot change — wrong age, wrong cancer type)

### Gap categories (for "close" trials only):
- "measurable": a specific numeric threshold (lab value, treatment count) must be reached. Include currentValue, requiredValue, unit.
- "conditional": a medication must stop, or a treatment line must complete. No numeric threshold.
- "fixed": age, cancer type — permanent barrier. Set matchCategory to "excluded" instead.

### Scoring guidance (holistic — not a formula):
- Cancer stage match: strong signal
- Full eligibility criteria met: strong signal
- Mutation/biomarker match: strong signal. Weight by confidence: high=full, medium=note uncertainty, low=flag as manually entered
- Negative mutation as exclusion: if patient has it and trial excludes it → conditional gap or disqualifier
- Prior treatment history: check inclusion/exclusion vs priorTreatmentLines
- Lab values: compare numeric values to trial thresholds → measurable gaps
- Medication conflicts: trial exclusion vs currentMedications → conditional gaps
- Trial phase: Phase 3 = preferred. Phase 1 = note "early-phase, higher uncertainty"

### Uncertainty rule:
If you are uncertain about a gap, set verifiable: false and explain in description. Never guess.

### Gap description format (plain language):
- Measurable lab: "Your [test] needs to reach [required] [unit] — your last result was [current] [unit] ([date])"
- Measurable treatment: "This trial requires [N] completed prior lines of therapy — your history shows [current]"  
- Conditional medication: "This trial requires no prior [drug] treatment — currently blocked by [medication] in your medication list"
- Unverifiable: "This trial requires [criterion] — we don't have this on file. Ask your care team."

Score ≥ 40 for matched trials. Close trials are scored but the score is secondary to gap quality.`
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npm run test:run -- src/__tests__/trials/gapAnalysis.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && npm run typecheck
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/trials/gapAnalysis.ts apps/web/src/__tests__/trials/gapAnalysis.test.ts
git commit -m "feat(trials): add gap analysis types and scoring rubric prompt builder"
```

---

## Chunk 5: Matching Queue

### Task 5: matchingQueue.ts — queue insert + claim + process

**Files:**
- Create: `apps/web/src/lib/trials/matchingQueue.ts`
- Create: `apps/web/src/__tests__/trials/matchingQueue.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/__tests__/trials/matchingQueue.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn(() => Promise.resolve()) })) }))
const mockUpdate = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([])) })) })) }))

vi.mock('@/lib/db', () => ({
  db: { insert: mockInsert, update: mockUpdate, select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) })) },
}))
vi.mock('@/lib/trials/assembleProfile', () => ({
  assembleProfile: vi.fn(() => Promise.resolve({ cancerType: 'NSCLC', age: 55, zipCode: '94105', mutations: [], currentMedications: [], labResults: [], priorTreatmentLines: [], activeTreatment: null, conditions: null, allergies: null, cancerStage: null, city: null, state: null })),
}))
vi.mock('@/lib/trials/clinicalTrialsAgent', () => ({
  runTrialsAgent: vi.fn(() => Promise.resolve({ matched: [], close: [] })),
}))

import { enqueueMatchingRun } from '@/lib/trials/matchingQueue'

describe('enqueueMatchingRun', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts into matchingQueue with onConflictDoNothing', async () => {
    await enqueueMatchingRun('profile-abc', 'new_medication')
    expect(mockInsert).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/web && npm run test:run -- src/__tests__/trials/matchingQueue.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create matchingQueue.ts**

Create `apps/web/src/lib/trials/matchingQueue.ts`:

```ts
import { db } from '@/lib/db'
import { matchingQueue, trialMatches, notifications, careProfiles } from '@/lib/db/schema'
import { eq, and, isNull, lt, sql } from 'drizzle-orm'
import { assembleProfile } from './assembleProfile'
import { runTrialsAgent } from './clinicalTrialsAgent'

export async function enqueueMatchingRun(
  careProfileId: string,
  reason: 'profile_update' | 'new_medication' | 'new_lab' | 'nightly' | 'retry'
) {
  await db.insert(matchingQueue)
    .values({ careProfileId, reason, status: 'pending' })
    .onConflictDoNothing()
}

// Release stale claimed rows older than 10 minutes (called at cron startup)
export async function releaseStaleClaimedRows() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
  await db.update(matchingQueue)
    .set({ status: 'pending', claimedAt: null })
    .where(and(eq(matchingQueue.status, 'claimed'), lt(matchingQueue.claimedAt!, tenMinutesAgo)))
}

// Claim one pending row atomically for a specific careProfileId
async function claimQueueRow(careProfileId: string): Promise<string | null> {
  const rows = await db.update(matchingQueue)
    .set({ status: 'claimed', claimedAt: new Date() })
    .where(and(eq(matchingQueue.careProfileId, careProfileId), eq(matchingQueue.status, 'pending')))
    .returning({ id: matchingQueue.id })
  return rows[0]?.id ?? null
}

export async function processMatchingQueueForProfile(careProfileId: string): Promise<void> {
  const rowId = await claimQueueRow(careProfileId)
  if (!rowId) return // Already claimed or no pending row

  try {
    const profile = await assembleProfile(careProfileId)
    const { matched, close } = await runTrialsAgent(profile)

    // Upsert matched trials
    for (const trial of matched) {
      await db.insert(trialMatches)
        .values({ ...trial, careProfileId, matchCategory: 'matched', updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [trialMatches.careProfileId, trialMatches.nctId],
          set: { ...trial, matchCategory: 'matched', updatedAt: new Date(), lastCheckedAt: new Date() },
        })
    }

    // Upsert close trials
    for (const trial of close) {
      await db.insert(trialMatches)
        .values({ ...trial, careProfileId, matchCategory: 'close', updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [trialMatches.careProfileId, trialMatches.nctId],
          set: { ...trial, matchCategory: 'close', updatedAt: new Date(), lastCheckedAt: new Date() },
        })
    }

    // Notify on new unnotified matches
    const newMatches = await db.select()
      .from(trialMatches)
      .where(and(eq(trialMatches.careProfileId, careProfileId), isNull(trialMatches.notifiedAt)))
    
    if (newMatches.length > 0) {
      const [cp] = await db.select({ userId: careProfiles.userId })
        .from(careProfiles).where(eq(careProfiles.id, careProfileId)).limit(1)
      
      if (cp) {
        const hasNewClose = newMatches.some(m => m.matchCategory === 'close')
        const hasNewMatched = newMatches.some(m => m.matchCategory === 'matched')
        
        if (hasNewMatched) {
          await db.insert(notifications).values({
            userId: cp.userId,
            type: 'trial_match',
            title: 'New trial matches available',
            message: 'New trial matches are available. Open CareCompanion to view.',
          })
        } else if (hasNewClose) {
          await db.insert(notifications).values({
            userId: cp.userId,
            type: 'trial_close',
            title: "You're close to qualifying for new trials",
            message: "You're close to qualifying for new trials. Open CareCompanion to see what's changed.",
          })
        }

        // Mark all as notified
        await db.update(trialMatches)
          .set({ notifiedAt: new Date() })
          .where(and(eq(trialMatches.careProfileId, careProfileId), isNull(trialMatches.notifiedAt)))
      }
    }

    await db.update(matchingQueue)
      .set({ status: 'completed', processedAt: new Date() })
      .where(eq(matchingQueue.id, rowId))

  } catch (err) {
    await db.update(matchingQueue)
      .set({
        status: 'failed',
        errorMessage: (err as Error).message,
        retryCount: sql`${matchingQueue.retryCount} + 1`,
      })
      .where(eq(matchingQueue.id, rowId))
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npm run test:run -- src/__tests__/trials/matchingQueue.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && npm run typecheck
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/trials/matchingQueue.ts apps/web/src/__tests__/trials/matchingQueue.test.ts
git commit -m "feat(trials): add matchingQueue — enqueue, claim, process, notify"
```

---

## Chunk 6: Clinical Trials Agent + Agent Routing

### Task 6: clinicalTrialsAgent.ts + update specialists.ts and router.ts

**Files:**
- Create: `apps/web/src/lib/trials/clinicalTrialsAgent.ts`
- Modify: `apps/web/src/lib/agents/specialists.ts`
- Modify: `apps/web/src/lib/agents/router.ts`

- [ ] **Step 1: Create clinicalTrialsAgent.ts**

Create `apps/web/src/lib/trials/clinicalTrialsAgent.ts`:

```ts
import { anthropic } from '@ai-sdk/anthropic'
import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import { searchTrials, getTrialDetails, searchByEligibility } from './tools'
import { buildScoringSystemPrompt, isCloseTrial } from './gapAnalysis'
import type { PatientProfile, EligibilityGap } from './assembleProfile'

export type TrialMatchResult = {
  nctId:                string
  title:                string
  matchScore:           number
  matchReasons:         string[]
  disqualifyingFactors: string[]
  uncertainFactors:     string[]
  eligibilityGaps:      EligibilityGap[] | null
  enrollmentStatus:     string | null
  locations:            object[]
  trialUrl:             string | null
}

export type AgentMatchOutput = {
  matched: TrialMatchResult[]
  close:   TrialMatchResult[]
}

const searchTrialsTool = tool({
  description: 'Search ClinicalTrials.gov for trials matching a condition',
  parameters: z.object({
    condition: z.string(),
    terms:     z.string().optional(),
    location:  z.string().optional(),
    status:    z.string().optional(),
    phase:     z.string().optional(),
    pageSize:  z.number().optional(),
  }),
  execute: async (params) => searchTrials(params),
})

const getTrialDetailsTool = tool({
  description: 'Get full protocol details for a specific clinical trial by NCT ID',
  parameters: z.object({ nct_id: z.string() }),
  execute: async ({ nct_id }) => getTrialDetails(nct_id),
})

const searchByEligibilityTool = tool({
  description: 'Search trials filtered by patient eligibility parameters',
  parameters: z.object({
    condition: z.string(),
    terms:     z.string().optional(),
    age:       z.number().optional(),
    sex:       z.string().optional(),
    location:  z.string().optional(),
  }),
  execute: async (params) => searchByEligibility(params),
})

export async function runTrialsAgent(profile: PatientProfile): Promise<AgentMatchOutput> {
  const systemPrompt = buildScoringSystemPrompt(profile)
  const locationFilter = profile.zipCode ? `50mi:${profile.zipCode}` : undefined

  const userMessage = `Find and score clinical trials for this patient. 
Search for trials matching: ${profile.cancerType ?? 'cancer'}, stage: ${profile.cancerStage ?? 'unknown'}.
${locationFilter ? `Filter by location: ${locationFilter}` : 'No location filter — patient zip code not provided.'}
Age: ${profile.age ?? 'unknown'}.

For each trial found, score it using the rubric and output valid JSON for each trial with the fields: matchCategory, matchScore, matchReasons, disqualifyingFactors, uncertainFactors, eligibilityGaps.

Only output trials with matchCategory "matched" or "close" — skip "excluded" entirely.
Limit to top 20 trials across all tool calls.`

  const { text } = await generateText({
    model:       anthropic('claude-sonnet-4.6'),
    system:      systemPrompt,
    prompt:      userMessage,
    tools: {
      search_trials:         searchTrialsTool,
      get_trial_details:     getTrialDetailsTool,
      search_by_eligibility: searchByEligibilityTool,
    },
    stopWhen: stepCountIs(10),  // AI SDK v6 — replaces maxSteps
  })

  // Parse JSON blocks from Claude's response
  const jsonBlocks = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map(m => m[1])
  const results: TrialMatchResult[] = []

  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(block)
      const trials = Array.isArray(parsed) ? parsed : [parsed]
      for (const t of trials) {
        if (t.matchCategory === 'excluded') continue
        results.push({
          nctId:                t.nct_id ?? t.nctId ?? '',
          title:                t.title ?? '',
          matchScore:           Math.max(0, Math.min(100, t.matchScore ?? 0)),
          matchReasons:         t.matchReasons ?? [],
          disqualifyingFactors: t.disqualifyingFactors ?? [],
          uncertainFactors:     t.uncertainFactors ?? [],
          eligibilityGaps:      t.eligibilityGaps ?? null,
          enrollmentStatus:     t.status ?? null,
          locations:            t.locations ?? [],
          trialUrl:             t.url ?? null,
        })
      }
    } catch { /* skip malformed blocks */ }
  }

  const matched = results.filter(r => r.matchCategory !== 'close' && r.matchScore >= 40)
  const close   = results.filter(r =>
    r.matchCategory === 'close' || (r.eligibilityGaps && isCloseTrial(r.eligibilityGaps))
  )

  return { matched, close }
}
```

- [ ] **Step 2: Add `'trials'` to SpecialistType in specialists.ts**

In `apps/web/src/lib/agents/specialists.ts`, change:

```ts
export type SpecialistType = 'medication' | 'insurance' | 'scheduling' | 'wellness' | 'labs' | 'general';
```

to:

```ts
export type SpecialistType = 'medication' | 'insurance' | 'scheduling' | 'wellness' | 'labs' | 'general' | 'trials';
```

Then add the trials entry to the `SPECIALISTS` record:

```ts
  trials: {
    name: 'Clinical Trials Coordinator',
    description: 'Finds and scores clinical trials matching the patient profile. Identifies trials the patient qualifies for and trials they are close to qualifying for.',
    systemPrompt: `You are the Clinical Trials Coordinator for CareCompanion. You help patients and caregivers find clinical trials they may be eligible for.

Your role:
- Find trials matching the patient's cancer type, stage, mutations, and treatment history
- Score each trial against the patient's profile
- Identify "close" trials where a specific, achievable change could unlock eligibility
- Always explain in plain language WHY a trial matches or doesn't
- Flag trials where data is missing rather than guessing

Safety rules:
- NEVER advise the patient to change their treatment to qualify for a trial
- NEVER guarantee eligibility — always recommend discussing with their oncologist
- Always end with: "Discuss any trial options with your oncology team before taking action."`,
    relevantDataKeys: ['cancerType', 'cancerStage', 'medications', 'labResults', 'mutations', 'treatmentHistory'],
    allowedTools: ['search_trials', 'get_trial_details', 'search_by_eligibility'],
  },
```

- [ ] **Step 3: Add trial trigger phrases to router.ts**

In `apps/web/src/lib/agents/router.ts`, find the `z.enum([...])` for specialists and add `'trials'`:

```ts
specialists: z.array(z.enum(['medication', 'insurance', 'scheduling', 'wellness', 'labs', 'general', 'trials']))
```

In the routing prompt, add:

```
- trials: questions about clinical trials, research studies, enrollment, eligibility, "find me trials", "am I eligible", "close to qualifying", "trial match"
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && npm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/trials/clinicalTrialsAgent.ts apps/web/src/lib/agents/specialists.ts apps/web/src/lib/agents/router.ts
git commit -m "feat(trials): add Clinical Trials Coordinator agent and wire into routing"
```

---

## Chunk 7: API Routes

### Task 7: Six trial API routes

**Files:**
- Create all routes listed below. All follow the existing pattern: import `getAuthenticatedUser` from `@/lib/api-helpers`, query via `db`, return `NextResponse.json(...)`.

- [ ] **Step 1: GET /api/trials/matches**

Create `apps/web/src/app/api/trials/matches/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { trialMatches, careProfiles } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page     = parseInt(searchParams.get('page') ?? '1')
  const limit    = parseInt(searchParams.get('limit') ?? '20')
  const category = searchParams.get('category') // 'matched' | 'close' | null (all)

  const [profile] = await db.select({ id: careProfiles.id })
    .from(careProfiles).where(eq(careProfiles.userId, user.id)).limit(1)
  if (!profile) return NextResponse.json({ matches: [], close: [] })

  const staleThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const whereClause = category && category !== 'all'
    ? and(eq(trialMatches.careProfileId, profile.id), eq(trialMatches.matchCategory, category))
    : eq(trialMatches.careProfileId, profile.id)

  const rows = await db.select().from(trialMatches)
    .where(whereClause)
    .orderBy(desc(trialMatches.matchScore))
    .limit(limit).offset((page - 1) * limit)

  const result = rows.map(r => ({
    ...r,
    stale: r.updatedAt != null && r.updatedAt < staleThreshold,
  }))

  return NextResponse.json({
    matched: result.filter(r => r.matchCategory === 'matched'),
    close:   result.filter(r => r.matchCategory === 'close'),
    page,
    limit,
  })
}
```

- [ ] **Step 2: POST /api/trials/match (live run)**

Create `apps/web/src/app/api/trials/match/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { assembleProfile } from '@/lib/trials/assembleProfile'
import { runTrialsAgent } from '@/lib/trials/clinicalTrialsAgent'
import { db } from '@/lib/db'
import { careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile] = await db.select({ id: careProfiles.id })
    .from(careProfiles).where(eq(careProfiles.userId, user.id)).limit(1)
  if (!profile) return NextResponse.json({ error: 'No care profile found' }, { status: 404 })

  const patientProfile = await assembleProfile(profile.id)
  const { matched, close } = await runTrialsAgent(patientProfile)

  return NextResponse.json({ matched, close })
}
```

- [ ] **Step 3: GET /api/trials/[nctId] (live trial detail)**

Create `apps/web/src/app/api/trials/[nctId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { getTrialDetails } from '@/lib/trials/tools'

export async function GET(req: NextRequest, { params }: { params: { nctId: string } }) {
  const { user, error } = await getAuthenticatedUser(req)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const detail = await getTrialDetails(params.nctId)
  if ('error' in detail) return NextResponse.json({ error: detail.error }, { status: 502 })

  return NextResponse.json(detail)
}
```

- [ ] **Step 4: POST /api/trials/save**

Create `apps/web/src/app/api/trials/save/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { savedTrials, careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({
  nctId:          z.string().min(1),
  interestStatus: z.enum(['interested', 'applied', 'enrolled', 'dismissed']).default('interested'),
})

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = schema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const [profile] = await db.select({ id: careProfiles.id })
    .from(careProfiles).where(eq(careProfiles.userId, user.id)).limit(1)
  if (!profile) return NextResponse.json({ error: 'No care profile' }, { status: 404 })

  const [row] = await db.insert(savedTrials)
    .values({ careProfileId: profile.id, nctId: body.data.nctId, interestStatus: body.data.interestStatus })
    .onConflictDoUpdate({
      target: [savedTrials.careProfileId, savedTrials.nctId],
      set: { interestStatus: body.data.interestStatus, savedAt: new Date() },
    })
    .returning()

  return NextResponse.json(row)
}
```

- [ ] **Step 5: GET /api/trials/saved and PATCH /api/trials/saved/[nctId]**

Create `apps/web/src/app/api/trials/saved/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { savedTrials, careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile] = await db.select({ id: careProfiles.id })
    .from(careProfiles).where(eq(careProfiles.userId, user.id)).limit(1)
  if (!profile) return NextResponse.json([])

  const rows = await db.select().from(savedTrials)
    .where(eq(savedTrials.careProfileId, profile.id))

  return NextResponse.json(rows)
}
```

Create `apps/web/src/app/api/trials/saved/[nctId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { savedTrials, careProfiles } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({
  interestStatus: z.enum(['interested', 'applied', 'enrolled', 'dismissed']),
})

export async function PATCH(req: NextRequest, { params }: { params: { nctId: string } }) {
  const { user, error } = await getAuthenticatedUser(req)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = schema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const [profile] = await db.select({ id: careProfiles.id })
    .from(careProfiles).where(eq(careProfiles.userId, user.id)).limit(1)
  if (!profile) return NextResponse.json({ error: 'No care profile' }, { status: 404 })

  const [row] = await db.update(savedTrials)
    .set({ interestStatus: body.data.interestStatus })
    .where(and(eq(savedTrials.careProfileId, profile.id), eq(savedTrials.nctId, params.nctId)))
    .returning()

  return NextResponse.json(row ?? { error: 'Not found' })
}
```

- [ ] **Step 6: Typecheck all new routes**

```bash
cd apps/web && npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/trials/
git commit -m "feat(trials): add API routes — matches, match, save, saved, detail"
```

---

## Chunk 8: Cron Jobs + Vercel Config

### Task 8: Two nightly cron routes and vercel.json entries

**Files:**
- Create: `apps/web/src/app/api/cron/trials-match/route.ts`
- Create: `apps/web/src/app/api/cron/trials-status/route.ts`
- Modify: `vercel.json` (root)

- [ ] **Step 1: Create trials-match cron**

Create `apps/web/src/app/api/cron/trials-match/route.ts`:

```ts
/**
 * Cron: Nightly clinical trials matching.
 * Runs at 2am UTC. Processes matchingQueue in batches of 5.
 * Also re-queues failed rows (retryCount < 3) and re-checks close trials for gap closure.
 */
import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import {
  careProfiles, matchingQueue, trialMatches,
  notifications, savedTrials,
} from '@/lib/db/schema'
import { eq, and, isNull, lt, sql, inArray } from 'drizzle-orm'
import {
  enqueueMatchingRun,
  releaseStaleClaimedRows,
  processMatchingQueueForProfile,
} from '@/lib/trials/matchingQueue'
import { assembleProfile } from '@/lib/trials/assembleProfile'
import { runTrialsAgent } from '@/lib/trials/clinicalTrialsAgent'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const BATCH_SIZE  = 5
const TIME_BUDGET = 270_000 // 270s — stop before 300s limit

export async function GET(req: Request) {
  const authError = verifyCronRequest(req)
  if (authError) return authError

  const start = Date.now()
  let processed = 0

  // 1. Release stale claimed rows
  await releaseStaleClaimedRows()

  // 2. Re-queue failed rows with retryCount < 3
  const failed = await db.select({ careProfileId: matchingQueue.careProfileId })
    .from(matchingQueue)
    .where(and(eq(matchingQueue.status, 'failed'), lt(matchingQueue.retryCount, 3)))
  for (const row of failed) {
    await enqueueMatchingRun(row.careProfileId, 'retry')
  }

  // 3. Enqueue all active profiles for nightly run
  const profiles = await db.select({ id: careProfiles.id }).from(careProfiles)
  for (const p of profiles) {
    await enqueueMatchingRun(p.id, 'nightly')
  }

  // 4. Process queue in batches of BATCH_SIZE
  const pending = await db.select({ careProfileId: matchingQueue.careProfileId })
    .from(matchingQueue).where(eq(matchingQueue.status, 'pending'))

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    if (Date.now() - start > TIME_BUDGET) break
    const batch = pending.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(row => processMatchingQueueForProfile(row.careProfileId)))
    processed += batch.length
  }

  // 5. Re-check "close" trials for gap closure using stored gaps + current profile data
  // We check per-profile (not per-trial) to avoid re-running the agent for every individual trial.
  // Group close trials by careProfileId, assemble profile once per patient, then let Claude
  // evaluate whether stored gaps are now resolved against the current profile.
  const closeTrials = await db.select().from(trialMatches).where(eq(trialMatches.matchCategory, 'close'))
  const byProfile = new Map<string, typeof closeTrials>()
  for (const t of closeTrials) {
    byProfile.set(t.careProfileId, [...(byProfile.get(t.careProfileId) ?? []), t])
  }

  for (const [profileId, trials] of byProfile) {
    if (Date.now() - start > TIME_BUDGET) break
    try {
      const profile = await assembleProfile(profileId)
      // Ask Claude: given current profile data, which of these stored gaps are now resolved?
      const { anthropic } = await import('@ai-sdk/anthropic')
      const { generateObject } = await import('ai')
      const { z } = await import('zod')

      const gapCheckPrompt = trials.map(t =>
        `Trial ${t.nctId} "${t.title ?? ''}": gaps = ${JSON.stringify(t.eligibilityGaps)}`
      ).join('\n')

      const { object } = await generateObject({
        model: anthropic('claude-sonnet-4.6'),
        schema: z.object({
          resolved: z.array(z.string()).describe('NCT IDs where all gaps are now resolved based on current profile'),
        }),
        prompt: `Given this patient profile:\n${JSON.stringify(profile, null, 2)}\n\nCheck which trials now have all gaps resolved:\n${gapCheckPrompt}\n\nReturn only NCT IDs where the patient NOW meets all previously blocking criteria.`,
      })

      for (const nctId of object.resolved) {
        const trial = trials.find(t => t.nctId === nctId)
        if (!trial) continue
        await db.update(trialMatches)
          .set({ matchCategory: 'matched', notifiedAt: null, updatedAt: new Date() })
          .where(and(eq(trialMatches.careProfileId, profileId), eq(trialMatches.nctId, nctId)))
        const [cp] = await db.select({ userId: careProfiles.userId })
          .from(careProfiles).where(eq(careProfiles.id, profileId)).limit(1)
        if (cp) {
          await db.insert(notifications).values({
            userId: cp.userId,
            type:    'trial_gap_closed',
            title:   'You now qualify for a trial you were close to',
            message: `Good news — you now qualify for a trial you were close to: ${trial.title ?? 'a clinical trial'}. Open CareCompanion to view.`,
          })
        }
      }
    } catch { /* skip profile, continue */ }
  }

  return NextResponse.json({ ok: true, processed, elapsed: Date.now() - start })
}
```

- [ ] **Step 2: Create trials-status cron**

Create `apps/web/src/app/api/cron/trials-status/route.ts`:

```ts
/**
 * Cron: Nightly trial status monitoring.
 * Runs at 3am UTC. Checks enrollment status of all saved trials.
 * Uses cursor (cronState) to resume across nightly runs if truncated by timeout.
 */
import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import { savedTrials, cronState, notifications, careProfiles } from '@/lib/db/schema'
import { eq, gt, and, ne } from 'drizzle-orm'
import { getTrialDetails } from '@/lib/trials/tools'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const BATCH_SIZE  = 10
const TIME_BUDGET = 270_000
const CURSOR_KEY  = 'trials_status_cursor'

export async function GET(req: Request) {
  const authError = verifyCronRequest(req)
  if (authError) return authError

  const start = Date.now()

  // Load cursor
  const [cursorRow] = await db.select().from(cronState).where(eq(cronState.key, CURSOR_KEY))
  const lastId = cursorRow?.value ?? '00000000-0000-0000-0000-000000000000'

  const rows = await db.select().from(savedTrials)
    .where(and(gt(savedTrials.id, lastId), ne(savedTrials.interestStatus, 'dismissed')))
    .orderBy(savedTrials.id)
    .limit(100) // cap to 100 per run

  let lastProcessedId = lastId
  let checked = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    if (Date.now() - start > TIME_BUDGET) break
    const batch = rows.slice(i, i + BATCH_SIZE)

    await Promise.all(batch.map(async row => {
      try {
        const detail = await getTrialDetails(row.nctId)
        if ('error' in detail) return

        const newStatus = (detail as Record<string, string>).status
        if (newStatus && newStatus !== row.lastKnownEnrollmentStatus) {
          const [cp] = await db.select({ userId: careProfiles.userId })
            .from(careProfiles).where(eq(careProfiles.id, row.careProfileId)).limit(1)
          if (cp) {
            await db.insert(notifications).values({
              userId:  cp.userId,
              type:    'trial_status_change',
              title:   'A saved trial has a status update',
              message: 'A saved trial has a status update. Open CareCompanion to view details.',
            })
          }
          await db.update(savedTrials)
            .set({ lastKnownEnrollmentStatus: newStatus, lastStatusCheckedAt: new Date(), notifiedOfChangeAt: new Date() })
            .where(eq(savedTrials.id, row.id))
        } else {
          await db.update(savedTrials)
            .set({ lastStatusCheckedAt: new Date() })
            .where(eq(savedTrials.id, row.id))
        }
      } catch { /* skip */ }
    }))

    lastProcessedId = batch[batch.length - 1].id
    checked += batch.length
  }

  // If we processed all rows, reset cursor; otherwise save progress
  const ranToEnd = checked === rows.length
  await db.insert(cronState)
    .values({ key: CURSOR_KEY, value: ranToEnd ? '00000000-0000-0000-0000-000000000000' : lastProcessedId })
    .onConflictDoUpdate({ target: cronState.key, set: { value: ranToEnd ? '00000000-0000-0000-0000-000000000000' : lastProcessedId, updatedAt: new Date() } })

  return NextResponse.json({ ok: true, checked, elapsed: Date.now() - start })
}
```

- [ ] **Step 3: Add cron entries to vercel.json**

In `/Users/aryanmotgi/carecompanion/vercel.json`, add to the `crons` array:

```json
{ "path": "/api/cron/trials-match", "schedule": "0 2 * * *" },
{ "path": "/api/cron/trials-status", "schedule": "0 3 * * *" }
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && npm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/cron/trials-match/ apps/web/src/app/api/cron/trials-status/ vercel.json
git commit -m "feat(trials): add nightly matching and trial status monitoring cron jobs"
```

---

## Chunk 9: Trigger Integration

### Task 9: Fire queue insert after careProfile, medication, and lab writes

**Files:**
- Modify: `apps/web/src/app/api/care-profiles/route.ts`
- Modify: `apps/web/src/app/api/records/medications/route.ts` (or equivalent medications write route)
- Modify: `apps/web/src/app/api/labs/route.ts` (or equivalent lab write route)

- [ ] **Step 1: Add trigger to medications route**

File: `apps/web/src/app/api/records/medications/route.ts`

Add import at top:
```ts
import { enqueueMatchingRun, processMatchingQueueForProfile } from '@/lib/trials/matchingQueue'
```

After the `db.insert(medications).values({ careProfileId: profileId, ... })` call (around line 46) and after the bulk insert (`db.insert(medications).values(rows).returning()` around line 163), add immediately after each successful write — before the return statement:

```ts
void enqueueMatchingRun(profileId, 'new_medication').then(() =>
  void processMatchingQueueForProfile(profileId)
)
```

Note: `profileId` is already defined earlier in each handler from the care profile lookup. The `void` prefix fires it without awaiting — the HTTP response is not delayed.

- [ ] **Step 2: Add trigger to lab results route**

File: `apps/web/src/app/api/save-scan-results/route.ts`

Add the same import. After `await db.insert(labResults).values(rows)` (around line 120), insert:

```ts
void enqueueMatchingRun(profile.id, 'new_lab').then(() =>
  void processMatchingQueueForProfile(profile.id)
)
```

`profile.id` is already available from the profile lookup earlier in the handler.

- [ ] **Step 3: Add trigger to care-profiles update route**

Run this to find the PATCH/PUT handler:
```bash
grep -n "db.update.*careProfiles\|set.*cancerType\|set.*cancerStage" apps/web/src/app/api/care-profiles/route.ts | head -10
```

After the successful `db.update(careProfiles).set(...)` call, add:

```ts
void enqueueMatchingRun(profileId, 'profile_update').then(() =>
  void processMatchingQueueForProfile(profileId)
)
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/care-profiles/ apps/web/src/app/api/records/ apps/web/src/app/api/labs/
git commit -m "feat(trials): trigger immediate matching on medication, lab, and profile updates"
```

---

## Chunk 10: UI

### Task 10: Trials UI — dashboard card, full tab, match cards

**Files:**
- Create all components listed in the File Map above.

- [ ] **Step 1: Create TrialMatchCard.tsx**

Create `apps/web/src/components/trials/TrialMatchCard.tsx`:

```tsx
'use client'

type Props = {
  nctId:                string
  title:                string
  matchScore:           number
  matchReasons:         string[]
  disqualifyingFactors: string[]
  uncertainFactors:     string[]
  phase:                string | null
  enrollmentStatus:     string | null
  locations:            Array<{ city: string; state: string; country: string }> | null
  trialUrl:             string | null
  stale?:               boolean
  onSave:    (nctId: string) => void
  onDismiss: (nctId: string) => void
  onShare:   (nctId: string, title: string, url: string) => void
  onContact: (nctId: string) => void
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-100 text-green-800'
    : score >= 60 ? 'bg-blue-100 text-blue-800'
    : 'bg-yellow-100 text-yellow-800'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {score}% match
    </span>
  )
}

export function TrialMatchCard(props: Props) {
  const nearestSite = props.locations?.[0]

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <a href={props.trialUrl ?? '#'} target="_blank" rel="noopener noreferrer"
            className="text-sm font-medium text-blue-700 hover:underline line-clamp-2">
            {props.title}
          </a>
          <p className="text-xs text-gray-500 mt-0.5">{props.nctId} · {props.phase ?? 'Phase N/A'}</p>
        </div>
        <ScoreBadge score={props.matchScore} />
      </div>

      {props.stale && (
        <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
          Last matched {new Date().toLocaleDateString()} — re-run to refresh
        </p>
      )}

      {props.matchReasons.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">Why you match</p>
          <ul className="space-y-0.5">
            {props.matchReasons.map((r, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                <span className="text-green-500 flex-shrink-0">✓</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {props.disqualifyingFactors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">Potential concerns</p>
          <ul className="space-y-0.5">
            {props.disqualifyingFactors.map((f, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                <span className="text-red-400 flex-shrink-0">✗</span>{f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {props.uncertainFactors.length > 0 && (
        <div>
          {props.uncertainFactors.map((u, i) => (
            <p key={i} className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">{u}</p>
          ))}
        </div>
      )}

      {nearestSite && (
        <p className="text-xs text-gray-500">
          📍 {nearestSite.city}, {nearestSite.state}
          {props.enrollmentStatus === 'RECRUITING' && (
            <span className="ml-2 text-green-600 font-medium">· Currently recruiting</span>
          )}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={() => props.onSave(props.nctId)}
          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
          Save
        </button>
        <button onClick={() => props.onContact(props.nctId)}
          className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
          Contact
        </button>
        <button onClick={() => props.onShare(props.nctId, props.title, props.trialUrl ?? '')}
          className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
          Share
        </button>
        <button onClick={() => props.onDismiss(props.nctId)}
          className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700 ml-auto">
          Dismiss
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create CloseMatchCard.tsx**

Create `apps/web/src/components/trials/CloseMatchCard.tsx`:

```tsx
'use client'
import type { EligibilityGap } from '@/lib/trials/assembleProfile'

type Props = {
  nctId:           string
  title:           string
  trialUrl:        string | null
  eligibilityGaps: EligibilityGap[]
  phase:           string | null
  onSave:    (nctId: string) => void
  onDismiss: (nctId: string) => void
}

function GapLabel({ type }: { type: EligibilityGap['gapType'] }) {
  const labels: Record<string, string> = {
    measurable:  'Lab value to reach',
    conditional: 'Condition to meet',
  }
  return (
    <span className="text-xs font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
      {labels[type] ?? type}
    </span>
  )
}

export function CloseMatchCard(props: Props) {
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <a href={props.trialUrl ?? '#'} target="_blank" rel="noopener noreferrer"
            className="text-sm font-medium text-blue-700 hover:underline line-clamp-2">
            {props.title}
          </a>
          <p className="text-xs text-gray-500 mt-0.5">{props.nctId} · {props.phase ?? 'Phase N/A'}</p>
        </div>
        <span className="text-xs text-purple-700 bg-purple-100 px-2 py-0.5 rounded font-medium flex-shrink-0">
          Close match
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-700">What's blocking eligibility</p>
        {props.eligibilityGaps.map((gap, i) => (
          <div key={i} className="bg-white border border-purple-100 rounded p-2.5 space-y-1">
            <GapLabel type={gap.gapType} />
            <p className="text-xs text-gray-700 mt-1">{gap.description}</p>
            {!gap.verifiable && (
              <p className="text-xs text-amber-600 italic">
                We can't verify this automatically — ask your care team
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={() => props.onSave(props.nctId)}
          className="text-xs px-3 py-1.5 border border-purple-300 text-purple-700 rounded hover:bg-purple-50">
          Watch this trial
        </button>
        <button onClick={() => props.onDismiss(props.nctId)}
          className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700 ml-auto">
          Dismiss
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create ZipCodePrompt.tsx**

Create `apps/web/src/components/trials/ZipCodePrompt.tsx`:

```tsx
export function ZipCodePrompt() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-sm text-amber-800">
        Add your zip code to find trials near you — distance matching is unavailable without it.
      </p>
      <a href="/settings" className="text-sm font-medium text-amber-900 underline flex-shrink-0">
        Go to Settings →
      </a>
    </div>
  )
}
```

- [ ] **Step 4: Create TrialsTab.tsx**

Create `apps/web/src/components/trials/TrialsTab.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { TrialMatchCard } from './TrialMatchCard'
import { CloseMatchCard } from './CloseMatchCard'
import { ZipCodePrompt } from './ZipCodePrompt'

type TrialMatch = {
  nctId: string; title: string; matchScore: number; matchCategory: string
  matchReasons: string[]; disqualifyingFactors: string[]; uncertainFactors: string[]
  eligibilityGaps: unknown[] | null; phase: string | null; enrollmentStatus: string | null
  locations: Array<{ city: string; state: string; country: string }> | null
  trialUrl: string | null; stale: boolean
}

export function TrialsTab({ hasZip }: { hasZip: boolean }) {
  const [matched, setMatched]     = useState<TrialMatch[]>([])
  const [close, setClose]         = useState<TrialMatch[]>([])
  const [loading, setLoading]     = useState(true)
  const [liveRunning, setLiveRunning] = useState(false)

  useEffect(() => {
    fetch('/api/trials/matches')
      .then(r => r.json())
      .then(data => { setMatched(data.matched ?? []); setClose(data.close ?? []) })
      .finally(() => setLoading(false))
  }, [])

  async function runLive() {
    setLiveRunning(true)
    const data = await fetch('/api/trials/match', { method: 'POST' }).then(r => r.json())
    setMatched(data.matched ?? [])
    setClose(data.close ?? [])
    setLiveRunning(false)
  }

  async function saveTrialAction(nctId: string) {
    await fetch('/api/trials/save', { method: 'POST', body: JSON.stringify({ nctId }), headers: { 'Content-Type': 'application/json' } })
  }

  async function dismissTrial(nctId: string) {
    await fetch(`/api/trials/saved/${nctId}`, { method: 'PATCH', body: JSON.stringify({ interestStatus: 'dismissed' }), headers: { 'Content-Type': 'application/json' } })
    setMatched(m => m.filter(t => t.nctId !== nctId))
    setClose(c => c.filter(t => t.nctId !== nctId))
  }

  function shareTrialAction(nctId: string, title: string, url: string) {
    const text = encodeURIComponent(`I found this trial, can we discuss? ${url}`)
    window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${text}`)
  }

  async function contactTrial(nctId: string) {
    const detail = await fetch(`/api/trials/${nctId}`).then(r => r.json())
    const loc = detail?.locations?.[0]
    const contact = loc?.contacts?.[0]
    if (contact?.email) window.open(`mailto:${contact.email}`)
    else if (contact?.phone) window.open(`tel:${contact.phone}`)
  }

  if (loading) return <div className="py-12 text-center text-sm text-gray-500">Loading trial matches…</div>

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-6 px-4">
      {!hasZip && <ZipCodePrompt />}

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Clinical Trials</h1>
        <button onClick={runLive} disabled={liveRunning}
          className="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {liveRunning ? 'Searching…' : 'Find trials now'}
        </button>
      </div>

      {matched.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Matched Trials</h2>
          {matched.map(t => (
            <TrialMatchCard key={t.nctId} {...t}
              onSave={saveTrialAction}
              onDismiss={dismissTrial}
              onShare={shareTrialAction}
              onContact={contactTrial}
            />
          ))}
        </section>
      )}

      {close.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Trials You're Close To</h2>
          <p className="text-xs text-gray-500">These trials have specific gaps — we'll notify you if you become eligible.</p>
          {close.map(t => (
            <CloseMatchCard key={t.nctId} {...t}
              eligibilityGaps={(t.eligibilityGaps as unknown[]) ?? []}
              onSave={saveTrialAction}
              onDismiss={dismissTrial}
            />
          ))}
        </section>
      )}

      {matched.length === 0 && close.length === 0 && !loading && (
        <div className="py-12 text-center text-sm text-gray-500">
          No trial matches found yet. Click "Find trials now" to search, or check back after your next appointment.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create /trials page route**

Create `apps/web/src/app/(app)/trials/page.tsx`:

```tsx
import { TrialsTab } from '@/components/trials/TrialsTab'
import { db } from '@/lib/db'
import { careProfiles } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export default async function TrialsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const [profile] = await db.select({ zipCode: careProfiles.zipCode })
    .from(careProfiles).where(eq(careProfiles.userId, session.user.id)).limit(1)

  const hasZip = /^\d{5}$/.test(profile?.zipCode ?? '')

  return <TrialsTab hasZip={hasZip} />
}
```

- [ ] **Step 6: Create TrialsDashboardCard.tsx**

Create `apps/web/src/components/trials/TrialsDashboardCard.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export function TrialsDashboardCard() {
  const [matchedCount, setMatchedCount] = useState<number | null>(null)
  const [closeCount, setCloseCount]     = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/trials/matches?limit=100')
      .then(r => r.json())
      .then(data => {
        setMatchedCount((data.matched ?? []).length)
        setCloseCount((data.close ?? []).length)
      })
      .catch(() => {})
  }, [])

  if (matchedCount === null) return null
  if (matchedCount === 0 && closeCount === 0) return null

  return (
    <Link href="/trials" className="block rounded-lg border border-blue-200 bg-blue-50 p-4 hover:bg-blue-100 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-900">Clinical Trials</p>
          <p className="text-xs text-blue-700 mt-0.5">
            {matchedCount > 0 && `${matchedCount} match${matchedCount !== 1 ? 'es' : ''}`}
            {matchedCount > 0 && closeCount! > 0 && ' · '}
            {closeCount! > 0 && `${closeCount} close`}
          </p>
        </div>
        <span className="text-blue-600 text-lg">→</span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 7: Add TrialsDashboardCard to the main dashboard page**

In the main dashboard page (find it with `find apps/web/src/app -name "page.tsx" -path "*dashboard*" | head -3`), import and render `<TrialsDashboardCard />` alongside other dashboard cards.

- [ ] **Step 8: Typecheck**

```bash
cd apps/web && npm run typecheck
```

Expected: No errors.

- [ ] **Step 9: Run full test suite**

```bash
cd apps/web && npm run test:run
```

Expected: All existing tests still pass. New tests pass.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/trials/ apps/web/src/app/
git commit -m "feat(trials): add UI — TrialsTab, TrialMatchCard, CloseMatchCard, ZipCodePrompt, TrialsDashboardCard"
```

---

## Final Verification

- [ ] **Run full typecheck**

```bash
cd apps/web && npm run typecheck
```

Expected: Zero errors.

- [ ] **Run full test suite**

```bash
cd apps/web && npm run test:run
```

Expected: All tests pass.

- [ ] **Run lint**

```bash
cd apps/web && npm run lint
```

Expected: No new lint errors.

- [ ] **Smoke test the /trials route**

Start dev server (`bun dev` from root) and open `/trials`. Verify:
- Page loads without error
- "Find trials now" button fires a POST to `/api/trials/match` 
- Zip code prompt appears if profile has no zip
- Dashboard card appears after matches are fetched
