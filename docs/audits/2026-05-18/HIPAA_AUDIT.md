# HIPAA PHI Audit Report

**Date:** 2026-05-18  
**Branch:** aryan/dev  
**Auditor:** Automated HIPAA PHI scan (CLAUDE.md Rule 7)  
**Scope:** `apps/web/src/`, `apps/mobile/src/`, `packages/`

---

## Summary

| Metric | Count |
|--------|-------|
| Total logging/tracking call sites scanned | 220 |
| Unique files containing log calls | 122 |
| **Confirmed PHI leaks auto-redacted** | **6** |
| Cases flagged for human review | 8 |
| Patterns discovered (systemic) | 4 |
| Analytics/error-tracking with proper PHI scrubbing | 3 ✅ |

---

## Confirmed Leaks Auto-Redacted

### 1. Share token logged alongside userId
**File:** `apps/web/src/app/api/cron/weekly-summary/route.ts:233`

| | Content |
|-|---------|
| Before | `logger.info('weekly_summary_generated', { userId: profile.userId, token });` |
| After | `logger.info('weekly_summary_generated', { userId: profile.userId });` |

**Why:** `token` is a 20-character random share token that grants unauthenticated read access to a patient's weekly health summary. Logging it creates a durable credential record in log aggregators that could enable unauthorized access to PHI.

---

### 2. AI health analysis text in error log
**File:** `apps/web/src/app/api/cron/radar/route.ts:365`

| | Content |
|-|---------|
| Before | `logger.error('radar_parse_failed', { userId: profile.userId, text: text.slice(0, 200) });` |
| After | `logger.error('radar_parse_failed', { userId: profile.userId });` |

**Why:** `text` is the raw AI model response that analyzed the patient's health data — mood trends, pain levels, medication side effects, and caregiver burnout signals. Up to 200 characters of this health analysis text was being written to error logs on JSON parse failure.

---

### 3. User email in Cognito error message
**File:** `apps/web/src/app/api/delete-account/route.ts:50`

| | Content |
|-|---------|
| Before | `console.error(\`[delete-account] Cognito deletion failed for username "${cognitoUsername}" (DB record already deleted):\`, cognitoErr);` |
| After | `console.error('[delete-account] Cognito deletion failed (DB record already deleted):', cognitoErr instanceof Error ? cognitoErr.message : String(cognitoErr));` |

**Why:** `cognitoUsername` is `user.providerSub ?? user.email`. For users whose `providerSub` was not stored (pre-migration accounts), this logs their email address — which is PHI in a health context. Additionally the raw `cognitoErr` object was serialized (could contain Cognito request metadata).

---

### 4. Full auth error cause JSON-serialized
**File:** `apps/web/src/lib/auth.ts:186,188`

| | Content |
|-|---------|
| Before | `console.error('[auth][error][cause]', JSON.stringify(e.cause, null, 2))` / `String(e.cause)` |
| After | `console.error('[auth][error][cause]', typeof cause === 'object' && cause !== null ? { type: cause?.constructor?.name ?? typeof cause, code: cause?.code, statusCode: cause?.statusCode } : '[non-serializable]')` |

**Why:** `JSON.stringify` on an auth error cause recursively serializes all enumerable properties, which can include JWT payloads, OAuth access tokens, session data, or user attributes returned from Cognito. Replaced with a safe subset: only `type`, `code`, and `statusCode`.

---

### 5. Raw Cognito error object — provision-demo
**File:** `apps/web/src/app/api/admin/provision-demo/route.ts:132`

| | Content |
|-|---------|
| Before | `console.error('[provision-demo] Cognito create failed:', err);` |
| After | `console.error('[provision-demo] Cognito create failed:', err instanceof Error ? err.message : String(err));` |

**Why:** AWS SDK error objects include the full request context in their metadata, which for `AdminCreateUser` includes the user's email, temporary password policy, and user attributes.

---

### 6. Raw Cognito error object — provision-reviewer
**File:** `apps/web/src/app/api/admin/provision-reviewer/route.ts:142`

| | Content |
|-|---------|
| Before | `console.error('[provision-reviewer] Create Cognito user failed:', err);` |
| After | `console.error('[provision-reviewer] Create Cognito user failed:', err instanceof Error ? err.message : String(err));` |

**Why:** Same as #5 above.

---

## Needs Human Review

These cases were not auto-edited because intent or data shape is ambiguous.

### R1. Client-side setup wizard error logging
**File:** `apps/web/src/components/SetupWizard.tsx:169`  
**Context:** `console.error('Setup error:', err);`  
**Why:** The setup wizard collects patient name, diagnosis/cancer type, and caregiver relationship across steps 1–5. If an HTTP error response echoes the request body (some middleware does), PHI from the submitted form could appear in this browser-side log. Additionally, browser `console.error` is visible in browser DevTools and captured by browser monitoring agents. Recommend wrapping in a `reportError(err)` helper that extracts only `err.message`.

---

### R2. Journal/symptom entry errors
**File:** `apps/web/src/app/api/journal/route.ts:72,95,129`  
**Context:** `console.error('[journal] POST/GET/DELETE error:', err);`  
**Why:** Journal entries store symptoms, medications, notes, and mood/pain scores (PHI). Some ORM errors (e.g., Drizzle constraint violations) include the violating row data in the error message. Low probability but non-zero; recommend `err instanceof Error ? err.message : String(err)`.

---

### R3. Document scan AI error
**File:** `apps/web/src/app/api/scan-document/route.ts:80`  
**Context:** `console.error('[scan-document] Error:', err)`  
**Why:** This endpoint sends medical documents (lab reports, insurance EOBs, imaging results) to the AI model for extraction. Anthropic SDK errors occasionally include the prompt text when the request fails, which here could contain the full medical document content. Recommend message-only extraction and ensure the prompt builder strips raw document text before re-throwing.

---

### R4. Chat cache telemetry using console.log
**File:** `apps/web/src/app/api/chat/route.ts:328–334`  
**Context:** `console.log('[chat-cache]', JSON.stringify({ userId, cachedInputTokens, inputTokens, outputTokens, cacheEnabled }));`  
**Why:** No direct PHI in this payload — only token counts and a userId. However: (a) server code should use `logger.*` not `console.log` for consistency with the structured logging pipeline; (b) `userId` in logs creates a linkable operational record — consider whether this telemetry is needed in production. Recommend `logger.info('chat_cache_telemetry', {...})` and filtering out of production log exports if not required.

---

### R5. HealthKit clinical records error (mobile, ×2)
**Files:** `apps/mobile/src/services/healthkit.ts:446,532`  
**Context:** `console.warn('[HealthKit] fetchClinicalRecords failed:', err)` (after extracting `message` on the line above)  
**Why:** The `message` variable is already extracted from `err` one line above, yet the full `err` object is still logged. HealthKit native bridge errors can include FHIR resource identifiers or partial record data in verbose error metadata. Replace `err` with `message` to match the already-extracted value.

---

### R6. WellnessVitals bridge error (mobile)
**File:** `apps/mobile/src/services/wellnessVitals.ts:174`  
**Context:** `console.warn('[WellnessVitals] today() failed:', err)`  
**Why:** Wellness vitals (step count, heart rate, sleep) are health data covered under HIPAA when associated with a patient record. The `err` from a failing native bridge is unlikely to contain the data itself, but message-only extraction is a simple defensive improvement.

---

### R7. Calendar appointment errors (mobile)
**File:** `apps/mobile/src/services/calendar.ts:67,94`  
**Context:** `console.warn('[Calendar] fetchEvents failed:', err)` / `console.warn('[Calendar] appointments.create failed for', ev.id, err)`  
**Why:** Calendar events contain appointment titles, times, and provider names. `ev.id` (line 94) is an internal identifier (low risk). The raw `err` objects are from the device calendar API — unlikely to contain content, but recommend message extraction for consistency.

---

### R8. Community route errors (PHI-adjacent content)
**Files:** `apps/web/src/app/api/community/route.ts:72,136` / `apps/web/src/app/api/community/[id]/route.ts:77,145,173`  
**Context:** `console.error('[community] GET/POST error:', err)` / `console.error('[community/id] GET/POST/DELETE error:', err)`  
**Why:** Community posts contain `cancerType` and `authorRole` fields. While posts are community-shared (not strictly private PHI), DB errors on insert/update can sometimes include the input data in error context. Low priority but worth consistent message-extraction.

---

## Positive Findings

The following PHI-protection mechanisms were confirmed working correctly:

1. **PostHog analytics scrubbing** (`apps/web/src/lib/analytics.ts`) — `sanitize_properties` strips `patientName`, `cancerType`, `medication`, `labValue`, `chatMessage` before any event leaves the browser. ✅

2. **Sentry mobile scrubbing** (`apps/mobile/src/lib/sentry.ts`) — `beforeSend: scrubPHI` recursively redacts 17 PHI field names (`patientName`, `diagnosis`, `medicationName`, `symptoms`, `notes`, `message`, `phone`, `location`, etc.) across all event data, breadcrumbs, and extra context. ✅

3. **Onboarding analytics** (`apps/web/src/lib/analytics/onboarding-events.ts`) — Only emits phase names, booleans, and durations. No names, IDs, or health data. Comment confirms intent. ✅

4. **Structured logger exists** — `logger.info/error` wrapper is used in cron jobs and export routes. The correct error-message extraction pattern (`err instanceof Error ? err.message : String(err)`) is already used in `weekly-summary/route.ts:237` and `appointment-prep.ts:161`. ✅

---

## Patterns Discovered (Systemic)

### P1. Inconsistent error serialization
6 files pass raw `err` objects to `console.error`; ~8 already use the safe `err instanceof Error ? err.message : String(err)` pattern. There is no lint rule enforcing the safe form. **Recommendation:** Add an ESLint rule (custom or via `eslint-plugin-security`) that disallows passing non-string expressions as the last argument to `console.error/warn` in server files.

### P2. Mixed `console.*` vs `logger.*` on server
Server routes split between raw `console.error` and the structured `logger.*` helper. This breaks log pipeline consistency — `console.*` outputs go to stdout unstructured while `logger.*` calls produce structured JSON that can be filtered and monitored. **Recommendation:** Enforce `logger.*` on all server-side code (`apps/web/src/app/api/**`) and replace remaining `console.*` calls.

### P3. No pre-commit PHI field-name check
No hook or lint rule prevents PHI field names (`user.email`, `name`, `patientName`, `diagnosis`, `phone`, `dob`, `medications`) from appearing inside `console.*` or `logger.*` call arguments. **Recommendation:** Add a pre-commit `grep` hook or `eslint-plugin-no-restricted-syntax` rule targeting patterns like `/console\.(log|error|warn|info|debug)\([^)]*\.(email|name|phone|dob|diagnosis|medication)/`.

### P4. Client-side errors unguarded
Browser-side `console.error` calls (e.g., `SetupWizard.tsx`) have no scrubbing equivalent of the Sentry `beforeSend` hook. Browser logs persist in DevTools, can be captured by extensions, and are visible to anyone with DevTools access on a shared device. **Recommendation:** Route client-side errors through a `reportError(err)` wrapper that extracts only `err.message` before logging and before forwarding to any third-party error tracker.

---

## Files Changed in This Audit

| File | Change |
|------|--------|
| `apps/web/src/app/api/cron/weekly-summary/route.ts` | Removed `token` from info log |
| `apps/web/src/app/api/cron/radar/route.ts` | Removed health analysis text from error log |
| `apps/web/src/app/api/delete-account/route.ts` | Redacted cognitoUsername (potential email) from error message |
| `apps/web/src/lib/auth.ts` | Replaced full `JSON.stringify(e.cause)` with safe subset |
| `apps/web/src/app/api/admin/provision-demo/route.ts` | Extracted error message from raw Cognito err object |
| `apps/web/src/app/api/admin/provision-reviewer/route.ts` | Extracted error message from raw Cognito err object |
