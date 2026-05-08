# HealthKit "Replace or Merge" Flow — Design Spec

**Date:** 2026-05-08
**Branch context:** `shreyash/feature/healthkit-integration`
**Author:** Shreyash (with Claude)
**Owners:** mobile (Shreyash) + web/Aurora (loop in Aryan via PR review)

---

## Goal

When a user connects HealthKit, give them an explicit choice between **merging** new HealthKit records with their existing CC data (today's behavior) or **replacing** all existing medical data with the HealthKit data and re-onboarding. Replace is destructive and forces the user back through the onboarding flow.

## Non-goals

- Selective replacement (e.g., "wipe just labs, keep meds") — single coarse switch only.
- Restore/undo of replaced data — once replaced, the soft-deleted rows are not exposed in any UI; restore is out of scope.
- Replace flow for non-medical data (chat history, journal, theme, auth session) — preserved untouched.
- Web app UI for triggering replace — mobile only for now.

---

## User Flow

```
Settings → Connect Health Records           Onboarding setup → HealthKit step
                │                                       │
                ▼                                       ▼
         /health-connect (tutorial pages)
                │
                ▼  user taps "Connect Health"
         requestHealthKitPermissions()
                │
                ▼  iOS permission sheet → user grants
                │
                ▼
        Has any existing meds/labs/appts? ──── No ──► merge sync (current path)
                │ Yes
                ▼
         /health-replace-prompt  (NEW screen)
                │
        ┌───────┴───────┐
        ▼               ▼
      Merge         Replace All
        │               │
        │               ▼ confirmation Alert ("Are you sure?")
        │               │
        │               ▼
        │       POST /api/healthkit/replace
        │               │
        │               ▼ success
        │       refetch profile → care profile fields are null
        │               │
        │               ▼
        │       router.replace('/setup')   (re-onboard)
        ▼
POST /api/healthkit/sync (existing)
        │
        ▼
   router.back()
```

---

## Mobile UI

### New screen: `app/health-replace-prompt.tsx`

Full-screen modal-style. Pushed onto the navigation stack from the connect handler.

**Layout (top → bottom):**

- Hero icon (medkit) + "Connected to Apple Health" success line.
- H1: "How should we merge your data?"
- Card 1 — **Merge** (primary visual treatment):
  - Title: "Add HealthKit data alongside what's already in CareCompanion"
  - Body: "Existing medications, lab results, and appointments are kept. HealthKit records are added. Records you've already synced are deduplicated automatically."
  - Big button: **"Merge"** (theme.accent)
- Card 2 — **Replace All** (destructive treatment, red border / muted):
  - Title: "Start fresh from HealthKit"
  - Body: "Your existing medications, lab results, appointments, and care profile (cancer type, treatment phase, etc.) are deleted. You'll be asked to set up your care profile again. **This cannot be undone.**"
  - Button: **"Replace All"** (theme.rose)

**Replace tap → confirmation `Alert.alert`:**
> Title: "Replace all your data?"
> Body: "This deletes all medications, lab results, appointments, and your care profile setup. You'll re-do the onboarding flow. This cannot be undone."
> Buttons: "Cancel" (default) | "Replace" (destructive)

### Trigger logic in `health-connect.tsx::handleConnect`

After `requestHealthKitPermissions()` returns `true` and `markHealthKitConnected()`:

```ts
const hasExisting = await checkHasExistingMedicalData()  // GET /api/healthkit/inventory
if (hasExisting) {
  router.push('/health-replace-prompt')
} else {
  // First-time, nothing to replace — go straight to merge sync
  await syncHealthKitData()
  // existing success animation + back nav
}
```

### Settings entry behavior

Tapping "Connect Health Records" from Settings goes through the same `/health-connect` → grant → `/health-replace-prompt` path. (Already-granted iOS prompt resolves immediately; user still sees the merge/replace choice.)

---

## Backend

### New endpoint: `POST /api/healthkit/replace`

**Path:** `apps/web/src/app/api/healthkit/replace/route.ts`
**Touches Aryan-adjacent territory** — flag in PR description.

**Request body:** Same shape as `/api/healthkit/sync`:
```ts
{ records: HealthKitRecord[] }
```

**Behavior (single transaction):**

1. Auth — return 401 if no session.
2. Look up `careProfile` for user. If none, return 404 (shouldn't happen for an established user).
3. **Wipe phase** (single `db.transaction` — all four statements either commit together or roll back together):
   - `UPDATE medications SET deleted_at = now() WHERE care_profile_id = $1 AND deleted_at IS NULL` — soft delete (matches existing pattern).
   - `UPDATE appointments SET deleted_at = now() WHERE care_profile_id = $1 AND deleted_at IS NULL` — soft delete.
   - `DELETE FROM lab_results WHERE user_id = $1` — hard delete (`labResults` table has no `deletedAt` column per schema audit).
   - `UPDATE care_profiles SET ...nulled fields..., onboarding_completed = false WHERE id = $1` — null out medical/onboarding fields, preserve row identity.
4. **Sync phase** (post-transaction, best-effort): identical semantics to `/api/healthkit/sync` insert loop — iterate records, upsert via `onConflictDoUpdate` keyed on `healthkitFhirId`. Individual insert failures are caught and counted in `errors` (matches existing `/sync` behavior); the wipe is **not** rolled back if a record fails to insert. Rationale: a single bad FHIR payload should not leave the user with neither old data nor new data.
5. **Audit log** (HIPAA-compliant per CLAUDE.md rule 7 — counts only, no PHI):
   ```ts
   logAudit({
     user_id: session.user.id,
     action: 'replace_data',
     resource_type: 'healthkit',
     details: {
       deleted: { medications: M, appointments: A, labResults: L },
       synced: { medications: m, labResults: l, appointments: a, skipped: s },
       careProfileReset: true,
     },
   })
   ```
6. Return `{ deleted: {...}, synced: N, errors: N }`.

### careProfile fields nulled by replace

Based on `apps/web/src/lib/db/schema.ts::careProfiles`:

**Nulled / reset:**
- `patientName`, `patientAge`, `relationship`
- `cancerType`, `cancerStage`, `treatmentPhase`
- `conditions`, `allergies`
- `onboardingCompleted` → `false`, `onboardingPriorities` → `[]`
- `emergencyContactName`, `emergencyContactPhone`
- `caregivingExperience`, `primaryConcern`
- `city`, `state`, `zipCode`
- `fieldOverrides` → `null`

**Preserved (identity / auth-level):**
- `id`, `userId`, `createdAt` — would break FK chains if changed
- `role`, `caregiverForName` — user identity
- `checkinStreak` — engagement metric, not medical
- `lastRadarRunAt` — engagement metric
- `updatedAt` — auto-bumped to now

### No schema changes

This endpoint reuses existing columns. CLAUDE.md rule 8 (Aurora schema migration requirement) **does not apply**.

---

## Mobile post-replace flow

After `POST /api/healthkit/replace` returns 200:

1. Mobile clears any cached profile state.
2. `ProfileContext.refetch()` → returns careProfile with nulled fields, `onboardingCompleted = false`.
3. `health-replace-prompt.tsx` calls `router.replace('/setup')` to push the user into the onboarding wizard.
4. Setup wizard re-fills fields. The HealthKit-sourced medications/labs/appointments are already in the DB and will appear in Care/Home tabs once setup completes.

---

## Inventory check helper

The "skip the prompt if zero existing data" logic needs a quick way to ask "does this user have any existing medical data?". Options:

- **Add `GET /api/healthkit/inventory`** returning `{ hasMeds, hasLabs, hasAppts }` (counts not needed). Simple, dedicated.
- **Reuse existing list endpoints** (`apiClient.medications.list`, `.appointments.list`, `.labResults.list`) and check `length > 0` client-side. No new endpoint, three round-trips.

**Decision:** Reuse existing list endpoints. Three calls run in `Promise.all`, latency cost negligible, and avoids touching the web side for a trivial check.

---

## Error handling

- iOS permission denied → existing handling, no change. Replace prompt is never shown.
- Replace endpoint 4xx/5xx **before the wipe transaction commits** → existing data intact, mobile shows `Alert.alert('Replace failed', '<message>')`, stays on `/health-replace-prompt`. User can retry or back out.
- Replace endpoint 5xx **after wipe but mid-sync** → wipe persisted (intentional, see Sync phase note), `errors` count returned in response. Mobile still routes user to `/setup` and warns: `Alert.alert('Some records didn't sync', 'Your old data was cleared but N HealthKit records failed to import. You can re-sync from Settings later.')`.
- Network drop mid-call → mobile cannot distinguish from a 5xx; shows the same retry alert as the 5xx case. On retry, the upsert keys (`healthkitFhirId`) make the call idempotent.
- Inventory check fails → fail-closed: skip the prompt, default to merge. Don't block the flow on a non-critical preflight.

---

## Audit / privacy

- All log entries via existing `logAudit()` helper. Counts only, no record names, no PHI.
- Console logging in route handler restricted to error messages — no record contents.
- Soft-deleted rows remain in the DB (medications, appointments) but are filtered out of every read query via `isNull(deletedAt)`. They are recoverable for compliance/audit purposes if needed but invisible to the user.
- Lab results are hard-deleted. There is no audit trail for individual labs beyond the count in the audit log entry. Acceptable per existing schema design.

---

## Test plan (high-level)

**Backend (`apps/web/src/app/api/healthkit/replace/__tests__/route.test.ts`):**
- 401 when unauthenticated
- 404 when no careProfile
- Happy path: existing meds/labs/appts get soft/hard deleted, careProfile fields nulled, new records inserted
- Transaction rollback: simulate insert failure mid-loop, verify wipe is also rolled back
- Empty `records[]`: still wipes, ends with empty data set
- Audit log entry created with correct shape, no PHI

**Mobile (manual smoke test on simulator):**
- Connect with existing data → see prompt → tap "Merge" → existing data preserved + new records added
- Connect with existing data → see prompt → tap "Replace All" → confirm → DB wiped → routed to /setup
- Connect with no existing data → prompt skipped, straight to sync
- Network failure during replace → error alert, data unchanged

---

## Out of scope (explicit YAGNI)

- Per-resource selective replace ("wipe just meds")
- Replace history / undo
- Web UI for replace
- Migration to hard-delete medications/appointments
- Schema changes to `lab_results` to add `deletedAt`
- Background sync after first connect
- Settings toggle to default future re-syncs to "always replace"

---

## File map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `apps/mobile/app/health-replace-prompt.tsx` | New merge-or-replace decision screen |
| Modify | `apps/mobile/app/health-connect.tsx` | Branch to prompt screen after grant when existing data present |
| Modify | `apps/mobile/src/services/healthkit.ts` | Add `replaceHealthKitData()` + `hasExistingMedicalData()` helpers |
| Modify | `apps/mobile/src/services/api.ts` | Add `apiClient.healthkit.replace()` client |
| Create | `apps/web/src/app/api/healthkit/replace/route.ts` | New POST endpoint, atomic delete + sync |
| Create | `apps/web/src/app/api/healthkit/replace/__tests__/route.test.ts` | Vitest suite for the new endpoint |
