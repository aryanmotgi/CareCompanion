# HIPAA Round-2 Autofix Report (Retry)

**Date:** 2026-05-19  
**Source audit:** `docs/audits/2026-05-18/HIPAA_AUDIT.md`  
**Branch:** aryan/dev

---

## Fixed Items

### R2 — Journal/symptom entry errors (3 sites)
**Files:** `apps/web/src/app/api/journal/route.ts:72, 95, 129`

| Site | Before | After |
|------|--------|-------|
| POST error | `console.error('[journal] POST error:', err)` | `console.error('[journal] POST error:', err instanceof Error ? err.message : String(err))` |
| GET error | `console.error('[journal] GET error:', err)` | `console.error('[journal] GET error:', err instanceof Error ? err.message : String(err))` |
| DELETE error | `console.error('[journal] DELETE error:', err)` | `console.error('[journal] DELETE error:', err instanceof Error ? err.message : String(err))` |

**Why safe to auto-fix:** Pattern is identical to the already-established safe form used in `weekly-summary/route.ts:237` and `appointment-prep.ts:161`. Drizzle ORM constraint errors can include violating row data (symptoms, medications, mood/pain scores); message-only extraction eliminates that risk.

---

### R4 — Chat cache telemetry (console.log → logger.info)
**File:** `apps/web/src/app/api/chat/route.ts:329–335`

| | Content |
|-|---------|
| Before | `console.log('[chat-cache]', JSON.stringify({ userId, cachedInputTokens, inputTokens, outputTokens, cacheEnabled }))` |
| After | `logger.info('chat_cache_telemetry', { userId, cachedInputTokens, inputTokens, outputTokens, cacheEnabled })` |

Added `import { logger } from '@/lib/logger'` to the file.

**Why safe to auto-fix:** No PHI in the payload (only token counts + userId). Change aligns server-side code with the structured logging pipeline (`logger.*` vs raw `console.*`) per systemic Pattern P2 from the audit. The intent is explicit in the existing comment above the call.

---

### R5 — HealthKit clinical records (2 sites)
**File:** `apps/mobile/src/services/healthkit.ts:446, 531`

| Site | Before | After |
|------|--------|-------|
| fetchClinicalRecords (sync path) | `console.warn('...failed:', err)` | `console.warn('...failed:', message)` |
| fetchClinicalRecords (retry path) | `console.warn('...failed:', err)` | `console.warn('...failed:', message)` |

**Why safe to auto-fix:** The variable `message` is already extracted from `err` on the immediately preceding line in both cases. This is a mechanical substitution — replaces the raw error object with the already-extracted string. Zero semantic change.

---

### R6 — WellnessVitals bridge error
**File:** `apps/mobile/src/services/wellnessVitals.ts:174`

| | Content |
|-|---------|
| Before | `console.warn('[WellnessVitals] today() failed:', err)` |
| After | `console.warn('[WellnessVitals] today() failed:', err instanceof Error ? err.message : String(err))` |

**Why safe to auto-fix:** Wellness vitals (step count, heart rate, sleep) are health data; message-only extraction is a simple defensive improvement consistent with the audit's recommendation.

---

### R7 — Calendar appointment errors (2 sites)
**File:** `apps/mobile/src/services/calendar.ts:67, 94`

| Site | Before | After |
|------|--------|-------|
| fetchEvents | `console.warn('[Calendar] fetchEvents failed:', err)` | `console.warn('[Calendar] fetchEvents failed:', err instanceof Error ? err.message : String(err))` |
| appointments.create | `console.warn('[Calendar] appointments.create failed for', ev.id, err)` | `console.warn('[Calendar] appointments.create failed for', ev.id, err instanceof Error ? err.message : String(err))` |

**Why safe to auto-fix:** `ev.id` is an internal identifier (low risk, retained). Raw `err` objects from the device calendar API are replaced with message-only extraction for consistency.

---

### R8 — Community route errors (5 sites)
**Files:** `apps/web/src/app/api/community/route.ts:72, 136` / `apps/web/src/app/api/community/[id]/route.ts:77, 145, 173`

All five `console.error('[community...] ... error:', err)` calls updated to extract `err instanceof Error ? err.message : String(err)`.

**Why safe to auto-fix:** Community posts contain `cancerType` and `authorRole`. DB errors on insert/update can include input data in error context. Message extraction eliminates that risk with no behavior change.

---

## Skipped Items

| Item | File | Reason skipped |
|------|------|----------------|
| R1 — SetupWizard client error | `apps/web/src/components/SetupWizard.tsx:169` | Explicitly excluded per task instructions (human triage). Requires a `reportError()` wrapper to be designed — not a simple find-replace. |
| R3 — Document scan AI error | `apps/web/src/app/api/scan-document/route.ts:80` | Explicitly excluded per task instructions (human triage). Requires verifying that the prompt builder strips raw document text before re-throwing — semantic analysis required. |

---

## Health Check After Fixes

| Check | Result |
|-------|--------|
| typecheck | PASS (7/7 packages) |
| lint | PASS (0 errors) |

Tests not re-run (no logic changed, only error serialization format).

---

## Total Fixes This Round

| Round | Auto-fixed | Skipped |
|-------|-----------|---------|
| Round 1 (2026-05-18) | 6 confirmed leaks | — |
| Round 2 (2026-05-19) | **12 sites across 7 files** | 2 (R1, R3) |
| **Cumulative** | **18 sites** | **2** |
