# Code Health Audit — CareCompanion

**Date:** 2026-05-24  
**Scope:** `apps/web/src` + `apps/mobile/src`  
**Branch:** `aryan/dev`  
**Auditor:** Automated multi-agent analysis  

---

## Executive Summary

This audit covers seven domains beyond the `/health` dashboard: complexity hotspots, type safety holes, async error swallowing, N+1 query risk, test coverage gaps, bundle bloat, and schema drift. The codebase is broadly functional but carries compounding risks in three areas that warrant immediate attention: **pervasive non-null assertion abuse in auth-sensitive API routes** (262 instances), **44 of 62 schema tables with no migration files** (one already caused a production manual intervention), and **65 % of `lib/` files having zero test coverage**. The remaining sections are MEDIUM severity but will compound if unaddressed.

---

## Section 1 — Complexity Hotspots

Functions over ~100 LOC or components exceeding 500 LOC become unit-test-hostile, brittle to PR review, and often mask correctness bugs. The following table lists the highest-impact offenders.

### 1.1 Web App — Critical Files (900+ LOC)

| Severity | File | LOC | Worst Function / Notes |
|----------|------|-----|------------------------|
| CRITICAL | `app/page.tsx` | 1,107 | `TrialsScreen()` ≈ 445 LOC (line 663); `PhoneMockup()` ≈ 245 LOC (line 158) |
| CRITICAL | `components/DashboardView.tsx` | 1,072 | Single component ≈ 863 LOC (line 210); 4+ `useEffect` hooks for data fetching |
| HIGH | `lib/db/schema.ts` | 921 | Drizzle table definitions; no function extraction problem but change surface is enormous |
| HIGH | `lib/tools.ts` | 718 | `buildTools()` ≈ 697 LOC (line 22); 15+ tool definitions in one function |
| HIGH | `app/api/cron/radar/route.ts` | 687 | `GET()` ≈ 632 LOC (line 60); AI batch analysis, symptom scoring, notification dedup all inline |

### 1.2 Web App — High Files (500–699 LOC)

| Severity | File | LOC | Notes |
|----------|------|-----|-------|
| HIGH | `components/DocumentOrganizer.tsx` | 676 | Core component ≈ 355 LOC |
| HIGH | `components/CareHubView.tsx` | 654 | `SeverityTint()` ≈ 333 LOC |
| HIGH | `lib/system-prompt.ts` | 618 | `buildRoleContext()` ≈ 231 LOC; `buildSystemPromptBlocks()` ≈ 322 LOC |
| HIGH | `components/LabTrends.tsx` | 606 | Three functions each ≈ 100–195 LOC |
| MEDIUM | `components/SettingsPage.tsx` | 597 | Monolithic settings form |
| MEDIUM | `components/VisitPrepView.tsx` | 594 | `VisitPrepView()` ≈ 499 LOC |
| MEDIUM | `components/TreatmentCycleTracker.tsx` | 582 | Core component ≈ 447 LOC |
| MEDIUM | `components/HealthDataChart.tsx` | 545 | Chart component ≈ 385 LOC |
| MEDIUM | `components/ChatInterface.tsx` | 540 | Chat UI ≈ 485 LOC |

### 1.3 Mobile App — High Files

| Severity | File | LOC | Notes |
|----------|------|-----|-------|
| HIGH | `components/Timeline.tsx` | 660 | Complex data transforms, animations, state all inline |
| HIGH | `services/healthkit.ts` | 579 | Sync state machine + FHIR normalization; as-any heavy |
| HIGH | `components/auth/AuthAtoms.tsx` | 552 | Multiple `reanimated` blobs; hard to test |
| MEDIUM | `components/care/CareGroupTab.tsx` | 540 | |

**Refactoring priority:** `DashboardView.tsx` and `app/page.tsx` are both over 1,000 LOC. Either component failing at runtime is a critical UX regression. Both should be split into focused sub-components in the next sprint.

---

## Section 2 — Type Safety Holes

**Total findings: 298 instances** across both apps.

### 2.1 Non-Null Assertions (`!.` / `!`) — 262 instances

| Severity | Pattern | Count | Key Files | Risk |
|----------|---------|-------|-----------|------|
| CRITICAL | `dbUser!.id` / `dbUser!.email` | 80+ | Every `app/api/**/route.ts` | Asserted-safe user object is null when auth check fails silently — PHI exposure, data written to wrong user |
| CRITICAL | `csrfError!` returned directly | 38 | All API routes via `validateCsrf()` helper | Returns `undefined` on unexpected code path; response body becomes `undefined` |
| HIGH | `user!.id` in community/chat/share routes | 60+ | `api/community/route.ts`, `api/chat/route.ts`, `api/share/route.ts` | Cross-user data access if user is null |
| MEDIUM | `log.createdAt!.toISOString()` | ~5 | `api/compliance/calendar/route.ts` | Audit log timestamps crash if null |
| MEDIUM | `process.env.APP_KILL_REASON!.trim()` | 2 | `api/version/route.ts` | Crash on missing env var |
| LOW | Non-null in test mock assertions | 20+ | `__tests__/*.test.ts` | Tests only; but masks defensive-coding habit |

**Example of the systemic pattern (hundreds of occurrences):**
```ts
// Current — unsafe
const userId = dbUser!.id;

// Required — safe
const userId = dbUser?.id;
if (!userId) return apiError('Unauthorized', 401);
```

### 2.2 `as any` Casts — 20 instances

| Severity | File | Line(s) | Description |
|----------|------|---------|-------------|
| HIGH | `lib/soft-delete.ts` | 48, 78, 103 | `const tblAny = tbl as any` — dynamic table access without type guard; wrong table could be soft-deleted |
| HIGH | `apps/mobile/src/services/healthkit.ts` | 224–241 | `(r as any).name`, `(r as any).dose`, `(r as any).testName` — PHI (medications, labs) parsed without type guards |
| HIGH | `apps/mobile/src/components/DailyAlertsCard.tsx` | 93 | `(labsRaw as any)?.labs` — lab alert data structure uncertain |
| MEDIUM | `apps/mobile/src/components/TodaysMedicationsCard.tsx` | 135, 160, 176 | Route navigation typed as `any` |
| MEDIUM | `apps/mobile/src/services/notifications.ts` | 84, 210–211, 305 | Native module accessed without type contract |
| LOW | Auth/reset test files | multiple | Test fixture mocks |

### 2.3 `as unknown` Casts — 15 instances

| Severity | File | Line | Description |
|----------|------|------|-------------|
| HIGH | `app/api/chat/route.ts` | 293 | `memoriesData as unknown as Record<string, unknown>[]` — AI context memories cast without validation |
| HIGH | `lib/memory-conflict.ts` | 42 | Vector similarity search result cast without parse |
| HIGH | `lib/memory/retrieve.ts` | 329 | DB rows cast without Zod/runtime parse |
| HIGH | `lib/trials/tools.ts` | 76, 112 | Clinical trial location data cast — wrong geography in trial recommendations |
| MEDIUM | `components/MessageBubble.tsx` | 108 | Tool-call part parsed via unsafe cast |
| MEDIUM | `app/api/cron/memory-decay/route.ts` | 26 | Cron result rowCount guessed via cast |

### 2.4 `@ts-expect-error` — 1 instance (Acceptable)

`apps/mobile/src/components/AnimatedCounter.tsx:42` — legitimate Reanimated framework incompatibility, well-documented.

---

## Section 3 — Async Error Swallowing

### 3.1 Missing `.catch()` on Promise Chains

| Severity | File | Line(s) | Impact |
|----------|------|---------|--------|
| HIGH | `components/CsrfProvider.tsx` | 26–28 | CSRF token fetch has no `.catch()` — network failure silently blocks all form submissions |
| MEDIUM | `components/DashboardView.tsx` | 252–274 | Multiple `.then()` data fetches (weekly updates, care team, timeline) without `.catch()` — dashboard silently empty |
| MEDIUM | `components/SettingsPage.tsx` | 68–70 | Share links fetch no `.catch()` |
| MEDIUM | `components/trials/TrialsTab.tsx` | 128–132 | Per-fetch `.then(r => r.json())` inside `Promise.allSettled` can reject silently |

### 3.2 Empty / Log-Only Catch Blocks

| Severity | File | Line(s) | Pattern |
|----------|------|---------|---------|
| MEDIUM | `lib/offline-queue.ts` | 17, 51 | `catch { return [] }` and `catch { remaining.push(...) }` — offline mutation failures invisible |
| MEDIUM | `apps/mobile/src/services/wellnessVitals.ts` | 43, 73, 81 | `catch { // ignore }` on AsyncStorage health data sync |
| MEDIUM | `apps/mobile/src/services/healthkit.ts` | 112–114 | `catch { /* drop silently */ }` — HealthKit sync queue drops with no telemetry |
| MEDIUM | `apps/mobile/src/services/notifications.ts` | 49, 89, 97, 193, 195, 212, 214 | `.catch(() => {})` on AsyncStorage notification pref writes — preference changes lost silently |
| MEDIUM | `lib/trials/matchingQueue.ts` | 175, 185, 195 | `.catch(() => {})` — trial match notifications silently not delivered |
| LOW | `components/BugReportButton.tsx` | 43–46 | Silent fail shows success UI to user; acceptable UX choice but deceptive |

### 3.3 Missing Error Boundaries

| Severity | Location | Finding |
|----------|----------|---------|
| HIGH | `apps/mobile/src/` | **No ErrorBoundary component exists.** Any uncaught render error crashes the entire app with no recovery path. |
| MEDIUM | `apps/web/src/app/` | No `global-error.tsx` — layout-level errors fall through to browser default. Route-level `error.tsx` files exist at `(app)/` and `shared/[token]/`. |

---

## Section 4 — N+1 Query Risk

### 4.1 Confirmed N+1 Patterns

| Severity | File | Lines | Pattern |
|----------|------|-------|---------|
| HIGH | `app/api/checkins/route.ts` | 228–235 | `for (userId of caregiverUserIds) { await db.insert(notificationDeliveries).values({...}) }` — N separate INSERT round trips; should batch to single `.values([...array...])` |
| MEDIUM | `app/api/care-group/route.ts` | 31–38 | Sequential `await bcrypt.compare()` inside loop over existing groups — CPU-bound blocking; should `Promise.all()` |
| MEDIUM | `app/api/health-summary/route.ts` | 40–50 | 9 parallel `db.select()` calls via `Promise.all()` — correct parallelism but all 9 are separate round trips; 2–3 JOINed queries could halve latency |

**The `checkins` N+1 is the only true database N+1.** The others are parallel but still unnecessarily chatty. For a health app serving caregivers with multiple patients, the 9-query health summary will compound as user base grows.

---

## Section 5 — Test Coverage Gaps

### 5.1 Summary

| Metric | Value |
|--------|-------|
| Total `lib/` source files | 71 |
| Files with test coverage | 25 (35%) |
| Files with **no** coverage | 46 (65%) |
| Uncovered LOC (estimated) | 7,374 |

### 5.2 Critical — Zero Test Coverage

| Severity | File | LOC | Why It Matters |
|----------|------|-----|----------------|
| CRITICAL | `lib/auth.ts` | 190 | Core auth logic; zero tests means regressions ship silently |
| CRITICAL | `lib/agents/orchestrator.ts` | 238 | Multi-agent routing; untested orchestration can loop or lose context |
| CRITICAL | `lib/tools.ts` | 718 | AI tool definitions; wrong tool shape breaks chat silently |
| CRITICAL | `lib/agents/specialists.ts` | 408 | Specialist agent configs; untested prompt drift |
| HIGH | `lib/memory/retrieve.ts` | 350 | Memory retrieval; already using `as unknown` casts; no safety net |
| HIGH | `lib/email.ts` | 394 | All transactional email templates; silent breakage invisible |
| HIGH | `lib/trials/matchingQueue.ts` | 253 | Matching queue; already has silent `.catch(() => {})` |
| HIGH | `lib/trials/clinicalTrialsAgent.ts` | 164 | Trial matching agent |
| HIGH | `lib/trials/gapAnalysis.ts` | 125 | Gap analysis for trial eligibility |
| HIGH | `lib/onboarding/phase-machine.ts` | 190 | Onboarding state machine; wrong state = broken first-run UX |
| MEDIUM | `lib/compliance-tracker.ts` | 168 | PHI-adjacent compliance logic |
| MEDIUM | `lib/drug-interactions.ts` | 106 | Drug safety feature; wrong output is a patient safety risk |
| MEDIUM | `lib/reminders.ts` | 153 | Reminder scheduling |
| MEDIUM | `lib/treatments.ts` | 301 | Treatment data transforms |
| MEDIUM | `lib/appointment-prep.ts` | 164 | Appointment preparation templates |

### 5.3 Tested Files (Baseline)

Tests exist for: `lib/memory/__tests__/extract.test.ts`, `lib/memory/__tests__/retrieve.test.ts` (partial), `lib/health-score.ts`, `lib/fhir.ts`, `lib/auth-config.ts`, and API route unit tests under `app/api/*/__tests__/`. The `__tests__` coverage is concentrated in the HealthKit sync pipeline and auth flows — good coverage where it exists, but the agent and trial layers are completely dark.

---

## Section 6 — Bundle Bloat

### 6.1 Web App (`apps/web/package.json`)

| Severity | Package | Version | Issue | Action |
|----------|---------|---------|-------|--------|
| MEDIUM | `recharts` | 3.8.1 | ~80KB gzip; full import pulls entire chart library | Audit actual chart usage; use dynamic import or replace simple sparklines with `react-sparklines` (~5KB) |
| MEDIUM | `jspdf` | 4.2.1 | ~140KB; always in client bundle | Move PDF generation server-side (Next.js API route + `@react-pdf/renderer`) OR use `next/dynamic` with `ssr: false` and `loading` placeholder |
| LOW | `axios` | 1.15.2 | 14KB if `fetch` is also used natively | Verify single HTTP strategy; if both exist, migrate API calls to native `fetch` + `AbortController` |
| ✅ OK | `date-fns` | 4.1.0 | Tree-shakeable; replaces moment correctly | No action |
| ✅ OK | `@aws-sdk/*` | v3 | Modular v3 clients, not monolithic SDK | No action |

**No moment, lodash, core-js, or @babel/polyfill detected.** The web bundle baseline is healthy.

### 6.2 Mobile App (`apps/mobile/package.json`)

No heavy dependencies detected. Expo module usage is correct and efficient. No action required.

---

## Section 7 — Schema Drift

### 7.1 Migration Coverage

| Metric | Value |
|--------|-------|
| Tables defined in `schema.ts` | 62 |
| Tables with `CREATE TABLE` in migrations | 18 |
| Tables with only `ALTER TABLE` in migrations | 14 |
| Tables with **no migration at all** | **44** |

### 7.2 Known Drift Evidence

Migration `008_premium_care_os.sql` contains an explicit comment:
> *"Production received these manually on 2026-04-24 but no migration file was ever committed, leaving dev drifted."*

This is the second known occurrence of out-of-band production schema changes. The pattern is high-risk for a HIPAA-adjacent application.

### 7.3 Tables in `schema.ts` with No Migrations

`appointments`, `audit_logs`, `care_team_activity`, `care_team_activity_log`, `claims`, `community_posts`, `community_replies`, `community_upvotes`, `connected_apps`, `cron_state`, `doctors`, `documents`, `fsa_hsa`, `health_summaries`, `insurance`, `matching_queue`, `medication_reminders`, `messages`, `mutations`, `notification_deliveries`, `notifications`, `prior_auths`, `push_subscriptions`, `reminder_logs`, `saved_trials`, `scanned_documents`, `shared_links` (has ALTER, no CREATE), `symptom_entries`, `treatment_cycles`, `user_preferences`, and 14 more.

Most were created in the initial bootstrap before migration tracking began — but new environments (staging refresh, developer onboarding, disaster recovery) will be missing these tables unless `drizzle-kit push` is explicitly run. Given the production manual-schema precedent, a fully automated baseline migration is necessary.

### 7.4 Other Drift Issues

| Severity | Issue |
|----------|-------|
| MEDIUM | **Duplicate migration file:** `017_performance_indexes.sql` and `017_performance_indexes_queryeditor.sql` exist — unclear which was applied; could cause index conflicts |
| LOW | `invites` table referenced in `migrations/001_*.sql` but **not in `schema.ts`** — likely deprecated but query references may still exist |

---

## Top 10 Action Items — Ranked by Impact

| Rank | Action | Severity | Effort | Domain |
|------|--------|----------|--------|--------|
| 1 | **Replace all `dbUser!` / `user!` non-null assertions in API routes with explicit null guards** (`if (!dbUser?.id) return apiError(401)`). 80+ instances across every route. Auth integrity and PHI protection depend on this. | CRITICAL | 2 days | Type Safety |
| 2 | **Generate and commit a baseline migration for the 44 schema-only tables.** Run `drizzle-kit generate` to produce SQL, commit under `migrations/000_baseline.sql`. Add CI step to block deploys when schema.ts and migration count diverge. | CRITICAL | 1 day | Schema Drift |
| 3 | **Add a React `ErrorBoundary` to the mobile app root.** Without it, any uncaught render error shows a blank screen with no recovery. Wrap `<App>` and add a fallback UI. | HIGH | 4 hours | Async / Error Handling |
| 4 | **Write tests for `lib/auth.ts`, `lib/tools.ts`, and `lib/agents/orchestrator.ts`.** These are the three highest-LOC, zero-coverage critical-path files. Auth regressions are invisible; agent prompt drift is invisible. | HIGH | 3 days | Test Coverage |
| 5 | **Add type-safe Zod parsing to HealthKit FHIR record consumption** (`apps/mobile/src/services/healthkit.ts:224–241`). Eight `as any` casts on medication names, dosages, and lab values represent a PHI correctness risk. | HIGH | 1 day | Type Safety |
| 6 | **Fix the CSRF provider's missing `.catch()`** (`components/CsrfProvider.tsx:26`). A network blip during CSRF init silently blocks all form submissions for the session. One `.catch(err => console.error('[csrf]', err))` + retry. | HIGH | 1 hour | Async / Error Handling |
| 7 | **Batch the N+1 INSERT in `app/api/checkins/route.ts:228–235`.** Replace the caregiver-notify loop with a single `db.insert(notificationDeliveries).values(caregiverUserIds.map(...))`. Immediate improvement for all multi-caregiver profiles. | HIGH | 2 hours | N+1 Queries |
| 8 | **Decompose `DashboardView.tsx` (1,072 LOC) and `app/page.tsx` (1,107 LOC)** into focused sub-components. Extract tabs, data-fetch hooks, and card sections. Each resulting component should be independently testable. | MEDIUM | 3 days | Complexity |
| 9 | **Lazy-load `jspdf` and audit `recharts` import depth** in the web app. Move PDF export to a server-side API route; replace any `import * from 'recharts'` with named imports to enable tree-shaking. | MEDIUM | 4 hours | Bundle Bloat |
| 10 | **Consolidate or delete the duplicate `017_performance_indexes_queryeditor.sql` migration** and verify `invites` table deprecation. Prevents index-creation conflicts on fresh cluster deploys. | MEDIUM | 1 hour | Schema Drift |

---

## Appendix — Health Check Baseline

Pre-push checks as of audit date (run before committing this document):

```
npm run typecheck   — verify
npm run lint        — verify
npm run test:run    — verify
npm run deadcode    — verify
```

All four must be green before merging this branch.

---

*Audit generated 2026-05-24. Re-run when significant changes land in `lib/`, `app/api/`, or `schema.ts`.*
