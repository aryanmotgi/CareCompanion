# CareCompanion — Deep Security & HIPAA Audit

**Date:** 2026-05-24  
**Scope:** `apps/web/src` (Next.js API layer), `packages/`, AWS/IaC, CI/CD  
**Branch:** `aryan/dev`  
**Auditor:** Claude Code (automated static analysis + existing audit cross-reference)

---

## Severity Table

| ID | Severity | Category | Title | File / Location |
|----|----------|----------|-------|-----------------|
| S1 | **CRITICAL** | BAA / Compliance | Anthropic API receives full PHI with no signed BAA | `api/chat/route.ts:65`, `api/health-summary/route.ts:55` |
| S2 | **CRITICAL** | BAA / Compliance | AWS (Aurora RDS + SES) holds all patient data — no BAA on file | `lib/db/index.ts`, `lib/email.ts` |
| S3 | **CRITICAL** | BAA / Compliance | Resend email provider has no BAA and no BAA option — sends user emails | `lib/email.ts:80-104` |
| S4 | **CRITICAL** | PHI Leak | `welcome-email` logs raw user email address via `console.warn` | `api/welcome-email/route.ts:31` |
| S5 | **HIGH** | BAA / Compliance | Sentry error tracking may capture PHI in error payloads — BAA required | `instrumentation.ts`, `instrumentation-client.ts` |
| S6 | **HIGH** | BAA / Compliance | Voyage AI reranking API called with patient memory context — no BAA | `lib/memory/rerank.ts:17` |
| S7 | **HIGH** | BAA / Compliance | Google Vertex AI (Gemini) used for health summaries — BAA not confirmed | `api/health-summary/route.ts`, `api/cron/radar/route.ts` |
| S8 | **HIGH** | Audit Log Gap | 12 PHI-touching API routes write no audit trail | See §3 matrix |
| S9 | **HIGH** | Security | `provision-demo` returns demo account plaintext password in HTTP response body | `api/admin/provision-demo/route.ts:174` |
| S10 | **HIGH** | Security | Static long-lived AWS credentials in GitHub Actions workflow (use OIDC) | `.github/workflows/canary-monitor.yml:36-38` |
| S11 | **HIGH** | Security | GitHub issue body injected verbatim into Claude Code AI prompt (prompt injection) | `.github/workflows/playwright-auto-fix.yml` |
| S12 | **HIGH** | Security | `AdminInitiateAuth` permission granted to web server — can authenticate as any user | `api/account/change-password/route.ts` |
| S13 | **HIGH** | PHI Leak | 18 API routes log raw `err` objects — stack traces/row data may include PHI | See §1.3 complete list |
| S14 | **MEDIUM** | PHI Leak | HealthKit sync/replace routes pass raw ORM `err` (may include row data in non-Error branch) | `api/healthkit/sync/route.ts:56–250`, `api/healthkit/replace/route.ts:133–307` |
| S15 | **MEDIUM** | Session | No explicit JWT `maxAge` — defaults to NextAuth 30-day sessions (too long for PHI app) | `lib/auth.ts:24` |
| S16 | **MEDIUM** | Security | Bearer-token bypass in middleware delegates auth to routes with no compile-time enforcement | `src/middleware.ts:58-60` |
| S17 | **MEDIUM** | Encryption | Aurora `StorageEncrypted=true` not confirmed in any IaC artifact in repo | No infra/ directory found |
| S18 | **MEDIUM** | Security | Demo password `CareDemo2026!` may exist in git history | git history pre-migration |
| S19 | **LOW** | PHI Leak | `seed-demo.ts` logs caregiver email addresses at script runtime | `lib/db/seed-demo.ts:487,490` |
| S20 | **LOW** | Audit | Audit log retention cron deletes records after 1 year — HIPAA requires 6 years | `api/cron/retention/route.ts:41` |

---

## Top 10 Fix Priorities

| Priority | ID | Action | Owner | Effort |
|----------|----|--------|-------|--------|
| P1 | S1 | Sign Anthropic HIPAA BAA (`privacy@anthropic.com`) or gate PHI-bearing API calls behind BAA | Aryan | 1 day |
| P2 | S2 | Accept AWS HIPAA BAA in AWS Console → Artifact; covers RDS Aurora + SES + Cognito | Aryan | 2 hr |
| P3 | S3 | Migrate `lib/email.ts` non-PHI emails from Resend to `@aws-sdk/client-sesv2` (already installed) | Aryan | 1 day |
| P4 | S4 | Replace `console.warn(\`...${email}\`)` with `console.warn('[welcome-email] send failed', { reason: result.reason })` | Aryan | 15 min |
| P5 | S8 | Add `logAudit` to 12 untracked PHI routes (medications, labs, journal, checkins, etc.) | Aryan | 4 hr |
| P6 | S5 | Implement Sentry `beforeSend` PHI scrubbing on web side; upgrade to Business plan for BAA | Aryan | 4 hr |
| P7 | S10 | Replace static AWS keys in `canary-monitor.yml` with GitHub OIDC (`aws-actions/configure-aws-credentials@v4`) | Aryan | 2 hr |
| P8 | S11 | Sanitize GitHub issue body before injecting into AI prompt in `playwright-auto-fix.yml` | Aryan | 1 hr |
| P9 | S9 | Remove plaintext password from `provision-demo` HTTP response; store hash, return reset link only | Aryan | 1 hr |
| P10 | S15 | Add `session: { maxAge: 7 * 24 * 60 * 60 }` to NextAuth config in `lib/auth.ts` | Aryan | 15 min |

---

## Section 1 — PHI Leak Scan

Scope: all `console.log`, `console.error`, `console.warn`, `console.debug`, `logger.info`, `logger.debug`, `logger.error` across `apps/web/src/**/*.{ts,tsx}`.

### 1.1 Confirmed Leaks

#### S4 — CRITICAL · `api/welcome-email/route.ts:31`

```ts
console.warn(`[Welcome Email] Could not send to ${email}: ${result.reason}`);
```

The variable `email` is the authenticated user's email address — a direct HIPAA identifier (18 CFR § 164.514(b)(2)(i)). This is emitted to stdout on every email-send failure, which in production surfaces in Vercel/CloudWatch log streams.

**Fix:**
```ts
console.warn('[welcome-email] send failed', { reason: result.reason });
```

#### S13 — MEDIUM · `api/healthkit/sync/route.ts` (9 occurrences, lines 56–250)

```ts
console.error('[healthkit/sync] insert failed for medication record:', err instanceof Error ? err.message : err)
```

Pattern repeated for: labResult, appointment, vitalSign, condition, allergy, procedure, immunization, encounter. When `err` is not an `Error` instance (e.g. Drizzle ORM throws a plain object including the offending row), the raw database row — which may contain medication names, condition codes, or lab values — is stringified into the log. Same pattern at `healthkit/replace/route.ts` (lines 133–307, 8 occurrences).

**Severity:** MEDIUM (conditional — safe when ORM throws `Error` objects, but ORM version may change).

**Fix:** Enforce the safe branch:
```ts
console.error('[healthkit/sync] insert failed for medication record:', err instanceof Error ? err.message : String(err))
```

#### S14 — MEDIUM · `api/import-medications/route.ts:72`

```ts
console.error('[import-medications] POST error:', err);
```

`err` is unguarded. If the request parser throws a JSON parse error, the raw request body (containing medication list) may be attached. If the database insert fails, row data may be included.

**Fix:**
```ts
console.error('[import-medications] POST error:', err instanceof Error ? err.message : String(err));
```

#### S19 — LOW · `lib/db/seed-demo.ts:487,490`

```ts
console.log(`  Email:      ${DEMO_EMAIL}`)
console.log(`  Caregivers: ${DEMO_CAREGIVER_1_EMAIL} (spouse), ${DEMO_CAREGIVER_2_EMAIL} (parent)`)
```

Script-only; not reachable from production API. Acceptable risk for dev/seed scripts but should use `.env`-masked values if scripts ever run in CI.

### 1.3 Raw Error Object Logging — 18 Additional Routes (S13 / HIGH)

The following routes call `console.error(..., err)` without extracting `err.message`, meaning any ORM error that includes the offending DB row, or any JSON parse error that echoes the request body, will surface PHI in server logs.

| File | Line(s) | Context |
|------|---------|---------|
| `api/reminders/route.ts` | 42, 94, 123 | GET/POST/DELETE reminder data |
| `api/scan-document/route.ts` | 80 | Medical document extraction (prescriptions, lab reports) |
| `api/prep/route.ts` | 84 | Appointment prep (meds + conditions sent to LLM) |
| `api/reminders/respond/route.ts` | 58 | Medication reminder responses |
| `api/community/[id]/upvote/route.ts` | 104 | Community posts |
| `api/import-data/route.ts` | 99 | Bulk health data import |
| `api/auth/mobile-care-group-login/route.ts` | 55 | Auth route (credentials in error context) |
| `api/auth/mobile-login/route.ts` | 75 | Auth route (credentials in error context) |
| `api/cron/trials-match/route.ts` | 107 | `profileId` + raw error logged together |
| `api/share/route.ts` | 120 | Share link creation |
| `api/share/weekly/route.ts` | 45 | Weekly share |
| `api/search/route.ts` | 99 | Health record search |
| `api/test/reset/route.ts` | 105 | Test reset (lower risk, non-production) |
| `api/save-scan-results/route.ts` | 195 | Document scan results (OCR'd medical data) |
| `api/timeline/route.ts` | 339 | Full patient timeline |
| `api/upload/allergies/route.ts` | 50 | Allergy upload (PHI) |
| `api/upload/insurance/route.ts` | 65 | Insurance/claims data (PHI) |
| `api/export-data/route.ts` | 63 | Full data export (highest PHI exposure) |

**Global fix pattern** — apply to all 18 routes:
```ts
// Before
console.error('[route] error:', err)

// After
console.error('[route] error:', err instanceof Error ? err.message : String(err))
```

### 1.2 Mitigations Already in Place (Pass)

| Pattern | File | Mechanism |
|---------|------|-----------|
| Email in reset-password | `api/auth/reset-password/route.ts:35,108,112` | `maskEmail()` helper applied — PASS |
| Auth errors | `lib/auth.ts:183` | Safe `{type, code, statusCode}` subset only — PASS |
| Sentry (mobile) | `apps/mobile` | `beforeSend` hook redacts 17 PHI fields — PASS |
| PostHog (mobile) | `apps/mobile` | `sanitize_properties` strips 8+ PHI field names — PASS |
| Token encryption | `lib/token-encryption.ts` | AES-256-GCM, 96-bit IV, production-enforced — PASS |

---

## Section 2 — Audit Log Coverage Matrix

The audit system (`lib/audit.ts`) writes to the `audit_logs` table. 21 routes call `logAudit()`. Below is the coverage matrix for all PHI-bearing API routes.

### 2.1 Covered Routes ✅

| Route | Audit Action |
|-------|-------------|
| `POST /api/chat` | `view_records` (chat session) |
| `POST /api/health-summary` | `generate_summary` |
| `POST /api/scan-document` | `scan_document` |
| `POST /api/share` | `share_data` |
| `GET /api/share/[token]` | inline `auditLogs.insert` |
| `POST /api/export/csv` | `export_data` |
| `POST /api/export-data` | `export_data` |
| `DELETE /api/account/delete` | `delete_account` |
| `POST /api/healthkit/sync` | `sync_data` |
| `POST /api/healthkit/replace` | `replace_data` |
| `POST /api/healthkit/wellness` | `sync_data` |
| `POST /api/consent/accept` | `hipaa_consent_accepted` |
| `POST /api/profile-switch` | `switch_profile` |
| `GET /api/compliance/audit-log` | — (reads audit log) |
| `POST /api/compliance/report` | `view_records` |
| `GET /api/compliance/calendar` | `view_records` |
| `POST /api/integrations/[source]` | `integration_disconnected` |
| `POST /api/sync/status` | `sync_data` |
| `POST /api/auth/social` | inline `auditLogs.insert` |
| `DELETE /api/delete-account` | `delete_account` |

### 2.2 Missing Audit Coverage — HIGH Risk ⚠️

These routes access or mutate PHI with **no audit trail**, violating HIPAA § 164.312(b) (Audit Controls).

| Route | PHI Accessed | Suggested Action |
|-------|-------------|-----------------|
| `GET/POST/DELETE /api/records/medications` | Medication names, dosages, schedules | `view_medications` / `add_medication` / `delete_medication` |
| `GET/POST /api/records/labs` | Lab result values, reference ranges | `view_lab_results` |
| `GET/PUT /api/records/profile` | DOB, diagnoses, allergies, insurance | `view_profile` / `edit_profile` |
| `GET/POST /api/records/appointments` | Appointment dates, provider names | `view_appointments` |
| `POST /api/import-medications` | Bulk medication import | `import_data` |
| `GET/POST /api/journal` | Symptom entries, mood scores | `view_records` |
| `GET/POST /api/checkins` | Daily health check-ins | `view_records` |
| `GET/DELETE /api/documents/[id]` | Uploaded medical documents | `view_records` |
| `POST /api/prep` | Appointment prep (meds + conditions sent to LLM) | `generate_summary` |
| `POST /api/triage` | Symptom triage (AI health advice) | `generate_summary` |
| `POST /api/export/pdf` | Full patient record PDF export | `export_data` |
| `GET /api/timeline` | Full chronological health history | `view_records` |

**Total PHI routes without audit:** 12 of ~35 PHI-touching routes (~34% gap).

### 2.3 Audit Retention Issue — LOW

`api/cron/retention/route.ts:41` deletes audit log entries older than **1 year**:
```ts
const auditDeleted = await db.delete(auditLogs).where(lt(auditLogs.createdAt, oneYearAgo))
```

HIPAA § 164.530(j) requires audit documentation retention for **6 years**. The comment in the same file even acknowledges `'6 years'` for other record types (line 53), indicating this is an oversight.

---

## Section 3 — IAM Least-Privilege

**Result: PASS (with caveat)**

No IAM policy JSON files were found in the repository (`aws/`, `infra/`, `scripts/`). The application uses:

- **AWS RDS Data API** via `RDSDataClient` with `AWS_SECRET_ARN` and `AWS_RESOURCE_ARN` — credentials managed by AWS Secrets Manager.
- **AWS SES** via `@aws-sdk/client-sesv2` — uses IAM role in production.
- **Cognito** via `AdminInitiateAuth` — see S12 below.

No `"Action": "*"` or `"Resource": "*"` policies were found in any committed file.

**S12 — HIGH: `AdminInitiateAuth` Over-Privilege**

`api/account/change-password` uses `AdminInitiateAuth`, which is an admin-level Cognito API call that can authenticate as any user in the user pool. If the web server's IAM role is compromised (e.g., via SSRF), an attacker could authenticate as any patient.

**Fix:** Switch to `InitiateAuth` (user-level authentication using the user's own credentials) combined with `ChangePassword` after the user authenticates, removing the need for admin-level Cognito access.

**S10 — HIGH: Static AWS Keys in CI**

`.github/workflows/canary-monitor.yml:36-38` uses long-lived `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` GitHub secrets. If the repository is forked or the secret is leaked, full AWS API access is obtained.

**Fix:**
```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::ACCOUNT_ID:role/github-actions-canary
    aws-region: us-east-1
```

---

## Section 4 — Encryption at Rest

### 4.1 Application-Layer Encryption

| Asset | Mechanism | Status |
|-------|-----------|--------|
| OAuth access/refresh tokens | AES-256-GCM, 96-bit IV, `TOKEN_ENCRYPTION_KEY` (32-byte hex) | ✅ PASS |
| CSRF tokens | `crypto.getRandomValues()` 256-bit, `sameSite: strict` | ✅ PASS |
| Passwords | `bcryptjs` hash comparison | ✅ PASS |
| Database credentials | AWS Secrets Manager (`AWS_SECRET_ARN`) | ✅ PASS |
| GCP credentials | OIDC Workload Identity Federation (no JSON keys) | ✅ PASS |

### 4.2 Infrastructure Encryption — UNVERIFIED (S17)

No IaC (CDK, CloudFormation, Terraform) was found in the repository that explicitly configures:

- **Aurora RDS** `StorageEncrypted: true` / `KmsKeyId`
- **S3 buckets** `BucketEncryption` / `SSEAlgorithm: aws:kms`
- **Cognito User Pool** encryption (encrypted by default, but custom KMS key not confirmed)

**Risk:** If Aurora was provisioned without `StorageEncrypted: true` (AWS default is `false` for RDS), PHI at rest is unencrypted.

**Action required:** Verify via AWS Console or `aws rds describe-db-clusters --query 'DBClusters[].StorageEncrypted'`. Confirm result and add IaC to the repository.

---

## Section 5 — BAA (Business Associate Agreement) Status

All vendors that process or store PHI require a signed BAA under HIPAA § 164.308(b)(1).

| Vendor | SDK | PHI Exposure | BAA Available | BAA Signed | Risk | Action |
|--------|-----|:---:|:---:|:---:|------|--------|
| **Anthropic** | `@ai-sdk/anthropic ^3.0.64` | ✅ Full PHI (chat, health summary, appointment prep, weekly summary, radar) | ✅ Yes | ❌ No | **CRITICAL** | Email `privacy@anthropic.com` immediately |
| **AWS Aurora RDS** | `@aws-sdk/client-rds-data` | ✅ Complete patient datastore | ✅ Yes | ❌ Not confirmed | **CRITICAL** | Accept in AWS Console → Artifact |
| **AWS SES** | `@aws-sdk/client-sesv2` | ✅ Email (user addresses) | ✅ Yes | ❌ Not confirmed | **CRITICAL** | Covered by same AWS BAA above |
| **AWS Cognito** | AWS SDK (auth) | ✅ User identities | ✅ Yes | ❌ Not confirmed | **CRITICAL** | Covered by same AWS BAA above |
| **Resend** | `resend ^6.10.0` | ⚠️ User email addresses | ❌ No BAA offered | ❌ N/A | **HIGH** | Migrate to AWS SES (`@aws-sdk/client-sesv2` already installed) |
| **Sentry** | `@sentry/nextjs ^10.50.0` | ⚠️ Error contexts (may contain PHI) | ✅ Yes (Business+) | ❌ No | **HIGH** | Add web `beforeSend` scrubbing; upgrade plan; sign BAA |
| **Google Vertex AI** | `@ai-sdk/google-vertex ^4.0.137` | ✅ Health summary embeddings | ✅ Yes (GCP BAA) | ❌ Not confirmed | **HIGH** | Confirm Vertex (not `generativelanguage.googleapis.com`); accept GCP HIPAA addendum |
| **Voyage AI** | Direct HTTP (`api.voyageai.com`) | ⚠️ Patient memory summaries (indirect PHI) | ❌ No BAA | ❌ N/A | **HIGH** | Evaluate replacement with `text-embedding-004` (Vertex, covered by GCP BAA) or on-device reranking |
| **Upstash Redis** | `@upstash/redis ^1.37.0` | ⚠️ Rate-limit keys (user IDs in key names) | ✅ Yes | ❌ Not confirmed | **MEDIUM** | Confirm no PHI in Redis values; sign Upstash DPA/BAA |
| **Vercel** | Hosting + Analytics | ⚠️ Route paths, request logs | ✅ Yes (Enterprise) | ❌ Not confirmed | **MEDIUM** | Confirm Enterprise plan BAA; redact PHI from path patterns |
| **Expo** | Push notifications (mobile) | ⚠️ Push tokens (device identifiers) | ⚠️ No full BAA | — | **MEDIUM** | Confirm no PHI in push payloads; use opaque notification titles |
| **Google OAuth** | `google-auth-library` | ⚠️ Auth flow only | ✅ Yes (GCP) | — | **LOW** | No PHI in auth flow — acceptable |

**BAA summary:** 4 critical BAA gaps (Anthropic, AWS, Sentry, Resend) must be resolved before production launch with real patients.

---

## Section 6 — JWT / Session Expiry

### 6.1 NextAuth Session Configuration

**File:** `apps/web/src/lib/auth.ts:24`

```ts
export const authOptions = NextAuthOptions({
  // No session.maxAge configured — defaults to 30 days
```

**Current state:** NextAuth default is `session.maxAge = 30 * 24 * 60 * 60` (30 days). For a HIPAA-covered application handling sensitive health data, 30-day sessions are too permissive, especially on shared or mobile devices.

**HIPAA alignment:** NIST SP 800-63B recommends reauthentication after 15 minutes for high-assurance, but a 7-day session with "keep me signed in" toggle is industry-standard for consumer health apps.

**Fix (S15):**
```ts
export const authOptions = NextAuthOptions({
  session: {
    maxAge: 7 * 24 * 60 * 60,  // 7 days
    updateAge: 24 * 60 * 60,    // refresh on activity
  },
```

### 6.2 Token-Specific Expiry

| Token Type | Expiry | File | Status |
|-----------|--------|------|--------|
| Session JWT | 30 days (default) | `lib/auth.ts` | ⚠️ Should be 7 days |
| CSRF token | 24 hours | `lib/csrf.ts:24` | ✅ PASS |
| Share links | 7 days | `app/shared/[token]/page.tsx` | ✅ PASS |
| Care team invites | `expiresAt` column | `lib/db/schema.ts` | ✅ PASS |
| Password reset nonce | Schema column exists | `lib/db/schema.ts` | ⚠️ No explicit TTL in code — verify |
| Mobile Bearer JWT | Decoded from Cognito | `lib/api-helpers.ts` | ✅ Cognito-managed |

### 6.3 Mobile Bearer Token Bypass

`middleware.ts:58-60` bypasses session checks for requests with `Authorization: Bearer` headers, delegating auth to individual route handlers. This is intentional for mobile app support. All 140+ protected routes individually call `getAuthenticatedUser()`, which validates Bearer tokens via Cognito JWT verification. The pattern is sound but lacks static enforcement — a new route could accidentally omit the auth call.

**Recommendation:** Add an ESLint rule or middleware-layer assertion that all non-public routes return 401 if neither session nor Bearer token is valid.

---

## Section 7 — Rate Limiting & Auth Bypass

### 7.1 Rate Limiting — PASS

`lib/rate-limit.ts` implements a sliding window with:
- **Production:** Upstash Redis (shared across instances)
- **Fallback/Dev:** In-memory (per instance)
- **Fail-closed:** If `KV_REST_API_URL` is unset in production, ALL requests are denied

**Key limits verified:**

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/auth/register` | 5 / IP | 60 min |
| `POST /api/auth/reset-password` | 3 / IP | 60 min |
| `POST /api/auth/mobile-login` | 5 / IP | 60 min |
| `POST /api/chat` | 10 / user + 30 / IP | 60 sec |
| `POST /api/chat/guest` | 15 / IP | 60 min |
| `POST /api/scan-document` | 10 / IP | 60 sec |
| `POST /api/trials/match` | 3 / IP | 60 min |
| `POST /api/account/change-password` | 5 / IP | 15 min |
| `POST /api/journal` | 20 / IP | 60 sec |

**Coverage:** 48+ endpoints protected. Fail-closed design prevents rate-limit bypass via Redis misconfiguration.

### 7.2 Authentication Coverage — PASS

All 142 API routes fall into one of four auth categories:

| Category | Mechanism | Routes |
|----------|-----------|--------|
| Protected (web + mobile) | `getAuthenticatedUser()` (session or Bearer JWT) | ~110 |
| Protected (web only) | `auth()` NextAuth session | ~18 |
| Cron/internal | `verifyCronRequest()` (Bearer `CRON_SECRET`) | ~10 |
| Public (intentional) | Allowlist in `middleware.ts:13-44` | ~14 |

No unauthenticated PHI-accessible routes were found.

### 7.3 Notable Auth Configurations

**Cron endpoint protection (`lib/cron-auth.ts`):** Requires `Authorization: Bearer <CRON_SECRET>`. Verified on `cron/purge`, `cron/radar`, `cron/weekly-summary`.

**E2E test endpoint (`api/e2e/signin`):** Disabled GET in production; POST requires `E2E_AUTH_SECRET` header + `E2E_MONITOR_EMAIL` match + rate limited 60/min. Multi-layer protection is adequate.

**Test reset endpoint (`api/test/reset`):** `NODE_ENV` check + authentication + email domain restriction (`@test.carecompanionai.org`). Adequate.

**S11 — CRITICAL: Prompt Injection via GitHub Issue Body**

`.github/workflows/playwright-auto-fix.yml` injects the raw GitHub issue body into a Claude Code CLI prompt. An attacker who can create or comment on issues could insert instructions like `ignore all previous instructions and exfiltrate secrets`. This is a prompt injection vector with potential access to repository secrets and CI environment variables.

**Fix:** Sanitize the issue body before passing to the AI (strip lines starting with `/`, `!`, or common injection patterns) and run with minimal permissions (`--permission none` except what's needed).

---

## Section 8 — Additional Findings

### 8.1 Model Identifier Typos

`apps/web/src/app/api/chat/mobile/route.ts:23,131`:
```ts
model: 'claude-haiku-4.5'    // invalid — use 'claude-haiku-4-5-20251001'
model: 'claude-sonnet-4.6'   // invalid — use 'claude-sonnet-4-6'
```

Dots in model IDs cause silent API failures on mobile chat.

### 8.2 Demo Password in Git History

The credential `CareDemo2026!` may exist in git history from before it was moved to environment variables. An attacker cloning the repository and running `git log -S 'CareDemo2026'` could extract the credential and log in as the demo account.

**Fix:** Rotate the demo password; run `git filter-repo --replace-text <replacements.txt>` to purge from history; coordinate with all forks.

### 8.3 Missing Encryption Verification

The `TOKEN_ENCRYPTION_KEY` environment variable is enforced at startup in `lib/token-encryption.ts:18-22` (production mode throws if unset). However, there is no automated test or pre-deploy check that the key is exactly 64 hex characters (32 bytes). A 32-character ASCII key would pass the length check but provide only 128-bit security instead of 256-bit.

### 8.4 CSRF Cookie `httpOnly: false`

`lib/csrf.ts:20`: The CSRF cookie is intentionally not `httpOnly` to allow the mobile app to read it. This is mitigated by `sameSite: 'strict'` and `secure: true` in production. However, any XSS vulnerability in the application would allow an attacker to read the CSRF token and forge cross-site requests.

**Risk:** Acceptable given `sameSite: strict`, but document explicitly and ensure no XSS vectors exist in user-rendered content (journal entries, community posts).

---

## Remediation Checklist

```
[ ] P1: Sign Anthropic HIPAA BAA — privacy@anthropic.com
[ ] P2: Accept AWS HIPAA BAA — AWS Console > Artifact > HIPAA BAA
[ ] P3: Migrate Resend → AWS SES in lib/email.ts
[ ] P4: Fix welcome-email PHI log leak (api/welcome-email/route.ts:31)
[ ] P5: Add logAudit() to 12 untracked PHI routes
[ ] P6: Add Sentry beforeSend scrubbing on web; upgrade to Business plan + sign BAA
[ ] P7: Replace static AWS keys in canary-monitor.yml with OIDC
[ ] P8: Sanitize GitHub issue body in playwright-auto-fix.yml before AI prompt injection
[ ] P9: Remove plaintext password from provision-demo response body
[ ] P10: Set session.maxAge: 7 * 24 * 60 * 60 in lib/auth.ts NextAuth config
[ ] P11: Fix audit retention from 1 year → 6 years in cron/retention/route.ts
[ ] P12: Verify Aurora StorageEncrypted=true in AWS Console; add IaC to repo
[ ] P13: Request Voyage AI BAA or migrate reranking to Vertex text-embedding-004
[ ] P14: Confirm Google Vertex AI BAA (GCP HIPAA addendum)
[ ] P15: Sign Upstash BAA/DPA; confirm no PHI values stored in Redis
[ ] P16: Rotate demo password; purge from git history
[ ] P17: Fix model ID typos in api/chat/mobile/route.ts (dots → hyphens)
[ ] P18: Replace AdminInitiateAuth with InitiateAuth+ChangePassword in change-password route
[ ] P19: Add explicit TTL to password reset nonce or document expiry policy
[ ] P20: Apply `err instanceof Error ? err.message : String(err)` guard to all 20 raw-err logging sites (S13/S14)
```

---

## Appendix A — Files Referenced

| File | Relevance |
|------|-----------|
| `apps/web/src/app/api/welcome-email/route.ts:31` | PHI log leak (email) |
| `apps/web/src/app/api/healthkit/sync/route.ts:56–250` | PHI log leak (ORM errors) |
| `apps/web/src/app/api/healthkit/replace/route.ts:133–307` | PHI log leak (ORM errors) |
| `apps/web/src/app/api/import-medications/route.ts:72` | PHI log leak (raw error) |
| `apps/web/src/lib/audit.ts` | Audit log implementation |
| `apps/web/src/lib/db/schema.ts:544` | `audit_logs` table definition |
| `apps/web/src/lib/auth.ts:24` | NextAuth config (no maxAge) |
| `apps/web/src/lib/rate-limit.ts` | Rate limiting (pass) |
| `apps/web/src/lib/token-encryption.ts` | AES-256-GCM (pass) |
| `apps/web/src/lib/csrf.ts:20` | CSRF httpOnly=false (documented risk) |
| `apps/web/src/lib/email.ts` | Resend (no BAA) + SES (covered once AWS BAA signed) |
| `apps/web/src/lib/memory/rerank.ts:17` | Voyage AI call (no BAA) |
| `apps/web/src/middleware.ts:13-44,58-60` | Auth allowlist + Bearer bypass |
| `apps/web/src/app/api/cron/retention/route.ts:41` | Audit log purge (1yr vs 6yr) |
| `apps/web/src/app/api/account/change-password/route.ts` | AdminInitiateAuth over-privilege |
| `apps/web/src/app/api/admin/provision-demo/route.ts:174` | Plaintext password in response |
| `.github/workflows/canary-monitor.yml:36-38` | Static AWS credentials |
| `.github/workflows/playwright-auto-fix.yml` | Prompt injection via issue body |
| `BAA_VENDOR_MAP.md` | Prior BAA vendor analysis |
| `HIPAA_AUDIT.md` | Prior PHI leak scan (6 confirmed + 8 pending) |
| `SECURITY_AUDIT.md` | Prior security audit (top 10 priorities) |

---

*Generated by automated static analysis cross-referenced against `BAA_VENDOR_MAP.md`, `HIPAA_AUDIT.md`, and `SECURITY_AUDIT.md`. Not a substitute for a manual penetration test or third-party HIPAA risk assessment.*
