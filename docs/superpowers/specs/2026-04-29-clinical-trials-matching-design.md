# Clinical Trials Matching — Design Spec
**Date:** 2026-04-29  
**Status:** Under review (v3)

---

## 1. Overview

Integrate clinical trial matching natively into CareCompanion using the matching logic from the ClinicalTrialsMatching repo. The approach lifts the MCP tool definitions (ClinicalTrials.gov API wiring) and adds them to CareCompanion's existing Claude agent system — no separate service.

CareCompanion's unique advantage: we already have the full patient profile (cancer type, stage, mutations, medications, lab results, treatment history, age, location). We use this to pre-populate searches and score eligibility far more accurately than any standalone tool that must ask the patient conversationally.

**Two matching modes:**
- **Background (automated):** Nightly cron pre-fetches matches for all active patients, stores results, notifies on new matches or gap closures
- **Real-time (conversational):** Patient asks "find me trials" in chat — Clinical Trials Coordinator agent runs live

**Three result categories surfaced to the user:**
1. **Matched Trials** — patient qualifies now (matchScore ≥ 40, no blocking gaps)
2. **Trials You're Close To** — patient has only measurable or conditional gaps (not fixed)
3. **Excluded** — hard filter failure (wrong age, wrong cancer type) — never surfaced

**Scope (Phase 1, web only, US patients):** Mobile, PDF export, enrollment submission, insurance check, vector search, international patients — out of scope.

---

## 2. Architecture

```
Patient Health Data (DB)
  cancer_type, stage, mutations (with confidence), medications,
  lab results (with numeric values), treatment cycles (prior lines), age, zip_code
         ↓
  assembleProfile.ts  →  PatientProfile struct
         ↓
  Clinical Trials Coordinator Agent (7th specialist)
    ↓ search_trials / search_by_eligibility (max page_size=20 per call)
  ClinicalTrials.gov API v2
    ↓ get_trial_details (for top 20 results)
  Claude scores + gap-analyses each trial (rubric-guided, holistic)
    → matchCategory: "matched" | "close" | "excluded"
    → matchScore (0–100)
    → matchReasons[], disqualifyingFactors[], uncertainFactors[]
    → eligibilityGaps[] (for "close" trials only)
         ↓
  trialMatches table  (upsert on careProfileId+nctId)
         ↓
  ┌──────────────────┬───────────────────────────┐
  ↓                  ↓                           ↓
Dashboard         Matched Trials tab        Close Trials tab
"3 matches,       sorted by score           "Trials You're Close To"
 2 close"         desc                      with plain-language gap text
                                                 ↓
                                    Nightly cron re-checks gaps
                                    → notify when gap closes
```

---

## 3. Database Schema

All FKs: `ON DELETE CASCADE`. All timestamps: `withTimezone: true`.

### 3a. Add to `careProfiles`
```ts
city:    text('city')
state:   text('state')
zipCode: text('zip_code')   // validated /^\d{5}$/ on write; US-only Phase 1
```

### 3b. New `mutations` table
```ts
mutations {
  id:             uuid PK defaultRandom()
  careProfileId:  uuid FK → careProfiles ON DELETE CASCADE
  mutationName:   text NOT NULL
  status:         text NOT NULL  CHECK IN ('positive','negative','unknown')
  confirmedDate:  date (nullable)
  source:         text NOT NULL  CHECK IN ('lab_report','fhir','manual')
  createdAt:      timestamp defaultNow()
}
Index: (careProfileId)
```

### 3c. New `trialMatches` table
```ts
trialMatches {
  id:                   uuid PK defaultRandom()
  careProfileId:        uuid FK → careProfiles ON DELETE CASCADE
  nctId:                text NOT NULL
  title:                text
  matchCategory:        text NOT NULL  CHECK IN ('matched','close','excluded')
  matchScore:           integer        CHECK (matchScore BETWEEN 0 AND 100)
  matchReasons:         text[]
  disqualifyingFactors: text[]
  uncertainFactors:     text[]
  eligibilityGaps:      jsonb          -- array of EligibilityGap objects (see §5)
  enrollmentStatus:     text
  locations:            jsonb          -- {facility, city, state, country, enrollmentStatus}[]
  trialUrl:             text
  notifiedAt:           timestamp (nullable)
  lastCheckedAt:        timestamp
  createdAt:            timestamp defaultNow()
  updatedAt:            timestamp defaultNow()
}
Unique: (careProfileId, nctId)
Indexes: (careProfileId), (matchCategory), (notifiedAt) WHERE notifiedAt IS NULL, (updatedAt)
```

`locations` JSONB: facility name, city, state, country, enrollment status only. No coordinator contacts stored at rest.

### 3d. New `savedTrials` table
```ts
savedTrials {
  id:                        uuid PK defaultRandom()
  careProfileId:             uuid FK → careProfiles ON DELETE CASCADE
  nctId:                     text NOT NULL
  savedAt:                   timestamp defaultNow()
  interestStatus:            text NOT NULL DEFAULT 'interested'
                             CHECK IN ('interested','applied','enrolled','dismissed')
  lastKnownEnrollmentStatus: text
  lastStatusCheckedAt:       timestamp (nullable)
  notifiedOfChangeAt:        timestamp (nullable)
}
Unique: (careProfileId, nctId)
Index: (careProfileId), (lastStatusCheckedAt)
```

`savedTrials.nctId` is standalone — no FK to `trialMatches`. A trial saved via chat may not have a `trialMatches` row.

### 3e. New `matchingQueue` table
```ts
matchingQueue {
  id:            uuid PK defaultRandom()
  careProfileId: uuid FK → careProfiles ON DELETE CASCADE
  reason:        text NOT NULL  CHECK IN ('profile_update','new_medication','new_lab','nightly','retry')
  status:        text NOT NULL DEFAULT 'pending'
                 CHECK IN ('pending','claimed','completed','failed')
  triggeredAt:   timestamp defaultNow()
  claimedAt:     timestamp (nullable)
  processedAt:   timestamp (nullable)
  errorMessage:  text (nullable)
  retryCount:    integer NOT NULL DEFAULT 0
}
```

**Deduplication:** `INSERT ... ON CONFLICT DO NOTHING` on partial unique index:
```sql
CREATE UNIQUE INDEX matching_queue_one_pending_per_patient
ON matching_queue (care_profile_id)
WHERE status IN ('pending', 'claimed');
```
One active row per patient at all times. Rapid successive updates (5 meds added in 30s) → exactly 1 pending row.

**Stale claim recovery:** Cron startup step: `UPDATE matching_queue SET status='pending', claimed_at=NULL WHERE status='claimed' AND claimed_at < now() - interval '10 minutes'`. Releases orphaned claims from crashed workers before processing begins.

**Retry logic:** On failure, set `status='failed'`, increment `retryCount`, store `errorMessage`. Nightly cron re-queues rows where `status='failed' AND retryCount < 3` by inserting a new row with `reason='retry'` (old failed row stays for audit). After 3 failures, row stays `failed` permanently — no silent discard.

### 3f. Status monitoring overflow

`savedTrials` does not get `processedAt`/`errorAt` columns — it's a user-facing record, not a job queue. Instead, the status monitoring cron tracks its own progress via a lightweight `statusCheckCursor` in the existing app settings or a `cronState` key-value store (e.g., a single-row `cronState` table):

```ts
cronState {
  key:       text PK   -- e.g. 'trials_status_last_checked_id'
  value:     text
  updatedAt: timestamp
}
```

The cron stores the last processed `savedTrials.id` cursor and resumes from there on the next nightly run. No saved trial is permanently skipped.

---

## 4. Patient Profile Assembly

**File:** `apps/web/src/lib/trials/assembleProfile.ts`

```ts
type LabResult = {
  testName:       string
  numericValue:   number | null    // null if result is not numeric (e.g. "positive")
  unit:           string | null
  resultDate:     string
  isAbnormal:     boolean
}

type PatientProfile = {
  cancerType:          string
  cancerStage:         string
  age:                 number
  zipCode:             string | null   // null → UI prompt, matching runs without location filter
  city:                string
  state:               string
  mutations: Array<{
    name:        string
    status:      'positive' | 'negative' | 'unknown'
    source:      'lab_report' | 'fhir' | 'manual'
    confidence:  'high' | 'medium' | 'low'
  }>
  currentMedications:  string[]
  labResults:          LabResult[]     // all results, for gap analysis
  priorTreatmentLines: Array<{
    regimen:    string               // treatmentCycles.regimenName
    startDate:  string               // treatmentCycles.startDate
    cycleCount: number               // MAX(cycleNumber) WHERE careProfileId = ? AND regimenName = ? AND isActive = false
  }>
  activeTreatment: {
    regimen:     string
    startDate:   string
    cycleNumber: number
  } | null
  conditions:   string
  allergies:    string
}
```

**Mutation confidence:** `lab_report` → `high`, `fhir` → `medium`, `manual` → `low`.

**Prior treatment assembly:** `SELECT regimen_name, start_date, MAX(cycle_number) as cycle_count FROM treatment_cycles WHERE care_profile_id = ? AND is_active = false GROUP BY regimen_name, start_date ORDER BY start_date`.

**Lab results:** Pull all `labResults` rows for the careProfile, extracting `name`, `value` (attempt `parseFloat`; if NaN set `numericValue: null`), `unit`, `date`, `isAbnormal`. Missing or non-numeric values are flagged `numericValue: null` — Claude marks these gaps as `"unverifiable"`.

**Zip validation:** `/^\d{5}$/`. Invalid or null → `zipCode: null`. Matching runs without location filter; results shown with note "Add your zip code for distance-sorted results."

---

## 5. Eligibility Gap Tracking

This is the core differentiator. When a patient does not fully qualify for a trial, Claude analyzes the gap and categorizes it.

### Gap Categories

| Category | Definition | Surfaced to user? |
|---|---|---|
| `measurable` | A specific numeric threshold (lab value, treatment count) | Yes — "Trials You're Close To" |
| `conditional` | A medication must stop or a treatment must complete | Yes — "Trials You're Close To" |
| `fixed` | Age, cancer type — cannot change | No — trial excluded entirely |

Only trials where ALL gaps are `measurable` or `conditional` (none `fixed`) appear in "Trials You're Close To".

### EligibilityGap type

```ts
type EligibilityGap = {
  gapType:         'measurable' | 'conditional' | 'fixed'
  description:     string          // plain English: "Your hemoglobin needs to reach 10 g/dL (last: 9.2 g/dL)"
  metric:          string | null   // e.g. "hemoglobin", "prior lines of therapy", null if not applicable
  currentValue:    string | null   // e.g. "9.2", "1", null if unverifiable
  requiredValue:   string | null   // e.g. "10", "2"
  unit:            string | null   // e.g. "g/dL", null if not applicable
  verifiable:      boolean         // false if lab data missing or non-numeric
  closureSignal:   string | null   // what to watch: "labResults.hemoglobin", "treatmentCycles.count", "medications.name"
                                   // used by nightly cron to detect gap closure
}
```

**Gap examples Claude should produce:**

- Measurable lab: `"Your hemoglobin needs to reach 10 g/dL — your last result was 9.2 g/dL (Jan 15)"`
- Measurable treatment: `"This trial requires 2 completed prior lines of therapy — your history shows 1"`
- Conditional medication: `"This trial requires no prior EGFR treatment — currently blocked by Osimertinib in your medication list"`
- Unverifiable: `"This trial requires a specific ECOG performance score — we don't have this on file. Ask your care team."`

**Uncertainty rule:** If Claude is uncertain about a gap, it must say so explicitly in `description` and set `verifiable: false`. Never guess.

### Gap closure detection (nightly cron)

For each `trialMatches` row where `matchCategory = 'close'`:
1. Re-assemble current patient profile
2. Pass current profile + stored `eligibilityGaps[]` to Claude
3. Claude checks: is this gap now closed based on current data?
4. If all gaps resolved → update `matchCategory = 'matched'`, set `notifiedAt = null` (re-notify), insert notification: `"Good news — you now qualify for a trial you were close to: [title]. Open CareCompanion to view."`

Notification body for gap closure is the one case where the trial title is included — it is motivating and not sensitive clinical information. All other notifications remain generic.

### `trialMatches` stores gap data

The `eligibilityGaps` JSONB column on `trialMatches` holds the full `EligibilityGap[]` array. For `matchCategory = 'matched'`, this is `[]`. For `matchCategory = 'close'`, it contains 1+ gaps. For `matchCategory = 'excluded'`, it is `null` (row not written at all — excluded trials are not stored).

---

## 6. Scoring Rubric

Claude applies this rubric holistically — `matchScore` (0–100) is Claude-assigned, not a deterministic formula. The rubric is injected into the Clinical Trials Coordinator's system prompt.

**Token / trial count cap:** Claude scores at most 20 trials per patient per run (`page_size=20` on `search_trials`). This bounds context size and prevents overflow. Common cancer types (NSCLC, breast) may return many results — 20 is sufficient for quality matches.

### Hard Filters — trial not stored if failed
| Criterion | Logic |
|---|---|
| Age | Patient age outside trial min/max age → `matchCategory = 'excluded'`, not stored |
| Cancer type | No overlap with trial conditions → `matchCategory = 'excluded'`, not stored |
| Fixed gap | Any gap Claude categorizes as `fixed` → `matchCategory = 'excluded'`, not stored |

### Scored Criteria
| Criterion | Guidance to Claude | Notes |
|---|---|---|
| Cancer stage match | Strong signal | Mismatch → disqualifyingFactor or measurable gap |
| Eligibility criteria met | Strong signal | Claude reads full eligibility text vs profile |
| Mutation/biomarker | Strong signal, confidence-weighted | `high`: full weight. `medium`: note uncertainty. `low`: flag manual entry |
| Negative mutation as exclusion | Strong signal | If patient has it and trial excludes it → conditional gap or disqualifier |
| Prior treatment history | Strong signal | Check inclusion/exclusion criteria against `priorTreatmentLines` |
| Lab values | Strong signal for gaps | Compare numeric lab values to trial thresholds → measurable gaps |
| Medication conflicts | Medium signal | Trial exclusion vs `currentMedications` → conditional gaps |
| Distance from zip | Medium signal | ClinicalTrials.gov radius filter handles this server-side |
| Trial phase | Soft signal | Phase 3 preferred; Phase 1 flagged |

### matchScore cutoff
- `matchCategory = 'matched'` AND `matchScore < 40` → do not surface. Trial stored but filtered in UI.
- `matchCategory = 'close'` → always surfaced in "Trials You're Close To" regardless of score (gap quality matters more than score).

---

## 7. Claude Tools

**File:** `apps/web/src/lib/trials/tools.ts`

1. `search_trials(condition, terms?, location?, status?, phase?, page_size=20)`
2. `get_trial_details(nct_id)` — full protocol, fetched live
3. `search_by_eligibility(condition, terms?, age?, sex?, location?)`

Base URL: `https://clinicaltrials.gov/api/v2`. Timeout: 15s. Location filter: `distance=50mi:{zipCode}` when zip is present.

**Rate limit handling:** On 429 → exponential backoff: 2s, 4s, 8s (3 retries). On persistent 429 → mark queue row `status='failed'`, `errorMessage='rate_limited'`, continue to next patient.

**Claude API failure:** If Claude fails mid-run (rate limit, context overflow) → mark queue row `status='failed'`, store error, nightly retry picks it up. Cron does not abort — continues to next patient.

---

## 8. Agent Routing

Add Clinical Trials Coordinator as 7th specialist in `agents/orchestrator.ts`. Trigger phrases added to routing rules: `"trial"`, `"clinical trial"`, `"study"`, `"research study"`, `"enroll"`, `"find me trials"`, `"am I eligible"`, `"close to qualifying"`.

Agent receives assembled `PatientProfile` injected into system context — patient does not re-state their diagnosis.

For background matching (cron), agent is called directly, bypassing orchestrator.

---

## 9. API Endpoints

All require existing session auth middleware.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/trials/matches` | Fetch stored matches. Params: `page`, `limit=20`, `category` (`matched`\|`close`\|`all`). Returns rows with `stale: true` flag when `updatedAt < 90 days ago` — does NOT exclude them (UI handles display). |
| `POST` | `/api/trials/match` | Live match run. Applies same `matchScore < 40` filter as nightly cron. Returns top 20 scored trials split into `matched[]` and `close[]`. |
| `GET` | `/api/trials/[nctId]` | Fetch full trial detail live. Returns coordinator contacts (not stored at rest). |
| `POST` | `/api/trials/save` | Body: `{ nctId, interestStatus }`. Upserts `savedTrials`. |
| `PATCH` | `/api/trials/saved/[nctId]` | Update `interestStatus`. |
| `GET` | `/api/trials/saved` | List saved trials for current careProfile. |

`processMatchingQueueForProfile(careProfileId)` is an internal async function — not an HTTP endpoint. Called inline (fire-and-forget) from mutation handlers after DB writes.

---

## 10. Automation

### Cron Job 1: Nightly Patient Matching
**Schedule:** `0 2 * * *` | **Route:** `/api/cron/trials-match` | **Timeout:** 300s (Vercel Pro)

```
vercel.json:
{ "crons": [
  { "path": "/api/cron/trials-match", "schedule": "0 2 * * *" },
  { "path": "/api/cron/trials-status", "schedule": "0 3 * * *" }
]}
```

**Startup:** Release stale claimed rows (`claimed_at < now() - 10min`).

**Processing:** Batches of 5 patients. For each:
1. Claim queue row atomically via `UPDATE ... WHERE status='pending' RETURNING id` — skip if 0 rows
2. Assemble profile
3. Claude scores ≤20 trials, categorizes matched/close/excluded
4. Upsert `trialMatches` (on conflict `careProfileId+nctId` → update all fields + `updatedAt`)
5. Check for gap closures on existing `close` rows → upgrade to `matched` if resolved
6. Insert notifications for new matches and gap closures (in same DB transaction as `notifiedAt` update)
7. Mark queue row `status='completed'`

**Overflow:** If 270s elapsed, stop batch loop. Remaining patients stay in queue with `status='pending'` — picked up next nightly run.

**Re-queue failed rows:** Before normal processing, insert `reason='retry'` rows for `status='failed' AND retryCount < 3` patients.

### Cron Job 2: Trial Status Monitoring
**Schedule:** `0 3 * * *` | **Route:** `/api/cron/trials-status`

Uses `cronState` table with key `trials_status_cursor` to resume from last processed `savedTrials.id`.

**Batch:** 10 saved trials per batch. Each `get_trial_details` call: 15s max → ~150s per batch, within 300s limit. After each batch, persist cursor. If time budget exceeded, stop — resumes next night.

For each saved trial:
1. Call `get_trial_details(nctId)` 
2. Compare enrollment status to `lastKnownEnrollmentStatus`
3. On change → insert notification (generic: "A saved trial has a status update. Open CareCompanion to view.")
4. Update `lastKnownEnrollmentStatus`, `lastStatusCheckedAt`, `notifiedOfChangeAt`

**Error handling:** Tool failure for one trial → log, skip, continue. Do not abort batch.

### Trigger-based Matching
Fires after: `careProfiles` update, `medications` insert/delete, `labResults` insert.

```ts
// After DB write (fire-and-forget, does not block response):
await db.insert(matchingQueue)
  .values({ careProfileId, reason: 'profile_update', status: 'pending' })
  .onConflictDoNothing()  // partial unique index: one pending per patient

processMatchingQueueForProfile(careProfileId)  // void, runs async
```

### Notification body rules
| Event | Body |
|---|---|
| New matched trial | "New trial matches are available. Open CareCompanion to view." |
| New close trial | "You're close to qualifying for new trials. Open CareCompanion to see what's changed." |
| Gap closed → now qualifies | "Good news — you now qualify for a trial you were close to: [trial title]. Open CareCompanion to view." |
| Trial status change | "A saved trial has a status update. Open CareCompanion to view." |

Gap-closure notifications include trial title (motivating, not sensitive). All others are generic.

Uses existing `notifications` table (schema: `userId, type, title, message, isRead, createdAt` — confirmed present in schema.ts).

---

## 11. Action Layer

| Action | Implementation |
|---|---|
| Save / Interested | `POST /api/trials/save` → upsert `savedTrials` |
| Contact Coordinator | `GET /api/trials/[nctId]` → live contacts → mailto/tel link. Not stored at rest. |
| Share with Oncologist | Pre-fills existing message flow: "I found this trial, can we discuss? [trialUrl]" |
| Dismiss | `PATCH /api/trials/saved/[nctId]` → `interestStatus = 'dismissed'` → excluded from notifications |

---

## 12. UI

### Dashboard Card
- "X matches, Y close" badge
- Top 1 match preview (score + one reason)
- Top 1 close preview (gap description)
- Link to Trials tab

### Trials Tab (`/trials`) — two sections

**Matched Trials**
- Sorted by `matchScore` desc
- Stale rows (`stale: true` from API) shown with "Last matched [date] — re-run to refresh" banner
- Cards: title, score badge, matchReasons, disqualifyingFactors, uncertainFactors, phase, nearest site
- Mutation manual-entry note where applicable
- Actions: Save, Contact, Share, Dismiss

**Trials You're Close To**
- Each card shows gaps in plain language (from `eligibilityGaps[].description`)
- Gap type label: "Lab value to reach" / "Medication to stop" / "Treatment to complete"
- Unverifiable gaps shown with: "We can't verify this automatically — ask your care team"
- Actions: Save (to watch), Dismiss

### Score Badge Colors
- ≥80: green | 60–79: blue | 40–59: yellow | <40: not shown

### Zip Code Prompt
- Banner if `zipCode` null/invalid: "Add your zip code to find trials near you → [Settings]"
- Non-blocking — matching still runs, distance not shown

### Trial Detail
- Full eligibility criteria (Claude-simplified)
- All locations (from ClinicalTrials.gov, city/state only — no exact mileage)
- Eligibility gaps (if close match)
- Primary outcomes
- Live coordinator contact (fetched on demand)
- Link to ClinicalTrials.gov

---

## 13. Distance Calculation

ClinicalTrials.gov API v2 accepts `distance=50mi:{zipCode}` — radius filtering is server-side. No geocoding API needed. Nearest site shown as city/state. Exact mileage not displayed (Phase 1).

---

## 14. Out of Scope (Phase 1)

Mobile app, PDF export, trial enrollment submission, insurance coverage check, vector/semantic search, international patients, exact mileage display, coordinator contact storage, ECOG score capture.
