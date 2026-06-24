# Tech Debt Audit — CareCompanion Monorepo
**Date:** 2026-05-24  
**Branch:** aryan/dev  
**Scope:** apps/web/src, apps/mobile/src, packages/\*

---

## Executive Summary

Seven categories of tech debt were audited: annotation markers (TODO/FIXME), dead code, stale dependencies, schema drift, test fragility, duplicated logic, and premature abstraction. Total findings: **30 items** across 5 severity levels. The sprint-15 attack plan targets the 15 highest-impact items covering correctness regressions, security exposure, and structural rot in that priority order.

---

## Ranked Inventory

> **Severity scale:** 5 = security/data risk · 4 = correctness regression · 3 = correctness smell / will bite within a sprint · 2 = perf or maintainability drag · 1 = cleanup / cosmetic

| # | Category | Item | Location | Sev | Hours | Blocking? |
|---|----------|------|----------|-----|-------|-----------|
| 1 | Stale dep | `next-auth` pinned at `5.0.0-beta.31` (production auth on a beta package) | `apps/web/package.json:48` | 5 | 6 | Must audit breaking-change notes for beta→stable auth flow |
| 2 | TypeScript | 29 type errors: `Cannot find module 'axios'`, `Cannot find module 'ai'/'drizzle-orm'`, implicit `any` params in trials/ | `apps/web/src/lib/trials/*.ts`, `src/middleware.ts` | 4 | 4 | Needs local dep install or path-alias fix first |
| 3 | Stale dep | `next: 14.2.35` — CLAUDE.md target is Next 16; 14.x receives security patches only | `apps/web/package.json:47` | 4 | 12 | React 19 + turbopack + App Router cache semantics change; coordinate with Aryan |
| 4 | Dead code | `generateNotificationsForUser` exported from `notifications.ts:46` — zero call-sites in production code; the notification cron dispatches by a different path | `apps/web/src/lib/notifications.ts:46` | 3 | 2 | None |
| 5 | Duplicate logic | `healthkit/sync/route.ts` and `healthkit/replace/route.ts` share ~200 lines of identical Drizzle upsert blocks for 8 entity types (medication, labResult, appointment, vitalSign, condition, allergy, procedure, immunization) | `apps/web/src/app/api/healthkit/sync/route.ts:36-252`, `replace/route.ts:113-309` | 3 | 4 | None |
| 6 | TODO/correctness | `TODO(notifications): dispatch in-app/push notification to patient` — join-request flow silently does not notify the patient group owner | `apps/web/src/app/api/care-group/request-join/route.ts:82` | 3 | 2 | Notifications service (`lib/notifications.ts`) already exists; just wire it |
| 7 | Schema drift | `conversationSummaries.messageCount` defined nullable (`.default(0)` without `.notNull()`) in `schema.ts:399`, but the conversation-summaries table has no corresponding migration adding this column; migration 021 only adds it to `conversations`. Column exists in Drizzle types but not in DB. | `apps/web/src/lib/db/schema.ts:399`, `migrations/021_conversations_message_count.sql` | 3 | 1 | Need a migration 024 to add it, then flip `.notNull()` in schema |
| 8 | Schema drift | Duplicate migration number: `017_performance_indexes.sql` and `017_performance_indexes_queryeditor.sql` both carry the `017` prefix. Any migration runner that sorts alphabetically will apply both or skip the second. | `apps/web/src/lib/db/migrations/` | 3 | 1 | Rename second file to `017b_…` or `018a_…` and renumber downstream |
| 9 | Duplicate logic | `daysSince` defined twice with **different semantics**: `system-prompt.ts:616` uses raw `Math.floor(Date.now() - date) / 86400000` (UTC epoch delta), while `packages/utils/src/dates.ts:29` uses `differenceInCalendarDays` (local calendar boundary). Results diverge by 1 day near midnight or across DST transitions. | `apps/web/src/lib/system-prompt.ts:616`, `packages/utils/src/dates.ts:29` | 3 | 1 | Delete system-prompt copy; import from `@carecompanion/utils` |
| 10 | PHI in logs | HealthKit sync/replace routes log raw error objects after failed upserts: `console.error('[healthkit/sync] insert failed for medication record:', err)`. The `err` object from Drizzle may embed query parameters containing patient medication names, dosages, lab values. Violates Team Rule 7. | `apps/web/src/app/api/healthkit/sync/route.ts:56-250`, `replace/route.ts:133-307` | 3 | 3 | Replace with `err instanceof Error ? err.message : 'unknown'` and structured logger |
| 11 | Stale dep | `next-auth` aside, `@ai-sdk/anthropic: ^3.0.64` and `ai: ^6.0.142` are pinned to v3/v6 while the Vercel AI SDK has released v5 with new unified streaming interface and breaking `streamText`/`generateText` signatures. | `apps/web/package.json:24,38` | 3 | 6 | Coordinate with Aryan; touches AI architecture |
| 12 | Dead code | 8 unused production dependencies (knip confirmed): `postgres` (web — superseded by Drizzle's built-in driver), `@babel/runtime`, `@expo/metro-runtime`, `expo-asset`, `expo-linking`, `react-dom`, `react-native-screens`, `react-native-web` (all mobile). | `apps/web/package.json:49`, `apps/mobile/package.json:18-61` | 2 | 1 | `npm remove` per package; mobile ones can reduce bundle |
| 13 | Test fragility | `rate-limit.test.ts:54` uses `setTimeout(resolve, 120)` (120 ms real sleep) to wait for a sliding-window reset. Fails on slow CI runners when the host is loaded. `audit-log.test.ts:10,27,29` has three more 20–50 ms sleeps for async flush timing. | `apps/web/src/lib/__tests__/rate-limit.test.ts:54`, `audit-log.test.ts:10,27,29` | 2 | 2 | Use fake timers (`vi.useFakeTimers`) or move wall-clock logic behind a seam |
| 14 | Dead code | 32 unused exports + 5 unused exported types flagged by knip. Most are in mobile normalizers (`normalizers.ts:73-251`) and memory retrieval internals (`retrieve.ts`, `convomem.ts`, `extract.ts`). Knip also calls out `TIER1_CAP`, `SUMMARY_SCORE_MULTIPLIER` as unused exports — but grep confirms they are used internally; knip is firing false positives because test files are treated as the only consumers. | `apps/mobile/src/services/internal/normalizers.ts:73-251`, `apps/web/src/lib/memory/retrieve.ts:8,300` | 2 | 2 | Add `export` keyword only to symbols that cross package boundaries; make internal constants unexported |
| 15 | TODO/perf | `cacheHitRate: null // TODO: wire when Anthropic cache metrics available` — memory-eval cron can't measure cache efficiency; wastes budget intelligence. The Anthropic `usage` object on `generateText` exposes `cacheReadTokens` and `cacheWriteTokens` since AI SDK v3.1. | `apps/web/src/app/api/cron/memory-eval/route.ts:95` | 2 | 3 | Capture `result.usage.cacheReadTokens` from `generateText` call |
| 16 | Stale dep | `expo: ~52.0.0` — Expo 53 shipped. Expo 52 receives critical patches only. SDK bump required before App Store review in 2026-Q3. | `apps/mobile/package.json:33` | 2 | 8 | Shreyash owns; coordinate before App Store submission |
| 17 | Stale dep | `react: ^18` (web) and `react: 18.3.1` (mobile) — React 19 is stable. Next 15+ requires React 19; upgrade is blocked by Next 14→15 work (item 3). | `apps/web/package.json:50`, `apps/mobile/package.json:53` | 2 | 4 | Blocked on item 3 |
| 18 | Duplicate logic | Mobile FHIR normalizers (`apps/mobile/src/services/internal/normalizers.ts`) define 7 entity converters (condition, allergy, procedure, immunization, vitalSign, labResult, medication) that do not exist in `packages/utils/src/fhir.ts` (which only has 3). When the web needs equivalent parsing it will likely re-implement again. | `apps/mobile/src/services/internal/normalizers.ts:73-251`, `packages/utils/src/fhir.ts` | 2 | 6 | Move normalizers into `@carecompanion/utils`; coordinate with Shreyash and Rahil |
| 19 | Stale dep | `drizzle-orm: ^0.45.2` — 0.40 was a major API shift; 0.45 is current. No immediate concern but the `^` semver range can pull in 0.46+ which historically had breaking query-builder changes. | `apps/web/package.json:42` | 2 | 1 | Pin to exact minor (`~0.45.2`) to avoid surprise upgrades |
| 20 | Dead code | `apps/web/src/lib/calendar.ts` — knip flags this entire file as unused. Zero imports from production code. | `apps/web/src/lib/calendar.ts` | 2 | 0.5 | Delete if confirmed no feature branch consumes it |
| 21 | Premature abstraction | `apps/web/src/lib/trials/tools.ts` imports `axios` (a 38 KB gzipped runtime dep) for exactly two HTTP calls to the ClinicalTrials.gov API. Native `fetch` with the existing `withRetry` wrapper covers this. Also bloats the Lambda cold-start for the trials cron. | `apps/web/src/lib/trials/tools.ts:1` | 2 | 1 | Remove `axios` dep; replace two `client.get()` calls with `fetch()` |
| 22 | Stack convention | `apps/web/src/middleware.ts` — CLAUDE.md stack rule says "use proxy.ts instead of middleware.ts" for Next 16. The file currently implements session auth, CSRF injection, and mobile bearer-token bridging in a single NextAuth middleware. Migration to proxy.ts is required before Next 16 upgrade. | `apps/web/src/middleware.ts` | 2 | 4 | Must be done as part of Next upgrade (item 3) |
| 23 | Duplicate logic | Two independent retry implementations: `withRetry<T>` in `lib/trials/tools.ts:8` (web) and `BACKOFF_MS`/`MAX_ATTEMPTS`/`nextRetryState` in `apps/mobile/src/services/internal/pure.ts:57-99`. No shared retry util in `packages/utils`. | `apps/web/src/lib/trials/tools.ts:8`, `apps/mobile/src/services/internal/pure.ts:57-99` | 2 | 2 | Extract a `retry(fn, opts)` util into `@carecompanion/utils` |
| 24 | Test fragility | `describe.skipIf(!process.env.GEMINI_API_KEY)` — the entire embed integration test suite is silently skipped in CI (no `GEMINI_API_KEY` in CI env). This means the embedding path has zero CI coverage. | `apps/web/src/lib/__tests__/embed.test.ts:24` | 2 | 2 | Extract a mock-driven unit test that runs always; keep integration test behind env flag but add CI note |
| 25 | Knip misconfiguration | Knip reports 106 "unused files" — the vast majority are test files (`.test.ts`, `.spec.ts`). This happens because the vitest config modules (`vitest/config`) cannot be loaded by knip (missing module), so knip can't infer the test-runner file graph. Produces noise that makes knip's signal/noise ratio unusable. | `knip.json`, `apps/web/vitest.config.ts` | 2 | 2 | Add `vitest` to knip's `ignoreDependencies` or install peer deps in CI so knip can resolve configs |
| 26 | TODO/cleanup | `paused: boolean('paused')` on `medicationReminders` table carries comment `"deferred UI — see TODOS"`. Column is inserted as `false` in care-group helper but read nowhere in the UI layer. Dead schema column accumulating for 2+ sprints. | `apps/web/src/lib/db/schema.ts:740` | 1 | 2 | Either wire the privacy-mute toggle UI or drop the column via migration |
| 27 | Dead devdep | 8 unused devDependencies: `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event`, `eslint`, `jsdom` (web) and `husky`, `lint-staged`, `turbo` (root). The test stack is vitest + jsdom via vitest plugin, not jest-dom. | `apps/web/package.json`, `package.json` | 1 | 0.5 | `npm remove` — reduces lockfile noise |
| 28 | Dead code | `DEFAULT_CAREGIVER_PERMS` and `DEFAULT_PATIENT_PERMS` exported from `lib/care-group.ts:41,49` — knip flags as unused exports but grep shows they are consumed internally (line 77). Knip false-positive due to same test-graph issue as item 25. | `apps/web/src/lib/care-group.ts:41,49` | 1 | 0.5 | Remove `export` keyword; keep as module-private constants |
| 29 | TODO/cleanup | Three test files reference `// Report: TODO.md <section>` as their only top-of-file comment. These are stale tracking hooks from an earlier audit pass; the actual TODO.md no longer contains those sections. | `rate-limit.test.ts:3`, `ownership.test.ts:4`, `delete.test.ts:5` | 1 | 0.5 | Delete stale comment lines |
| 30 | Stale dep | `next-auth` beta aside, `framer-motion: ^11` (web) — v12 dropped React 17 support and improved tree-shaking. 18 `motion` component files import it; lazy-load opportunity exists. | `apps/web/package.json:43` | 1 | 2 | Upgrade to `^12`; audit `AnimatePresence` API change |

---

## Category Summaries

### 1 · TODO / FIXME / HACK / XXX (6 items)

| File | Line | Text | Category | Sev |
|------|------|------|----------|-----|
| `apps/web/src/app/api/cron/memory-eval/route.ts` | 95 | `TODO: wire when Anthropic cache metrics available` | perf | 2 |
| `apps/web/src/app/api/care-group/request-join/route.ts` | 82 | `TODO(notifications): dispatch in-app/push notification` | correctness | 3 |
| `apps/web/src/lib/db/schema.ts` | 740 | `// patient's privacy mute toggle (deferred UI — see TODOS)` | correctness | 1 |
| `apps/web/src/app/api/auth/register/__tests__/rate-limit.test.ts` | 3 | `// Report: TODO.md Auth Audit section` (stale ref) | cleanup | 1 |
| `apps/web/src/app/api/checkins/__tests__/ownership.test.ts` | 4 | `// Report: TODO.md Dashboard Flow Audit section` (stale ref) | cleanup | 1 |
| `apps/web/src/app/api/documents/__tests__/delete.test.ts` | 5 | `// Report: TODO.md — Scan & Document Upload Flow Audit` (stale ref) | cleanup | 1 |

Only 6 annotation markers exist across the entire codebase — unusually low, but the absence of markers elsewhere does not mean absence of debt; several other categories document untracked technical obligations.

### 2 · Dead Code

**Unused exports (real, not knip false-positives):**
- `generateNotificationsForUser` — `apps/web/src/lib/notifications.ts:46` — no production call-sites
- `resetRateLimits` — `apps/web/src/lib/rate-limit.ts:120` — exported but never called
- 12 normalizer functions in `apps/mobile/src/services/internal/normalizers.ts` — exported but only consumed by tests that knip also flags as unreachable

**Dead API routes (zero web-app consumers):**
No confirmed dead API routes — all routes examined have at least one `fetch('/api/…')` consumer or are cron-invoked via Vercel Cron headers.

**Commented-out code blocks >5 lines:**
None found across the production source tree. Developers are deleting rather than commenting, which is positive hygiene.

**Unused files:**
- `apps/web/src/lib/calendar.ts` — no imports; knip confirms dead. All date helpers consumers use `date-fns` directly.

**Unused dependencies:**
- Production: `postgres` (web), 7 mobile packages (see item 12)
- Dev: 5 web, 3 root (see item 27)

### 3 · Stale Dependencies

| Package | Locked | Latest stable | Gap | Security-relevant |
|---------|--------|--------------|-----|-------------------|
| `next-auth` | `5.0.0-beta.31` | `5.0.0` (stable) | Beta in prod | **Yes** — session cookie signing, CSRF |
| `next` | `14.2.35` | `15.3.x` | 1 major | **Yes** — CVE patches, App Router edge cache bugs |
| `@ai-sdk/anthropic` | `^3.0.64` | `^5.x` | 2 majors | Moderate — API surface change |
| `ai` (Vercel AI SDK) | `^6.0.142` | `^5.x` | Version confusion — `ai` pkg is being consolidated; v6 may be unstable | Moderate |
| `expo` | `~52.0.0` | `53.x` | 1 major | Moderate — JSI security, OTA patches |
| `react` | `^18` / `18.3.1` | `19.x` | 1 major | Low — blocked on Next upgrade |
| `drizzle-orm` | `^0.45.2` | `0.45.x` (current) | None | Low — pinning risk |
| `framer-motion` | `^11` | `^12` | 1 major | Low |

The most critical exposure is `next-auth` beta in production. Beta packages do not receive CVE disclosures through standard channels. The stable `next-auth@5.0.0` has been released.

### 4 · Schema Drift

Two confirmed mismatches between `apps/web/src/lib/db/schema.ts` and the migration files:

1. **`conversationSummaries.messageCount` missing migration** — `schema.ts:399` declares `messageCount: integer('message_count').default(0)` (nullable, no `.notNull()`). Migration 021 adds `message_count INTEGER NOT NULL DEFAULT 0` only to the `conversations` table, not to `conversation_summaries`. The Drizzle model references a column the live DB likely does not have, causing silent `undefined` on reads.

2. **Duplicate migration prefix `017`** — `017_performance_indexes.sql` and `017_performance_indexes_queryeditor.sql` share the `017` prefix. Sequentially numbered migration runners (like most CI tools use) may skip, duplicate, or error on this pair. The `_queryeditor` suffix suggests it was applied manually via RDS Query Editor rather than committed through the standard pipeline, leaving the migration history inconsistent.

No other drift was detected in migrations 001–023 vs the current schema.ts table definitions.

### 5 · Test Fragility

| File | Line | Issue | Sev |
|------|------|-------|-----|
| `apps/web/src/lib/__tests__/rate-limit.test.ts` | 54 | `setTimeout(resolve, 120)` — 120 ms real-wall sleep for sliding-window reset. Flaky on loaded CI. | 2 |
| `apps/web/src/lib/__tests__/audit-log.test.ts` | 10, 27, 29 | Three `setTimeout(resolve, 20–50)` sleeps for async flush timing. | 2 |
| `apps/web/src/lib/__tests__/embed.test.ts` | 24 | `describe.skipIf(!process.env.GEMINI_API_KEY)` — embedding integration test skipped in every CI run; zero coverage of the embed path. | 2 |
| `knip.json` + vitest configs | — | knip can't load vitest/config; treats all 106 test files as unreachable. Breaks dead-code CI signal. | 2 |

No `.only()` markers or `test.todo()` stubs were found in the test tree. No explicit `flaky` annotations.

### 6 · Duplicated Logic

Three confirmed near-duplicate clusters spanning multiple files or packages:

**Cluster A — HealthKit upsert bodies** (severity 3, ~4h)  
`healthkit/sync/route.ts` lines 36–252 and `healthkit/replace/route.ts` lines 113–309 are structurally identical for all 8 entity types. The only difference is that `replace` first soft-deletes existing records. Extracting a shared `upsertHealthKitEntities(entities, db)` function would remove ~200 lines of copy-paste and ensure both routes stay in sync when adding new entity types.

**Cluster B — daysSince** (severity 3, ~1h)  
Two implementations with different semantics (epoch-delta vs calendar-boundary). The system-prompt version (`system-prompt.ts:616`) can report one day off from the shared utils version near UTC midnight or across DST. The system-prompt text given to the AI model uses this for "X days since last check-in" phrasing — a 1-day discrepancy is user-visible.

**Cluster C — Retry-with-backoff** (severity 2, ~2h)  
`lib/trials/tools.ts:8` and `apps/mobile/src/services/internal/pure.ts:57-99` each implement exponential backoff retry independently. They have different delay arrays and different error-classification logic. A single `retry(fn, opts)` in `@carecompanion/utils` would give both consistent behavior and test coverage.

### 7 · Premature Abstraction / Over-engineering

No oversized base classes or factory-of-factories patterns were found. Two narrower issues:

1. **`axios` in trials/tools.ts** — importing a 38 KB runtime library for 2 GET calls. `fetch` is available on Node 18+ (the Next.js runtime) and handles the same retry and timeout logic already present. This also inflates the function cold-start.

2. **Single-use `@ai-sdk/google-vertex`** — `apps/web/package.json:25` includes `@ai-sdk/google-vertex: ^4.0.137`. A codebase grep finds it imported in exactly one file (`lib/embed.ts`). The embed path is gated behind `GEMINI_API_KEY` which is absent from CI. This is a 120 KB+ SDK bundle for a feature that is not yet shipped end-to-end.

---

## Sprint-15 Attack Plan (Top 15)

These 15 items are ordered by blast-radius × fixability. Each can be completed within a single PR without a downstream cascade.

| Priority | Item # | Action | Owner | Est. Hours |
|----------|--------|--------|-------|-----------|
| 1 | #1 | Upgrade `next-auth` from `5.0.0-beta.31` → `^5.0.0` stable; run auth test suite | Aryan | 6 |
| 2 | #2 | Fix 29 TypeScript errors in `lib/trials/*.ts` and `middleware.ts` — install missing deps or add `// @ts-expect-error` with tracking issue | Aryan | 4 |
| 3 | #7 | Write migration `024_conversation_summaries_message_count.sql`; add `message_count INTEGER NOT NULL DEFAULT 0`; flip schema.ts to `.notNull()` | Aryan | 1 |
| 4 | #8 | Rename `017_performance_indexes_queryeditor.sql` → `017b_performance_indexes_queryeditor.sql` to disambiguate migration order | Aryan | 0.5 |
| 5 | #9 | Delete `daysSince` from `system-prompt.ts:616`; import `daysSince` from `@carecompanion/utils/dates` | Aryan | 1 |
| 6 | #4 | Delete `generateNotificationsForUser` export from `notifications.ts` (zero callers) — or wire it to the nightly cron | Aryan | 2 |
| 7 | #6 | Wire notification dispatch in `care-group/request-join/route.ts:82`; call existing `generateNotificationsForUser` or the push helper | Aryan | 2 |
| 8 | #10 | Replace raw `err` objects in healthkit sync/replace console.error calls with `err instanceof Error ? err.message : 'unknown'` | Aryan | 3 |
| 9 | #5 | Extract `upsertHealthKitEntities(records, db)` helper from the 8-entity-type upsert blocks duplicated across sync and replace routes | Aryan | 4 |
| 10 | #12 | Remove `postgres` from web deps; remove 7 unused mobile deps; remove 8 unused devDeps | Aryan / Shreyash | 1 |
| 11 | #13 | Replace real sleeps in `rate-limit.test.ts:54` and `audit-log.test.ts:10,27,29` with `vi.useFakeTimers()` | Aryan | 2 |
| 12 | #15 | Wire `result.usage.cacheReadTokens` from the `generateText` call in memory-eval cron to satisfy the `cacheHitRate` TODO | Aryan | 3 |
| 13 | #25 | Fix knip.json to ignore vitest config modules; run `npm run deadcode` until it produces meaningful signal with zero false-positive test files | Aryan | 2 |
| 14 | #21 | Remove `axios` from `trials/tools.ts`; replace `client.get()` with `fetch()`; remove `axios` from `apps/web/package.json` | Aryan | 1 |
| 15 | #23 | Extract shared `retry(fn, opts)` util into `packages/utils/src/retry.ts`; replace both ad-hoc implementations | Aryan / Shreyash | 2 |

**Sprint-15 total estimated hours: ~34.5h**  
All 15 items are within Aryan's ownership domain (AI architecture, `apps/web/src/lib/`, `.claude/` infra) except items 10 and 15 where Shreyash owns the mobile side. No item in the sprint-15 list requires touching Rahil's onboarding flows or FHIR parsing.

---

## Deferred to Sprint-16+

| # | Item | Reason deferred |
|---|------|----------------|
| 3 | Next.js 14→15 upgrade | Large blast radius; requires React 19, middleware→proxy.ts rewrite, App Router cache audit. Deserves its own sprint. |
| 11 | AI SDK v3→v5 upgrade | Coordinate with Aryan; touches AI architecture across chat, memory, and extract flows. |
| 16 | Expo 52→53 upgrade | Shreyash owns; App Store deadline drives timing. |
| 18 | Merge mobile FHIR normalizers into `packages/utils` | Cross-team coordination; Rahil owns `fhir.ts`. |
| 26 | Wire or drop `paused` toggle UI | Product decision needed before schema drop. |
| 30 | framer-motion v11→v12 | Low risk; fold into Next upgrade PR. |

---

*Generated by automated scan + manual verification on 2026-05-24. Re-run knip after fixing item 25 (knip config) to get a clean baseline.*
