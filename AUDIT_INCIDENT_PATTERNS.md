# Incident Pattern Audit — CareCompanion
**Period:** Last 30 days (2026-04-24 → 2026-05-24)  
**Scope:** All `fix:`, `fix(…):`, `security:`, `security(…):`, and `hotfix:` commits  
**Total fix/security commits:** 22 of 51 total (43%)  
**Analyst:** aryan/dev audit pass

---

## 1. Cluster Table

| # | Category | Commits | % of fixes | Canonical Example |
|---|----------|---------|-----------|-------------------|
| B | **iOS / EAS Build** | 9 | 41% | `fix(mobile): pin expo-application to SDK 52` (#96) |
| H | **Infra / CI Config** | 5 | 23% | `fix(canary): query carecompanion DB not postgres` (#50, #51) |
| C | **Auth / Cognito / Middleware** | 3 | 14% | `fix(middleware): let no-role users reach /login` (#79, #80) |
| S | **Security / HIPAA PHI** | 4 | 18% | `security: Phase 0 HIPAA — redact PHI from push notifications` (#74) |
| A | **Aurora Schema Drift** | 2 | 9% | `db+docs: migration 017 perf indexes + privacy Aurora copy fix` (#75) |
| P | **Push Notifications** | 1 | 5% | Covered under Security cluster |
| G | **State Mgmt / Data Validation** | 3 | 14% | `fix: batch 2 — 9 UI/UX bugs` (#82) |
| O | **Other** | 1 | 5% | `fix(deps): regenerate bun.lock` (#72) |

> Commits frequently span multiple categories (e.g., #74 covers both PHI/Security and Push). Categories above reflect the **primary root cause**. Total exceeds 22 because two commits are dual-classified.

---

## 2. Top-3 Cluster Deep Dives — 5 Whys Analysis

### Cluster B — iOS / EAS Build Failures

**Commit count:** 9  
**Canonical example:** `fix(mobile): pin expo-application to SDK 52 + refresh Pods` (#96), which was the *third* successive fix commit attempting to resolve TestFlight launch crashes on builds 21, 22, and 23.

#### Incident Narrative

Build 21 shipped with a SIGABRT crash on launch inside `expo.controller.errorRecoveryQueue`. The initial diagnosis (commit #94) was a missing `BGTaskSchedulerPermittedIdentifiers` entry in `Info.plist`. A new build (build 22) was submitted — it crashed with an identical signature. The second diagnosis (#95) was Sentry's `react-native` SDK crashing during initialization because `EXPO_PUBLIC_SENTRY_DSN` was unset in the EAS production environment. Sentry was removed. Build 23 still crashed. The *actual* root cause was `expo-application@^56.0.3` in `package.json` — an SDK 56 package running against an SDK 52 project. The SDK 52 autolinker ejected `EXApplication` from the native binary; the JS bundle's `require('expo-application')` threw on launch, the error recovery queue caught it, and the queue itself aborted. Three consecutive TestFlight rejections, ~72 hours of blocked QA time, before root cause was identified.

#### 5 Whys

| Why | Answer |
|-----|--------|
| **1.** Why did TestFlight builds 21/22/23 SIGABRT on launch? | `require('expo-application')` threw because the native module was absent from the binary. |
| **2.** Why was the native module absent? | `expo-application@^56.0.3` was in `package.json`. The SDK 52 autolinker rejected a module built for SDK 56, so `EXApplication` never linked. |
| **3.** Why was an SDK 56 package installed in an SDK 52 project? | A prior upgrade used an unconstrained semver range (`^56.0.3`) rather than `npx expo install expo-application`, which pins to the SDK-correct version (`~6.0.2`). |
| **4.** Why wasn't the mismatch caught before the TestFlight build? | No CI job runs `npx expo-doctor` or `npx expo install --check` to validate that all Expo-managed packages are pinned to the running SDK version. Debug builds succeeded because the JS engine swallows some native-module failures in dev mode. |
| **5.** Why is there no SDK-compatibility gate in CI? | The iOS CI workflow tests only type-check, lint, and archive; there is no pre-archive step that validates Expo SDK parity across all installed packages. |

**Systemic gap:** Missing `expo-doctor` / `expo install --check` gate in the EAS/CI pipeline. The failure only manifests in Release builds submitted to TestFlight, making it invisible to local development.

---

### Cluster H — Infra / CI Config Failures

**Commit count:** 5  
**Canonical example:** `fix(canary): query carecompanion DB not postgres` (#50) immediately followed by `fix(canary): always exit 0, let workflow signal abort` (#51) — two successive fixes to the same 200-line monitoring script, within 13 minutes of each other.

#### Incident Narrative

The canary monitor was introduced in #49 as a GH Actions cron that health-checks the production Aurora cluster. It immediately failed: the script queried the `postgres` system database (hardcoded) rather than the `carecompanion` application database. That was fixed in #50. The workflow then silently dropped CI failure signals: the script exited `1` on abort, which — combined with `pipefail` — killed the workflow step before the `STATUS` variable could be written to `GITHUB_OUTPUT`, so the issue-creation step was never triggered. Fixed in #51. Later, commit #47 had to harden the `api-health-ping` workflow against false positives (the `/api/e2e/signin` endpoint was intentionally 404 in production but the ping was testing it), and #61 migrated the workflow to AWS OIDC after discovering long-lived AWS credentials were still in use.

#### 5 Whys

| Why | Answer |
|-----|--------|
| **1.** Why did the canary monitor query the wrong database? | The script was written with a hardcoded `postgres` db name, not the app db (`carecompanion`). |
| **2.** Why was it hardcoded incorrectly? | The script author was not aware of the `DATABASE_NAME` env var convention established in `apps/web/src/lib/db/index.ts`. |
| **3.** Why wasn't the convention surfaced during review? | There is no automated test or integration check for monitoring scripts; they are not covered by `npm run test:run`. |
| **4.** Why wasn't the exit-code bug caught before merge? | The workflow only runs on a cron or manual dispatch, not on PR push. There is no dry-run/smoke-test step for new workflow files. |
| **5.** Why is there no workflow dry-run gate? | GH Actions workflow validation is limited to YAML syntax; logic errors (wrong exit codes, env var names) are only discovered in production runs. |

**Systemic gap:** CI/monitoring scripts lack a dry-run integration test. New workflow files are only validated by YAML linting, not by logic execution.

---

### Cluster C — Auth / Cognito / Middleware Routing

**Commit count:** 3  
**Canonical example:** `fix(middleware): let no-role users reach /login instead of bouncing to /onboarding` (#79), immediately followed by `fix(middleware): let no-role authenticated users reach /login` (#80) — two successive fixes to the same 80-line middleware file, 27 minutes apart.

#### Incident Narrative

A refactor removed `/set-role` and consolidated role assignment into `/onboarding`. The middleware was updated to redirect role-less authenticated users to `/onboarding`. However, this created a loop: users who had an authenticated session but whose role was `null` (e.g., mid-signup abandons, SSO signups before role selection) would hit any protected route, get redirected to `/onboarding`, which in some states redirected them back. Fix #79 changed the redirect destination to `/login`. But it missed an edge case: *authenticated* users (valid JWT, no role) were still being sent to `/login` rather than being allowed through so the login page could route them forward. Fix #80 patched the condition. Total time to stable: ~27 minutes and 2 production pushes.

#### 5 Whys

| Why | Answer |
|-----|--------|
| **1.** Why did fix #79 immediately require a second fix #80? | The fix considered only unauthenticated no-role users; it did not account for authenticated users with a valid JWT but `role === null`. |
| **2.** Why was the edge case missed? | There is no exhaustive state matrix test for the middleware — the four distinct user states (no-session, authenticated+no-role, authenticated+role, suspended) are not individually covered. |
| **3.** Why are there no middleware state tests? | `src/middleware.ts` (now `proxy.ts` per Next 16 convention) is treated as routing glue rather than business logic deserving test coverage. |
| **4.** Why is there no policy requiring middleware/proxy coverage? | The test suite is focused on API route handlers and React components. There is no rule that redirecting logic must be integration-tested. |
| **5.** Why wasn't this surfaced in manual QA before push? | The invalid user state (authenticated, `role=null`) is hard to reproduce manually without a purpose-built test account; QA checklist did not enumerate this state. |

**Systemic gap:** No integration test matrix for `middleware.ts` / `proxy.ts` routing states. The five states (unauthenticated, authenticated+no-role, authenticated+role, authenticated+suspended, bot/health-check) should each have a test that asserts the correct redirect destination.

---

## 3. Recurring File Hotspots — Top 10, Risk-Ranked

| Rank | File | Touches (30d) | Risk Level | Risk Rationale |
|------|------|---------------|-----------|----------------|
| 1 | `apps/mobile/app/_layout.tsx` | 10 | 🔴 CRITICAL | Root layout — any unhandled throw here is a launch crash (proven: builds 21–23). Loaded on every app boot. |
| 2 | `apps/web/src/lib/db/schema.ts` | 12 | 🔴 CRITICAL | Central DB type truth. Drift between schema.ts and Aurora DDL causes silent data corruption or runtime panics. No migration-schema sync check in CI. |
| 3 | `apps/mobile/ios/CareCompanion/Info.plist` | 8 | 🔴 CRITICAL | Missing keys = TestFlight rejection or runtime crash (BGTask, HealthKit). Apple review is the *only* gate; there is no local pre-build validation. |
| 4 | `apps/mobile/src/services/notifications.ts` | 7 | 🔴 CRITICAL | PHI in push payloads caused a P0 security incident (#74). APNS payloads are logged by third-party SDKs. High blast radius. |
| 5 | `apps/web/src/middleware.ts` | 7 | 🔴 HIGH | Auth routing hub. Three fix/security commits in 30 days. Bugs here affect every authenticated user flow. |
| 6 | `apps/mobile/ios/CareCompanion.xcodeproj/project.pbxproj` | 7 | 🟠 HIGH | Xcode project state machine. Manual edits are brittle; merge conflicts corrupt the project silently. |
| 7 | `apps/mobile/ios/CareCompanion/PrivacyInfo.xcprivacy` | 8 | 🟠 HIGH | Incorrect or missing privacy manifest entries cause App Store rejection. Introduced mid-sprint each time new APIs are added. |
| 8 | `bun.lock` | 11 | 🟡 MEDIUM | Lockfile staleness caused CI failure (#72). Frequently diverges when multiple dev branches add deps concurrently. |
| 9 | `apps/mobile/src/services/healthkit.ts` | 9 | 🟠 HIGH | HealthKit FHIR normalizers handle raw PHI. Normalizer bugs can corrupt clinical records silently. |
| 10 | `apps/web/src/app/api/health/route.ts` | 6 | 🟡 MEDIUM | Health endpoint is the canary gate. Misconfig here (e.g., #47) generates false positive alerts and masks real outages. |

**Key observation:** Files 1, 3, and 6 (`_layout.tsx`, `Info.plist`, `.pbxproj`) interact as a unit — a change to any one frequently requires matching updates to the others, but there is no lint rule or CI check enforcing their co-evolution. Files 4 and 9 both touch PHI and are HIPAA-adjacent; neither has a PHI-redaction unit test.

---

## 4. Anti-Patterns — Revert-Then-Refix Pairs

### Anti-pattern 1: Cascading-Diagnosis TestFlight Crash (Builds 21 → 22 → 23)

**Commits:** #94 → #95 → #96  
**Pattern:** Correct symptom, wrong root cause — three consecutive times.

- **#94** diagnosed BGTask plist entries as the crash cause; shipped build 22.
- **#95** diagnosed Sentry SDK (undefined DSN) as the crash cause; shipped build 23.
- **#96** found the real cause: wrong `expo-application` SDK version.

Each fix was independently reasonable based on available data, but the crash signature was identical for all three causes, making it impossible to distinguish without deeper crash analysis. The result was 3 × EAS archive + TestFlight submission cycles (~45 min each), blocking the entire mobile QA pipeline for ~3 days.

**Root pattern:** No local Release-mode smoke test. Debug builds pass; only TestFlight catches the crash. Without a pre-submission device test in Release mode, hypothesis testing is expensive (one iteration = one TestFlight build).

---

### Anti-pattern 2: Immediate Fix-for-the-Fix (Middleware #79 → #80)

**Commits:** `d225edc` (#79) → `6621d47` (#80), 27 minutes apart  
**Pattern:** Fix shipped to production, broke a related code path, required same-session patch.

- #79 changed middleware to redirect no-role users to `/login` (correct direction).
- #80 added the missing condition: authenticated users with no role must *also* be allowed through.

The second fix was merged 27 minutes after the first, strongly suggesting the breakage was discovered immediately via manual testing post-push rather than in a pre-merge test. This pattern indicates that the fix was typed, pushed, and manually verified in production rather than against a local test harness.

---

### Anti-pattern 3: Canary Script #50 → #51 (Two-Fix Initialization)

**Commits:** `e10f1d3` (#50) → `b9bbf44` (#51), 13 minutes apart  
**Pattern:** New infrastructure script introduced with two latent bugs in sequence.

- Script queried `postgres` DB, not `carecompanion` — fixed in #50.
- Script exited 1 on abort, breaking the workflow status gate — fixed in #51.

Neither bug was caught before the first production cron run because there was no test run of the script against a real (or mock) environment before merge. This is the "works in author's head" anti-pattern: the author understood the intended logic but couldn't verify it without a live cron execution.

---

### Anti-pattern 4: PHI Leak Discovered in Audit, Not Proactively

**Commits:** #63 (P0 security bundle) and #74 (Phase 0 HIPAA push redaction)  
**Pattern:** Security issues surfaced by reactive audit scan rather than proactive gate.

The PHI audit in #63 found 6 confirmed leaks across 220 `console.log`/tracking call sites. Push notification PHI was a separate issue addressed 3 days later in #74. In both cases, the bugs existed in production before the audit ran. No automated pre-commit or pre-push gate was blocking PHI strings from entering logs or push payloads.

---

## 5. Prevention Investments — Top 7 Ranked by ROI

### P1 — `expo-doctor` gate in EAS CI pipeline

**Target cluster:** iOS / EAS Build  
**What:** Add `npx expo-doctor --non-interactive` as the first step in `.github/workflows/ci.yml` (iOS job) and in the EAS build hook (`eas.json` → `cli.appVersionSource` pre-build script). Fail the step if any SDK version mismatch is detected.  
**Also add:** `npx expo install --check` to the pre-push hook so developers see the mismatch before pushing.  
**Effort:** 2 hours  
**Bugs prevented per year (estimated):** 3–5 TestFlight crash builds (based on 3 in this 30-day window alone). Each crash build costs ~3 hours of developer time + 45-minute archive cycle = ~4 hours/incident.  
**Total savings:** ~16–20 hours/year, plus removal of App Store submission risk  
**ROI:** Very high — 2h investment, prevents multi-day QA blocks

---

### P2 — Middleware/proxy route table integration tests

**Target cluster:** Auth / Cognito / Middleware  
**What:** Add a `__tests__/middleware.test.ts` (or `proxy.test.ts`) using `@edge-runtime/vm` or Next.js test utilities. Cover 5 explicit states: (1) unauthenticated → `/login`, (2) authenticated, no role → `/login`, (3) authenticated, role set, accessing protected route → pass-through, (4) authenticated, accessing `/login` → `/dashboard`, (5) health-check paths → pass-through without auth.  
**Also add:** A PR checklist item "if modifying `middleware.ts`: run middleware test suite".  
**Effort:** 4 hours  
**Bugs prevented per year:** 2–3 same-session refix incidents (pattern is established: every middleware change in this period required a follow-up fix). Each incident = ~1 hour of dev + potential user-facing auth failure.  
**Total savings:** ~3–6 hours/year + zero auth regressions in production  
**ROI:** High — 4h investment, prevents production auth breakage

---

### P3 — PHI-redaction lint rule for `console.log` / push payloads

**Target cluster:** Security / HIPAA PHI  
**What:** Add an ESLint rule (custom or `eslint-plugin-no-secrets` + custom pattern) that rejects `console.log`, `logger.info`, and similar calls containing field names known to hold PHI: `patientName`, `medicationName`, `diagnosis`, `dob`, `mrn`, `address`, `phone`. Also add a pre-push Git hook that greps push notification payload builders for raw `patient.*` string interpolation.  
**Also add:** A CI job step (`npm run lint:phi`) that runs this rule on every PR touching `src/lib/notifications.ts`, `src/lib/push.ts`, or any `*notifications*.ts` mobile file.  
**Effort:** 6 hours (rule authoring + config + CI integration)  
**Bugs prevented per year:** 1–2 PHI leak incidents discovered in audit rather than proactively (costs include: HIPAA breach risk, legal review, engineer remediation).  
**Total savings:** Incalculable if a breach is prevented; conservatively ~20 hours of incident response per year  
**ROI:** Extreme — regulatory and reputational risk reduction

---

### P4 — Schema-migration parity CI check

**Target cluster:** Aurora Schema Drift  
**What:** Add a CI step that compares column names and types defined in `apps/web/src/lib/db/schema.ts` against the applied migrations in `apps/web/src/lib/db/migrations/`. This can be done with `drizzle-kit check` or a custom script that introspects the schema from migrations and diffs against the TypeScript schema definition. Fail the step if any column is in schema.ts but not in the latest migration, or vice versa.  
**Effort:** 5 hours  
**Bugs prevented per year:** 1–2 schema drift incidents (schema.ts is the most-touched file in the repo at 12 touches in 30 days).  
**Total savings:** ~8–10 hours/year of production debugging, plus prevention of silent data corruption  
**ROI:** High — schema drift in a HIPAA context carries audit risk

---

### P5 — Pre-submission Release-mode device smoke test

**Target cluster:** iOS / EAS Build  
**What:** Add a mandatory step before any TestFlight submission: run the app in Release mode on a physical device (or Simulator with Release scheme) and verify the splash screen resolves without crash within 10 seconds. This can be scripted with `xcodebuild -scheme CareCompanion -configuration Release -destination 'platform=iOS Simulator,name=iPhone 15'` and a `xcrun simctl launch` + `xcrun simctl logverbose` check for `SIGABRT` or `NSException`.  
**Add to:** EAS build runbook and PR checklist for mobile releases.  
**Effort:** 3 hours to write the script + document the runbook step  
**Bugs prevented per year:** All cascading-diagnosis TestFlight crashes (3 in this period). Each costs ~4 hours developer + ~3 hours blocked QA.  
**Total savings:** ~21 hours in this period alone; annualized ~40 hours  
**ROI:** Very high — eliminates the most expensive incident type observed

---

### P6 — Monitoring script integration test harness

**Target cluster:** Infra / CI Config  
**What:** New CI scripts (canary monitors, health pings) must include a `--dry-run` flag that executes all logic against a test database fixture and validates the output format before the script is merged. Add a GitHub Actions workflow job `ci-scripts-dry-run` that runs all scripts in `apps/web/scripts/` with test env vars pointing at a local Postgres container.  
**Effort:** 4 hours (test harness setup + retrofitting existing scripts)  
**Bugs prevented per year:** 2–3 monitoring failures discovered only in production (the canary pattern). Each costs ~2 hours + risk of silent outage.  
**Total savings:** ~6–8 hours/year + improved confidence in production monitoring  
**ROI:** Moderate-high — monitoring blind spots are especially dangerous in a HIPAA health context

---

### P7 — Info.plist / PrivacyInfo.xcprivacy co-evolution lint

**Target cluster:** iOS / EAS Build  
**What:** Write a pre-commit hook (and CI check) that, when `app.json`'s `ios.infoPlist` block is modified, asserts that the corresponding native `Info.plist` and `PrivacyInfo.xcprivacy` are also staged. Similarly, when `apps/mobile/package.json` gains a new Expo SDK package, assert that `app.json`'s `ios.infoPlist` block covers any required usage description keys for that SDK (parsed from a maintained `sdk-to-plist-keys.json` mapping file).  
**Effort:** 5 hours  
**Bugs prevented per year:** 2–4 App Store rejection cycles or launch crashes caused by missing plist keys (4 such commits in 30 days).  
**Total savings:** ~16–20 hours/year in App Store review cycles + TestFlight iterations  
**ROI:** High — each App Store rejection causes days of delay

---

## 6. Prevention Investment Summary — ROI Ranking

| Rank | Investment | Cluster | Effort (hrs) | Estimated bugs/yr prevented | Annual hrs saved | ROI |
|------|-----------|---------|-------------|---------------------------|-----------------|-----|
| 1 | PHI-redaction lint rule (P3) | Security/HIPAA | 6 | 1–2 incidents | ~20 + breach risk | Extreme |
| 2 | Pre-submission Release smoke test (P5) | iOS/EAS Build | 3 | 3–5 crash builds | ~40 | Very High |
| 3 | `expo-doctor` CI gate (P1) | iOS/EAS Build | 2 | 3–5 bad builds | ~20 | Very High |
| 4 | Middleware integration tests (P2) | Auth/Middleware | 4 | 2–3 regressions | ~6 | High |
| 5 | Schema-migration parity check (P4) | Aurora Schema | 5 | 1–2 drift events | ~10 | High |
| 6 | Info.plist co-evolution lint (P7) | iOS/EAS Build | 5 | 2–4 rejections | ~20 | High |
| 7 | Monitoring script dry-run harness (P6) | Infra/CI | 4 | 2–3 monitor failures | ~8 | Moderate-High |

**Total investment:** 29 hours  
**Total estimated annual hours saved:** ~124 hours (engineering time only; excludes breach risk and App Store delay costs)

---

## 7. Observations and Systemic Themes

### Theme 1: Debug vs. Release divergence is the highest-risk gap

Four of the nine iOS/EAS build fix commits were caused by behavior that was *invisible in debug builds* but crashed in Release (BGTask exceptions, native module autolinker rejections, Sentry init without DSN). This means the local development loop cannot catch these issues — only TestFlight can. The 3-build cascading diagnosis is a direct consequence of having no Release-mode smoke test in the inner loop.

### Theme 2: New infrastructure ships without its own test

Every new monitoring or CI script introduced in this period (canary monitor, api-health-ping, OIDC workflow) required 1–2 immediate fix commits. The pattern is consistent: write script → merge → first production run reveals bugs → fix. The cost of this pattern is low individually but compounds: the monitoring system cannot be trusted until it has been battle-tested, which defeats its purpose.

### Theme 3: PHI handling is a reactive, not proactive, discipline

Both PHI incidents (push notification payloads, `console.log` leaks) were discovered by dedicated audit passes rather than by automated gates. The audit itself found 6 confirmed leaks across 220 call sites. The correct response is not better audits — it is a lint gate that makes the bad pattern unambiguous at commit time.

### Theme 4: The hotspot files need ownership tags and change protocols

The top 10 hotspot files collectively absorbed ~90 touches in 30 days. Five of those files (`_layout.tsx`, `Info.plist`, `notifications.ts`, `middleware.ts`, `schema.ts`) are each single points of failure for major subsystems. These files do not currently appear in the ownership matrix in `CLAUDE.md` with explicit change protocols (e.g., "changes to `_layout.tsx` require a Release smoke test before merge"). Adding such protocols to the team rules section would distribute the risk of high-frequency changes.

### Theme 5: 43% fix rate signals feature velocity is outpacing safety nets

22 of 51 commits (43%) in the past 30 days were bug fixes or security patches. The industry baseline for mature products is ~15–20%. The gap reflects a launch-sprint context where features are being built faster than the test infrastructure can cover them. The investments above are ranked to address the highest-blast-radius gaps first, with the expectation that the fix rate should decline below 25% within two sprints of implementation.

---

*Generated on 2026-05-24. Next review recommended after investment P1–P3 are implemented.*
