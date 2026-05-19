# Delete Candidates — Musk Subtraction
*The best part is no part. Sorted by `lines × confidence`.*

Methodology: dead routes (no inbound nav), deprecated code (self-labelled), one-shot scripts (no package.json entry), abandoned experiments (no functional callers).

**Identified: ~4,300 lines across 8 groups (~4% of 104k-line codebase).**
To reach 30%, one major feature area (Trials, Community, or Analytics — ~8,000–12,000 lines each) must also be deprecated. See note at bottom.

---

## 1. `apps/video/` — Remotion marketing video workspace
**~2,519 lines | Confidence: 0.9 | Score: 2,267**

Zero imports from `apps/web` or `apps/mobile`. Entirely isolated Remotion renderer used to produce a hackathon demo video. Two registered compositions: `FullVideo` (4,650 frames / ~2.6 min) and `FullVideo2` (1,500 frames). If the rendered MP4 is already archived, the source code provides no production value.

**Why safe:** No route, no API, no shared package imports it. `package.json` does not reference it in any script. Removing it cannot affect web or mobile users.

**Delete plan:**
```
rm -rf apps/video/
# Remove "video" from workspaces in root package.json
```

---

## 2. `apps/web/src/app/api/admin/provision-demo/route.ts` + `provision-reviewer/route.ts`
**719 lines | Confidence: 0.75 | Score: 539**

Internal curl-only endpoints for creating demo and reviewer accounts. No UI calls them. The only references are `console.log` statements within the files themselves and comments like `curl -X POST https://carecompanionai.org/api/admin/...`. They include hardcoded email strings and log PHI-adjacent data (email, user ID) violating the no-PHI-in-logs rule (CLAUDE.md §7). 719 lines to do what `scripts/seed_demo.ts` (348 lines) already does behind a proper script interface.

**Why safe:** No user-facing feature depends on these endpoints. They are ops-only, curl-triggered, and can be replaced with a 20-line wrapper around existing seed logic.

**Delete plan:**
```
rm apps/web/src/app/api/admin/provision-demo/route.ts
rm apps/web/src/app/api/admin/provision-reviewer/route.ts
# Add thin npm scripts to package.json calling seed_demo.ts with --role=reviewer
```

---

## 3. `apps/web/src/app/demo-walkthrough/page.tsx` + `apps/web/src/app/one-pager/page.tsx`
**553 lines | Confidence: 0.80 | Score: 442**

`demo-walkthrough/page.tsx` (317 lines): a standalone marketing walkthrough page with hardcoded slide content and a CTA to `/chat/guest`. Listed in `middleware.ts:22` as a public route but not linked from any persistent navigation. Last significant edit appears tied to hackathon submission. Not reached from `AppShell.tsx`, `DashboardView.tsx`, or any onboarding step.

`one-pager/page.tsx` (236 lines): static marketing page with no inbound `href` or `<Link>` anywhere in the codebase. Not in `middleware.ts`. Accessible only by direct URL.

**Why safe:** Neither page is in the product navigation. Removing them does not affect any authenticated user flow. If needed for future demos, the content can be regenerated from `DESIGN.md`.

**Delete plan:**
```
rm -rf apps/web/src/app/demo-walkthrough/
rm -rf apps/web/src/app/one-pager/
# Remove '/demo-walkthrough' from the publicRoutes array in middleware.ts:22
```

---

## 4. One-shot migration scripts with no package.json entry
**313 lines | Confidence: 0.90 | Score: 281**

| File | Lines | Notes |
|------|-------|-------|
| `apps/web/scripts/backfill-identities.ts` | 106 | One-time identity backfill; no `npm run` entry |
| `apps/web/scripts/backfill-embeddings.ts` | 76 | One-time embedding backfill; no `npm run` entry |
| `apps/web/scripts/repolarize-legacy-memories.ts` | 75 | One-time memory polarity correction; no `npm run` entry |
| `apps/web/scripts/apply-migration.ts` | 56 | Generic migration runner superseded by `drizzle-kit push`; no `npm run` entry |

All four: no entry in `apps/web/package.json` scripts block, no import from any other file, no CI reference. Contrast with `seed-eval-user.ts` (kept: `eval:memory:seed`) and `canary-monitor.ts` (kept: `monitor:canary`).

**Why safe:** These were one-time data migrations. If they haven't been run yet, they should be converted to proper Drizzle migrations under `apps/web/src/lib/db/migrations/` — not loose scripts.

**Delete plan:**
```
rm apps/web/scripts/backfill-identities.ts
rm apps/web/scripts/backfill-embeddings.ts
rm apps/web/scripts/repolarize-legacy-memories.ts
rm apps/web/scripts/apply-migration.ts
```

---

## 5. `apps/web/src/app/api/care-group/join/route.ts` — deprecated join endpoint
**108 lines | Confidence: 0.90 | Score: 97**

The file opens with: `// DEPRECATED — superseded by /api/care-group/join-by-code` and logs `console.warn('[DEPRECATED] /api/care-group/join (name+password) called')` on every invocation. One caller remains: `apps/web/src/components/CareGroupScreen.tsx:94`. The feature flag `isCaregiverCodeFlowEnabled()` defaults to `true` permanently; the code-join path is the canonical path. The old name+password flow has no tests in the test suite.

**Why safe:** `isCaregiverCodeFlowEnabled()` has defaulted to `true` since migration 012. No new accounts use the name+password join. Update the one remaining caller and delete.

**Delete plan:**
```
rm apps/web/src/app/api/care-group/join/route.ts
# In CareGroupScreen.tsx:94, change fetch('/api/care-group/join') → fetch('/api/care-group/join-by-code')
# Update CareGroupScreen.tsx payload to match join-by-code schema (add `code` field, drop `patientName`+`password`)
```

---

## 6. `apps/web/eval/snapshots/legacy.json`
**~50 lines | Confidence: 0.90 | Score: 45**

Stale evaluation fixture from the pre-hybrid memory architecture. `hybrid.json` in the same directory is the active snapshot. `legacy.json` is not imported anywhere in the codebase (grep: 0 results for `legacy.json` outside the file itself).

**Why safe:** The memory eval cron (`/api/cron/memory-eval/route.ts`) uses `hybrid.json` only. `legacy.json` is an orphaned artifact.

**Delete plan:**
```
rm apps/web/eval/snapshots/legacy.json
```

---

## 7. Dead feature-flag branches across 3 routes
**~40 lines | Confidence: 0.95 | Score: 38**

`isCaregiverCodeFlowEnabled()` in `apps/web/src/lib/feature-flags.ts:21–22` has `defaultValue: true` and no known deployment sets it to `false`. Three routes contain `if (!isCaregiverCodeFlowEnabled()) { return NextResponse.json({ error: 'Feature disabled' }, { status: 503 }) }`:

- `apps/web/src/app/api/care-group/request-join/route.ts:30–32`
- `apps/web/src/app/api/care-group/code/route.ts:25` (entire handler is the flag check)
- `apps/web/src/app/api/care-group/join-by-code/route.ts:42–44`

The false branch is unreachable code in production. The flag mechanism and the env-var check remain useful as a pattern, but the flag itself can be removed once join/route.ts (candidate #5) is deleted.

**Why safe:** The flag has been `true` since the code-join rollout. Removing the dead branches removes ~13 lines per file and eliminates a confusing 503 path that would only fire if someone manually flipped a never-set env var.

**Delete plan:**
```
# In each of the 3 routes above: delete the isCaregiverCodeFlowEnabled() import and the early-return guard block
# Delete apps/web/src/lib/feature-flags.ts entirely (no other flags defined there)
```

---

## 8. `apps/web/src/app/(app)/sync-status/page.tsx` — 2-line redirect stub
**2 lines | Confidence: 1.00 | Score: 2**

```ts
import { redirect } from 'next/navigation'
export default function Page() { redirect('/settings') }
```

No inbound `href` anywhere in the codebase. The route was placeholder-committed and never implemented. Redirects to `/settings`, which is also reachable directly. Retaining this file misleads future developers into thinking sync status has a UI home.

**Why safe:** Nothing navigates to `/sync-status`. Users never see it. Delete it, and if sync status visibility is ever built, create a real implementation (see PREMORTEM.md #3 for the spec).

**Delete plan:**
```
rm apps/web/src/app/(app)/sync-status/page.tsx
rm apps/web/src/app/(app)/sync-status/  # if directory is now empty
```

---

## Path to 30%

The 8 groups above recover ~4,300 lines (~4% of the 104k-line codebase). To reach 30% (~31,000 lines), one major feature vertical must be cut. Candidates ranked by lines-saved vs. retention impact:

| Feature | Approx lines (web + mobile) | Retention signal |
|---------|----------------------------|-----------------|
| Clinical Trials | ~8,000 | Low — requires oncologist confirmation loop; see PREMORTEM #4 |
| Community / CareHub | ~6,000 | Low — zero cross-posting from external platforms |
| Analytics dashboard | ~4,000 | Low — empty until "first week of tracking" completed |

**Recommended first cut:** Trials. Move `apps/web/src/app/(app)/trials/`, `apps/mobile/app/(tabs)/trials.tsx`, `apps/web/src/app/api/cron/trials-match/`, `apps/web/src/app/api/cron/trials-status/`, `apps/web/src/lib/trials/`, and the five `__tests__/trials/` test files behind a `NEXT_PUBLIC_TRIALS_ENABLED=true` env var. Default it to `false`. Saves ~8,000 lines of active execution surface and removes the liability described in PREMORTEM #4 — at zero UX cost to the 95%+ of users who never tapped the Trials tab.
