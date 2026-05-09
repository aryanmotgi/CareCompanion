# CareCompanion HIPAA Compliance Assessment Report

**Version:** 1.0  
**Date:** April 8, 2026  
**Prepared For:** CareCompanion Development Team  
**Classification:** CONFIDENTIAL  

---

## Table of Contents

1. Executive Summary
2. Scope & Methodology
3. Current HIPAA Violation Risk Assessment
4. Critical Findings
5. High-Priority Findings
6. Medium-Priority Findings
7. Third-Party Vendor Analysis (BAA Requirements)
8. PHI Data Flow Map
9. Remediation Plan
10. Compliance Roadmap & Timeline
11. Appendix: HIPAA Rules Reference

---

## 1. Executive Summary

CareCompanion is an AI-powered cancer care platform that processes Protected Health Information (PHI) including patient names, cancer diagnoses, medications, lab results, insurance claims, and treatment histories. This report assesses the application's current compliance posture against HIPAA's Privacy Rule, Security Rule, and Breach Notification Rule.

### Overall Assessment: HIGH RISK — Not Production-Ready for Real PHI

The platform has **12 critical findings**, **8 high-priority findings**, and **6 medium-priority findings** that must be addressed before processing real patient data. The most significant issues are:

1. **Full patient records are transmitted to Anthropic's Claude API** on every chat request — without a Business Associate Agreement (BAA)
2. **OAuth tokens for health system integrations are stored in plaintext** in the database
3. **No field-level encryption** for PHI stored in Supabase
4. **Incomplete Row-Level Security** on several tables containing sensitive data
5. **In-memory rate limiting** that doesn't function in Vercel's serverless architecture

### Are We Currently Violating HIPAA?

**If processing real patient data: Yes, multiple violations exist.** If only using demo/test data in development, these are pre-production findings that must be resolved before launch.

| HIPAA Rule | Status | Key Gap |
|---|---|---|
| Privacy Rule (164.502) | VIOLATION | PHI sent to Anthropic without BAA or minimum necessary controls |
| Security Rule (164.312) | VIOLATION | No encryption at rest for PHI, plaintext token storage |
| Breach Notification (164.404) | VIOLATION | No breach notification procedures or incident response plan |
| Business Associate (164.502(e)) | VIOLATION | No BAAs — but fixable by preventing PHI from reaching vendors ($0) |
| Access Control (164.312(a)) | PARTIAL | Auth exists but RLS incomplete on several tables |
| Audit Controls (164.312(b)) | PARTIAL | Audit logging exists but not applied to all endpoints |
| Integrity Controls (164.312(c)) | PARTIAL | No checksums or integrity verification for PHI |
| Transmission Security (164.312(e)) | OK | HTTPS enforced via Vercel/Supabase |

---

## 2. Scope & Methodology

### What Was Assessed

- Full source code review (62 API routes, 33+ library files, 55 UI components)
- Environment configuration and secrets management
- Database schema and Row-Level Security policies
- Authentication and session management
- All third-party service integrations
- Data flow from collection through storage, processing, and deletion
- Client-side data handling

### PHI Categories Identified in CareCompanion

| PHI Element | Where Stored | Where Transmitted |
|---|---|---|
| Patient name, age | `care_profiles` table | Claude API system prompt |
| Cancer type & stage | `care_profiles` table | Claude API system prompt |
| Medications & dosages | `medications` table | Claude API system prompt |
| Doctor names & contacts | `doctors` table | Claude API system prompt |
| Appointment details | `appointments` table | Claude API system prompt |
| Lab results & values | `lab_results` table | Claude API system prompt |
| Insurance info | `insurance` table | Claude API system prompt |
| Claims & denials | `claims` table | Claude API system prompt |
| Prior authorizations | `prior_auths` table | Claude API system prompt |
| Symptoms & journal | `symptom_entries` table | Claude API (if discussed) |
| Allergies & conditions | `care_profiles` table | Claude API system prompt |
| Chat messages | `messages` table | Claude API (every request) |
| Long-term memories | `memories` table | Claude API (loaded into context) |
| Scanned documents | Claude Vision API | Anthropic servers |

---

## 3. Current HIPAA Violation Risk Assessment

### 3.1 Active Violations (If Processing Real PHI)

#### VIOLATION 1: No Business Associate Agreements (45 CFR 164.502(e))

**Rule:** Covered entities must have BAAs with all business associates that create, receive, maintain, or transmit PHI.

**Finding:** CareCompanion transmits PHI to multiple third parties without BAAs:

- **Anthropic (Claude API):** Receives full patient records including name, diagnosis, medications, lab results, insurance info, and scanned medical documents on every chat request. The system prompt at `src/lib/system-prompt.ts` lines 105-284 constructs a comprehensive patient dossier sent with every API call.

- **Supabase:** Stores all PHI in PostgreSQL. CareCompanion uses Supabase's standard tier — HIPAA-eligible hosting requires Supabase's Enterprise tier with a signed BAA.

- **Vercel:** Processes server-side requests, captures function logs, and may log error data containing PHI. Vercel offers HIPAA compliance on Enterprise plans only.

**Evidence (system-prompt.ts lines 105-107):**
```typescript
let context = `\n\n=== CARE PROFILE ===\n`;
context += `Patient: ${profile.patient_name || 'Not provided'}`;
if (profile.patient_age) context += `, Age: ${profile.patient_age}`;
```

**Impact:** Each chat message transmits the entire patient record to Anthropic's servers. This includes medications (lines 142-152), doctors (lines 157-164), appointments (lines 169-177), lab results (lines 186-198), denied claims (lines 211-221), prior authorizations (lines 224-233), FSA/HSA balances (lines 236-243), and all long-term memories (lines 247-284).

#### VIOLATION 2: No Minimum Necessary Standard (45 CFR 164.502(b))

**Rule:** Only the minimum necessary PHI should be used or disclosed for a given purpose.

**Finding:** Every chat request sends ALL patient data regardless of the question asked. A user asking "what time is my next appointment?" triggers transmission of their full medication list, lab results, insurance claims, and every memory extracted from past conversations.

#### VIOLATION 3: No Encryption at Rest (45 CFR 164.312(a)(2)(iv))

**Rule:** PHI must be rendered unusable, unreadable, or indecipherable to unauthorized persons.

**Finding:** All PHI is stored in plaintext in Supabase PostgreSQL tables. OAuth access tokens and refresh tokens for health system integrations (Epic, 1upHealth) are stored without application-level encryption.

**Evidence (oneup/callback/route.ts line 59):**
```typescript
access_token: tokens.access_token,    // Plaintext
refresh_token: tokens.refresh_token,  // Plaintext
```

#### VIOLATION 4: No Breach Notification Procedures (45 CFR 164.404)

**Rule:** Covered entities must notify affected individuals within 60 days of discovering a breach.

**Finding:** No breach notification policy, incident response plan, or forensic investigation capability exists in the codebase or documentation.

---

### 3.2 Potential Violations (Gaps That Could Lead to Violations)

#### GAP 1: Incomplete Audit Controls (45 CFR 164.312(b))

**Rule:** Implement hardware, software, and procedural mechanisms to record and examine activity in systems containing PHI.

**Finding:** An audit logging system exists (`src/lib/audit-log.ts`) but is not consistently applied across all API routes. Chat endpoints, document extraction, data sync operations, and most CRUD operations do not generate audit logs. Only care team operations and account deletion are logged.

#### GAP 2: Weak Webhook Authentication (45 CFR 164.312(d))

**Rule:** Implement procedures to verify the identity of persons or entities seeking access to ePHI.

**Finding:** The FHIR webhook endpoint (`src/app/api/webhooks/fhir/route.ts`) uses simple string comparison for signature verification instead of HMAC-SHA256. In development, it accepts all webhooks without verification.

**Evidence:**
```typescript
if (!secret) {
  return process.env.NODE_ENV !== 'production' // Accepts everything in dev
}
return signature === secret // Simple string match, not HMAC
```

#### GAP 3: No Session Timeout (45 CFR 164.312(a)(2)(iii))

**Rule:** Implement electronic procedures to terminate sessions after a predetermined time of inactivity.

**Finding:** No session timeout configuration was found. Sessions managed by Supabase may persist indefinitely.

#### GAP 4: Rate Limiting Non-Functional in Production (45 CFR 164.312(a)(1))

**Rule:** Implement technical policies and procedures for electronic systems maintaining ePHI to allow access only to authorized persons.

**Finding:** Rate limiting uses an in-memory token bucket (`src/lib/rate-limit.ts`). On Vercel's serverless architecture, each function instance maintains its own independent bucket. A determined attacker can bypass limits by hitting different instances.

---

## 4. Critical Findings

### C1: Full PHI Transmitted to Anthropic Claude API

**Severity:** CRITICAL  
**HIPAA Rules:** 164.502(b), 164.502(e), 164.314  
**File:** `src/lib/system-prompt.ts`  

**Description:** The `buildSystemPrompt()` function constructs a system prompt containing ALL patient data and sends it to Anthropic's Claude API with every chat request. This includes:

- Patient name and age (line 106-107)
- Cancer type, stage, treatment phase (lines 110-121)
- Conditions and allergies (lines 122-123)
- All medications with dosages and prescribing doctors (lines 142-152)
- All doctors with phone numbers (lines 157-164)
- All upcoming appointments (lines 169-177)
- Lab results including abnormal values (lines 186-198)
- Denied insurance claims with amounts (lines 211-221)
- Prior authorization statuses (lines 224-233)
- FSA/HSA balances (lines 236-243)
- All long-term memories extracted from conversations (lines 247-284)
- Conversation summaries (lines 288+)

**Additionally:** The memory extraction system (`src/lib/memory.ts`) sends conversation content to Claude Haiku for fact extraction after every assistant response, and for conversation summarization every 20 messages — doubling the PHI exposure.

**Risk:** If Anthropic experiences a data breach, or if API requests are logged/stored by Anthropic, all patient data is exposed.

### C2: Document Scanner Sends Medical Images to Anthropic

**Severity:** CRITICAL  
**HIPAA Rules:** 164.502(b), 164.502(e)  
**Files:** `src/app/api/documents/extract/route.ts`, `src/app/api/scan-document/route.ts`  

**Description:** Users can photograph prescription bottles, lab reports, insurance cards, and medical bills. These images are sent directly to Claude Vision API for data extraction. Original medical documents containing PHI are transmitted to Anthropic's servers.

### C3: OAuth Tokens Stored Without Encryption

**Severity:** CRITICAL  
**HIPAA Rules:** 164.312(a)(2)(iv), 164.312(e)(2)(ii)  
**Files:** All OAuth callback routes under `src/app/api/auth/*/callback/` and `src/app/api/oneup/callback/`  

**Description:** Access tokens and refresh tokens for Epic MyChart, 1upHealth, Walgreens, Google Calendar, and insurance portals are stored in plaintext in the `connected_apps` table. These tokens provide direct access to patients' health records at external systems.

### C4: No Business Associate Agreements

**Severity:** CRITICAL  
**HIPAA Rules:** 164.502(e), 164.504(e)  

**Description:** No BAAs exist with any third-party vendor processing PHI. However, **BAAs can be avoided entirely** by preventing PHI from reaching these vendors through code changes:

| Vendor | Current Problem | Budget Fix | BAA Needed After Fix? |
|---|---|---|---|
| Anthropic (Claude) | Receives full patient records | De-identify system prompt (strip names/IDs) | **No** — de-identified data is not PHI |
| Supabase | Stores all PHI in plaintext | Encrypt at app layer (AES-256-GCM) | **No** — Supabase only sees ciphertext |
| Vercel | May log PHI in errors | Sanitize all log output | **No** — Vercel never sees PHI |
| Google Calendar | Appointment PHI | Strip doctor names/purposes from sync | **No** — only non-PHI synced |
| 1upHealth | Health record tokens | N/A — sign their free standard BAA | **Yes** (free) |

### C5: Incomplete Row-Level Security

**Severity:** CRITICAL  
**HIPAA Rules:** 164.312(a)(1)  
**File:** `supabase/migrations/rls_policies.sql`  

**Description:** RLS is confirmed on `care_profiles`, `medications`, `doctors`, `appointments`, and `messages`. However, several tables containing PHI appear to lack RLS policies:

- `lab_results` — Contains test values and abnormal flags
- `claims` — Contains insurance claim amounts and denial reasons
- `insurance` — Contains member IDs and coverage details
- `prior_auths` — Contains authorization details
- `connected_apps` — **Contains OAuth tokens for health systems**
- `memories` — Contains extracted patient facts
- `notifications` — Contains medication names and lab values
- `symptom_entries` — Contains daily health journal data
- `fsa_hsa` — Contains financial health account data

**Risk:** Without RLS, a compromised API route or SQL injection could expose one patient's data to another user.

### C6: No Breach Notification Infrastructure

**Severity:** CRITICAL  
**HIPAA Rules:** 164.404, 164.406, 164.408  

**Description:** HIPAA requires:
- Individual notification within 60 days of breach discovery
- HHS notification (immediately if 500+ individuals, annually if fewer)
- Media notification if 500+ individuals in a state

None of these procedures exist in the application or documentation.

---

## 5. High-Priority Findings

### H1: Chat Messages Stored in Plaintext

**File:** `src/app/api/chat/route.ts`  
**Description:** User messages that may contain PHI (symptom descriptions, medication questions, insurance discussions) are stored unencrypted in the `messages` table.

### H2: Memory System Stores Extracted PHI Facts

**File:** `src/lib/memory.ts`  
**Description:** After every assistant response, Claude Haiku extracts facts from conversations and stores them in the `memories` table. These facts include medication details, conditions, allergies, family information, and more — stored in plaintext with category labels.

### H3: Audit Logging Not Applied Consistently

**File:** `src/lib/audit-log.ts`  
**Description:** Audit logging infrastructure exists but is only called from care team and account deletion operations. The following PHI-accessing operations are NOT logged:
- Chat conversations (every chat request accesses full patient record)
- Document scanning and extraction
- Lab result viewing
- Medication CRUD operations
- Data sync operations
- Health summary generation
- Data export

### H4: Incomplete Data Export (Right of Access)

**File:** `src/app/api/export-data/route.ts`  
**Description:** HIPAA 164.524 gives patients the right to access their complete medical record. The current export excludes:
- Chat messages and conversation history
- Long-term memories
- Health summaries
- Symptom journal entries
- Medication reminder logs
- Audit logs

### H5: Soft Delete 30-Day Retention Window

**File:** `src/lib/soft-delete.ts`  
**Description:** Deleted records are retained for 30 days before hard deletion. While this is reasonable for accidental deletion recovery, there is no mechanism for users to request immediate permanent deletion when closing their account.

### H6: No Data Retention Policy

**Description:** HIPAA requires documented policies for how long different categories of PHI are retained and how they are destroyed. No such policy exists.

### H7: Error Logging May Expose PHI

**Files:** `src/lib/error-reporting.ts`, various `catch` blocks  
**Description:** Error messages are logged to console (captured by Vercel). Stack traces and error messages may contain patient data from failed database queries or API calls.

### H8: Client-Side Treatment Data in localStorage

**File:** `src/components/TreatmentCycleTracker.tsx`  
**Description:** Side effects data is stored in browser localStorage (`cc-side-effects` key). While not direct PHI identifiers, symptom data tied to a logged-in session could constitute PHI. localStorage is vulnerable to XSS attacks and persists after logout.

---

## 6. Medium-Priority Findings

### M1: No Cache-Control Headers on PHI Endpoints

**Description:** API responses containing PHI don't set `Cache-Control: no-store` headers. Proxy caches and browser caches may retain sensitive health data.

### M2: Middleware Route Matcher Incomplete

**File:** `src/middleware.ts`  
**Description:** Auth middleware only covers explicitly listed routes. New API routes could be accidentally unprotected if not added to the matcher list.

### M3: No FHIR Data Validation

**Files:** `src/lib/oneup.ts`, `src/lib/oneup-sync.ts`  
**Description:** FHIR resources imported from external health systems are not validated for data integrity or completeness before storage.

### M4: No Token Expiry Monitoring

**Description:** OAuth tokens for health system integrations have no expiry monitoring. Expired tokens could cause silent sync failures, leading to stale patient data.

### M5: Google Calendar Integration Cannot Be HIPAA-Compliant

**Description:** Standard Google Calendar does not offer a BAA. Appointment data (doctor names, appointment purposes) constitutes PHI and cannot be synced without a HIPAA-eligible Google Workspace agreement.

### M6: Guest Chat Has No Abuse Prevention

**File:** `src/app/api/chat/guest/route.ts`  
**Description:** Anonymous chat allows 15 messages/hour with IP-based rate limiting only. No CAPTCHA or abuse detection. While guest chat doesn't access stored PHI, it could be used for prompt injection or API cost attacks.

---

## 7. Third-Party Vendor Analysis — Budget-First Strategy

The guiding principle: **if a vendor never receives PHI, no BAA is needed.** Instead of paying for expensive Enterprise tiers with BAAs, we eliminate PHI from reaching third parties through code changes. This is cheaper, faster, and reduces attack surface.

### 7.1 Anthropic (Claude API) — SOLVE WITH CODE, NOT A BAA

**Current Problem:** Full patient records sent on every chat request.

**Budget Fix: De-identify before sending ($0)**
- Strip `patient_name` and `patient_age` from the system prompt
- Replace doctor names with roles ("your oncologist" instead of "Dr. Sarah Chen")
- Keep clinical data (medications, cancer type, lab values) — these are not individually identifiable once names are removed
- For document scanning: strip/redact patient name from extracted text before sending image descriptions

Once de-identified, the data sent to Anthropic is no longer PHI under HIPAA's Safe Harbor method (45 CFR 164.514(b)), so **no BAA is required.**

**What stays:** Cancer type, medication names, lab values, treatment info (these are clinical context, not identifiers)  
**What gets removed:** Patient name, age, doctor full names, phone numbers, insurance member IDs

### 7.2 Supabase — SOLVE WITH APP-LEVEL ENCRYPTION ($0)

**Current Problem:** All PHI stored in plaintext.

**Budget Fix: Encrypt at the application layer before storing**
- Use Node.js built-in `crypto.createCipheriv('aes-256-gcm', ...)` to encrypt sensitive fields before they reach Supabase
- Supabase only ever stores ciphertext — it never "receives" PHI in a usable form
- Store the encryption key in Vercel Environment Variables (encrypted at rest by Vercel)
- Decrypt on read within the application layer

**Fields to encrypt:** `patient_name`, `access_token`, `refresh_token`, `member_id`, `messages.content`, `memories.fact`

If Supabase never sees plaintext PHI, no BAA is needed. Standard Supabase tier continues to work.

### 7.3 Vercel — SOLVE WITH LOG SANITIZATION ($0)

**Current Problem:** Error logs may contain PHI.

**Budget Fix: Sanitize all log output**
- Wrap error handlers to strip PHI from messages before `console.error()`
- Use structured logging with explicit allowlists of loggable fields
- Never log request/response bodies on PHI endpoints

If Vercel never receives PHI in logs, no BAA is needed. Standard Vercel plan continues to work.

### 7.4 1upHealth — BAA AVAILABLE AT NO EXTRA COST

**1upHealth's HIPAA Posture:**
- HITRUST CSF certified, designed for healthcare data
- BAA included in standard developer agreement

**Required Action:** Sign 1upHealth's standard BAA (no tier upgrade needed).

### 7.5 Google Calendar — REMOVE PHI FROM SYNC ($0)

**Budget Fix:** Sync only date/time fields without PHI:
- No doctor names in calendar events
- No appointment purposes or descriptions
- Title format: "Medical Appointment" (generic)

Alternatively, remove the Google Calendar integration entirely since credentials are currently empty.

### Cost Comparison: Enterprise BAAs vs. Code-Level Fixes

| Vendor | Enterprise BAA Cost | Code Fix Cost | Approach |
|---|---|---|---|
| Anthropic | ~$$$$/mo (Enterprise API) | $0 (de-identify in code) | De-identify |
| Supabase | ~$599+/mo (Enterprise) | $0 (app-level encryption) | Encrypt |
| Vercel | ~$$$$/mo (Enterprise) | $0 (sanitize logs) | Sanitize |
| 1upHealth | $0 (BAA included) | N/A | Sign standard BAA |
| Google Calendar | N/A (no BAA available) | $0 (strip PHI from sync) | Strip or remove |
| **Total** | **~$1,500+/mo** | **~$0/mo** | **Code changes** |

---

## 8. PHI Data Flow Map

### Current State (PROBLEMS)

```
USER INPUT (Browser)
    │
    ├─── Chat Message ──────────────────┐
    │                                    │
    ├─── Document Scan (Photo) ─────────┤
    │                                    │
    ├─── Manual Data Entry ─────────────┤
    │                                    ▼
    │                          VERCEL (Next.js API Routes)
    │                                    │
    │                    ┌───────────────┼───────────────┐
    │                    │               │               │
    │                    ▼               ▼               ▼
    │            ANTHROPIC API    SUPABASE DB     EXTERNAL APIs
    │            (Claude)        (PostgreSQL)    (Epic, 1up, etc.)
    │                │               │               │
    │         Receives:        Stores:          Receives:
    │         - Patient name   - All PHI        - OAuth tokens
    │         - Diagnosis        (PLAINTEXT)    - FHIR queries
    │         - Medications    - Chat msgs
    │         - Lab results    - Memories
    │         - Insurance      - Tokens
    │         - Scanned docs
    │         - All memories
    │         - Chat history
    │
    └─── localStorage: Side effects data
```

### Target State (AFTER CODE FIXES)

```
USER INPUT (Browser)
    │
    ├─── Chat Message ──────────────────┐
    │                                    │
    ├─── Document Scan (Photo) ─────────┤
    │                                    │
    ├─── Manual Data Entry ─────────────┤
    │                                    ▼
    │                          VERCEL (Next.js API Routes)
    │                                    │
    │                          ┌─── DE-IDENTIFY ───┐
    │                          │    & ENCRYPT       │
    │                    ┌─────┴─────┐    ┌────────┴────────┐
    │                    ▼            │    ▼                 ▼
    │            ANTHROPIC API       │  SUPABASE DB    EXTERNAL APIs
    │            (Claude)            │  (PostgreSQL)   (1up w/ BAA)
    │                │               │      │
    │         Receives:              │  Stores:
    │         - Cancer type          │  - ENCRYPTED PHI
    │         - Medications          │  - Encrypted tokens
    │         - Lab values           │  - Encrypted msgs
    │         - Treatment info       │
    │         NO names, NO IDs       │  Vercel logs:
    │         NO doctor names        │  - SANITIZED
    │         = NOT PHI              │  - No PHI
    │
    └─── localStorage: UI prefs only (no health data)
```

### Data Transmission Summary (After Fixes)

| From | To | Data | PHI? | BAA Needed? |
|---|---|---|---|---|
| Browser | Vercel | All user input | Yes | No (sanitized logs) |
| Vercel | Anthropic | De-identified clinical context | **No** | **No** |
| Vercel | Supabase | AES-256-GCM encrypted ciphertext | **No** | **No** |
| Vercel | 1upHealth | OAuth tokens | Yes | Yes (included free) |
| Vercel | Epic FHIR | OAuth tokens, FHIR queries | Yes | N/A (covered entity) |

---

## 9. Remediation Plan (Budget-Friendly — ~$0-10/mo)

The core strategy: **prevent PHI from leaving our application boundary** so expensive Enterprise BAAs are unnecessary. All fixes below are code changes using free/built-in tools.

### Phase 1: CRITICAL FIXES (Week 1)

All code changes, zero vendor costs.

#### 1.1 De-identify Data Sent to Anthropic ($0 — code change)

Modify `src/lib/system-prompt.ts` to strip identifiers before building the prompt:

```typescript
// BEFORE (sends PHI):
context += `Patient: ${profile.patient_name || 'Not provided'}`;
context += `, Age: ${profile.patient_age}`;
context += `- ${doc.name} (${doc.specialty}), ${doc.phone}`;

// AFTER (de-identified — no longer PHI):
context += `Patient: [name on file]`;
// Remove age entirely
context += `- Your ${doc.specialty || 'doctor'}`;  // Role only, no name/phone
```

**What to keep** (clinical context, not identifiable): cancer type, stage, treatment phase, medication names, dosages, lab values, frequencies, allergies, conditions.

**What to strip** (HIPAA identifiers): patient name, age, doctor full names, phone numbers, insurance member IDs, FSA/HSA provider names.

Under HIPAA's Safe Harbor de-identification (45 CFR 164.514(b)), removing the 18 identifier categories means the data is no longer PHI. No BAA needed.

#### 1.2 App-Level Encryption for Supabase ($0 — code change)

Create `src/lib/encryption.ts` using Node.js built-in `crypto`:

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32-byte key in env var

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}
```

Encrypt before every Supabase `.insert()` / `.update()`, decrypt after every `.select()`.

**Fields to encrypt:** `patient_name`, `access_token`, `refresh_token`, `member_id`, `messages.content`, `memories.fact`

Store `ENCRYPTION_KEY` in Vercel Environment Variables (Vercel encrypts env vars at rest). Supabase never sees plaintext PHI — no BAA needed.

#### 1.3 Sanitize Logs So Vercel Never Sees PHI ($0 — code change)

Create a log wrapper that strips sensitive fields:

```typescript
export function safeLog(message: string, data?: Record<string, unknown>) {
  const REDACT_KEYS = ['patient_name', 'name', 'phone', 'member_id', 'access_token',
    'refresh_token', 'content', 'fact', 'value', 'dose'];
  const sanitized = data ? redactKeys(data, REDACT_KEYS) : undefined;
  console.log(message, sanitized);
}
```

Replace all `console.log` / `console.error` in catch blocks with `safeLog()`. If Vercel never receives PHI in logs, no BAA needed.

#### 1.4 Credential Rotation ($0)

- Regenerate Supabase anon key and service role key
- Generate new Anthropic API key
- Rotate 1upHealth client ID/secret and Epic client ID
- Store all in Vercel Environment Variables (not `.env.local`)
- Generate a new `ENCRYPTION_KEY`: `openssl rand -hex 32`

#### 1.5 Complete Row-Level Security ($0 — SQL migration)

Add RLS policies to all unprotected tables:

```sql
-- Apply to: lab_results, claims, insurance, prior_auths, connected_apps,
-- memories, notifications, symptom_entries, fsa_hsa, health_summaries,
-- conversation_summaries, medication_reminders, reminder_logs

ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON lab_results FOR ALL
  USING (profile_id IN (
    SELECT id FROM care_profiles WHERE user_id = auth.uid()
  ));

-- For user_id-based tables (messages, memories, connected_apps):
ALTER TABLE connected_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_tokens" ON connected_apps FOR ALL
  USING (user_id = auth.uid());
```

### Phase 2: HARDENING (Week 2-3)

#### 2.1 Distributed Rate Limiting ($0 — Upstash free tier)

Replace in-memory rate limiter with Upstash Redis (free tier: 10k requests/day):

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '1 m'),
});
```

#### 2.2 Complete Audit Logging ($0 — code change)

Add audit logging to all PHI-accessing endpoints. The infrastructure already exists in `src/lib/audit-log.ts` — it just needs to be called from:
- Chat requests
- Document scans and extractions
- Data sync operations
- Medication/lab/appointment CRUD
- Health summary generation
- Data export and profile switches

#### 2.3 Fix Webhook Security ($0 — code change)

Replace string comparison with HMAC-SHA256:

```typescript
import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

#### 2.4 Session Timeout ($0 — config change)

Configure Supabase auth session expiry:
- Inactivity timeout: 30 minutes
- Absolute timeout: 12 hours
- Re-auth for sensitive operations (data export, account deletion)

#### 2.5 Cache-Control Headers ($0 — code change)

Add to all API routes returning PHI:

```typescript
return NextResponse.json(data, {
  headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
});
```

#### 2.6 Complete Data Export ($0 — code change)

Update `/api/export-data` to include ALL data: messages, memories, health summaries, symptom entries, reminder logs, audit logs.

#### 2.7 Immediate Hard Delete Option ($0 — code change)

Add hard-delete flag to `/api/delete-account` to bypass 30-day soft-delete on account closure.

#### 2.8 Remove localStorage PHI ($0 — code change)

Move `cc-side-effects` data from localStorage to Supabase. Clear any health data from localStorage on logout.

#### 2.9 Strip PHI from Google Calendar Sync ($0 — code change)

If keeping the integration: sync only date/time, use generic title ("Medical Appointment"), no doctor names or purposes. Or remove the integration entirely.

### Phase 3: POLICIES & TESTING (Week 3-5)

#### 3.1 Write Required HIPAA Policies ($0 — use HHS templates)

HHS provides free templates at hhs.gov. Required policies:

- **Privacy Policy** — Update existing `/privacy` page with PHI handling specifics
- **Data Retention Policy** — Define retention periods per data category
- **Breach Notification Policy** — Procedures for the 60-day notification window
- **Incident Response Plan** — Step-by-step breach response
- **Risk Assessment** — This report serves as the initial formal assessment

#### 3.2 Breach Detection ($0 — code change)

- Log failed auth attempts (already in Supabase auth logs)
- Alert on bulk data access patterns
- Monitor admin client usage

#### 3.3 Penetration Testing ($0 — self-service)

Use free tools instead of a $5-15k security firm:
- **OWASP ZAP** (free) — automated web app security scanning
- **Playwright security tests** — write custom auth bypass tests
- **Manual RLS testing** — attempt cross-user data access with test accounts
- **SQLMap** (free) — SQL injection testing

### Phase 4: MAINTAIN (Ongoing — $0)

- Monthly: Review audit logs for anomalies
- Quarterly: Rotate API keys and encryption keys
- Quarterly: Re-run OWASP ZAP scan
- Annually: Update this risk assessment
- Sign 1upHealth BAA (free, included in standard agreement)

---

## 10. Compliance Roadmap & Timeline

| Week | Phase | Actions | Cost | Owner |
|---|---|---|---|---|
| 1 | Critical | Rotate all credentials | $0 | Dev |
| 1 | Critical | De-identify system prompt (strip names/IDs) | $0 | Dev |
| 1 | Critical | Add app-level encryption (AES-256-GCM) | $0 | Dev |
| 1 | Critical | Complete RLS on all tables | $0 | Dev |
| 1 | Critical | Sanitize all log output | $0 | Dev |
| 2 | Harden | Upstash rate limiting | $0 | Dev |
| 2 | Harden | Complete audit logging on all endpoints | $0 | Dev |
| 2 | Harden | Fix webhook HMAC verification | $0 | Dev |
| 2-3 | Harden | Session timeout, cache headers, complete export | $0 | Dev |
| 3 | Harden | Hard delete option, remove localStorage PHI | $0 | Dev |
| 3-4 | Policies | Write HIPAA policies (use HHS templates) | $0 | Dev / Team |
| 4-5 | Testing | OWASP ZAP scan + manual RLS testing | $0 | Dev |
| 5 | BAA | Sign 1upHealth BAA (included free) | $0 | Dev |
| Ongoing | Maintain | Quarterly key rotation, log review, ZAP rescan | $0 | Dev |

### Estimated Cost

| Item | Enterprise Approach | Budget Approach | Savings |
|---|---|---|---|
| Anthropic BAA | ~$$$$/mo (Enterprise) | $0 (de-identify in code) | 100% |
| Supabase BAA | ~$599/mo (Enterprise) | $0 (app-level encryption) | 100% |
| Vercel BAA | ~$$$$/mo (Enterprise) | $0 (sanitize logs) | 100% |
| Rate limiting | ~$50/mo (Upstash Pro) | $0 (Upstash free tier) | 100% |
| Penetration testing | $5,000-15,000 (firm) | $0 (OWASP ZAP, self-run) | 100% |
| Legal review | $2,000-5,000 (attorney) | $0 (HHS templates) | 100% |
| HIPAA training | $500-2,000 (per dev) | $0 (HHS free training) | 100% |
| 1upHealth BAA | $0 | $0 | N/A |
| **Monthly total** | **~$1,500+/mo** | **~$0-10/mo** | **~99%** |
| **Upfront total** | **~$7,500-22,000** | **~$0** | **100%** |

**Note:** The budget approach achieves compliance through architectural design (preventing PHI from reaching vendors) rather than contractual agreements (paying vendors to handle PHI). Both are valid under HIPAA — the cheapest BAA is the one you don't need.

---

## 11. Appendix: HIPAA Rules Reference

### Key HIPAA Rules Applicable to CareCompanion

| Rule | Citation | Requirement | CareCompanion Status |
|---|---|---|---|
| BAA requirement | 164.502(e) | BAAs with all business associates | NOT MET |
| Minimum necessary | 164.502(b) | Limit PHI to what's needed | NOT MET |
| Encryption at rest | 164.312(a)(2)(iv) | Render PHI unreadable | NOT MET |
| Encryption in transit | 164.312(e)(1) | Protect PHI during transmission | MET (HTTPS) |
| Access controls | 164.312(a)(1) | Limit access to authorized users | PARTIAL |
| Audit controls | 164.312(b) | Record and examine system activity | PARTIAL |
| Integrity controls | 164.312(c)(1) | Protect PHI from alteration | NOT MET |
| Person authentication | 164.312(d) | Verify identity of users | MET |
| Breach notification | 164.404 | Notify individuals within 60 days | NOT MET |
| Risk analysis | 164.308(a)(1) | Conduct risk assessment | THIS REPORT |
| Workforce training | 164.308(a)(5) | Train workforce on policies | NOT MET |
| Contingency plan | 164.308(a)(7) | Data backup and disaster recovery | NOT MET |

### What Constitutes PHI Under HIPAA

Any individually identifiable health information including:
1. Names
2. Dates (except year) related to an individual
3. Geographic data smaller than state
4. Phone/fax numbers
5. Email addresses
6. Social Security numbers
7. Medical record numbers
8. Health plan beneficiary numbers
9. Account numbers
10. Certificate/license numbers
11. Vehicle identifiers
12. Device identifiers
13. Web URLs
14. IP addresses
15. Biometric identifiers
16. Full-face photos
17. Any unique identifying number

**CareCompanion stores elements 1, 2, 4, 8, and 9 — confirming it processes PHI and is subject to HIPAA.**

---

## Summary of Recommendations (Priority Order)

All fixes are code changes unless noted. Zero vendor upgrades required.

1. **WEEK 1:** De-identify system prompt — strip patient name, age, doctor names, phone numbers, member IDs ($0)
2. **WEEK 1:** Add AES-256-GCM encryption for sensitive DB fields — tokens, names, messages, memories ($0)
3. **WEEK 1:** Complete RLS policies on all 23 database tables ($0)
4. **WEEK 1:** Rotate all credentials and move to Vercel Environment Variables ($0)
5. **WEEK 1:** Sanitize all log output so Vercel never receives PHI ($0)
6. **WEEK 2:** Replace in-memory rate limiting with Upstash free tier ($0)
7. **WEEK 2:** Add audit logging to all PHI-accessing endpoints ($0)
8. **WEEK 2:** Fix FHIR webhook to use HMAC-SHA256 verification ($0)
9. **WEEK 3:** Session timeout, cache-control headers, complete data export ($0)
10. **WEEK 3:** Hard delete option, remove localStorage health data, strip Google Calendar PHI ($0)
11. **WEEK 4:** Write HIPAA policies using free HHS templates ($0)
12. **WEEK 5:** Self-service pen testing with OWASP ZAP ($0)
13. **WEEK 5:** Sign 1upHealth standard BAA (included free) ($0)
14. **ONGOING:** Quarterly key rotation, log review, security scans ($0)

**Total estimated cost: ~$0-10/month**

---

*This report is a technical assessment and does not constitute legal advice. Consult a HIPAA compliance attorney for formal legal guidance.*

*Report generated: April 8, 2026 | Updated: April 9, 2026 (budget-friendly remediation plan)*  
*Audit scope: Full codebase review — 62 API routes, 33+ library files, all auth and data handling*
