# Home / Labs / Care UI Consolidation + Apple Health Range Bars + Diagnosis Pills

**Date:** 2026-05-16  
**Author:** Shreyash Somani  
**Branch:** shreyash/feature/healthkit-integration

---

## Overview

Five targeted UI changes to reduce clutter and surface real Apple Health data:

1. Remove Care Timeline button from Today tab
2. Merge Care Timeline preview into the treatment journey card in My Care tab
3. Remove Health Data tab from Home; consolidate into Labs
4. Labs tab: replace demo data with real FHIR reference ranges + visual range bars
5. Home header: show primary diagnosis/condition as a pill from Apple Health

---

## Change 1 — Remove Care Timeline from Today Tab

**File:** `apps/mobile/app/(tabs)/index.tsx` ~lines 824–839

Delete the `GlassCard` block that renders "Care Timeline / Medications, appointments & milestones" and routes to `/timeline`. The Care Hub Radar button below it stays untouched.

No data changes. No navigation route changes (the `/timeline` screen still exists, reachable from My Care).

---

## Change 2 — Merge Care Timeline Preview into Treatment Journey Card

**File:** `apps/mobile/src/components/home/MyCarePanel.tsx` ~lines 134–180

The treatment journey card becomes a combined card. Behaviour depends on whether the user has data:

**Empty state (no medications / labs / appointments):** unchanged — existing skeleton + "Your treatment journey will appear here" + "Start a conversation" CTA.

**Data present:** replace the empty state content with:
- Up to 3 most-recent items across medications, labs, and appointments, sorted descending by date. Each item renders as a mini timeline row: colored dot → item label → date.
- A "View full timeline →" tappable link at the bottom that navigates to `/timeline`.

Data source: `medications`, `labResults`, `appointments` are already fetched in the care tab's existing `useEffect`; pass them into `MyCarePanel` (or read from the same context).

Item dot colours: medication = purple `#6c63ff`, lab = blue `#63aeff`, appointment = green `#63ff88`.

---

## Change 3 — Remove Health Data Tab from Home

**Files:** `apps/mobile/app/(tabs)/index.tsx`

- Remove `'healthData'` from the `HomeTabPills` options array.
- Remove the `activeTab === 'healthData'` conditional that renders `<HealthDataPanel />`.
- Remove the `HealthDataPanel` import.

`HealthDataPanel.tsx` itself is not deleted — it may be repurposed later — but it is no longer rendered anywhere after this change.

---

## Change 4 — Labs Tab: Real FHIR Range Bars, Remove Demo Data

**File:** `apps/mobile/app/(tabs)/labs.tsx`

### FhirRangeBar component (new, inline or extracted)

Parses the `referenceRange` string already stored in the database (e.g. `"10–250"`) and renders a horizontal range bar matching the Apple Health visual style:

```
Status label:   IN RANGE  /  LOW  /  HIGH
Track:          [░░░░░░████████████░░░░░░░]
                           ●
Labels:         10                    250
```

Implementation details:
- Parse: split on `–` (en-dash) or `-`; parse both sides to float. If parse fails → render nothing (graceful fallback).
- Display range: `displayMin = Math.min(0, low * 0.5)`, `displayMax = high * 1.5`. This gives visual padding so the reference zone isn't flush to the edges.
- Track fill colours: gray background track; blue/accent highlight for the normal zone; dot marker at the value's proportional position.
- Status text above track: "IN RANGE" (green) if `low ≤ value ≤ high`, "LOW" (amber) if below, "HIGH" (red) if above.
- When `referenceRange` is null: render only value + unit, no bar.

### Demo data removal

`HealthDataPanel.tsx` is no longer rendered (Change 3). The `DEMO_LABS` and `RECENT_RESULTS` constants in that file are not touched — file is left dormant.

No new API calls needed: `referenceRange` already flows from HealthKit sync → normalizer → database → `apiClient.labResults.list()` response.

---

## Change 5 — Diagnosis Pill in Home Header

### Backend (sync endpoints)

**Files:**
- `apps/web/src/app/api/healthkit/sync/route.ts`
- `apps/web/src/app/api/healthkit/replace/route.ts`

Both endpoints currently ignore `condition` records. Add processing:

1. Filter incoming `records` for `type === 'condition'`.
2. Keep only conditions where `clinicalStatus` is `'active'` or `'resolved'` (drop `'inactive'`).
3. Serialize to JSON array of `{ display, code, clinicalStatus }` objects.
4. Write to the existing `careProfiles.conditions` text column (no migration needed — column already exists at `schema.ts` line 86).
   - For `/sync`: merge with any existing conditions (union by `code`, prefer new record's `clinicalStatus`).
   - For `/replace`: overwrite entirely.

No new table, no migration SQL required.

### Frontend

**File:** `apps/mobile/app/(tabs)/index.tsx` ~lines 570–592

The care profile is already in `ProfileContext` and available on the home screen. Add:

```tsx
const conditions = useMemo(() => {
  try { return JSON.parse(profile?.conditions ?? '[]') as { display: string }[] }
  catch { return [] }
}, [profile?.conditions])
```

After `<RoleBadge style={{ marginTop: 4 }} />`, render condition pills:

```tsx
{conditions.slice(0, 2).map(c => (
  <DiagnosisPill key={c.display} label={c.display} />
))}
{conditions.length > 2 && <DiagnosisPill label={`+${conditions.length - 2}`} />}
```

`DiagnosisPill` is a small inline component (same file or `src/components/DiagnosisPill.tsx`):
- Background: `#ff636344`, border: `#ff636355`, text: `#ff9d9d` — coral, visually distinct from the purple Patient pill.
- Same height/padding as `RoleBadge`.
- Pills wrap into a flex row alongside `RoleBadge`.

If `conditions` is empty or null → nothing renders. No empty state.

---

## Data Flow Summary

```
Apple Health → Bridge.fetchClinicalRecords()
  → normaliseCondition() [normalizers.ts]          ← already implemented
  → POST /api/healthkit/sync { records }
  → sync/route.ts filters type='condition'          ← NEW
  → careProfiles.conditions = JSON.stringify(...)   ← NEW (existing column)

ProfileContext.profile.conditions                   ← already fetched
  → home screen useMemo parse                       ← NEW
  → DiagnosisPill[]                                 ← NEW component

Apple Health → referenceRange string in labResults  ← already synced
  → labs.tsx FhirRangeBar parses "low–high"         ← NEW component
  → visual range bar                                ← NEW
```

---

## Out of Scope

- New database migrations (using existing `careProfiles.conditions` text column)
- Trend charts (dropped in Change 3/4; HealthDataPanel dormant)
- Editing or deleting conditions
- Wellness vitals (steps, HR, sleep) — unchanged
- Any web changes

---

## Files Touched

| File | Change |
|---|---|
| `apps/mobile/app/(tabs)/index.tsx` | Remove Care Timeline button; remove Health Data tab + HealthDataPanel; add DiagnosisPill rendering |
| `apps/mobile/src/components/home/MyCarePanel.tsx` | Merge timeline preview into treatment journey card |
| `apps/mobile/app/(tabs)/labs.tsx` | Add FhirRangeBar; remove demo data dependency |
| `apps/web/src/app/api/healthkit/sync/route.ts` | Process condition records → careProfiles.conditions |
| `apps/web/src/app/api/healthkit/replace/route.ts` | Process condition records → careProfiles.conditions |
| `apps/mobile/src/components/DiagnosisPill.tsx` | New component (or inline) |
