# Code Review — 2026-05-18

**Reviewer:** Claude Code (independent second-opinion pass)
**Scope:** AI-generated commits on `main` from 2026-05-15 to 2026-05-16
**Note:** No commits landed in the literal last 24 h (2026-05-18/19). This review covers the most recent overnight/day-batch AI-generated push (9 commits, merged as v0.5.1.0).

---

## Summary

| Commit | Message | Severity |
|--------|---------|----------|
| `a05f533` | chore: merge all dev branches → main (v0.5.1.0) | 🟠 high |
| `5bb5774` | feat(memory): wire memory v2 into mobile chat route | 🟠 high |
| `3d5f7f2` | feat(reconciliation): medication observation data layer | 🟡 medium |
| `2226a75` | feat(memory): v2.1 batch 1 — dedup, decay, summaries, contradictions | 🔴 critical |
| `b9bbf44` | fix(canary): always exit 0, let workflow signal abort | ✅ clean |
| `e10f1d3` | fix(canary): query carecompanion DB not postgres | ✅ clean |
| `0b84150` | feat(canary): GH Actions cron monitor with auto-promote + issue alerts | 🟠 high |
| `7128098` | feat(memory): v2 — hybrid retrieval, prompt cache, budget caps, smart routing | 🟠 high |
| `1624dd2` | fix(ci): harden api-health-ping against server-side misconfig | 🟡 medium |

**Findings by severity:** 1 critical, 5 high, 5 medium, 8 low

---

## Critical / High Findings (must fix before next deploy to prod)

### 🔴 CRITICAL

`apps/web/src/lib/memory-conflict.ts:60`: 🔴 critical: `findCosineDuplicate` raw SQL uses `WHERE user_id = ${userId}` without `::uuid` cast. Every other raw Aurora query in the codebase uses `${userId}::uuid` to match the UUID column type; this query will fail at runtime with a type-mismatch error when cosine dedup runs. Add `::uuid`: `WHERE user_id = ${userId}::uuid`.

### 🟠 HIGH

`apps/web/src/lib/budget.ts:26`: 🟠 high: TOCTOU race in `reserveBudget` — the daily cap check runs in application code *after* the `INSERT ... ON CONFLICT DO UPDATE` has already committed. Under concurrent load, two requests can both read `total_input <= cap`, both commit, and both be served above cap. Move the cap check entirely into SQL using a conditional `DO UPDATE ... WHERE user_usage.reserved_input_tokens + EXCLUDED.reserved_input_tokens <= cap` and return a sentinel row when the condition fails.

`apps/web/src/app/api/healthkit/replace/route.ts:157`: 🟠 high: `careProfile = created` where `created` is the first element of `db.insert(...).returning()`. If the INSERT returns an empty array (e.g. constraint violation that doesn't throw), `careProfile` is `undefined` and `careProfile.id` on the next line crashes the route. Add a null guard: `if (!careProfile) return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })`.

`apps/web/src/app/api/chat/mobile/route.ts:95-127` (commit `5bb5774`): 🟠 high: Model ID strings use dot separators (`claude-sonnet-4.6`, `claude-haiku-4.5`) but the Anthropic SDK expects dash separators (`claude-sonnet-4-6`, `claude-haiku-4-5-20251001`). Incorrect model IDs cause silent 400 errors in production for all mobile chat requests. Fix both strings to use dashes.

`apps/web/src/app/api/chat/mobile/route.ts` (commit `5bb5774`): 🟠 high: Mobile chat route has no `reserveBudget` or `recordUsage` calls, even though both were added to the web chat route in `7128098`. Mobile users bypass the daily token cap entirely. Wire budget caps into the mobile route the same way as the web route.

`.github/workflows/canary-monitor.yml` (commit `0b84150`): 🟠 high: Workflow authenticates to AWS using long-lived `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` secrets. CLAUDE.md rule 9 mandates "SSO / IAM role only." Static IAM keys are a lateral-movement risk if the secret is ever leaked from GitHub. Migrate to OIDC (`aws-actions/configure-aws-credentials` with `id-token: write` permission) before canary auto-promote reaches production.

---

## Medium Findings (fix this sprint)

`apps/web/src/app/api/records/medication-observations/route.ts:138`: 🟡 medium: `discrepancyFlag ? 201 : 201` always returns HTTP 201. The intent is `discrepancyFlag ? 201 : 200` so clients can distinguish "observation logged" (200) from "observation logged + discrepancy detected" (201). Fix the second branch to `200`.

`apps/web/src/app/api/chat/mobile/route.ts:107-113` (commit `5bb5774`): 🟡 medium: `convoMemEnabledForUser(user!.id)` is called twice in the same `Promise.all` block, each triggering a `SELECT COUNT(*)` from `conversation_summaries`. Compute the result once outside the block and reuse it.

`apps/web/src/lib/memory/convomem.ts:107,112` (commit `2226a75`): 🟡 medium: Same double-query issue as above — `convoMemEnabledForUser` called twice sequentially for memories and summaries. Hoist to a single call.

`apps/mobile/app/signup.tsx` (commit `a05f533`): 🟡 medium: `markSignedIn()` called inside a 950 ms `setTimeout` with no cleanup on unmount. If the user navigates away before the timer fires, the state mutation runs on an unmounted component. Return a cleanup function from the `useEffect` that cancels the timeout.

`apps/web/src/app/api/chat/route.ts` (commit `7128098`): 🟡 medium: `console.log('[chat-cache]', JSON.stringify({ userId: dbUser!.id, ... }))` logs the internal user UUID. Although a UUID is not direct PHI, it is a persistent identifier linkable to patient records. CLAUDE.md rule 7 prohibits PHI in logs. Replace with a truncated hash or remove the `userId` field.

`apps/web/scripts/canary-monitor.ts` (commit `0b84150`): 🟡 medium: If `setHybridEnv()` succeeds but `triggerDeploy()` fails, the environment variable is set to `true` with no active deployment to pick it up. The next canary cycle will re-evaluate a state that partially took effect. Add a rollback of the env var on deploy failure, or at minimum emit a `CRITICAL` alert so the team can intervene manually.

`1624dd2` commit message: 🟡 medium: Commit bundles four unrelated changes (onboarding redesign, mobile HealthKit/EventKit/wellness bridge, the CI fix, `maxDuration` bump) under `fix(ci): harden api-health-ping`. This makes `git bisect` and targeted rollback very difficult. Should have been 3–4 separate commits. Flag for future discipline; no code change needed now.

---

## Low Findings (nice to have)

`apps/web/src/app/api/records/medication-observations/route.ts:173`: 🔵 low: `GET` returns up to 200 rows with no pagination. Add `?limit=` and `?cursor=` parameters for large histories.

`apps/web/src/lib/memory-conflict.ts` (rewriteContradictionViaHaiku): 🔵 low: No `maxOutputTokens` cap or timeout on the `generateText` call. This creates an unbounded Haiku call on the synchronous write path. Cap at `maxOutputTokens: 60` and wrap with a timeout/AbortSignal.

`apps/web/src/lib/memory/retrieve.ts:TIER1_CAP`: 🔵 low: `TIER1_CAP = 5` hard-limits tier-1 safety facts. A patient with 7+ safety-critical facts (multiple allergies, active conditions, medications) will silently drop some from context. For a healthcare app consider a higher cap or a hard floor for the allergy category.

`apps/mobile/src/services/healthkit.ts:308`: 🔵 low: Verify the `console.log('[HealthKit] __DEV__: substituting', ...)` call is inside the `if (__DEV__)` guard block, not just near it. If it leaks to production builds it reveals internal implementation details.

`apps/mobile/src/services/wellnessVitals.ts:254,333`: 🔵 low: `console.warn('[WellnessVitals] dropping queued payload ...' , message)` where `message` is built from `res.text()`. If the server returns a PHI-containing error body it would be logged. Truncate or discard the response text in the error string.

`apps/web/src/middleware.ts` (commit `1624dd2`): 🔵 low: Redirect changed from `/set-role` to `/onboarding`; old `/set-role` pages deleted. Confirm no external links (onboarding emails, app store screenshots, support docs) still reference `/set-role` — users following stale links hit a 404.

`apps/mobile/ios/CalendarBridge.swift` (commit `1624dd2`): 🔵 low: Keyword filter (`clinic/doctor/hospital/mychart/appointment/oncology`) is English-only, case-sensitive (verify), and has no tests. Edge cases with mixed-case or non-English event titles may be wrongly excluded or included.

`docs/2026-05-16-home-labs-care-ui-consolidation-design.md` (commit `a05f533`): 🔵 low: Design-spec markdown committed to repo. Contains patient-flow UX context. If the repo ever goes public this could reveal product internals. Move to a private wiki or remove post-implementation.

`5bb5774` commit message: 🔵 low: Prefixed with `v0.5.0.1 feat(memory): ...`. The version prefix before the Conventional Commits type is non-standard. Use `feat(memory): wire memory v2 into mobile chat route` only.

---

## Ownership Violations

| Commit | Files Touched | Owner Required | Actual Author | Status |
|--------|--------------|----------------|---------------|--------|
| `a05f533` | `apps/mobile/**` (extensive) | Shreyash | Aryan (squash merge) | ⚠️ Process gap — Shreyash is co-author, but squash-merge erases PR review trail. No visible Aryan-as-reviewer record per rule 4. |
| `1624dd2` | `apps/mobile/**` (HealthKit/EventKit/wellness bridge) + onboarding flows (Rahil) + web/AI (Aryan) | Shreyash + Rahil + Aryan | Aryan | ⚠️ Multi-owner commit. Should have been separate PRs routed to each owner. |

**No hardcoded credential violations found in committed files.** The canary workflow uses GitHub Secrets (not committed values) but uses the wrong authentication pattern (see High findings).

---

## Tests Missing

| Area | Commit | Risk |
|------|--------|------|
| `/api/records/medication-observations` POST/GET/PATCH | `3d5f7f2` | Ownership check, discrepancy logic, 409 guard untested |
| `findCosineDuplicate` against real Aurora UUID types | `2226a75` | The `::uuid` cast bug is only visible against real Aurora; mocked tests pass |
| `canary-monitor.ts` `decide()` stop-condition branches | `0b84150` | Auto-promote to prod is untested |
| `reserveBudget` concurrent reservation race | `7128098` | Sequential test cannot catch the TOCTOU race |
| ConvoMem bypass in mobile chat route | `5bb5774` | Mobile-specific bypass path has no test |
| `predecessorPhase` / BACK action in onboarding phase machine | `1624dd2` | Phase-machine BACK transitions untested |
| `CalendarBridge.swift` keyword filter | `1624dd2` | Swift logic has no unit tests |
| `DiagnosisPill` component | `a05f533` | New UI component, no test |

---

## Action Items by Priority

1. **Before next prod deploy:**
   - Fix `::uuid` cast in `memory-conflict.ts:60` (Aurora runtime crash)
   - Fix `reserveBudget` TOCTOU race in `budget.ts:26` (token cap bypass)
   - Fix `careProfile` null guard in `healthkit/replace/route.ts:157` (crash on insert failure)
   - Fix model ID strings in mobile chat route (`.` → `-`)
   - Wire `reserveBudget`/`recordUsage` into mobile chat route

2. **This sprint:**
   - Migrate canary workflow to OIDC (IAM policy compliance)
   - Fix `discrepancyFlag ? 201 : 201` ternary typo
   - Eliminate double `convoMemEnabledForUser` DB calls
   - Fix `setTimeout` / unmount leak in `signup.tsx`
   - Remove `userId` from chat-cache log

3. **Backlog:**
   - Add pagination to medication-observations GET
   - Add token cap to `rewriteContradictionViaHaiku`
   - Raise or stratify `TIER1_CAP` for allergy category
   - Add tests for the eight uncovered areas above
   - Enforce single-owner, single-concern commits going forward
