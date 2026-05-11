# Home Daily Alerts + Medications Widgets

**Date:** 2026-05-11
**Owner:** Shreyash (apps/mobile/)
**Status:** Spec approved, ready for implementation plan

## Goal

Replace the static "Did You Know" card on the Home tab with two action-oriented widgets:

1. **Daily Alerts** — surface real clinical alerts (drug interactions, lab values out of range) plus placeholder AI-derived insights.
2. **Today's Medications** — list current meds (name / dose / frequency) and route to the Care tab on tap.

Also extend the Care tab with create + delete medication UI, since tapping the meds widget should land on a screen where meds can actually be managed (currently read-only).

## Out of scope

- Building any `/api/insights` backend. AI / side-effect alerts are hardcoded placeholders this round, clearly marked.
- Editing existing meds (only create + delete in this round).
- Clinical tuning of interaction severity (we trust whatever `/api/interactions/check` returns).
- Wiring alert taps to deep-link destinations.

## Files touched

| Path | Change |
|---|---|
| `apps/mobile/app/(tabs)/index.tsx` | Remove "Did You Know" card + existing meds card; mount `<DailyAlertsCard />` + `<TodaysMedicationsCard />` at top. |
| `apps/mobile/src/components/DailyAlertsCard.tsx` | **New** — alerts widget. |
| `apps/mobile/src/components/TodaysMedicationsCard.tsx` | **New** — meds widget. |
| `apps/mobile/app/(tabs)/care.tsx` | Add "+ Add" button + per-row trash; wire `apiClient.medications.create` / `.delete`. |

No backend changes. No `packages/api` changes (existing methods cover create / delete / interactions check).

## DailyAlertsCard

### Data sources (merged into one list)

| Source | Type | Endpoint |
|---|---|---|
| Drug interactions | real | `apiClient.interactions.check(meds)` (POST `/api/interactions/check`) |
| Lab out-of-range | real, client-side | derived from `apiClient.labResults.list(careProfileId)` |
| AI / side-effect insights | placeholder | hardcoded constants in the component, `BETA` chip on the row |

### Alert row shape

```ts
type Alert = {
  id: string
  severity: 'info' | 'warning' | 'danger'
  title: string         // 1 line, e.g. "Tamoxifen + Anastrozole may reduce efficacy"
  detail: string        // 1 line, e.g. "Tap to review with your AI companion"
  source: 'interaction' | 'lab' | 'ai-beta'
}
```

- **Severity → color**: `info = violet`, `warning = amber`, `danger = red`. Reuse theme tokens (`theme.amber`, `theme.red`, `theme.violet`).
- **Source = `ai-beta`** → small `BETA` chip rendered next to the title so placeholders are obviously not live.

### Lab out-of-range detection

- Iterate `labResults` for the current `careProfileId`.
- Parse `referenceRange` string (sample format: `"4.0–11.0"` or `"4.0-11.0"` — handle both dashes).
- Compare numeric `value` against parsed `[low, high]`. If outside, emit a `danger` alert: title `"<TestName> out of range"`, detail `"<value> <unit> (ref: <low>–<high>)"`.
- If `referenceRange` is missing or unparseable → skip silently (don't show false alerts).

### Placeholder AI alerts

Two hardcoded examples, both `severity: 'warning'`, `source: 'ai-beta'`:

1. `"Fatigue trend rising"` / `"Mentioned in 3 of your last 5 chat sessions"`
2. `"Sleep impact noted"` / `"Possibly correlated with Tamoxifen dosing time"`

These render unconditionally (not gated on real data) so the widget always has something to show during the demo phase.

### Visual states

- **Loading** (any source still pending): shimmer skeleton matching `ShimmerSkeleton` pattern used elsewhere in `(tabs)/index.tsx`.
- **Empty** (no alerts from any source): show "All clear — no alerts today" with a calm icon.
- **Overflow**: cap at 3 visible rows, render `"+ N more"` link if alerts.length > 3. Tap behavior on the more link is deferred (no-op).

### Tap behavior

- Row tap: **no-op for round 1**. Don't add `Pressable` wrapper — render rows as plain `View` so there's no misleading affordance.

## TodaysMedicationsCard

### Data

- `apiClient.medications.list(careProfileId)` — same call already made in `HomeScreen`. Lift into the new component; pass `careProfileId` as prop. (Remove the duplicate fetch in `HomeScreen`.)

### Layout

- Header row: `"TODAY'S MEDICATIONS"` label + count badge (matches existing meds card style — reuse styles where possible).
- Body: each med as a row: `name · dose` on the left, `frequency` on the right.
- Tap anywhere on the card → `router.push('/(tabs)/care')`.

### States

- **Loading**: shimmer skeleton.
- **Empty**: card with "No medications yet — tap to add" copy, still tappable → routes to Care tab.

## Care tab additions

### Add medication

- Add a **"+ Add"** pill / icon button to the right of the meds section header in `(tabs)/care.tsx`.
- Tapping opens a **modal sheet** with form:
  - `name` (required, string)
  - `dose` (optional, string — e.g. `"20 mg"`)
  - `frequency` (optional, string — e.g. `"Once daily"`)
  - `prescribingDoctor` (optional, string)
- Submit handler calls `apiClient.medications.create({ careProfileId, ...form })`, then triggers refetch of the Care tab's meds list.
- Cancel / dismiss closes the sheet without saving.
- Use the existing `Modal` / sheet pattern in the app if one exists; otherwise plain `Modal` from `react-native` with the app's glass styling.

### Delete medication

- Each med row in the Care tab grows a **trash icon** on the right edge.
- Tap → `Alert.alert` confirmation ("Delete <name>?").
- On confirm → `apiClient.medications.delete(id)` → refetch.

### Constraints

- Don't refactor unrelated parts of `care.tsx`. Add the buttons and handlers inline near the meds section; leave labs/appointments sections untouched.
- Preserve existing animations and styling in `care.tsx`.

## Testing

This is mobile UI work — no automated tests exist for these screens in the repo. Manual verification on the iOS simulator:

1. Fresh launch → land on home → see Daily Alerts + Today's Medications widgets at top.
2. With 0 meds: alerts widget shows only the 2 AI placeholders; meds widget shows empty state.
3. With Sample Location A connected: alerts widget shows lab out-of-range for any lab outside its reference range (e.g. HDL Cholesterol if marked out-of-range).
4. With multiple meds: alerts widget calls `/api/interactions/check` and renders results.
5. Tap meds widget → lands on Care tab.
6. Care tab: tap "+ Add" → modal opens → fill form → save → new med appears in list AND in home meds widget on next focus.
7. Care tab: tap trash → confirm → med disappears from list AND home widget.

Typecheck must pass: `npm --workspace apps/mobile run typecheck`.

## Open questions

None — all earlier ambiguities resolved during brainstorming.

## Risks

- **`/api/interactions/check` shape**: if the response shape is unfamiliar, the rendering code may need adjustment. Plan step will verify the endpoint's contract before wiring the UI.
- **Reference range parsing**: lab data from real Apple Health (Sample Location A) may use unicode en-dash (`–`) or ASCII hyphen (`-`). Parser must handle both.
- **Duplicate fetch**: Today's Meds widget and any other home-card fetching meds will both call the same endpoint. Acceptable for now (cheap query); revisit if dashboard adds many more meds-dependent widgets.
