# Test Coverage Report

**Generated:** 2026-05-18  
**Branch:** aryan/dev

---

## Summary

### Coverage Tool Status

`@vitest/coverage-v8` is **not installed** and `vitest.config.ts` has no `coverage` block configured. Line/statement/branch coverage percentages are unavailable without installing a coverage provider.

**To enable coverage:**
```bash
bun add -D @vitest/coverage-v8 --filter @carecompanion/web
# Add to apps/web/vitest.config.ts:
# coverage: { provider: 'v8', reporter: ['text', 'html'], include: ['src/**/*.ts'] }
```

### Test Run Results (`npm run test:run`)

| Metric | Count |
|---|---|
| Test files | 76 |
| Tests passed | 647 |
| Tests skipped | 1 |
| Tests failed | 0 |
| Packages with tests | 4 (`@carecompanion/web`, `@carecompanion/utils`, `@carecompanion/api`, `apps/mobile`) |

All tests pass with `ANTHROPIC_API_KEY=""`. No Anthropic API calls reach the network.

---

## Untested Critical Paths

### API Route Coverage (Most Alarming Gap)

Out of **138 total API routes**, only **13 have a `__tests__/` directory** — a **9.4% route coverage rate**. The 125 untested routes include nearly every sensitive endpoint.

#### Auth Routes — No Tests (CRITICAL)

| Route | Risk |
|---|---|
| `apps/web/src/app/api/auth/mobile-login/route.ts` | Mobile JWT issuance, Cognito credential handling |
| `apps/web/src/app/api/auth/mobile-care-group-login/route.ts` | Care group scoped mobile tokens |
| `apps/web/src/app/api/auth/refresh/route.ts` | Token refresh — rotation logic untested |
| `apps/web/src/app/api/auth/set-password/route.ts` | Password mutation — no validation tests |
| `apps/web/src/app/api/auth/set-role/route.ts` | Role escalation endpoint — no authz guard tests |
| `apps/web/src/app/api/auth/social/route.ts` | OAuth social login flow |
| `apps/web/src/app/api/auth/cognito-logout/route.ts` | Logout / token revocation |
| `apps/web/src/app/api/account/change-password/route.ts` | Account security mutation |

#### Data Destruction — No Tests (HIGH)

| Route | Risk |
|---|---|
| `apps/web/src/app/api/delete-account/route.ts` | Irreversible — user data wipe, no tested guard |
| `apps/web/src/app/api/export-data/route.ts` | PHI bulk export — no authz/scope tests |
| `apps/web/src/app/api/export/csv/route.ts` | PHI CSV dump |
| `apps/web/src/app/api/export/pdf/route.ts` | PHI PDF dump |
| `apps/web/src/app/api/import-data/route.ts` | Data import — no validation tests |

#### Medical Safety — No Tests (HIGH)

| Route | Risk |
|---|---|
| `apps/web/src/app/api/interactions/check/route.ts` | Drug interaction checker — zero test coverage |
| `apps/web/src/app/api/triage/route.ts` | Medical triage endpoint |
| `apps/web/src/app/api/checkins/voice-extract/route.ts` | AI extraction of patient symptoms |

#### HIPAA Compliance — No Tests (HIGH)

| Route | Risk |
|---|---|
| `apps/web/src/app/api/compliance/audit-log/route.ts` | Audit log access — no tested authz |
| `apps/web/src/app/api/compliance/report/route.ts` | Compliance report generation |
| `apps/web/src/app/api/compliance/calendar/route.ts` | Compliance calendar |

#### Chat (Core Product) — No Tests (MEDIUM-HIGH)

| Route | Risk |
|---|---|
| `apps/web/src/app/api/chat/route.ts` | Main AI chat — streaming, memory writes, no tests |
| `apps/web/src/app/api/chat/mobile/route.ts` | Mobile chat variant |
| `apps/web/src/app/api/chat/guest/route.ts` | Unauthenticated chat — scope leakage risk |
| `apps/web/src/app/api/chat/history/route.ts` | Conversation history retrieval |

#### Cron Jobs — No Tests (MEDIUM)

| Route | Risk |
|---|---|
| `apps/web/src/app/api/cron/purge/route.ts` | Data purge — irreversible |
| `apps/web/src/app/api/cron/retention/route.ts` | PHI retention policy enforcement |
| `apps/web/src/app/api/cron/weekly-summary/route.ts` | Automated email with patient data |
| `apps/web/src/app/api/cron/trials-match/route.ts` | Clinical trial matching cron |

### Library Files — No Direct Tests

#### auth/ domain (CRITICAL)

| File | Gap |
|---|---|
| `apps/web/src/lib/auth.ts` | Main NextAuth + Cognito wiring — session callbacks, JWT transforms, profile sync all untested |
| `apps/web/src/lib/care-group-auth.ts` | Authorization helper for care group membership checks — used in many API routes |

#### memory/ domain (HIGH)

| File | Gap |
|---|---|
| `apps/web/src/lib/memory.ts` | Top-level memory facade (`saveMemory`, `loadMemory`) — only a snapshot test exists, no behavior tests |
| `apps/web/src/lib/memory/touch.ts` | Memory access tracking / recency update |

#### Medical / Safety (HIGH)

| File | Gap |
|---|---|
| `apps/web/src/lib/drug-interactions.ts` | Drug interaction logic — no unit tests for interaction detection or severity ranking |
| `apps/web/src/lib/appointment-prep.ts` | Pre-appointment prep generation |
| `apps/web/src/lib/treatments.ts` | Treatment recommendation logic |
| `apps/web/src/lib/refill-tracker.ts` | Medication refill status tracking |

#### AI Agents (HIGH)

| File | Gap |
|---|---|
| `apps/web/src/lib/agents/orchestrator.ts` | Multi-agent orchestration — routing decisions, tool handoffs all untested |
| `apps/web/src/lib/agents/router.ts` | Request classification and specialist routing |
| `apps/web/src/lib/agents/specialists.ts` | Domain-specific agent configurations |

#### Compliance / Audit (HIGH)

| File | Gap |
|---|---|
| `apps/web/src/lib/compliance-tracker.ts` | HIPAA access log tracking — correctness untested |
| `apps/web/src/lib/audit.ts` | Audit event writing (distinct from audit-log helper tested separately) |

#### Onboarding / Feature Flags (MEDIUM)

| File | Gap |
|---|---|
| `apps/web/src/lib/onboarding/phase-machine.ts` | State machine for multi-step onboarding |
| `apps/web/src/lib/onboarding/auto-save.ts` | Auto-save logic for onboarding forms |
| `apps/web/src/lib/feature-flags.ts` | Flag evaluation — no tests for flag override or default logic |
| `apps/web/src/lib/push.ts` | Push notification dispatch — no send-path tests |
| `apps/web/src/lib/reminders.ts` | Reminder scheduling logic (reminders-utils tested separately, not the main scheduler) |

---

## Files Modified Recently Without Tests

All source files in the repository appear to have been modified within the past 30 days (full-project commit window). Below are the recently active web files confirmed to have no matching test file:

```
apps/web/src/lib/auth.ts
apps/web/src/lib/care-group-auth.ts
apps/web/src/lib/agents/orchestrator.ts
apps/web/src/lib/agents/router.ts
apps/web/src/lib/agents/specialists.ts
apps/web/src/lib/drug-interactions.ts
apps/web/src/lib/compliance-tracker.ts
apps/web/src/lib/refill-tracker.ts
apps/web/src/lib/onboarding/phase-machine.ts
apps/web/src/lib/onboarding/auto-save.ts
apps/web/src/lib/feature-flags.ts
apps/web/src/lib/memory.ts
apps/web/src/lib/memory/touch.ts
apps/web/src/lib/push.ts
apps/web/src/lib/reminders.ts
apps/web/src/lib/treatments.ts
apps/web/src/lib/appointment-prep.ts
apps/web/src/lib/email.ts
apps/web/src/lib/active-profile.ts
apps/web/src/lib/audit.ts
apps/web/src/lib/offline-queue.ts
apps/web/src/lib/api-metrics.ts
apps/web/src/lib/hospitals.ts
apps/web/src/lib/checkin-validation.ts

# API routes (all recently changed, none have tests):
apps/web/src/app/api/auth/mobile-login/route.ts
apps/web/src/app/api/auth/mobile-care-group-login/route.ts
apps/web/src/app/api/auth/refresh/route.ts
apps/web/src/app/api/auth/set-role/route.ts
apps/web/src/app/api/account/change-password/route.ts
apps/web/src/app/api/delete-account/route.ts
apps/web/src/app/api/chat/route.ts
apps/web/src/app/api/interactions/check/route.ts
apps/web/src/app/api/compliance/audit-log/route.ts
apps/web/src/app/api/export-data/route.ts
apps/web/src/app/api/triage/route.ts
```

---

## Recommended Test Suite Additions (Top 10)

Ranked by risk: PHI exposure, auth bypass potential, medical safety, irreversibility.

### 1. `src/lib/auth.ts` — Auth Session / JWT Callbacks
**Rationale:** This file wires NextAuth to Cognito and controls session shape, JWT contents, and profile sync. A bug here silently breaks all auth. Tests should cover: JWT callback populates expected fields, session callback returns correct user shape, Cognito errors surface as proper auth failures, and `profileId` scoping prevents cross-patient data reads.

### 2. `src/app/api/auth/mobile-login/route.ts` + `mobile-care-group-login/route.ts`
**Rationale:** Mobile JWT issuance is a credential boundary. Tests should verify: invalid Cognito credentials return 401, expired tokens are rejected, a valid login returns a signed JWT with correct claims, and care-group scope is enforced on the second route.

### 3. `src/lib/care-group-auth.ts`
**Rationale:** This helper determines whether a requesting user may read another user's data. An incorrect authorization check is a direct PHI disclosure. Tests should cover: owner access passes, non-member access blocked, removed member blocked, and pending-request access level.

### 4. `src/app/api/auth/set-role/route.ts` + `account/change-password/route.ts`
**Rationale:** Role escalation and password change are security-sensitive mutations. Tests: unauthenticated request returns 401, role change requires appropriate privilege, password change validates current-password correctly, rate limiting applies.

### 5. `src/lib/drug-interactions.ts`
**Rationale:** Drug interaction detection is a patient safety feature. A false-negative could suppress a critical warning. Tests should cover: known interaction pairs are detected, severity levels are classified correctly, single-drug inputs return no interaction, and edge cases (empty list, duplicate entries) are handled.

### 6. `src/app/api/chat/route.ts`
**Rationale:** The main chat endpoint writes memory, calls the AI agent, and streams responses — all with PHI in context. Tests (with mocked AI SDK): unauthenticated request rejected, memory write called with correct userId, streaming response structure, and tool-call passthrough.

### 7. `src/lib/compliance-tracker.ts` + `src/app/api/compliance/audit-log/route.ts`
**Rationale:** HIPAA requires accurate, tamper-evident audit logs. Tests: access events are written with correct actor/resource fields, failed writes don't silently swallow errors, audit-log API enforces admin-only access.

### 8. `src/app/api/delete-account/route.ts` + `src/app/api/export-data/route.ts`
**Rationale:** Irreversible data destruction and PHI bulk export. Tests: both enforce authentication, export scopes to the requesting user's data only (no cross-user read), delete triggers soft-delete then hard-delete in correct order.

### 9. `src/lib/agents/orchestrator.ts` + `router.ts`
**Rationale:** The orchestrator determines which specialist handles a request. Routing bugs produce wrong-domain responses (e.g., billing agent answering a medication question). Tests (with mocked specialists): known input patterns route to expected specialists, unknown patterns fall back to general, orchestrator propagates tool results correctly.

### 10. `src/lib/onboarding/phase-machine.ts`
**Rationale:** The phase machine controls what data users are required to provide and whether onboarding is complete. A bug can skip consent or HIPAA agreement steps. Tests: each phase transition requires its prerequisites, skipping a phase throws, complete phase set marks onboarding done.

---

## Next Steps

1. **Install coverage tooling** to get line/branch numbers:
   ```bash
   bun add -D @vitest/coverage-v8 --filter @carecompanion/web
   ```
2. **Enforce a coverage gate** in CI (`coverage.thresholds` in `vitest.config.ts`): start at 40% lines and ratchet up.
3. **Prioritize items 1–4** above (auth + care-group-auth) before next release — they guard the PHI boundary.
4. **Mobile (`apps/mobile`)** has zero unit tests for its service layer (`src/services/auth.ts`, `src/services/healthkit.ts`, `src/services/background-sync.ts`). The three existing mobile test files cover only internal pure functions.
