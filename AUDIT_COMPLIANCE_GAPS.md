# CareCompanion — Compliance Posture Audit

**Date:** 2026-05-24
**Branch:** `aryan/dev`
**Auditor:** Claude Code (automated static analysis)
**Classification:** CONFIDENTIAL — DO NOT COMMIT TO PUBLIC REPOSITORIES
**Scope:** HIPAA Technical, Administrative & Physical Safeguards · SOC2 Type 2 Trust Services Criteria (CC1–CC9) · State Privacy Laws (CCPA/CPRA, WMHMD, TDPA, CPA) · GDPR applicability · FDA SaMD risk

> **Methodology:** Static analysis of 90+ API routes, 60+ library files, 4 compliance documents, and all third-party dependencies across the monorepo. Infrastructure runtime state (IAM roles, KMS configuration, Aurora encryption flags, Vercel log-drain settings) cannot be verified without AWS/Vercel console access; assumptions are noted inline. This document does not constitute legal advice and should be reviewed by qualified HIPAA counsel before reliance.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [HIPAA Technical Safeguards — 45 CFR 164.312](#2-hipaa-technical-safeguards)
3. [HIPAA Administrative Safeguards — 45 CFR 164.308](#3-hipaa-administrative-safeguards)
4. [HIPAA Physical Safeguards — 45 CFR 164.310](#4-hipaa-physical-safeguards)
5. [SOC2 Type 2 Readiness — CC1–CC9 Scoring](#5-soc2-type-2-readiness)
6. [State Privacy Laws](#6-state-privacy-laws)
7. [GDPR Applicability](#7-gdpr-applicability)
8. [FDA Software as a Medical Device (SaMD) Risk](#8-fda-samd-risk)
9. [Master Gap Table — Ranked by Enforcement Risk](#9-master-gap-table)
10. [90-Day Remediation Plan](#10-90-day-remediation-plan)

---

## 1. Executive Summary

CareCompanion is an AI-powered cancer care companion that processes Protected Health Information (PHI) including patient names, cancer diagnoses, medications, lab results, appointment data, insurance information, and chat history containing detailed health narratives. As of `aryan/dev` on 2026-05-24, the platform has strong technical controls in place but is **not production-ready for real patient data** due to missing Business Associate Agreements and several regulatory documentation gaps.

### Overall Compliance Scorecard

| Framework | Coverage | Blockers | Status |
|-----------|----------|----------|--------|
| HIPAA Technical Safeguards (§164.312) | 65% compliant | 2 | ⚠️ Partial |
| HIPAA Administrative Safeguards (§164.308) | 30% compliant | 5 | 🔴 High Risk |
| HIPAA Physical Safeguards (§164.310) | 80% compliant (cloud-native) | 0 | ✅ Adequate |
| SOC2 Type 2 (CC1–CC9) | ~40% criteria met | Multiple | ⚠️ Not ready |
| State Privacy Laws | Partially applicable | 3 | ⚠️ Action needed |
| GDPR | Likely not applicable yet | 0 | ✅ Monitor |
| FDA SaMD | HIGH RISK — possible Class II | Immediate | 🔴 Critical |

### Top 5 Launch Blockers

1. **No executed BAAs** with Anthropic, Google Gemini, Vercel, or AWS — PHI is transmitted to all four on every chat request (HIPAA violation the moment a real patient signs up)
2. **No Incident Response Plan or Breach Notification procedures** — §164.308(a)(6) and §164.404 require this before PHI enters production
3. **Privacy Policy references Supabase** — actual database is AWS Aurora; material misrepresentation creating multi-state regulatory exposure
4. **FDA SaMD risk unresolved** — the drug interaction checker, suicidality detection gap, and AI-generated treatment guidance may already constitute uncleared SaMD
5. **Automatic session timeout absent** — NextAuth JWT sessions last 30 days with no idle logoff; violates §164.312(a)(2)(iii) Automatic Logoff

---

## 2. HIPAA Technical Safeguards

> Reference: 45 CFR §164.312 — "A covered entity or business associate must, in accordance with §164.306 implement the following specifications…"

### 2.1 Access Control — §164.312(a)(1)

#### 2.1.1 Unique User Identification — §164.312(a)(2)(i) [REQUIRED]

**Status: COMPLIANT ✅**

All users receive a UUID primary key at registration (`users.id` in `apps/web/src/lib/db/schema.ts:45`). JWT tokens carry `dbUserId` as the stable identifier across sessions. API routes authenticate via `getAuthenticatedUser()` in `apps/web/src/lib/api-helpers.ts` which maps the session token to a unique DB UUID before authorizing any data access. The `auditLogs` table records `userId` for every PHI-access event. Mobile Bearer tokens are validated with `jwtVerify` (HMAC-SHA256 using `NEXTAUTH_SECRET`) and resolve to the same UUID namespace.

**Evidence:** `apps/web/src/lib/db/schema.ts:45`, `apps/web/src/lib/api-helpers.ts:24-31`, `apps/web/src/lib/audit.ts`

#### 2.1.2 Emergency Access Procedure — §164.312(a)(2)(ii) [REQUIRED]

**Status: GAP ❌**

No documented emergency access procedure exists for obtaining ePHI when normal authentication channels are unavailable (e.g., Vercel outage, NextAuth configuration failure). There is no "break-glass" procedure documented for direct Aurora access through the AWS Console, and no designated personnel authorized to invoke it.

**Remediation:** Document a break-glass emergency access procedure: define who (by role, not by name) can authorize direct Aurora console access, require MFA before invocation, mandate audit logging of all emergency access events, and schedule quarterly review of the procedure.

#### 2.1.3 Automatic Logoff — §164.312(a)(2)(iii) [ADDRESSABLE]

**Status: GAP ❌**

NextAuth is configured without an explicit `session.maxAge` or idle-timeout parameter. The default NextAuth JWT session expiry is 30 days with no inactivity detection. A session opened on a shared device (common in caregiving contexts where family members share tablets) remains valid for the full 30-day window. No client-side idle timer exists to call `signOut()` after a period of inactivity.

**Evidence:** `apps/web/src/lib/auth.ts` — no `session: { maxAge }` configuration found. `COMPLIANCE_GAP.md:214` confirms this gap.

**Remediation:** Set `session: { maxAge: 8 * 60 * 60 }` (8-hour absolute session expiry) in NextAuth config. Add a client-side idle detector (15–30 minutes) that calls `signOut()` after inactivity. For mobile, implement `AppState` change listeners to sign out on background-to-foreground transitions after an inactivity window.

#### 2.1.4 Encryption and Decryption — §164.312(a)(2)(iv) [ADDRESSABLE]

**Status: PARTIAL ⚠️**

**What is encrypted:**
- OAuth tokens: AES-256-GCM with random 96-bit IV and authentication tag (`apps/web/src/lib/token-encryption.ts`); `TOKEN_ENCRYPTION_KEY` enforcement throws in production
- Passwords: bcryptjs hash (rounds unverified; verify ≥12)
- Transport: TLS enforced via Vercel HSTS (`max-age=63072000; includeSubDomains; preload`) in `apps/web/next.config.mjs:35`
- Aurora at-rest: AWS default AES-256/KMS (assumed — not verifiable without console access)

**What is NOT encrypted at the application layer:**
- `patientName`, `dateOfBirth`, `cancerType`, `cancerStage`, `conditions`, `allergies`, `emergencyContactPhone`, `biomarkers`, `diagnosisDate` stored as plaintext columns in Aurora
- Insurance `memberId` stored plaintext
- No field-level encryption preventing a developer with DB credentials from reading raw PHI

**Remediation:** Document that Aurora KMS encryption satisfies this requirement (confirm in AWS Console and record the KMS key ARN). For defense-in-depth, add application-level field encryption for the highest-sensitivity columns (DOB, insurance member ID) using the existing `TOKEN_ENCRYPTION_KEY` pattern.

---

### 2.2 Audit Controls — §164.312(b) [REQUIRED]

**Status: PARTIAL ⚠️**

**What exists:**
- `apps/web/src/lib/audit.ts` implements `logAudit()` writing to an `auditLogs` table in Aurora with fields: `userId`, `action`, `resource`, `resourceId`, `ipAddress`, `method`, `path`, `statusCode`, `durationMs`, `metadata`
- 19 typed PHI-access actions are defined: `view_profile`, `view_medications`, `view_lab_results`, `view_appointments`, `export_data`, `scan_document`, `hipaa_consent_accepted`, etc.
- `logAudit()` is called in: main chat route, export-data route, HIPAA consent acceptance

**Gaps:**
- **Missing coverage:** `GET /api/records/medications`, `GET /api/records/lab-results`, `GET /api/records/appointments`, `GET /api/insurance` — major PHI GET routes do not call `logAudit()`
- **Retention policy:** No retention period configured; HIPAA documentation requires 6-year minimum retention for policies; HHS recommends 6-year retention for audit logs as well
- **Fire-and-forget:** `logAudit()` is async-fire-and-forget; audit failures are swallowed silently (`audit.ts:62-67`). A storage failure produces no error to the calling route
- **No admin review interface:** The audit log endpoint (`/api/compliance/audit-log`) is user-self-service only; no operator/security personnel review dashboard exists
- **No SIEM integration:** Logs are written to Aurora only; no export to CloudWatch, Datadog, or a SIEM for anomaly detection

**Remediation:** Add `logAudit()` calls to all PHI GET endpoints. Define a 6-year retention policy (Aurora automated backup + TTL or a dedicated log archive). Build an internal admin audit review page. Configure CloudWatch log export or a SIEM integration.

---

### 2.3 Integrity — §164.312(c)(1) [REQUIRED]

**Status: PARTIAL ⚠️**

**What exists:**
- Soft-delete pattern with 30-day recovery window protects against accidental destruction
- Foreign key CASCADE constraints maintain referential integrity
- CSRF protection (`apps/web/src/lib/csrf.ts`) prevents unauthorized state mutation
- Zod schema validation on all API routes prevents malformed writes

**What is missing:**
- No row-level checksums or HMACs for PHI records; a developer with direct DB access can modify records without detection
- No digital signatures on exported data packages
- The `auditLogs` table itself is not write-protected; it could be modified by a privileged DB user
- No PostgreSQL Row-Level Security (RLS) policies — all authorization is application-layer only

**Mechanism to Authenticate ePHI — §164.312(c)(2) [ADDRESSABLE]:** GAP ❌ — No mechanism to corroborate that ePHI has not been altered outside the application.

**Remediation:** Enable Aurora activity streams for immutable database audit logging. Add a `checksum` (SHA-256 of critical fields) column to highest-risk PHI tables, or use a write-once S3 log export via CloudWatch for the audit trail.

---

### 2.4 Person or Entity Authentication — §164.312(d) [REQUIRED]

**Status: PARTIAL ⚠️**

**What exists:**
- NextAuth v5 with password (bcrypt), Apple OAuth, Google OAuth, and Care Group shared-password providers
- JWT Bearer token auth for mobile with HMAC-SHA256 verification
- Rate limiting on credential login: 50 attempts per 15 minutes per email; 5 per hour for care groups
- CSRF protection on all state-mutating routes

**What is missing:**
- **No MFA (Multi-Factor Authentication):** No TOTP, SMS OTP, or hardware token support exists anywhere in the codebase. For a healthcare application handling PHI, MFA is a critical control gap — HHS guidance cites MFA as a "reasonable and appropriate" measure, and virtually all HIPAA audit findings cite its absence
- **No step-up authentication** for high-risk operations (data export, account deletion, care team addition)

**Remediation:** Implement TOTP MFA (via `otpauth` library or integrate Cognito's built-in MFA). Make MFA mandatory for all credential-based logins (not optional). Require re-authentication for data export and account deletion flows.

---

### 2.5 Transmission Security — §164.312(e)(1) [REQUIRED]

**Status: COMPLIANT ✅**

TLS enforced at Vercel edge. HSTS header: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (2-year, with preload list inclusion). All mobile API calls target `https://carecompanionai.org` (`apps/mobile/src/services/api.ts`). Security headers in `apps/web/next.config.mjs`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(), geolocation=()`
- CSP: `default-src 'self'`; restricts all external origins

**Minor gaps (not blocking):** No certificate pinning in the React Native mobile app. CSP `connect-src` includes `ws://localhost:3000` in dev; ensure this is excluded from production builds.

---

## 3. HIPAA Administrative Safeguards

> Reference: 45 CFR §164.308 — The administrative safeguard requirements are heavily documentation-driven. Many gaps here are missing policies, not missing technical controls.

### 3.1 Security Management Process — §164.308(a)(1)

| Specification | Required/Addr. | Status | Gap |
|--------------|---------------|--------|-----|
| Risk Analysis | Required | ⚠️ Partial | Informal HIPAA_Compliance_Report.md (April 2026) is not a signed, versioned, NIST SP 800-30 compliant risk analysis. Covers prior Supabase architecture now replaced by Aurora. |
| Risk Management | Required | ⚠️ Partial | Technical controls exist but are not traceable to a formal risk register mapping risk → control → test result |
| Sanction Policy | Required | ❌ Gap | No workforce sanction policy document exists |
| Information System Activity Review | Required | ⚠️ Partial | User-self-service audit log endpoint exists; no admin review interface or documented review cadence |

### 3.2 Assigned Security Responsibility — §164.308(a)(2)

**Status: GAP ❌** — No formally designated Security Officer. CLAUDE.md identifies Aryan as "web lead / AI architect" — this is an engineering ownership assignment, not a HIPAA Security Officer designation with the regulatory meaning (40 CFR §164.308(a)(2) requires a named individual, documented in writing).

### 3.3 Workforce Security — §164.308(a)(3)

| Specification | Required/Addr. | Status | Gap |
|--------------|---------------|--------|-----|
| Authorization / Supervision | Addressable | ❌ Gap | No documented procedure for authorizing workforce members to access ePHI systems (production DB, AWS Console, Vercel dashboard) |
| Workforce Clearance | Addressable | ❌ Gap | No background check or clearance process documented |
| Termination Procedures | Addressable | ❌ Gap | No checklist for revoking GitHub, AWS, Vercel, Upstash access on employee departure |

### 3.4 Information Access Management — §164.308(a)(4)

| Specification | Required/Addr. | Status | Gap |
|--------------|---------------|--------|-----|
| Access Authorization | Addressable | ⚠️ Partial | `getAuthenticatedUser()` enforces authentication; care-team role system exists. **Critical gap:** `careGroupMembers.perms` jsonb column (`can_read_meds`, `can_read_labs`, `can_read_appts`, `can_chat`, `can_edit_appts`) defined in schema (`apps/web/src/lib/db/schema.ts:672-675`) but **not checked in any API route handler**. A caregiver with `can_read_meds = false` can call `GET /api/records/medications` successfully. |
| Access Establishment & Modification | Addressable | ⚠️ Partial | Care team invite flow exists. No documented operator review process or admin interface for auditing who has access to which care profile. |

### 3.5 Security Awareness and Training — §164.308(a)(5)

| Specification | Required/Addr. | Status | Gap |
|--------------|---------------|--------|-----|
| Security Reminders | Addressable | ❌ Gap | No security training program, no security reminders documented |
| Protection from Malicious Software | Addressable | ⚠️ Partial | `npm audit` returns zero vulnerabilities. No Dependabot or automated dependency scanning in CI. No malware protection policy documented. |
| Log-in Monitoring | Addressable | ⚠️ Partial | Rate limiting on login attempts exists. Failed login attempts are NOT written to `auditLogs`. No alerting on brute-force patterns. |
| Password Management | Addressable | ⚠️ Partial | bcrypt hashing present. No server-enforced password complexity rules at `/api/auth/register/`. No documented password policy. |

### 3.6 Security Incident Procedures — §164.308(a)(6)

**Status: GAP ❌ — BLOCKER**

No Incident Response Plan (IRP) exists. No breach notification procedures per 45 CFR §164.404 (60-day notification window). The HIPAA_Compliance_Report.md explicitly acknowledges this gap. Sentry error monitoring exists but captures technical exceptions, not security incidents. No defined severity classification, response team contacts, containment steps, or post-incident review process.

### 3.7 Contingency Plan — §164.308(a)(7)

| Specification | Required/Addr. | Status | Gap |
|--------------|---------------|--------|-----|
| Data Backup Plan | Required | ⚠️ Partial | AWS Aurora automated backups assumed enabled (AWS default). Not documented, not tested, retention period unconfirmed. |
| Disaster Recovery Plan | Required | ❌ Gap | No DRP exists. No documented RTO/RPO targets. |
| Emergency Mode Operation Plan | Required | ❌ Gap | No documented continuity procedures |
| Testing and Revision | Addressable | ❌ Gap | No scheduled DR testing |
| Applications and Data Criticality | Addressable | ❌ Gap | No criticality tiering of systems |

### 3.8 Evaluation — §164.308(a)(8)

**Status: PARTIAL ⚠️** — This audit constitutes a point-in-time evaluation. No scheduled periodic security assessments. No penetration testing on record or planned.

### 3.9 Business Associate Contracts — §164.308(b)(1) [REQUIRED]

**Status: GAP ❌ — CRITICAL BLOCKER**

This is the single highest-enforcement-risk gap. PHI is transmitted to multiple vendors on every user request with no executed BAAs.

| Vendor | PHI Transmitted | BAA Available | BAA Executed | Blocker? |
|--------|----------------|---------------|--------------|----------|
| **Anthropic** (Claude API) | Full system prompt: patient name, cancer type, medications, lab results, chat history | Yes (Enterprise) | ❌ No | 🚨 P0 |
| **Google Gemini** (via @ai-sdk/google) | Memory facts containing medication names, diagnoses | Yes (Vertex AI only) | ❌ No | 🚨 P0 |
| **AWS** (Aurora RDS, Cognito, SES) | All PHI — Aurora is the primary PHI datastore | Yes (no cost) | ❌ Unconfirmed | 🚨 P0 |
| **Vercel** | All API requests route through Vercel; logs may capture PHI | Yes (Enterprise plan) | ❌ No | 🚨 P0 |
| **Resend** | Email addresses; care team invites contain patient name | ❌ No BAA path exists | N/A | 🚨 P0 (replace) |
| **Sentry** | Error payloads; `scrubPHI()` implemented in mobile, web status unclear | Yes (Business+ plan) | ❌ No | 🚨 P0 |
| **PostHog** | Page/click events; PHI sanitization implemented but autocapture risk | ❌ Cloud: No BAA | N/A | 🔴 P0 (mitigate) |
| **Voyage AI** | Memory fact text (reranking) | Unknown | ❌ No | 🟡 P1 |
| **Upstash Redis** | Rate-limit keys (user IDs, email hashes) | Yes (contact sales) | ❌ No | 🟡 P1 |

**Immediate actions:**
- Accept AWS HIPAA BAA via AWS Console → My Account → AWS Artifact
- Contact `privacy@anthropic.com` for Anthropic API BAA
- Verify Google AI routes through Vertex AI (not direct `generativelanguage.googleapis.com`) then accept Google Cloud DPA
- Contact Vercel Enterprise sales for BAA before any PHI enters production
- Replace Resend with AWS SES (covered under AWS BAA once signed)
- Upgrade Sentry to Business plan and execute BAA; confirm web `beforeSend` PHI scrubbing matches mobile's `scrubPHI()` implementation

---

## 4. HIPAA Physical Safeguards

> Reference: 45 CFR §164.310

CareCompanion is a cloud-native SaaS with no physical data center. Physical safeguard requirements are largely delegated to AWS and Vercel under the shared responsibility model.

| Safeguard | Status | Notes |
|-----------|--------|-------|
| **§164.310(a)(1) Facility Access Controls** | ✅ N/A — AWS responsibility | AWS Availability Zones, SAS 70 certified facilities, multi-factor physical access at data centers. Document reliance on shared responsibility model in formal risk analysis. |
| **§164.310(b) Workstation Use** | ❌ Gap | No workstation use policy for developer machines with production AWS/Vercel/GitHub access. Require documented AUP covering: approved OS versions, full-disk encryption (FileVault/BitLocker), no PHI on personal devices. |
| **§164.310(c) Workstation Security** | ⚠️ Partial | No MDM enrollment. No screensaver-lock policy. Informal controls assumed for small team. |
| **§164.310(d)(1) Disposal** | ✅ Compliant | `apps/web/src/lib/soft-delete.ts` implements 30-day soft-delete then hard purge via `/api/cron/purge/`. Aurora storage lifecycle managed by AWS. |
| **§164.310(d)(2) Accountability** | ⚠️ Partial | No hardware inventory for developer devices with production access. |
| **AWS IAM MFA** | ❌ Unverified | All IAM users accessing Aurora must have MFA enabled. Cannot verify without AWS Console access. Document requirement. |

**Cloud-Native Mitigation Summary:** AWS's HIPAA-eligible infrastructure handles physical security, data center access, and hardware disposal for all Aurora data. The primary physical safeguard gap is developer workstation policy — a policy document is needed, not a code change.

---

## 5. SOC2 Type 2 Readiness

> Reference: AICPA Trust Services Criteria 2017 (CC1–CC9)
> Scores are 0–10 representing evidence strength found in static analysis. SOC2 Type 2 requires a minimum 6-month observation period with consistent evidence across all criteria.

### CC1 — Control Environment

**Score: 3/10**

| Sub-criterion | Evidence | Gap |
|--------------|----------|-----|
| CC1.1 — Integrity & ethical values | CLAUDE.md team rules (good) | No code of conduct, no ethics policy, no published security commitments to customers |
| CC1.2 — Board/management oversight | No governance documentation | Must establish governance structure with defined oversight of security controls |
| CC1.3 — Organizational structure | CLAUDE.md defines file ownership; Aryan designated web lead | No formal org chart, no security authority assignment in signed documents |
| CC1.4 — HR practices / competence | No documented security competency requirements | Define security competencies for roles with PHI access |
| CC1.5 — Accountability | Pre-push hooks enforce quality gates; file ownership in CLAUDE.md | No formal accountability mapping: risk → control → owner → review cadence |

**To reach SOC2 readiness:** Write and publish internal Code of Conduct, Security Policy, and acceptable-use policy. Designate named Security Officer. Establish security governance meeting cadence.

---

### CC2 — Communication and Information

**Score: 5/10**

| Sub-criterion | Evidence | Gap |
|--------------|----------|-----|
| CC2.1 — Relevant information for controls | Structured JSON logging (`logger.ts`); Sentry monitoring; `/api/health` endpoint | No centralized log aggregation; Vercel logs not long-term retained; no SIEM |
| CC2.2 — Internal communication | CLAUDE.md team rules; Slack presumably | No formal security communication cadence; no documented incident communication tree |
| CC2.3 — External communication | Privacy policy at `/privacy`; HIPAA consent flow tracked in `users.hipaaConsentAt` | **Privacy policy references Supabase as database — actual database is AWS Aurora. Material misrepresentation.** Must fix before first paying user. |

---

### CC3 — Risk Assessment

**Score: 3/10**

| Sub-criterion | Evidence | Gap |
|--------------|----------|-----|
| CC3.1 — Specifies risk objectives | `HIPAA_Compliance_Report.md` documents some risks | No formal risk register with ownership, likelihood/impact ratings, or residual risk |
| CC3.2 — Identifies and analyzes risk | Multiple TODO items in docs identify specific risks | Missing systematic analysis across full threat landscape |
| CC3.3 — Considers fraud | No fraud risk assessment found | Conduct fraud risk assessment: account takeover, insider threat, data exfiltration scenarios |
| CC3.4 — Identifies changes impacting controls | No change management for security impact | Add security review step to PR process for PHI-flow changes |

**To reach SOC2 readiness:** Produce a formal risk assessment following NIST SP 800-30 methodology. Establish a risk register reviewed quarterly.

---

### CC4 — Monitoring Activities

**Score: 4/10**

| Sub-criterion | Evidence | Gap |
|--------------|----------|-----|
| CC4.1 — Ongoing evaluations | Sentry, PostHog, canary monitor in `.github/workflows/canary-monitor.yml` | No automated security monitoring; no anomaly detection for unusual data access (bulk exports, after-hours access) |
| CC4.2 — Evaluates and communicates deficiencies | No documented deficiency process | Establish formal deficiency tracking separate from engineering bug tracker |

---

### CC5 — Control Activities

**Score: 6/10**

Strong technical controls exist but are not formally mapped to risks.

| Sub-criterion | Evidence | Gap |
|--------------|----------|-----|
| CC5.1 — Selects and develops controls | CSRF, rate limiting, token encryption, HSTS, CSP, bcrypt, Zod validation, audit logging | Controls implemented ad hoc; no traceability from risk → control |
| CC5.2 — Technology controls | Comprehensive technical controls; CSP, SameSite cookies, input validation, parameterized queries (Drizzle ORM) | Strong; minor gap: no WAF, no IP allowlisting for admin routes |
| CC5.3 — Deploys through policies and procedures | Controls in code; pre-push quality gates | No formal policies distributed to all workforce members |

---

### CC6 — Logical and Physical Access Controls

**Score: 5/10**

| Sub-criterion | Evidence | Gap |
|--------------|----------|-----|
| CC6.1 — Logical access security | NextAuth, bcrypt, CSRF, rate limiting, middleware enforcement | **No MFA**; no session idle timeout; caregiver `perms` not enforced in API handlers |
| CC6.2 — Registers and authorizes users | User registration + care team invite flows | No formal access provisioning review for new workforce members |
| CC6.3 — Removes access when not needed | Account deletion cascade; care team member removal | No automated workforce access removal on HR termination |
| CC6.4 — Prevents unauthorized access | Middleware enforces auth; `WHERE userId = ?` throughout API; CSRF | Compliant — strong isolation patterns |
| CC6.5 — External threat protection | Rate limiting, CSRF, HSTS, CSP, Zod validation | No WAF; no DDoS protection beyond Vercel edge |
| CC6.6 — Internal threat protection | Application-layer user isolation only | **No DB-level RLS**; any developer with Aurora credentials can read all PHI; no separation of duties |
| CC6.7 — Physical access | Cloud-native; AWS-managed | Compliant |
| CC6.8 — Vendor / partner access | BAA_VENDOR_MAP.md documents vendor PHI flows | No formal third-party risk management program; no vendor access review cycle |

---

### CC7 — System Operations

**Score: 4/10**

| Sub-criterion | Evidence | Gap |
|--------------|----------|-----|
| CC7.1 — Detects vulnerabilities | `npm audit` clean; Sentry; GitHub Actions CI | No Dependabot; no scheduled DAST/SAST scans; no penetration testing |
| CC7.2 — Monitors anomalous behavior | Sentry exception monitoring; health check endpoint | No anomaly detection for unusual PHI access patterns |
| CC7.3 — Evaluates security events | Sentry captures exceptions | No security event classification or severity triage process |
| CC7.4 — Responds to incidents | Sentry notification | **No IRP** |
| CC7.5 — Restores after incidents | Aurora backups assumed | **No documented DR procedure** |

---

### CC8 — Change Management

**Score: 6/10**

| Sub-criterion | Evidence | Gap |
|--------------|----------|-----|
| CC8.1 — Authorized, tested, documented changes | Husky pre-push hooks (typecheck + lint + test + deadcode); PR required for main; Conventional Commits; squash-merge policy | No security review requirement for PHI-touching changes; no formal change approval record for production deployments |

---

### CC9 — Risk Mitigation

**Score: 3/10**

| Sub-criterion | Evidence | Gap |
|--------------|----------|-----|
| CC9.1 — Identifies risk mitigation activities | Rate limiting, encryption, audit logs, CSRF, CSP | No formal risk treatment plan documenting accept/mitigate/transfer/avoid decisions |
| CC9.2 — Vendor and partner risk management | BAA_VENDOR_MAP.md enumerates vendor PHI flows | **No executed BAAs**; no formal vendor risk assessment process; no third-party review cycle |

---

### SOC2 Audit Window Entry Requirements

Before entering a SOC2 Type 2 observation window (minimum 6 months), the following must be in place:

**Must-have (cannot enter audit window without):**
1. Executed BAAs with all PHI-touching vendors
2. Formal Security Officer designation (documented)
3. Written and distributed security policies: Information Security Policy, PHI Handling Policy, Acceptable Use Policy
4. Incident Response Plan tested at least once (tabletop exercise)
5. Formal risk analysis completed (NIST SP 800-30 format) and reviewed
6. MFA implemented for all production system access
7. Session timeout configured (automatic logoff)
8. Audit log coverage on all PHI endpoints
9. Privacy Policy corrected (remove Supabase reference, reflect Aurora/AWS)
10. Caregiver `perms` enforcement in API handlers

**Estimated time to SOC2 Type 1 readiness (point-in-time):** 3–4 months
**Estimated time to SOC2 Type 2 readiness (sustained evidence):** 9–11 months from today

---

## 6. State Privacy Laws

### 6.1 California — CCPA/CPRA (Cal. Civ. Code §1798.100 et seq.)

**Applicability: YES** — CCPA applies to for-profit businesses that collect personal information from California residents and meet any threshold: (a) annual gross revenues >$25M, (b) buy/sell/receive/share personal information of 100,000+ consumers/households, or (c) derive 50%+ of annual revenue from selling personal information. CareCompanion likely meets threshold (c) as the product scales. Even before meeting thresholds, proactive CCPA compliance is strategically sound.

**Key obligations:**
- **Right to Know / Access:** Users can request what personal information is collected — the existing `/api/export-data` endpoint partially addresses this but must enumerate all data categories collected and third parties to whom data is disclosed
- **Right to Delete:** Implemented via `/api/delete-account` with cascade delete and 30-day purge cron. **Gap:** Deletion must extend to third-party processors; verify all BAA vendors have deletion capabilities
- **Right to Correct:** No data correction endpoint found beyond normal edit flows; must document
- **Right to Opt-Out of Sale/Sharing:** PHI is not sold; document this explicitly in the Privacy Policy
- **Sensitive Personal Information (SPI):** Under CPRA, health information, precise geolocation, and racial/ethnic origin are SPI subject to use limitation — PHI fields in CareCompanion's schema constitute SPI

**What to add:**
- Update Privacy Policy: add CCPA-required disclosure of data categories collected, purposes of collection, categories of third parties, and contact for privacy requests
- Add "Do Not Sell or Share My Personal Information" footer link (even if the answer is "we do not sell")
- Implement a formal Data Subject Request (DSR) intake process with 45-day response time
- Add `/.well-known/privacy-policy` URL and CCPA notice

---

### 6.2 Washington — My Health My Data Act (WMHMD), effective July 2023

**Applicability: LIKELY YES** — WMHMD has broad applicability to any entity that collects "consumer health data" from Washington residents, regardless of whether the entity is a healthcare provider. "Consumer health data" includes health conditions, diagnoses, medications, and data used to infer any of these. CareCompanion's core data (cancer diagnosis, medications, lab results) is squarely within scope.

**Key obligations beyond CCPA:**
- **No sale of consumer health data without consent:** Explicit prohibition; document no-sale practice
- **No geofencing near health facilities for data collection purposes**
- **Separate, distinct consumer health data privacy notice** required (beyond general privacy policy)
- **Opt-in consent required** before collecting, sharing, or selling consumer health data — the existing HIPAA consent flow (`users.hipaaConsentAt`) partially addresses this but may need to be expanded
- **Right to access, correct, and delete** consumer health data — partially implemented
- **Processor agreements** required with any entity processing consumer health data — BAA gaps above also create WMHMD exposure

**What to add:**
- Washington-specific health data privacy notice
- Review HIPAA consent flow to ensure it covers WMHMD consent requirements
- Audit data flows to confirm no health data is shared with entities that could use it for advertising or secondary purposes
- Designate a Privacy Officer (separate from or overlapping with HIPAA Security Officer)

---

### 6.3 Texas — Texas Data Privacy and Security Act (TDPA), effective July 2024

**Applicability: LIKELY YES** — TDPA applies to any person conducting business in Texas or producing products/services targeted at Texas residents and processes personal data. Threshold: >25,000 consumers/year OR derives >25% of revenue from selling personal data. For a national health app, Texas applicability is likely.

**Key obligations:**
- Rights: access, correction, deletion, portability, opt-out of sale/targeting/profiling
- Data protection assessment required for processing sensitive data (which includes health data)
- **No broad applicability exemptions** for HIPAA-covered entities the way some other state laws exempt them; the TDPA explicitly applies to controllers processing PHI that are not covered entities
- Processor agreement requirements parallel to BAA requirements

**What to add:**
- Data protection impact assessment (DPIA) for health data processing — this overlaps with HIPAA risk analysis
- Add Texas-specific disclosures to Privacy Policy
- Implement DSR intake process meeting TDPA requirements

---

### 6.4 Colorado — Colorado Privacy Act (CPA), effective July 2023

**Applicability: POSSIBLE** — CPA applies to processors of personal data of 100,000+ Colorado consumers/year or 25,000+ if selling personal data. For early-stage CareCompanion, threshold may not be met yet, but as the platform scales this becomes applicable.

**Key obligations (same family as TDPA above):** Consumer rights (access, correction, deletion, portability, opt-out), data protection assessments, processor agreements.

**What to add:** Monitor user counts; implement CPA compliance when thresholds are approached. The DSR infrastructure and data protection assessment built for CCPA/TDPA can be reused.

---

### State Law Summary

| Law | Applies Now? | Key Additions Required | Timeline |
|-----|-------------|----------------------|----------|
| California CCPA/CPRA | YES | CCPA privacy notice, DSR intake, "Do Not Sell" link, SPI use limitation | Before first paying CA user |
| Washington WMHMD | YES | Separate health data privacy notice, opt-in consent review, processor agreements | Immediately — enforcement active |
| Texas TDPA | LIKELY | DPIA, TX Privacy disclosures, DSR process | Before 25K TX user threshold |
| Colorado CPA | POSSIBLE | Same as TDPA | When 100K user threshold approached |

---

## 7. GDPR Applicability

**Current Assessment: NOT YET APPLICABLE — MONITOR**

GDPR applies to processing of personal data of EU/EEA data subjects. CareCompanion's current focus is the US market (oncology care for US patients and caregivers). There is no evidence of active EU user recruitment, EU-specific marketing, or services targeting EU residents.

**When GDPR will apply:**
- Any EU/EEA user creates an account (even informally, via word-of-mouth referral)
- Any marketing materials target EU residents
- The app becomes available in European app stores with EU-directed marketing

**Key GDPR requirements if EU users are onboarded:**

| Requirement | Description |
|-------------|-------------|
| **Legal Basis** | Health data is "special category" under Art. 9; requires explicit consent (Art. 9(2)(a)) or legitimate interest documentation. The existing HIPAA consent flow (`hipaaConsentAt`, `hipaaConsentVersion`) is a partial foundation but must be expanded to GDPR explicit consent |
| **Standard Contractual Clauses (SCCs)** | Transfers of EU personal data to US vendors (Anthropic, Google, AWS US-East) require SCCs or an adequacy mechanism under Art. 46. Execute SCCs with all processors before any EU user data is transmitted |
| **Data Subject Rights** | Art. 15–22: Access, rectification, erasure, restriction, portability, objection. The existing export/delete endpoints partially satisfy this; must add restriction and objection endpoints |
| **Data Subject Request Endpoints** | No dedicated DSR API exists. Requires logged intake, response within 30 days (vs. CCPA's 45 days) |
| **Privacy by Design** | Art. 25: Data minimization requirements. Audit whether all PHI fields collected are strictly necessary |
| **DPA Appointment** | Art. 37: DPA required if large-scale processing of special-category data — likely required for a health app at scale |
| **Records of Processing Activities (RoPA)** | Art. 30: Maintain records of all processing activities — the BAA_VENDOR_MAP.md is a good starting point but must be formalized |
| **Breach Notification** | Art. 33: 72-hour notification to supervisory authority (vs. HIPAA's 60 days) — requires IRP to cover both timelines |

**Immediate actions:** Block EU IP ranges from registration OR designate a GDPR representative and begin SCC execution if any EU users are expected in the near term. Do not onboard EU users without GDPR compliance in place — health data penalties under GDPR can reach 4% of global annual turnover.

---

## 8. FDA Software as a Medical Device (SaMD) Risk

> Reference: FDA Digital Health Center of Excellence; FDA Guidance on Clinical Decision Support Software (September 2022); 21 CFR Part 820

**Risk Level: HIGH — REQUIRES IMMEDIATE LEGAL COUNSEL**

### What Triggers SaMD Classification

Under FDA guidance, software meets the SaMD definition and is subject to FDA regulation when it:
1. Is intended to diagnose, treat, cure, mitigate, or prevent disease or other conditions **AND**
2. Provides information (including recommendations) used to take clinical action with respect to a patient

The FDA's September 2022 CDS guidance distinguishes between:
- **Non-device CDS** (exempt from 510(k)): Displays data without making recommendations; allows clinicians to independently review basis
- **Device CDS** (requires clearance): Provides recommendations where the basis for the recommendation is not transparent and users are expected to rely on it

### CareCompanion Features That May Constitute SaMD

| Feature | SaMD Risk | Evidence |
|---------|-----------|---------|
| **Drug Interaction Checker** (`apps/web/src/lib/drug-interactions.ts`) | **CRITICAL — LIKELY SaMD** | Returns `safe_to_combine: boolean` — an explicit actionable recommendation about whether medications can be combined. User is expected to rely on this output. Basis (Haiku LLM reasoning) is not visible to user. This pattern squarely falls in FDA device-CDS territory. |
| **Lab Result Interpretation** (`apps/web/src/lib/agents/specialists.ts:229-280`) | **HIGH RISK** | AI interprets lab values with thresholds (ANC >1500, platelet thresholds) and provides recommendations. If framed as actionable rather than informational, this may be device-CDS. |
| **Triage/Neutropenic Fever Routing** (`apps/web/src/lib/system-prompt.ts:297-302`) | **HIGH RISK** | AI directs patients to go to the ER or call their oncologist based on symptom inputs. This is clinical decision support with direct treatment implications. |
| **Medication Dose Guidance** (medication specialist) | **MODERATE-HIGH** | Any feature that provides dosage recommendations beyond restating what the physician prescribed could be device-CDS. |
| **Suicidality Assessment** (Wellness specialist) | **HIGH RISK** | Crisis response constitutes a mental health clinical intervention. The absence of a proper protocol (documented in CLINICAL_SAFETY_GAP.md) creates both SaMD regulatory risk and direct patient harm risk. |
| **Clinical Trial Matching** (`apps/web/src/lib/trials/clinicalTrialsAgent.ts`) | **MODERATE** | Recommending specific clinical trials for a patient's cancer type could be considered treatment recommendation. |
| **Appointment Preparation Summaries** | **LOW** | Organizing existing patient data for a physician's review — likely non-device CDS if clearly framed as informational |

### SaMD Risk Classification

If FDA determines CareCompanion's drug interaction checker or clinical decision support features are SaMD, the applicable risk class under the international IMDRF SaMD framework is likely:

- **State of the healthcare situation:** Serious (cancer treatment errors can be life-threatening)
- **Significance of information to healthcare decision:** Drive clinical management (drug combination decisions)
- **Classification:** **Class IIb or III** — requiring at minimum a 510(k) premarket notification, and potentially a PMA if the device is novel with no predicate

### Regulatory Pathway Options

1. **Claim non-device CDS status:** Restructure all AI outputs as informational only, make the AI's reasoning visible to users, and ensure no output recommends a specific clinical action. Remove `safe_to_combine: boolean` from the drug checker output — replace with an information display. Add "this is not medical advice" at the output level, not just the footer.

2. **Pursue 510(k) clearance:** Identify a predicate device, conduct clinical validation studies, and submit a 510(k) premarket notification. Timeline: 12–18 months minimum.

3. **De-scope clinical features:** Remove or redesign any feature that functions as device-CDS (drug interaction checker, triage routing, dosage recommendations) to be clearly informational.

**Immediate Actions:**
- Engage FDA regulatory counsel to assess current product features against the 2022 CDS guidance
- Do not add new features that make diagnostic or treatment recommendations until regulatory status is resolved
- Redesign the drug interaction checker to display information rather than return a boolean `safe_to_combine` value
- Add a "Clinical Decision Support Notice" to the product that explicitly documents which features are and are not intended to be used for clinical decision-making
- Review the CLINICAL_SAFETY_GAP.md's 38 CATASTROPHIC-severity clinical safety gaps — many of these are also regulatory exposure points

---

## 9. Master Gap Table — Ranked by Enforcement Risk

The following table ranks all identified gaps by enforcement risk. Priority is based on: (A) likelihood of triggering OCR investigation or regulatory action if discovered, (B) severity of potential fine (HIPAA fines range from $100–$50,000 per violation, up to $1.9M per violation category per year), and (C) likelihood of patient harm.

| ID | Gap | Regulation | Enforcement Risk | Effort | Owner |
|----|-----|-----------|-----------------|--------|-------|
| G-01 | No executed BAA with Anthropic — PHI transmitted on every chat | §164.308(b)(1) | 🔴 CRITICAL | 2–3 wks (legal) | Aryan |
| G-02 | No executed BAA with AWS (Aurora, Cognito) | §164.308(b)(1) | 🔴 CRITICAL | 1 day | Aryan |
| G-03 | No executed BAA with Vercel — logs may capture PHI | §164.308(b)(1) | 🔴 CRITICAL | 1–2 wks | Aryan |
| G-04 | No executed BAA with Google Gemini embedding API | §164.308(b)(1) | 🔴 CRITICAL | 1–2 wks | Aryan |
| G-05 | Resend used for email — no BAA path exists | §164.308(b)(1) | 🔴 CRITICAL | 1 wk (replace) | Aryan |
| G-06 | No Incident Response Plan or breach notification procedures | §164.308(a)(6), §164.404 | 🔴 CRITICAL | 2–3 days | Founder |
| G-07 | Drug interaction checker likely constitutes uncleared SaMD | 21 CFR Part 820 | 🔴 CRITICAL | Legal counsel required | Aryan + Founder |
| G-08 | Privacy Policy references Supabase (actual DB: Aurora) — material misrepresentation | CCPA, WMHMD, §164.316 | 🔴 CRITICAL | 2 hrs | Aryan |
| G-09 | No automatic session logoff (30-day JWT with no idle timeout) | §164.312(a)(2)(iii) | 🟠 HIGH | 1 day | Aryan |
| G-10 | No MFA for credential-based login | §164.312(d) | 🟠 HIGH | 5–8 days | Aryan |
| G-11 | Caregiver `perms` not enforced in API handlers (can_read_meds bypass) | §164.308(a)(4) | 🟠 HIGH | 3–5 days | Aryan |
| G-12 | No formal Security Officer designation | §164.308(a)(2) | 🟠 HIGH | 0.5 days | Founder |
| G-13 | No formal risk analysis (NIST SP 800-30 format) | §164.308(a)(1) | 🟠 HIGH | 3–5 days | Founder/Aryan |
| G-14 | No Disaster Recovery Plan or documented RTO/RPO | §164.308(a)(7) | 🟠 HIGH | 2–3 days | Aryan |
| G-15 | 8 console.error calls in PHI routes pass raw error objects (PHI leakage risk) | §164.312(b) | 🟠 HIGH | 2–3 days | Aryan |
| G-16 | Audit logging absent from medication/lab/appointment GET endpoints | §164.312(b) | 🟠 HIGH | 1–2 days | Aryan |
| G-17 | No workforce security training or records | §164.308(a)(5) | 🟠 HIGH | 1 day | Founder |
| G-18 | No formal HIPAA security policies (InfoSec Policy, PHI Handling, AUP) | §164.316(a) | 🟠 HIGH | 3–5 days | Founder |
| G-19 | No suicidality crisis protocol in AI system prompts | Clinical safety | 🟠 HIGH (liability) | Low (prompt) | Aryan |
| G-20 | Neutropenic fever routed to oncologist instead of ER | Clinical safety | 🟠 HIGH (liability) | Low (prompt) | Aryan |
| G-21 | CCPA/WMHMD compliance missing (DSR intake, health data notice) | CCPA, WMHMD | 🟠 HIGH | 1–2 wks | Founder |
| G-22 | Washington WMHMD — separate health data privacy notice required | WMHMD | 🟠 HIGH | 3 days | Founder |
| G-23 | No RBAC audit interface for operators | SOC2 CC6.2 | 🟡 MEDIUM | 2–3 days | Aryan |
| G-24 | No workforce termination procedure | §164.308(a)(3) | 🟡 MEDIUM | 0.5 days | Founder |
| G-25 | No workstation use/security policy for developer machines | §164.310(b)/(c) | 🟡 MEDIUM | 0.5 days | Founder |
| G-26 | Audit log retention policy absent (HIPAA: 6-year minimum) | §164.316(b) | 🟡 MEDIUM | 1 day | Aryan |
| G-27 | Static long-lived AWS credentials in canary-monitor.yml (use OIDC) | SOC2 CC6.1 | 🟡 MEDIUM | 1 day | Aryan |
| G-28 | CRITICAL: GitHub issue body injected into Claude Code action prompt | Security | 🟡 MEDIUM (supply chain) | 0.5 days | Aryan |
| G-29 | `provision-demo` returns password in HTTP response body | Security | 🟡 MEDIUM | 1 hr | Aryan |
| G-30 | AdminInitiateAuth granted to web server — overly broad IAM | SOC2 CC6.5 | 🟡 MEDIUM | 1 day | Aryan |
| G-31 | No Dependabot / automated dependency scanning in CI | §164.308(a)(5) | 🟡 MEDIUM | 0.5 days | Aryan |
| G-32 | No certificate pinning in React Native mobile app | SOC2 CC6.5 | 🟡 MEDIUM | 3–5 days | Shreyash |
| G-33 | No field-level encryption for DOB, insurance member ID | §164.312(a)(2)(iv) | 🟡 MEDIUM | 3–5 days | Aryan |
| G-34 | Failed login attempts not logged to auditLogs | §164.308(a)(5) | 🟡 MEDIUM | 1 day | Aryan |
| G-35 | No SIEM or CloudWatch integration for audit log export | SOC2 CC7.2 | 🟡 MEDIUM | 3–5 days | Aryan |
| G-36 | No PHI data integrity checksums / write-once audit trail | §164.312(c) | 🟡 MEDIUM | 3–5 days | Aryan |
| G-37 | `safe_to_combine: boolean` creates explicit false safety signal | Clinical safety / SaMD | 🔴 HIGH (clinical) | 1 day | Aryan |
| G-38 | Mobile route bypasses orchestrator + drug interaction checking | Clinical safety | 🟠 HIGH (clinical) | 3–5 days | Aryan |
| G-39 | Demo mode system prompt missing safety rules and crisis protocol | Clinical safety | 🟡 MEDIUM | 1 day | Aryan |
| G-40 | EU user onboarding without GDPR SCC/DPA in place | GDPR Art. 46 | 🟡 MEDIUM (if EU users) | 2–3 wks | Founder |

---

## 10. 90-Day Remediation Plan

> Owners: **Aryan** = code/infrastructure · **Founder** = legal/policy/HR · **Shreyash** = mobile
> All items marked **P0** must be resolved before any real patient PHI enters production.

### Days 1–14: Critical Blockers (P0)

| # | Action | Owner | Effort |
|---|--------|-------|--------|
| 1 | **Accept AWS HIPAA BAA** via AWS Console → My Account → AWS Artifact. Covers Aurora, Cognito, SES, CloudWatch. Print PDF and file. | Aryan | 1 day |
| 2 | **Contact Anthropic for HIPAA BAA** — email `privacy@anthropic.com`. Subject: "HIPAA BAA Request." Engage Anthropic Enterprise if needed. | Founder | 1 day |
| 3 | **Replace Resend with AWS SES** — `@aws-sdk/client-ses` replaces `resend` SDK. Update `apps/web/src/lib/email.ts`. Covered under AWS BAA from step 1. | Aryan | 3–5 days |
| 4 | **Fix Privacy Policy** — Update `apps/web/src/app/privacy/page.tsx` line 141: replace "Supabase (SOC 2 Type II)" with "AWS Aurora (RDS), a HIPAA-eligible encrypted database managed by Amazon Web Services." | Aryan | 2 hrs |
| 5 | **Remove `password` from provision-demo response** — `apps/web/src/app/api/admin/provision-demo/route.ts:174`. Remove the `password: DEMO_PASSWORD` field from the JSON response. | Aryan | 1 hr |
| 6 | **Fix raw `err` objects in PHI routes** — Replace `console.error('[x] error:', err)` with `logger.error('[x] error', { route: 'x', error: err instanceof Error ? err.message : String(err) })` in: `scan-document/route.ts:80`, `save-scan-results/route.ts:195`, `import-data/route.ts:99`, `chat/mobile/route.ts:161`, `chat/route.ts:358,364`, `insurance/appeal/route.ts:108`, `healthkit.ts:446,532`. | Aryan | 2–3 days |
| 7 | **Add suicidality crisis protocol to system prompt** — Add the CLINICAL_SAFETY_GAP.md Section 5.1 crisis protocol verbatim to `BASE_PROMPT` in `apps/web/src/lib/system-prompt.ts`. Zero code changes — prompt text only. | Aryan | 2 hrs |
| 8 | **Fix neutropenic fever triage routing** — Add the CLINICAL_SAFETY_GAP.md Section 5.2 emergency protocol to `BASE_PROMPT` changing "call oncology team" language to "go to the ER immediately" for fever during nadir. | Aryan | 2 hrs |
| 9 | **Draft Incident Response Plan** — Write an IRP covering: detection triggers, severity classification, response team, containment steps, breach notification (60-day HIPAA / 72-hour GDPR), post-incident review. Use HHS sample IRP template as starting point. | Founder | 2–3 days |
| 10 | **Formally designate Security Officer** — Draft and sign a Security Officer designation letter naming the responsible individual. File in HR records. | Founder | 0.5 days |

### Days 15–45: High-Priority Gaps (P1)

| # | Action | Owner | Effort |
|---|--------|-------|--------|
| 11 | **Configure session timeout** — Set `session: { maxAge: 8 * 60 * 60 }` in `apps/web/src/lib/auth.ts`. Add client-side idle timer (30-min inactivity → `signOut()`). | Aryan | 1 day |
| 12 | **Enforce caregiver `perms` in API handlers** — Implement `checkCareTeamPermission(userId, careProfileId, permKey)` helper that loads `careGroupMembers.perms` jsonb and returns 403 if permission is false. Call before all caregiver-accessible PHI endpoints. | Aryan | 3–5 days |
| 13 | **Verify / pursue Google Gemini → Vertex AI routing** — Confirm `@ai-sdk/google` points to Vertex AI endpoint (not `generativelanguage.googleapis.com`). If not, reconfigure. Then accept Google Cloud DPA. | Aryan | 1–2 days |
| 14 | **Pursue Vercel Enterprise BAA** — Contact `vercel.com/contact/sales` for Enterprise plan BAA. While pending, configure Vercel log-drain to exclude request body logging (or route through a scrubbing layer). | Aryan+Founder | 1 wk |
| 15 | **Pursue Sentry HIPAA BAA** — Upgrade to Business plan. Contact `sales@sentry.io` for HIPAA DPA. Verify web `instrumentation.ts` implements the same `scrubPHI()` hook as mobile `sentry.ts`. | Aryan | 1–2 days |
| 16 | **Add audit logging to all PHI GET endpoints** — Add `logAudit()` calls to: `GET /api/records/medications`, `GET /api/records/lab-results`, `GET /api/records/appointments`, `GET /api/insurance`. | Aryan | 1–2 days |
| 17 | **Fix GitHub Actions prompt injection** — Sanitize or base64-encode the issue body before interpolating into Claude Code action prompt in `.github/workflows/playwright-auto-fix.yml:41-61`. Wrap in delimited block with explicit untrusted-content warning. | Aryan | 0.5 days |
| 18 | **Implement MFA (TOTP)** — Integrate TOTP MFA into the credential login flow. Consider Cognito's built-in MFA or `otpauth` library. Make MFA mandatory for all credential-based accounts within 60 days of launch. | Aryan | 5–8 days |
| 19 | **Redesign drug interaction output** — Remove `safe_to_combine: boolean` from `drug-interactions.ts:22-23`. Replace with informational display. Add `confidence: 'high' | 'medium' | 'low'` and `disclaimer: string`. UI must not display "safe to combine" language. | Aryan | 1–2 days |
| 20 | **Write formal risk analysis** — Enumerate all ePHI assets, external/internal threats, vulnerabilities, likelihood × impact per NIST SP 800-30. Sign, version, and schedule annual review. Supersedes the April 2026 informal report. | Founder+Aryan | 3–5 days |
| 21 | **Write core security policies** — Draft: Information Security Policy, PHI Handling and Minimum Necessary Policy, Acceptable Use Policy. Use HHS.gov templates. Distribute to all workforce members with acknowledgment signatures. | Founder | 3–5 days |
| 22 | **Write termination checklist** — Procedure for revoking GitHub org access, Vercel team access, AWS IAM deactivation, Upstash access revocation, and database credential rotation on employee departure. | Founder | 0.5 days |
| 23 | **CCPA/WMHMD compliance** — Update Privacy Policy to include CCPA required disclosures (data categories, purposes, third parties). Add "Do Not Sell" link. Create Washington-specific health data privacy notice. Implement DSR intake form with 45-day SLA. | Founder | 1–2 wks |
| 24 | **Switch AWS canary workflow to OIDC** — Replace static `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in `.github/workflows/canary-monitor.yml` with `aws-actions/configure-aws-credentials@v4` using `role-to-assume`. Remove long-lived IAM keys from GitHub Secrets. | Aryan | 1 day |
| 25 | **Enable Dependabot** — Add `.github/dependabot.yml` to enable weekly dependency vulnerability scanning across monorepo packages. | Aryan | 0.5 days |

### Days 46–90: SOC2 Readiness (P2)

| # | Action | Owner | Effort |
|---|--------|-------|--------|
| 26 | **Write Disaster Recovery Plan** — Define RTO (<4 hours), RPO (<1 hour with Aurora continuous backup), restoration procedures for Aurora, Vercel redeployment, and DNS failover. | Aryan | 2–3 days |
| 27 | **Verify Aurora backup configuration** — Confirm in AWS Console: automated backups enabled, retention ≥30 days, point-in-time recovery enabled. Document KMS key ARN and rotation schedule. | Aryan | 1 day |
| 28 | **Add QT prolongation and opioid MED prompts** — Add Sections 5.4 and 5.5 from CLINICAL_SAFETY_GAP.md to the Medication Specialist system prompt in `apps/web/src/lib/agents/specialists.ts`. | Aryan | 2 hrs |
| 29 | **Add Beers Criteria and triage red flags** — Add Sections 5.6 and 5.7 from CLINICAL_SAFETY_GAP.md to system prompts. | Aryan | 2 hrs |
| 30 | **Mobile route parity** — Add drug interaction checking, the multi-agent orchestrator, and safety system prompt sections to `apps/web/src/app/api/chat/mobile/route.ts`. | Aryan | 3–5 days |
| 31 | **Define audit log retention policy** — Add database-level TTL or a scheduled CloudWatch export job that archives `auditLogs` older than 30 days to S3 with 6-year retention. | Aryan | 1–2 days |
| 32 | **Add SIEM/CloudWatch export** — Route structured `logger.*` output to CloudWatch Logs. Configure alerts for: login failure spike, bulk data export events, after-hours production access. | Aryan | 3–5 days |
| 33 | **Security training program** — Conduct initial security awareness session for all team members. Document with signatures. Establish quarterly cadence. Content: PHI handling rules, safe error logging, incident reporting. | Founder | 1 day |
| 34 | **Penetration test** — Engage a third-party security assessor for a pre-launch penetration test covering: auth bypass, API authorization, SQL injection, XSS, prompt injection, session management. Target completion before first paying user. | Founder | 2–4 wks |
| 35 | **Engage FDA regulatory counsel** — Brief counsel on the drug interaction checker, triage routing, and lab interpretation features against the 2022 FDA CDS guidance. Obtain written opinion on SaMD classification. | Founder | Ongoing |
| 36 | **Fix failed login audit logging** — Log failed login attempts to `auditLogs` with action `login_failed` and include IP address. Set up CloudWatch alarm for >10 failures per minute per IP. | Aryan | 1 day |
| 37 | **WorkStation and BYOD policy** — Draft workstation use policy: mandatory full-disk encryption, screensaver lock, MDM enrollment. Evaluate device management tooling (Jamf, Kandji for Mac). | Founder | 1–2 days |
| 38 | **Replace deprecated model identifiers** — Fix `claude-haiku-4.5` and `claude-sonnet-4.6` (dots not hyphens) in `apps/web/src/app/api/chat/mobile/route.ts:23,131`. Correct identifiers: `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`. | Aryan | 30 min |
| 39 | **GDPR readiness** — If any EU users are expected within 6 months: designate EU data protection representative, execute SCCs with Anthropic and AWS, add GDPR-specific consent module, implement 72-hour breach notification workflow alongside HIPAA 60-day workflow. | Founder | 2–3 wks |
| 40 | **SOC2 readiness review** — Conduct internal control review against all CC1–CC9 criteria. Identify remaining gaps. Engage a SOC2 auditor for a readiness assessment before starting the formal observation window. | Founder+Aryan | 5 days |

---

### Summary: Gaps Resolved by 90-Day Plan

| Priority | Count | Expected Resolve Date |
|----------|-------|-----------------------|
| P0 — Launch blockers | 10 | Day 14 |
| P1 — High-priority | 15 | Day 45 |
| P2 — SOC2 readiness | 15 | Day 90 |
| **Total** | **40** | Day 90 |

**After 90 days, CareCompanion should be ready to:**
- Onboard real patient PHI (with BAAs in place)
- Begin the 6-month SOC2 Type 2 observation window
- Operate in CCPA/WMHMD compliance for US-based health data
- Present a defensible posture if audited by OCR (HIPAA enforcement)
- Obtain a legal opinion on FDA SaMD classification to guide product roadmap

---

*This document was produced by automated static analysis of the `aryan/dev` branch as of 2026-05-24 and should be reviewed by qualified HIPAA counsel, a certified SOC2 auditor, and FDA regulatory counsel before relying on it for legal, regulatory, or compliance decisions. Runtime infrastructure state (IAM policies, Aurora encryption, Vercel configuration) was not directly verified and is based on code review and reasonable inferences from AWS default behaviors.*

*CareCompanion AUDIT_COMPLIANCE_GAPS.md | aryan/dev | 2026-05-24*
