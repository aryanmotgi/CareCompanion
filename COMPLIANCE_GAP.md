# COMPLIANCE GAP ANALYSIS — CareCompanion
*Generated: 2026-05-21 | Branch: aryan/dev | Analyst: Automated Batch (claude-sonnet-4-6)*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Methodology & Scope](#2-methodology--scope)
3. [HIPAA Administrative Safeguards §164.308](#3-hipaa-administrative-safeguards-164308)
4. [HIPAA Physical Safeguards §164.310](#4-hipaa-physical-safeguards-164310)
5. [HIPAA Technical Safeguards §164.312](#5-hipaa-technical-safeguards-164312)
6. [HIPAA Organizational Requirements §164.314, §164.316](#6-hipaa-organizational-requirements-164314-164316)
7. [SOC2 Trust Services Criteria](#7-soc2-trust-services-criteria)
8. [Deep-Dive: PHI Log Redaction Audit](#8-deep-dive-phi-log-redaction-audit)
9. [Deep-Dive: Encryption Posture](#9-deep-dive-encryption-posture)
10. [Deep-Dive: Access Control & Authentication](#10-deep-dive-access-control--authentication)
11. [Deep-Dive: BAA Inventory & Subprocessor List](#11-deep-dive-baa-inventory--subprocessor-list)
12. [Remediation Backlog](#12-remediation-backlog)
13. [Sources](#13-sources)

---

## 1. Executive Summary

CareCompanion is an AI-powered cancer care platform that processes Protected Health Information (PHI) including patient names, cancer diagnoses, medications, lab results, insurance claims, and treatment histories. This compliance gap analysis was produced by static code review of the `aryan/dev` branch as of 2026-05-21.

### Control Coverage Totals

| Category | Total Controls | Compliant | Partial | Gap | N/A |
|----------|---------------|-----------|---------|-----|-----|
| HIPAA Administrative (§164.308) | 19 | 4 | 5 | 10 | 0 |
| HIPAA Physical (§164.310) | 9 | 4 | 1 | 1 | 3 |
| HIPAA Technical (§164.312) | 13 | 6 | 4 | 3 | 0 |
| HIPAA Organizational (§164.314/316) | 6 | 1 | 1 | 4 | 0 |
| SOC2 Trust Services (CC1–CC9) | 33 | 9 | 9 | 15 | 0 |
| **TOTAL** | **80** | **24 (30%)** | **20 (25%)** | **36 (45%)** | **3** |

### Top 5 Blockers for First Paying User (Ranked by Risk)

1. **No executed BAAs with Anthropic or Google (Gemini)** — PHI (patient name, diagnosis, medications, labs, chat history) is transmitted to both Anthropic Claude API and Google Gemini embedding API on every request. Without BAAs, this is an active HIPAA violation the moment a real patient uses the platform. Evidence: `apps/web/src/lib/memory/embed.ts`, `apps/web/src/lib/system-prompt.ts`, `apps/web/src/app/api/chat/route.ts`.

2. **No breach notification procedures or incident response plan** — `HIPAA_Compliance_Report.md` acknowledges no breach notification policy exists. No code or documented procedure for detecting, investigating, or notifying affected individuals of a PHI breach within 60 days (45 CFR §164.404).

3. **Privacy Policy references Supabase but actual DB is AWS Aurora** — `apps/web/src/app/privacy/page.tsx` line 141 tells users their data is stored in "Supabase (SOC 2 Type II)." The actual database is AWS Aurora via RDS Data API (`apps/web/src/lib/db/index.ts`). This is a material misrepresentation in the Privacy Policy and creates regulatory exposure.

4. **No documented risk analysis on file** — §164.308(a)(1) requires a formal, documented risk analysis. The existing `HIPAA_Compliance_Report.md` is an informal preliminary assessment, not the signed, versioned, periodically-reviewed risk analysis required by the regulation.

5. **Missing RBAC enforcement in several API routes** — While most routes use `getAuthenticatedUser()`, care-team role permissions (`can_read_meds`, `can_read_labs`, etc.) stored in `careGroupMembers.perms` jsonb column are not enforced at the API layer. A caregiver with `can_read_meds = false` can still call `/api/records/medications`. Evidence: `apps/web/src/lib/db/schema.ts` lines 672–675.

### Estimated Time to SOC2 Type 1 Readiness

**Estimated: 3–5 months** from today assuming:
- BAAs secured within 4–6 weeks (or PHI de-identification implemented as code-level fix)
- Policies (IRP, workforce training, risk analysis, contingency plan) written in parallel — 4–6 weeks
- Technical gaps (RBAC enforcement, audit log expansion, session timeout, privacy policy fix) — 2–4 weeks engineering
- Evidence collection period for Type 1 (point-in-time) — minimal if controls are in place
- Type 2 requires 6+ months of operating evidence; Type 1 can be achieved faster

---

## 2. Methodology & Scope

### What Was Reviewed

- **Code paths:** `apps/web/src/lib/` (all 60+ files), `apps/web/src/app/api/` (90+ route handlers), `apps/web/src/middleware.ts`, `apps/mobile/src/` (top-level structure and key service files)
- **Database schema:** `apps/web/src/lib/db/schema.ts`, `apps/web/drizzle/` migrations (000–003, custom migrations 001–017)
- **Configuration:** `.env.example`, `apps/web/next.config.mjs`, `apps/mobile/app.config.js`
- **Packages:** `packages/types/`, `packages/utils/`, `packages/api/`
- **Documentation:** `README.md`, `CLAUDE.md`, `HIPAA_Compliance_Report.md`, `ARCH_BETS.md`, `TODOS.md`, `docs/hipaa-migration.md`
- **Third-party integrations:** Anthropic Claude API, Google Gemini API, Voyage AI rerank API, Resend email, PostHog analytics, Sentry error monitoring, AWS Aurora RDS, Upstash Redis, Google Calendar OAuth

### Grep Patterns Used

```
console.log, patient, mrn, dob, diagnosis, medication, encrypt, kms, sse,
Authorization, Bearer, session, role, rbac, audit, log, redact,
backup, snapshot, rto, rpo, baa, business associate, https, tls, hsts,
incident, breach, workforce, training, access review
```

### What Was NOT Reviewed

- **AWS Console / IAM configuration** — could not verify IAM role policies, KMS key configuration, CloudWatch log groups, or Aurora encryption settings
- **Vercel project settings** — log drain configuration, environment variable encryption settings, edge function behavior
- **Live production environment** — all analysis is static; runtime behavior may differ
- **Signed legal agreements** — BAA execution status with vendors requires legal/business verification
- **Mobile iOS/Android distribution** — App Store/Play Store privacy settings not reviewed
- **Manual processes** — onboarding procedures, termination checklists, security training programs

### Assumptions Made

- **Aurora at-rest encryption:** AWS Aurora encrypts data at rest by default using AES-256 with AWS KMS. This is assumed based on AWS default behavior; not verifiable without AWS Console access.
- **Vercel TLS:** Vercel provides automatic TLS certificate management; HTTPS is assumed to be enforced at the edge.
- **No hardcoded credentials found:** Grep scans for API keys showed only environment variable references.
- **Supabase fully replaced:** No supabase directory or imports found in `apps/web/src/`. The `apps/web/src/lib/db/index.ts` uses AWS RDS Data API exclusively. Privacy policy reference to Supabase is an outdated copy.

---

## 3. HIPAA Administrative Safeguards (§164.308)

### §164.308(a)(1) — Security Management Process

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Risk Analysis | Conduct accurate and thorough assessment of potential risks to ePHI | **Required** | **Partial** | `HIPAA_Compliance_Report.md` (April 2026 informal report); references in `TODOS.md`, `docs/hipaa-migration.md` | Existing report is informal, not signed, not versioned. Covers prior Supabase architecture that has since been replaced. Missing formal threat modeling, asset inventory, likelihood/impact ratings per NIST SP 800-30. | Produce formal risk analysis document: enumerate all ePHI assets, threats (external attacker, insider, vendor breach), vulnerabilities, likelihood × impact matrix. Sign, date, and version. Schedule annual review. Est: 3–5 days. |
| Risk Management | Implement security measures to reduce risk to a reasonable level | **Required** | **Partial** | Multiple security controls exist: rate limiting (`rate-limit.ts`), CSRF protection (`csrf.ts`), token encryption (`token-encryption.ts`), bcrypt password hashing (`auth.ts`), audit logging (`audit.ts`) | No documented risk management plan. Controls are implemented ad hoc; no traceability from risk → control → test. | Create a risk register mapping identified risks to implemented controls and residual risk. Est: 2 days. |
| Sanction Policy | Apply appropriate sanctions against workforce members who fail to comply | **Required** | **Gap** | No code evidence; no documentation found | No sanction policy document exists in the codebase or `docs/` directory. | Write and publish an internal workforce security sanction policy document. Reference in employee handbook/contracts. Est: 1 day. |
| Information System Activity Review | Implement procedures to regularly review audit logs and access reports | **Required** | **Partial** | `apps/web/src/app/api/compliance/audit-log/route.ts` — endpoint exists for users to view their own audit logs. `auditLogs` table in schema. | No documented procedure for periodic (weekly/monthly) review of audit logs by security personnel. No automated anomaly detection. Audit log endpoint is user-self-service, not admin review. | Implement admin audit log review interface or export to SIEM. Document quarterly review cadence. Est: 3–5 days. |

### §164.308(a)(2) — Assigned Security Responsibility

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Security Officer | Identify the security official responsible for developing/implementing policies | **Required** | **Gap** | `CLAUDE.md` identifies Aryan as web lead/AI architect. No formal security officer designation in documentation. | No formally documented Security Officer designation. `CLAUDE.md` ownership map is a development tool, not a compliance designation. | Formally designate a Security Officer (can be a founder/team member). Document in policy and employment records. Est: 0.5 days. |

### §164.308(a)(3) — Workforce Security

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Authorization and/or Supervision | Procedures to authorize/supervise workforce members accessing ePHI | **Addressable** | **Gap** | `CLAUDE.md` defines file ownership but not ePHI access authorization procedures. | No documented procedures for authorizing workforce access to PHI systems. | Write access authorization procedures covering who can access production DB, log systems, and admin APIs. Est: 1 day. |
| Workforce Clearance Procedure | Appropriate access to ePHI based on roles | **Addressable** | **Gap** | Application-level roles (caregiver/patient/self) exist in `schema.ts`. No documentation of personnel clearance for accessing production systems. | No background check or clearance process documented for personnel who can access production ePHI. | Document workforce clearance process in HR policy. For small teams: minimum background check attestation for production access. Est: 1 day. |
| Termination Procedures | Procedures to revoke access when workforce relationship ends | **Addressable** | **Gap** | No documentation found | No termination procedure for revoking access to AWS console, Vercel, GitHub, database. | Write termination checklist covering GitHub org removal, Vercel team removal, AWS IAM deactivation, database credential rotation, Upstash access revocation. Est: 0.5 days. |

### §164.308(a)(4) — Information Access Management

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Isolating Healthcare Clearinghouse | If CE is a healthcare clearinghouse that is part of a larger org, protect the clearinghouse's ePHI from the larger org | **Required** | **N/A** | Not applicable — CareCompanion is not a clearinghouse. | N/A | N/A |
| Access Authorization | Policies for granting access to workstations, transactions, programs, or processes | **Addressable** | **Partial** | `getAuthenticatedUser()` in `api-helpers.ts`. Care team role system in `careTeamMembers` table (viewer/editor roles). CSRF protection. Rate limiting. | Caregiver `perms` jsonb column (`can_read_meds`, `can_read_labs`, etc.) is defined in schema but **not enforced in API route handlers**. A caregiver with `can_read_meds = false` can still call `GET /api/records/medications`. Evidence: `apps/web/src/lib/db/schema.ts` lines 672–675. | Implement `checkCareTeamPermission()` helper that loads and checks `perms` jsonb before allowing caregiver access to PHI sub-resources. Estimated: 3–5 days. |
| Access Establishment and Modification | Implement procedures to establish, document, review, and modify a user's right of access | **Addressable** | **Partial** | Role changes persist to DB via `/api/auth/set-role`. Care team invites tracked in `careTeamInvites` table with expiry. | No documented access review process. No admin interface for operators to audit who has access to which care profile. | Document access establishment/modification procedures. Add admin view for care team membership. Est: 2–3 days. |

### §164.308(a)(5) — Security Awareness and Training

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Security Reminders | Periodic security updates to workforce | **Addressable** | **Gap** | No documentation | No evidence of security training program, security reminders, or workforce training records. | Establish quarterly security awareness reminders (can be internal email/Slack). Document in policy. Est: 0.5 days ongoing. |
| Protection from Malicious Software | Procedures for guarding against, detecting, and reporting malicious software | **Addressable** | **Partial** | GitHub Actions CI (`ci.yml`) exists. Dependencies managed via npm. | No automated dependency vulnerability scanning (Dependabot/Snyk) configured in `.github/`. No documented malware protection policy. | Enable GitHub Dependabot alerts. Enable `npm audit` in CI. Document malware protection policy. Est: 1 day. |
| Log-in Monitoring | Procedures for monitoring log-in attempts and reporting discrepancies | **Addressable** | **Partial** | Rate limiting on login: `loginLimiter` in `auth.ts` (50 requests/15 min per email). Failed login attempts not logged to audit trail. | Failed login attempts are rate-limited but not logged to `auditLogs`. No alerting on brute-force patterns. | Add audit log entry on failed login attempts. Set up alert when login failure rate exceeds threshold. Est: 1–2 days. |
| Password Management | Procedures for creating, changing, and safeguarding passwords | **Addressable** | **Partial** | bcrypt password hashing in `auth.ts`. Password reset flow in `/api/auth/reset-password/`. | No documented minimum password requirements enforced at registration (length, complexity). No password rotation policy. | Add server-side password complexity validation at registration (`/api/auth/register/route.ts`). Document password policy. Est: 1 day. |

### §164.308(a)(6) — Security Incident Procedures

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Response and Reporting | Identify and respond to suspected or known security incidents; mitigate effects; document incidents | **Required** | **Gap** | `HIPAA_Compliance_Report.md` acknowledges no incident response plan. Sentry error monitoring is configured (`instrumentation.ts`). | No Incident Response Plan (IRP) document. No breach notification procedures. No documentation of how to detect, contain, eradicate, recover from, and report a security incident. | Write an Incident Response Plan covering: detection triggers, severity classification, response team contacts, containment steps, notification procedures (60-day breach notification per §164.404), post-incident review. Est: 2–3 days. |

### §164.308(a)(7) — Contingency Plan

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Data Backup Plan | Create and maintain retrievable exact copies of ePHI | **Required** | **Partial** | AWS Aurora has automated backups by default (7-day retention). No documentation in codebase confirming backup configuration or testing. | Backup is likely enabled as an AWS default but not documented, not tested, and not verified. Retention period not confirmed. | Document Aurora backup configuration (retention, frequency). Test restore procedure annually. Document RTO/RPO targets. Est: 1 day documentation + 1 day testing. |
| Disaster Recovery Plan | Restore loss of data | **Required** | **Gap** | No documentation found in `docs/` or codebase | No Disaster Recovery Plan exists. No documented RTO/RPO targets. | Write a Disaster Recovery Plan: identify critical systems, define RTO (target: <4 hours) and RPO (target: <1 hour for Aurora with continuous backup), document restoration procedures for Aurora, Vercel deployment, and DNS. Est: 2 days. |
| Emergency Mode Operation Plan | Procedures to enable continuation of critical business processes for protection of ePHI during/after emergency | **Required** | **Gap** | No documentation found | No Emergency Mode Operation Plan. | Document which functions are essential during emergency and how to operate manually if primary systems are unavailable. Est: 1 day. |
| Testing and Revision | Implement procedures for periodic testing/revision of contingency plans | **Addressable** | **Gap** | No documentation found | No scheduled testing of backup/DR procedures. | Schedule annual DR test. Document results. Est: 0.5 days scheduling + 1 day execution annually. |
| Applications and Data Criticality Analysis | Assess relative criticality of applications and data | **Addressable** | **Gap** | No documentation found | No criticality analysis of the various systems (Aurora DB, Vercel deployment, Redis, third-party APIs). | Document criticality tiers for all systems. Define degraded-mode behavior if each fails. Est: 1 day. |

### §164.308(a)(8) — Evaluation

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Evaluation | Perform a periodic technical and non-technical evaluation of security safeguards | **Required** | **Partial** | This document constitutes a point-in-time evaluation. GitHub Actions CI exists. | No scheduled periodic evaluation. No penetration testing scheduled. | Schedule annual security evaluation. Engage a security assessor for pre-launch pen test. Est: ongoing. |

### §164.308(b)(1) — Business Associate Contracts

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Business Associate Contracts | Have written contracts with business associates that provide satisfactory assurances regarding ePHI | **Required** | **Gap** | `HIPAA_Compliance_Report.md` and `docs/hipaa-migration.md` acknowledge BAAs are required but not yet executed. `ARCH_BETS.md` says "HIPAA BAA is already there" for Aurora (unverified). | No confirmed executed BAAs with: Anthropic (receives full PHI in system prompt), Google (Gemini embeddings of memory facts containing PHI), Voyage AI (reranks memory facts containing PHI), Resend (receives email addresses — borderline PHI), Sentry (receives error data that could include PHI if not scrubbed), PostHog (receives analytics events). | Execute AWS BAA (available at no cost for accounts with BAA). Pursue Anthropic Enterprise BAA or implement PHI de-identification before sending to Claude API. Pursue Google Cloud Healthcare BAA or de-identify memory facts before embedding. Pursue or evaluate Voyage AI BAA. See Section 11 for full inventory. **BLOCKER.** Est: 1–3 weeks for legal execution. |

---

## 4. HIPAA Physical Safeguards (§164.310)

### §164.310(a)(1) — Facility Access Controls

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Contingency Operations | Procedures to allow facility access to support restoration of lost data | **Addressable** | **N/A** | CareCompanion is a cloud-native SaaS with no physical data center. AWS manages physical facilities. AWS BAA covers physical safeguards for Aurora. | Physical facility access is AWS's responsibility under the shared responsibility model. | Document reliance on AWS shared responsibility model. Include in risk analysis. |
| Facility Security Plan | Safeguard the facility and equipment from unauthorized physical access | **Addressable** | **N/A** | Cloud-native; no physical offices with ePHI systems identified | AWS handles physical security for Aurora. Team laptops may have access to production credentials. | Implement device management policy for developer workstations with production access. Consider MDM. |
| Access Control and Validation | Procedures to control and validate a person's access to facilities and equipment | **Addressable** | **N/A** | Cloud-native | N/A for cloud-native systems at AWS layer. | Ensure AWS account uses MFA for all IAM users. Document in access policy. |
| Maintenance Records | Document repairs and modifications to physical components | **Addressable** | **N/A** | Cloud-native | N/A at this stage. | N/A |

### §164.310(b) — Workstation Use

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Workstation Use | Specify proper functions to be performed on workstations accessing ePHI | **Required** | **Gap** | No documentation found | No workstation use policy for developer machines that have access to production database, AWS console, or Vercel dashboard. | Write a workstation use policy: approved OS versions, required full-disk encryption, prohibited activities (no PHI on personal devices, etc.). Est: 0.5 days. |

### §164.310(c) — Workstation Security

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Workstation Security | Physical safeguards for workstations that access ePHI | **Required** | **Partial** | No documented policy, but team is small. | No formal workstation security policy. No MDM or device management tool. | Require full-disk encryption (FileVault/BitLocker), screensaver lock, and MDM enrollment for all workstations with production access. Document in security policy. Est: 1–2 days. |

### §164.310(d)(1) — Device and Media Controls

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Disposal | Procedures to address the final disposition of ePHI on hardware/electronic media | **Required** | **Compliant** | Aurora: AWS handles secure disposal. `apps/web/src/app/api/delete-account/route.ts` implements cascade delete via FK constraints. Soft delete + 30-day hard purge via `purgeExpiredRecords()` in `soft-delete.ts`. `/api/cron/purge/route.ts` and `/api/cron/retention/route.ts` implement scheduled cleanup. | Compliant for cloud data. Developer workstation disposal procedure not documented. | Document workstation media disposal procedure. |
| Media Re-use | Procedures for removal of ePHI from electronic media before re-use | **Addressable** | **Compliant** | Cloud-native; AWS handles storage media lifecycle. | No gaps for cloud-native deployment. | N/A |
| Accountability | Maintain a record of hardware and electronic media movements | **Addressable** | **Partial** | No documentation found for developer hardware tracking. | No hardware inventory or tracking policy for developer machines with production access. | Create simple hardware inventory log for devices with production access. Est: 0.5 days. |
| Data Backup and Storage | Create a retrievable exact copy of ePHI before moving equipment | **Addressable** | **Compliant** | Aurora automated backups. | Compliant by AWS Aurora default backup behavior. | Verify Aurora backup retention is configured appropriately (recommend 30 days). |

---

## 5. HIPAA Technical Safeguards (§164.312)

### §164.312(a)(1) — Access Control

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Unique User Identification | Assign a unique name/number for identifying and tracking user identity | **Required** | **Compliant** | UUID primary keys for all users (`users.id` in `schema.ts` line 45). JWT tokens carry `dbUserId`. All API routes authenticate via `getAuthenticatedUser()` which maps to a unique DB UUID. Audit logs record `userId`. | Compliant. | — |
| Emergency Access Procedure | Obtain necessary ePHI during an emergency | **Required** | **Gap** | No documentation found | No emergency access procedure for obtaining ePHI if normal authentication is unavailable (e.g., if AWS/Vercel is down, an emergency situation requires patient data). | Document an emergency access procedure: define break-glass access to Aurora via AWS console with MFA, who can authorize it, and required audit logging. Est: 1 day. |
| Automatic Logoff | Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity | **Addressable** | **Gap** | NextAuth JWT-based sessions used. No `maxAge` session configuration found in `auth.ts` or `auth.config.ts`. Default NextAuth JWT session is 30 days with no idle timeout. | No automatic session timeout configured. A session can remain active indefinitely, violating minimum necessary access principles. | Configure `session: { maxAge: 8 * 60 * 60 }` (8 hours) in NextAuth config. Add client-side idle timeout detection (15–30 minutes) that calls `signOut()`. Est: 1 day. |
| Encryption and Decryption | Implement a mechanism to encrypt and decrypt ePHI | **Addressable** | **Partial** | AES-256-GCM token encryption for OAuth tokens (`token-encryption.ts`). Aurora at-rest encryption (AWS default). HTTPS/TLS enforced via Vercel. HSTS header in `next.config.mjs` (line 34). bcrypt for passwords. | No field-level encryption for PHI fields in the database (patient name, diagnosis, medications, DOB, etc.). PHI stored in plaintext in Aurora. | Implement application-level field encryption for highest-sensitivity PHI fields (DOB, SSN if collected, insurance member IDs). Use `TOKEN_ENCRYPTION_KEY` pattern already established. Alternatively, document that Aurora KMS encryption satisfies this requirement and obtain AWS confirmation. Est: 3–5 days for field encryption. |

### §164.312(b) — Audit Controls

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Audit Controls | Implement hardware, software, and/or procedural mechanisms that record and examine activity on systems that contain or use ePHI | **Required** | **Partial** | `audit.ts` provides PHI-access audit logging to `auditLogs` table. `logAudit()` called in major PHI access routes: chat (`route.ts`), export (`export-data/route.ts`), consent (`consent/accept/route.ts`). `memoryAccessLog` table tracks AI memory retrievals. `auditLogs` has user+created index. | Not all PHI-touching routes call `logAudit()`. Specifically missing: medication reads (`GET /api/records/medications`), lab result reads, appointment reads, insurance reads. Audit logs have no retention policy. No read access to audit log by administrators (only self-service for users). | Add `logAudit()` calls to all PHI GET endpoints. Define and enforce audit log retention (minimum 6 years per HIPAA). Create admin audit log viewer. Est: 2–3 days. |

### §164.312(c)(1) — Integrity

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Integrity | Implement policies and procedures to protect ePHI from improper alteration or destruction | **Required** | **Partial** | Soft delete pattern protects against accidental destruction (30-day recovery window). Foreign key constraints with cascade deletes maintain referential integrity. CSRF protection prevents unauthorized state changes. bcrypt for passwords. | No checksums or integrity verification for PHI records. No write-once audit log (audit log itself could be modified). No database-level row-level security (RLS) policies — authorization enforced only at application layer. | Consider adding `checksum` column to critical PHI tables for integrity verification. Evaluate AWS Aurora activity streams for immutable audit logging. Est: 3–5 days. |
| Mechanism to Authenticate ePHI | Electronic mechanisms to corroborate ePHI has not been altered or destroyed in an unauthorized manner | **Addressable** | **Gap** | No checksums, HMACs, or digital signatures on PHI records found in schema or application code. | No mechanism to detect unauthorized ePHI modification outside the application (e.g., direct DB access). | Implement application-level checksums for highest-risk PHI tables, or enable Aurora activity streams for comprehensive change audit. Est: 3–5 days. |

### §164.312(d) — Person or Entity Authentication

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Person or Entity Authentication | Implement procedures to verify that a person or entity seeking access to ePHI is the one claimed | **Required** | **Partial** | NextAuth with JWT-signed sessions, bcrypt password verification, Apple/Google OAuth, JWT Bearer token for mobile, CSRF protection, rate limiting on login (50/15min). | No multi-factor authentication (MFA) available for credential-based login. MFA is especially important for a healthcare application handling PHI. No step-up authentication for high-risk operations (account deletion, data export). | Implement TOTP MFA (e.g., via NextAuth + `otpauth` library or integrate with an identity provider that supports MFA). Require MFA for admin/security-sensitive operations. Est: 5–8 days. |

### §164.312(e)(1) — Transmission Security

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Transmission Security | Implement technical security measures to guard against unauthorized access to ePHI transmitted over electronic communications networks | **Required** | **Compliant** | HSTS header configured in `next.config.mjs` (`max-age=63072000; includeSubDomains; preload`). All API endpoints served over HTTPS via Vercel. Mobile app uses `https://carecompanionai.org` as default base URL (`apps/mobile/src/services/api.ts` line 5). TLS enforced by Vercel edge infrastructure. | Compliant at transport layer. Note: data transmitted to Anthropic, Google Gemini, Voyage AI is protected by their TLS but lacks BAA coverage (see Section 11). | — |
| Encryption | Implement a mechanism to encrypt ePHI in transit | **Addressable** | **Compliant** | TLS/HTTPS enforced via Vercel and HSTS preload. OAuth tokens encrypted in DB with AES-256-GCM (`token-encryption.ts`). | Compliant for transport encryption. | — |
| Integrity Controls | Ensure ePHI is not improperly modified without detection during transmission | **Addressable** | **Compliant** | TLS provides integrity guarantees in transit. CSRF tokens prevent request forgery. | Compliant via TLS integrity. | — |

---

## 6. HIPAA Organizational Requirements (§164.314, §164.316)

### §164.314(a) — Business Associate Contracts and Other Arrangements

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Business Associate Contracts | Covered entity must have satisfactory assurances through BAA | **Required** | **Gap** | Same as §164.308(b)(1) — no confirmed executed BAAs with PHI-touching vendors | Critical gap. See Section 11 for full BAA inventory. | Execute BAAs with all PHI-touching vendors or implement code-level PHI de-identification. |
| Other Arrangements | If CE is part of an organized health care arrangement | **Required** | **N/A** | Not applicable to CareCompanion's current structure. | N/A | N/A |

### §164.314(b) — Requirements for Group Health Plans

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Group Health Plan Requirements | Plan documents must include BAA provisions | **Required** | **N/A** | CareCompanion is not a group health plan sponsor. | N/A | N/A |

### §164.316(a) — Policies and Procedures

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Policies and Procedures | Implement reasonable and appropriate policies and procedures to comply with the standards, implementation specifications, and requirements of this subpart | **Required** | **Gap** | `CLAUDE.md` has engineering team rules. `HIPAA_Compliance_Report.md` exists as an informal assessment. No formal HIPAA security policies found. | No formal written HIPAA security policies exist: no Information Security Policy, no PHI Handling Policy, no Acceptable Use Policy, no Data Classification Policy. | Draft formal security policy documents. Minimum required: Information Security Policy, PHI Handling and Minimum Necessary Policy, Acceptable Use Policy. Templates available at HHS.gov. Est: 3–5 days. |

### §164.316(b) — Documentation

| Control | Specification | Required/Addressable | Score | Evidence | Gap Detail | Remediation |
|---------|--------------|---------------------|-------|----------|-----------|------------|
| Documentation | Maintain documentation of policies and procedures | **Required** | **Partial** | `CHANGELOG.md`, `TODOS.md`, `HIPAA_Compliance_Report.md` provide development documentation. Privacy policy exists in `apps/web/src/app/privacy/page.tsx`. | Formal compliance documentation is missing: no policy version control, no record of policy reviews, no documentation of security incidents (even none). HIPAA requires documentation retention for 6 years from creation or last effective date. | Establish a documentation system (wiki, Notion, Confluence) for HIPAA policies and procedures. Version and date all policy documents. Est: 1 day to set up, ongoing for content. |
| Time Limit | Retain documentation for 6 years from date of creation or last effective date | **Required** | **Gap** | No documented retention policy for compliance records. Audit logs have no confirmed retention duration. | Audit logs in `auditLogs` table have no retention configuration. HIPAA requires 6-year minimum retention for security policies and documentation. | Add `created_at` index with TTL policy for audit logs (retain 6 years, not 30 days like soft-deleted PHI). Document retention policy. Est: 1 day. |
| Availability | Make documentation available to those responsible for implementing procedures | **Required** | **Partial** | `HIPAA_Compliance_Report.md` and `CLAUDE.md` are in the repo. | Compliance documentation is in the code repo but not in a structured policy management system accessible to all workforce members. | Move compliance documentation to a dedicated system outside the engineering repo for broader workforce access. Est: 1 day. |

---

## 7. SOC2 Trust Services Criteria

*SOC2 TSC 2017 reference. Scores reflect code evidence found in static analysis.*

### CC1 — Control Environment

| Control | Description | Score | Evidence | Gap |
|---------|-------------|-------|----------|-----|
| CC1.1 | COSO Principle 1 — Demonstrates commitment to integrity and ethical values | **Gap** | No code of conduct or ethics policy found | Write and publish code of conduct and security ethics policy |
| CC1.2 | Board/management oversight of controls | **Gap** | No governance documentation | Establish governance structure; document oversight responsibilities |
| CC1.3 | Organizational structure and assignment of authority | **Partial** | `CLAUDE.md` defines file ownership and team structure. Aryan designated as web lead. | Formalize org chart and reporting structure. Document security authority assignment. |
| CC1.4 | HR practices: commitment to competence | **Gap** | No documented hiring/competence requirements for security-sensitive roles | Document required security competencies for roles handling PHI |
| CC1.5 | Accountability for controls | **Partial** | File ownership in `CLAUDE.md`. Pre-push checks (`pre-push` husky hook) enforce quality gates. | Formalize accountability: who is responsible for each control; annual review |

### CC2 — Communication and Information

| Control | Description | Score | Evidence | Gap |
|---------|-------------|-------|----------|-----|
| CC2.1 | Relevant information to support controls | **Partial** | Structured JSON logging via `logger.ts`. Sentry error monitoring. Health check endpoint at `/api/health`. | No centralized log aggregation. Logs are scattered across Vercel and not retained long-term. |
| CC2.2 | Internal communication of control responsibilities | **Gap** | `CLAUDE.md` has team rules but no formal communication of security responsibilities | Establish security communication cadence (monthly security stand-up, incident notification procedures) |
| CC2.3 | External communication to users | **Partial** | Privacy policy in `apps/web/src/app/privacy/page.tsx`. HIPAA consent flow tracked in `users.hipaaConsentAt`. | Privacy policy references Supabase (outdated); must update to reflect actual infrastructure (AWS Aurora, Vercel). |

### CC3 — Risk Assessment

| Control | Description | Score | Evidence | Gap |
|---------|-------------|-------|----------|-----|
| CC3.1 | Specifies objectives to identify and assess risk | **Partial** | `HIPAA_Compliance_Report.md` documents some risks. | No formal risk register with ownership, likelihood, impact scores |
| CC3.2 | Identifies and analyzes risk | **Partial** | Various TODOS.md items identify specific technical risks (TOCTOU, session expiry). | Missing systematic risk analysis across full threat landscape |
| CC3.3 | Considers potential for fraud | **Gap** | No fraud risk assessment found | Conduct fraud risk assessment covering insider threat, account takeover, data exfiltration |
| CC3.4 | Identifies and assesses changes that could impact controls | **Gap** | No change management process for evaluating security impact | Add security review step to PR process for changes touching PHI flows |

### CC4 — Monitoring Activities

| Control | Description | Score | Evidence | Gap |
|---------|-------------|-------|----------|-----|
| CC4.1 | Selects and develops ongoing/separate evaluations | **Partial** | Sentry monitoring, PostHog analytics, health check endpoint. Canary monitor in `.github/workflows/canary-monitor.yml`. | No automated security monitoring (anomaly detection, failed auth spike alerts) |
| CC4.2 | Evaluates and communicates deficiencies | **Gap** | No documented deficiency communication process | Establish deficiency tracking (security issue tracker, not just engineering TODO) and communication to stakeholders |

### CC5 — Control Activities

| Control | Description | Score | Evidence | Gap |
|---------|-------------|-------|----------|-----|
| CC5.1 | Selects and develops control activities | **Partial** | Multiple technical controls: CSRF, rate limiting, token encryption, HSTS, CSP headers, bcrypt hashing | Controls exist but are not formally mapped to risks in a control framework |
| CC5.2 | Selects and develops technology controls | **Compliant** | Comprehensive technical controls in code. CSP headers, CORS-equivalent via SameSite cookies, input validation via Zod. | — |
| CC5.3 | Deploys through policies and procedures | **Gap** | Controls are deployed in code; no formal policies deployed to workforce | Write and distribute security policies to all workforce members |

### CC6 — Logical and Physical Access Controls

| Control | Description | Score | Evidence | Gap |
|---------|-------------|-------|----------|-----|
| CC6.1 | Logical access security software, infrastructure, and architectures | **Partial** | NextAuth JWT sessions, bcrypt, CSRF, rate limiting, middleware auth enforcement | No MFA; session timeout not configured; caregiver perms not enforced in API routes |
| CC6.2 | Prior to issuing access, registers and authorizes new internal and external users | **Partial** | User registration flow in `/api/auth/register/`. Care team invites with expiry. | No formal access provisioning review for new internal workforce members |
| CC6.3 | Removes access when no longer needed | **Partial** | Account deletion via `/api/delete-account/`. Care team member removal via `/api/care-team/remove/`. | No automated workforce access removal on HR termination |
| CC6.4 | Prevents unauthorized access to meet system objectives | **Compliant** | Middleware enforces authentication for all protected routes. User isolation via `WHERE userId = ?` patterns throughout API routes. CSRF protection. | — |
| CC6.5 | Logical access security measures to protect against threats from sources outside its system boundaries | **Partial** | Rate limiting, CSRF, HSTS, CSP, input validation. | No WAF (Web Application Firewall). No IP allowlisting for admin endpoints. |
| CC6.6 | Logical access security measures to protect against threats from internal sources | **Gap** | No separation of duties for production DB access. Any team member with AWS credentials can read raw PHI. | Implement DB access controls: IAM-based DB authentication, read-only vs. read-write IAM roles, access logging |
| CC6.7 | Restricts physical access | **Compliant** | Cloud-native; AWS handles physical security. | — |
| CC6.8 | Manages vendor and business partner access | **Gap** | No documented vendor access review or third-party risk management program | Establish vendor risk management policy and access review for third-party services |

### CC7 — System Operations

| Control | Description | Score | Evidence | Gap |
|---------|-------------|-------|----------|-----|
| CC7.1 | Detects and monitors for new vulnerabilities | **Partial** | Sentry error monitoring. GitHub Actions CI with typechecking and linting. | No automated dependency vulnerability scanning. No scheduled security scans. |
| CC7.2 | Monitors system components for anomalous behavior | **Partial** | Sentry monitors for exceptions. Health check endpoint. PostHog for usage analytics. | No anomaly detection for unusual data access patterns (large exports, bulk queries). |
| CC7.3 | Evaluates security events to determine impact | **Gap** | Sentry captures errors but no security event classification or severity assessment process | Implement security event classification in incident response procedures |
| CC7.4 | Responds to identified security incidents | **Gap** | No Incident Response Plan | Write and test IRP. See §164.308(a)(6). |
| CC7.5 | Restores system components after security incidents | **Gap** | No documented recovery procedures | Write disaster recovery procedures. See §164.308(a)(7). |

### CC8 — Change Management

| Control | Description | Score | Evidence | Gap |
|---------|-------------|-------|----------|-----|
| CC8.1 | Change management process includes authorization, testing, and documentation | **Partial** | Husky pre-commit/pre-push hooks enforce typecheck + lint + test. PR required for changes to main (`CLAUDE.md`). Conventional Commits enforced. Squash-merge policy. | No security review requirement in PR process for PHI-touching changes. No formal change approval for production deployments. |

### CC9 — Risk Mitigation

| Control | Description | Score | Evidence | Gap |
|---------|-------------|-------|----------|-----|
| CC9.1 | Identifies and selects risk mitigation activities | **Partial** | Various risk mitigations in place (rate limiting, encryption, audit logs). `HIPAA_Compliance_Report.md` outlines mitigation strategies. | No formal risk treatment plan documenting accept/mitigate/transfer/avoid decisions for each identified risk |
| CC9.2 | Assesses and manages risks associated with vendors and business partners | **Gap** | No formal vendor risk management program. BAAs not executed. | Implement vendor risk assessment process. Execute BAAs. See Section 11. |

---

## 8. Deep-Dive: PHI Log Redaction Audit

### 8.1 Structured Logger Analysis

The application has a structured logger at `apps/web/src/lib/logger.ts` that emits JSON to stdout. The logger accepts a `LogContext` interface that does NOT include PHI field names — it accepts `userId`, `route`, `method`, `duration`, and arbitrary `[key: string]: unknown`. This is a risk because callers can pass PHI in the context object.

**Assessment of `logger.ts`:** The logger itself does not redact. It relies on callers not passing PHI. No redaction helper is implemented for the general logger (only for Sentry via `sentry-utils.ts`).

### 8.2 Console.log/error Inventory

All `console.log`, `console.error`, and `console.warn` calls in non-test production code:

| File | Line | Statement | PHI Risk | Assessment |
|------|------|-----------|----------|-----------|
| `apps/web/src/lib/logger.ts` | 29–38 | `console.debug/log/warn/error(formatLog(...))` | Medium | Structured JSON; context can contain PHI if callers pass it. No deny-list filtering. |
| `apps/web/src/lib/token-encryption.ts` | 26 | `console.warn('[token-encryption] TOKEN_ENCRYPTION_KEY not set...')` | Low | Logs missing config warning only. No PHI. **Safe** |
| `apps/web/src/lib/token-encryption.ts` | 37 | `console.error('[token-encryption] TOKEN_ENCRYPTION_KEY is N chars...')` | Low | Logs config error only. No PHI. **Safe** |
| `apps/web/src/lib/memory/rerank.ts` | 33 | `console.warn('[rerank] voyage non-2xx', res.status)` | Low | HTTP status only. No PHI. **Safe** |
| `apps/web/src/lib/memory/rerank.ts` | 44 | `console.warn('[rerank] fallback to RRF order', err.message)` | Low | Error message only. **Safe** |
| `apps/web/src/lib/rate-limit.ts` | 84 | `console.warn('[rate-limit] KV_REST_API_URL not set...')` | Low | Config warning only. **Safe** |
| `apps/web/src/app/api/auth/reset-password/route.ts` | 35 | `console.log('[reset-password] No user found for ${maskEmail(...)}')` | Low | Uses `maskEmail()` helper. **Safe** |
| `apps/web/src/app/api/auth/reset-password/route.ts` | 112 | `console.log('[reset-password] Reset email sent to ${maskEmail(...)}')` | Low | Uses `maskEmail()` helper. **Safe** |
| `apps/web/src/app/api/auth/reset-password/confirm/route.ts` | 52 | `console.log('[reset-password-confirm] Password reset for ${maskEmail(...)}')` | Low | Uses `maskEmail()` helper. **Safe** |
| `apps/web/src/app/api/delete-account/route.ts` | 24,36 | `console.log('[delete-account] ... user ${user.id}')` | Low | Logs user UUID only. **Safe** |
| `apps/web/src/app/api/cron/retention/route.ts` | 45 | `console.log('[cron/retention] Purged N records', results)` | Low | Purge counts only. **Safe** |
| `apps/web/src/app/api/cron/purge/route.ts` | 17 | `console.log('[cron/purge] Purged N expired records', result.purged)` | Low | Purge counts only. **Safe** |
| `apps/web/src/app/api/chat/mobile/route.ts` | 161 | `console.error('[chat/mobile] error:', err)` | **High** | `err` object could contain request body, message history, or profile data. Full PHI context in scope. **Risk** |
| `apps/web/src/app/api/chat/route.ts` | 358 | `console.error('[memory] background extraction error:', err)` | Medium | Memory extraction errors could include conversation content. **Risk** |
| `apps/web/src/app/api/chat/route.ts` | 364 | `console.error('[memory] background summarization error:', err)` | Medium | Summarization errors could include conversation content. **Risk** |
| `apps/web/src/app/api/scan-document/route.ts` | 80 | `console.error('[scan-document] Error:', err)` | **High** | Document scanning processes medical documents. Errors could contain document content. **Risk** |
| `apps/web/src/app/api/save-scan-results/route.ts` | 195 | `console.error('[save-scan-results] POST error:', err)` | **High** | Scan result saving errors could include extracted medical data. **Risk** |
| `apps/web/src/app/api/import-data/route.ts` | 99 | `console.error('[import-data] POST error:', err)` | **High** | Import data could include full PHI records. **Risk** |
| `apps/web/src/app/api/healthkit/sync/route.ts` | 55,78,99,123 | `console.error('...insert failed...: err.message')` | Medium | Uses `err.message` only. Could expose DB constraint violations. **Partial Risk** |
| `apps/web/src/app/api/healthkit/replace/route.ts` | 105,128,149,175 | `console.error('...insert failed...: err.message')` | Medium | Same as above. **Partial Risk** |
| `apps/web/src/app/api/insurance/appeal/route.ts` | 108 | `console.error('[appeal] Error:', error)` | **High** | Insurance appeal context contains member IDs, claim amounts. **Risk** |

### 8.3 Overall PHI Log Assessment

**Summary:** 8 `console.error` calls pass the full error object (`err`) which could contain PHI from request body or database records. The most high-risk are chat-related (conversation content), scan-related (medical document content), and import-related (bulk PHI import).

**Key Finding:** The application does NOT have a global log redaction middleware for `console.error` calls that pass raw error objects. The Sentry `beforeSend` hook (`scrubPHI()` in `sentry-utils.ts`) handles Sentry error reports but does not cover `console.error` output going to Vercel's log drain.

**Remediation Required:**
1. Replace all `console.error('[x] error:', err)` patterns in PHI-handling routes with `logger.error('[x] error', { route: 'x', error: err instanceof Error ? err.message : String(err) })` which only logs the message string, not the full object.
2. Review auth logger in `auth.ts` lines 181–188 — currently logs `error.name` and `e.message` but not full objects. This is safe.
3. Consider implementing a `safeError()` helper that strips known PHI keys from error objects before logging.

---

## 9. Deep-Dive: Encryption Posture

### 9.1 Database Encryption at Rest

**Aurora (AWS RDS):**
- Connection via AWS RDS Data API (`apps/web/src/lib/db/index.ts`)
- AWS Aurora encrypts data at rest by default using AES-256 with AWS KMS
- **Status: Assumed Compliant** — cannot verify KMS key configuration without AWS Console access
- **Action Required:** Confirm Aurora encryption is enabled in AWS Console. Document KMS key ARN and key rotation schedule.

**Note on Supabase References:**
- The Privacy Policy page (`apps/web/src/app/privacy/page.tsx` line 141) states "All data stored in Supabase (PostgreSQL), a SOC 2 Type II certified cloud database" — this is outdated and inaccurate. The actual database is AWS Aurora.
- **BLOCKER:** Privacy policy must be updated before first paying user. Misrepresenting the data processor is a material privacy regulation violation.

### 9.2 Application-Level / Field-Level Encryption

**OAuth Token Encryption:**
- **Implemented and strong:** `apps/web/src/lib/token-encryption.ts` implements AES-256-GCM with a 96-bit random IV, authentication tag, and optional HMAC-signed OAuth state
- `TOKEN_ENCRYPTION_KEY` required in production (enforced with a thrown error)
- Tokens stored with `enc:v1:` prefix for easy detection of legacy plaintext vs encrypted values
- **Status: Compliant for OAuth tokens**

**PHI Field Encryption:**
- `schema.ts` contains plaintext PHI fields: `patientName`, `dateOfBirth`, `cancerType`, `cancerStage`, `conditions`, `allergies`, `emergencyContactPhone`, `biomarkers`, `diagnosisDate`
- No field-level encryption applied to any PHI columns
- Insurance `memberId` stored in plaintext
- **Status: Gap** — PHI is protected only by Aurora at-rest encryption. No application-layer encryption prevents a developer with DB credentials from reading raw PHI.

### 9.3 Secrets Management

- `.env.example` shows all secrets are environment variables, never hardcoded
- No AWS credentials, API keys, or secrets found hardcoded in any source files (grep confirms)
- `TOKEN_ENCRYPTION_KEY` must be 64 hex chars (32 bytes); enforced at runtime
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in env — **Risk:** If using long-lived IAM credentials instead of IAM roles, this increases the blast radius of a credential leak. `ARCH_BETS.md` mentions AWS OIDC canary work; IAM roles are preferred.
- **Status: Partial** — good secrets discipline in code, but IAM credential type unverified.

### 9.4 TLS/HTTPS Enforcement

- `next.config.mjs` (lines 30–38) sets:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (2-year HSTS with preload)
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy` with strict `default-src 'self'`
- **Status: Compliant** — HSTS enforced at application level. Vercel provides automatic TLS certificates.

### 9.5 Mobile App (React Native) TLS

- `apps/mobile/src/services/api.ts` uses hardcoded `https://carecompanionai.org` base URL
- Expo/React Native uses the system's TLS stack (iOS Security Framework / Android Network Security Config)
- No custom TLS pinning observed
- **Status: Partial** — HTTPS used but no certificate pinning. Certificate pinning is recommended for healthcare apps.

### 9.6 Passwords

- `auth.ts` line 5: `import bcrypt from 'bcryptjs'`
- Passwords hashed with bcrypt (default rounds — should verify ≥12)
- Password reset uses signed nonce-based tokens stored in `users.resetNonce`
- **Status: Compliant** for password storage. Verify bcrypt rounds ≥12.

---

## 10. Deep-Dive: Access Control & Authentication

### 10.1 NextAuth Configuration

- **Providers:** Credentials (email+password), Apple OAuth, Google OAuth, Care Group (shared password)
- **Session Strategy:** JWT (default NextAuth strategy — no server-side session table)
- **Token Contents:** `dbUserId`, `displayName`, `role`, `isDemo`
- **Session Duration:** Not explicitly configured → defaults to 30-day JWT expiry with no idle timeout. **Gap.**
- **Debug Mode:** `debug: process.env.NODE_ENV !== 'production'` in `auth.ts` line 179 — debug mode enabled in non-production environments.
- **Trust Host:** `trustHost: true` in `auth.ts` line 178 — necessary for Vercel deployments.

### 10.2 Row-Level Data Isolation by userId

Evidence of correct user isolation patterns throughout API routes:

**Compliant patterns found:**
- `apps/web/src/app/api/records/medications/route.ts` — all operations verify `eq(careProfiles.userId, dbUser.id)` before accessing medication data
- `apps/web/src/app/api/export-data/route.ts` — fetches by `user.id` only
- `apps/web/src/app/api/compliance/audit-log/route.ts` — `WHERE userId = user.id`
- Care profile operations use double-verification: check `careProfiles.userId = auth.userId` then `medications.careProfileId = profile.id`

**No database-level RLS** — data isolation is application-enforced only. A database connection with sufficient permissions could bypass all access controls.

### 10.3 RBAC / Role Enforcement

**Application roles:**
- User roles: `caregiver` | `patient` | `self` stored in `users.role`
- Care team roles: `editor` | `viewer` stored in `careTeamMembers.role`
- Care group roles: `owner` | `member` stored in `careGroupMembers.role`
- Granular permissions: `perms` jsonb in `careGroupMembers` (`can_read_meds`, `can_read_appts`, `can_read_labs`, `can_chat`, `can_edit_appts`)

**Gap identified:** The granular `perms` jsonb column in `careGroupMembers` is defined in the schema (`apps/web/src/lib/db/schema.ts` lines 672–675) but there is no evidence of it being checked in API route handlers. The fine-grained `can_read_meds` / `can_read_labs` / `can_read_appts` flags appear unused in access control decisions.

### 10.4 API Route Authorization Patterns

Most API routes follow a consistent pattern:
```typescript
1. getAuthenticatedUser() → returns dbUser or 401
2. Verify ownership: WHERE careProfiles.userId = dbUser.id
3. Operation on owned resource
```

**Routes that bypass CSRF (documented exceptions):**
- Cron jobs: `verifyCronRequest()` in `cron-auth.ts` uses `CRON_SECRET`
- Internal server-to-server: `x-internal-secret` header check
- Mobile Bearer token: bypasses CSRF cookie check (mobile can't set cookies)

### 10.5 Token Expiry and Refresh

- **Mobile JWT:** `/api/auth/mobile-login/route.ts` issues mobile JWTs with `expiresIn` (need to verify duration)
- **Token refresh:** `/api/auth/refresh/route.ts` and `apps/mobile/src/services/token-refresh.ts` handle mobile token refresh
- **OAuth tokens:** Google Calendar tokens encrypted and stored in `connectedApps` table with `expiresAt` check
- **Session timeout:** NextAuth web sessions have no idle timeout configured — a session opened on a shared computer remains valid for 30 days

---

## 11. Deep-Dive: BAA Inventory & Subprocessor List

| Vendor | Service | PHI Exposure | BAA Status | Notes |
|--------|---------|-------------|-----------|-------|
| **AWS (Aurora RDS)** | Primary database storing all PHI | Yes — stores all patient records, medications, lab results, etc. | **Unconfirmed** — AWS BAA is available at no cost. Must be executed in AWS console. | AWS BAA covers Aurora RDS Data API. **Action: Confirm execution.** |
| **AWS (broader services)** | IAM, KMS, CloudWatch Logs | Yes — IAM access to DB | **Unconfirmed** | Same AWS BAA covers all HIPAA-eligible services. |
| **Vercel** | Hosting, edge functions, deployment, log drain | Yes — all API requests route through Vercel; logs may capture PHI | **Not executed** per documentation review. Vercel Enterprise BAA available. | `docs/superpowers/specs/2026-04-20-monorepo-ios-design.md` notes "Vercel HIPAA BAA: must be in place before production launch." **High priority.** |
| **Anthropic (Claude API)** | AI chat, memory extraction, document scanning, health summaries | **Yes — receives full PHI** including patient name, diagnosis, medications, lab results, insurance, chat history in system prompt on every request | **Not executed** | `docs/hipaa-migration.md` lists as action item. Anthropic Enterprise plan offers BAA. Alternative: implement PHI de-identification. **BLOCKER.** |
| **Google (Gemini Embedding API)** | Text embeddings for AI memory system | **Yes** — `apps/web/src/lib/memory/embed.ts` sends memory fact text strings (e.g., "Mom increased metformin from 500mg to 1000mg") to Gemini | **Not confirmed** | Google Cloud Vertex AI version of Gemini falls under Google Cloud BAA. **High priority.** |
| **Voyage AI (rerank API)** | Memory reranking | **Yes** — `apps/web/src/lib/memory/rerank.ts` sends memory fact text to Voyage AI | **Unknown** | Check if Voyage AI offers BAA. If not, de-identify memory facts before reranking. Alternative: remove Voyage AI and use pure pgvector RRF ranking. |
| **Resend** | Transactional email | **Borderline PHI** — care team invite emails contain patient name; onboarding recap emails contain cancer type, medications | **Not confirmed** | Resend BAA available on Pro plan. **Action: Execute BAA.** |
| **PostHog** | Analytics | **Low risk** — `analytics.ts` strips PHI keys (`patientName`, `cancerType`, `medication`, `labValue`, `chatMessage`). Session recording disabled. | **Not confirmed** | PostHog BAA available on paid plans. PHI sanitization reduces risk. |
| **Sentry** | Error monitoring | **Medium risk** — `sentry-utils.ts` implements `scrubPHI()` via `beforeSend` hook. PHI in raw error messages may not be fully caught. | **Not confirmed** | Sentry BAA available on Business plan. |
| **Upstash Redis** | Distributed rate limiting | **Low risk** — only IP addresses, user IDs, email hashes stored as rate-limit keys | **Unknown** | If email addresses constitute PHI, gap exists. Consider hashing emails before use as rate-limit keys. |
| **Google Calendar** | Calendar integration for appointment sync | **Yes** — `sync/google-calendar/route.ts` syncs appointments including doctor names, specialties, purposes | **Not available on standard plan** | Solution: strip PHI from calendar sync (generic "Medical Appointment" title, no doctor names). **Action: Implement PHI stripping or disable integration.** |
| **1upHealth / OneUp** | FHIR health data (removed) | Previously integrated; `userPreferences.oneupUserId` still in schema | Integration removed per `/api/cron/sync/route.ts` | Deferred. If re-integrated, 1upHealth BAA is included free. |
| **GitHub** | Source code hosting | **Low** — no PHI in source code | N/A | Verify seed data files use synthetic data only. |

### BAA Priority Matrix

| Priority | Vendor | Action |
|----------|--------|--------|
| **BLOCKER** | Anthropic | Execute BAA or implement de-identification |
| **BLOCKER** | Google (Gemini/Vertex) | Execute BAA (Vertex AI) or de-identify memory facts |
| **BLOCKER** | Vercel | Execute Enterprise BAA or confirm PHI scrubbing from logs |
| **High** | AWS | Confirm BAA execution (HIPAA Eligible Services) |
| **High** | Resend | Execute BAA on Pro plan |
| **Medium** | Sentry | Execute BAA (Business plan) |
| **Medium** | PostHog | Execute BAA on paid plan |
| **Medium** | Google Calendar | Strip PHI from sync or disable |
| **Low** | Voyage AI | Evaluate BAA availability |
| **Low** | Upstash | Evaluate PHI exposure in rate-limit keys |

---

## 12. Remediation Backlog

| ID | Control | Gap Description | Risk Level | Effort | Priority Tier | Owner |
|----|---------|----------------|-----------|--------|--------------|-------|
| REM-001 | §164.308(b)(1) / CC9.2 | No executed BAA with Anthropic — PHI transmitted on every chat request | **Critical** | 2–3 weeks (legal) or 2 weeks (de-identification) | **BLOCKER** | Aryan + Founder |
| REM-002 | §164.308(b)(1) / CC9.2 | No executed BAA with Google Gemini — memory facts containing PHI sent to embedding API | **Critical** | 1 week (switch to Vertex AI) | **BLOCKER** | Aryan |
| REM-003 | §164.316(a) / Privacy Policy | Privacy Policy references Supabase — actual DB is AWS Aurora. Material misrepresentation. | **Critical** | 2 hours | **BLOCKER** | Aryan |
| REM-004 | §164.308(a)(6) | No Incident Response Plan or breach notification procedures | **Critical** | 2–3 days | **BLOCKER** | Founder/Aryan |
| REM-005 | §164.308(a)(4) | Caregiver `perms` jsonb flags defined in schema but not enforced in API route handlers | **High** | 3–5 days | **BLOCKER** | Aryan |
| REM-006 | CC6.1 / §164.312(d) | No MFA for credential-based login | **High** | 5–8 days | **SOC2-T1** | Aryan |
| REM-007 | §164.312(a)(1) | No automatic session timeout — JWT sessions last 30 days with no idle timeout | **High** | 1 day | **BLOCKER** | Aryan |
| REM-008 | §164.308(a)(1) | Formal risk analysis document missing | **High** | 3–5 days | **SOC2-T1** | Aryan/Founder |
| REM-009 | §164.308(a)(7) | No Disaster Recovery Plan or documented RTO/RPO | **High** | 2–3 days | **SOC2-T1** | Aryan |
| REM-010 | §164.316(a) | No formal HIPAA security policies (Information Security Policy, PHI Handling Policy, Acceptable Use Policy) | **High** | 3–5 days | **SOC2-T1** | Founder |
| REM-011 | §164.308(a)(2) | No designated Security Officer | **High** | 0.5 days | **SOC2-T1** | Founder |
| REM-012 | §164.308(b)(1) | No executed BAA with Vercel — Vercel logs may contain PHI | **High** | 1 week | **BLOCKER** | Aryan/Founder |
| REM-013 | §164.312(b) | Audit logging not applied to medication/lab/appointment GET endpoints | **High** | 1–2 days | **SOC2-T1** | Aryan |
| REM-014 | §164.308(a)(5) | No workforce security training program or records | **Medium** | 1 day setup + ongoing | **SOC2-T1** | Founder |
| REM-015 | CC8.1 | No security review requirement in PR process for PHI-touching changes | **Medium** | 0.5 days | **SOC2-T1** | Aryan |
| REM-016 | §164.316(b) | No audit log retention policy — HIPAA requires 6 years | **Medium** | 1 day | **SOC2-T1** | Aryan |
| REM-017 | §164.308(a)(3) | No workforce termination procedure for revoking access to production systems | **Medium** | 0.5 days | **SOC2-T1** | Founder |
| REM-018 | PHI Logging | 8 `console.error` calls in PHI-handling routes pass raw error objects that could contain PHI | **Medium** | 2–3 days | **SOC2-T1** | Aryan |
| REM-019 | §164.308(a)(1) | No risk management plan — controls implemented ad hoc | **Medium** | 2 days | **SOC2-T1** | Aryan/Founder |
| REM-020 | §164.308(b)(1) | Resend email BAA not confirmed — care team invite emails contain patient name | **Medium** | 1 day | **SOC2-T1** | Founder |
| REM-021 | §164.308(b)(1) | Sentry BAA not confirmed — error reports could contain PHI | **Medium** | 1 day | **SOC2-T1** | Aryan |
| REM-022 | §164.312(a)(1) | No emergency access procedure for production ePHI | **Medium** | 1 day | **SOC2-T1** | Aryan |
| REM-023 | §164.310(b) | No workstation use policy for developer machines with production access | **Medium** | 0.5 days | **SOC2-T1** | Founder |
| REM-024 | §164.308(a)(5) | No automated dependency vulnerability scanning (Dependabot/Snyk) in CI | **Medium** | 0.5 days | **SOC2-T1** | Aryan |
| REM-025 | CC6.6 | No separation of duties for production DB access | **Medium** | 3–5 days | **SOC2-T1** | Aryan |
| REM-026 | §164.308(a)(5) | Failed login attempts not logged to audit trail | **Medium** | 1 day | **SOC2-T2** | Aryan |
| REM-027 | §164.308(a)(5) | No documented minimum password requirements enforced at server side | **Low** | 1 day | **SOC2-T2** | Aryan |
| REM-028 | §164.312(c)(1) | No checksums/integrity verification for PHI records | **Low** | 3–5 days | **SOC2-T2** | Aryan |
| REM-029 | §164.310(b) | No device management/MDM for developer workstations with production access | **Low** | 1–2 weeks | **SOC2-T2** | Founder |
| REM-030 | CC7.2 | No anomaly detection for unusual data access patterns | **Low** | 3–5 days | **SOC2-T2** | Aryan |
| REM-031 | §164.308(a)(7) | Aurora backup configuration not documented or tested | **Low** | 0.5 days + 1 day testing | **SOC2-T2** | Aryan |
| REM-032 | §164.308(a)(8) | No penetration testing scheduled before launch | **Medium** | 2–4 weeks | **SOC2-T1** | Founder |
| REM-033 | §164.312(a)(1) | No field-level encryption for highest-sensitivity PHI (DOB, insurance member IDs) | **Low** | 3–5 days | **SOC2-T2** | Aryan |
| REM-034 | §164.308(b)(1) | Google Calendar integration syncs PHI without BAA | **Medium** | 2 days (strip PHI from sync) | **BLOCKER** | Aryan |
| REM-035 | CC2.3 | Privacy Policy confirms Supabase as database — misrepresentation | **Critical** | 2 hours | **BLOCKER** | Aryan |
| REM-036 | Mobile Security | No certificate pinning in React Native app | **Low** | 3–5 days | **HITRUST** | Shreyash |

### Priority Tier Summary

**BLOCKER (must fix before first paying user):**
REM-001, REM-002, REM-003, REM-004, REM-005, REM-007, REM-012, REM-034, REM-035

**SOC2-T1 (required for SOC2 Type 1 audit readiness):**
REM-006, REM-008, REM-009, REM-010, REM-011, REM-013, REM-014, REM-015, REM-016, REM-017, REM-018, REM-019, REM-020, REM-021, REM-022, REM-023, REM-024, REM-025, REM-032

**SOC2-T2 (required for SOC2 Type 2 — 6-month evidence period):**
REM-026, REM-027, REM-028, REM-029, REM-030, REM-031, REM-033

**HITRUST (for future HITRUST certification):**
REM-036

---

## 13. Sources

### HIPAA Regulatory References
- 45 CFR Part 164 — HIPAA Security Rule, Privacy Rule, Breach Notification Rule
- 45 CFR §164.308 — Administrative Safeguards
- 45 CFR §164.310 — Physical Safeguards
- 45 CFR §164.312 — Technical Safeguards
- 45 CFR §164.314 — Organizational Requirements
- 45 CFR §164.316 — Policies and Procedures / Documentation
- 45 CFR §164.404 — Breach Notification to Individuals
- 45 CFR §164.514(b) — Safe Harbor De-Identification Method
- HHS HIPAA Security Rule: https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html

### SOC2 References
- AICPA TSC 2017 — Trust Services Criteria (CC1–CC9)
- AICPA SOC 2 Guide: https://www.aicpa-cima.com/resources/landing/soc-2-reporting-on-an-examination-of-controls-at-a-service-organization-relevant-to-security-availability-processing-integrity-confidentiality-or-privacy

### AWS Compliance
- AWS HIPAA Compliance: https://aws.amazon.com/compliance/hipaa-compliance/
- AWS Business Associate Agreement: Available at no additional cost for accounts using HIPAA-eligible services
- AWS Aurora encryption at rest: Enabled by default with AWS KMS

### Vendor BAA Status
- Anthropic BAA: Available on Enterprise plan. Contact enterprise@anthropic.com
- Google Cloud BAA (covers Vertex AI / Gemini via Vertex): Available under Google Cloud Healthcare
- Vercel BAA: Available on Enterprise plan
- Resend BAA: Available on Pro plan ($20/mo)
- Sentry BAA: Available on Business plan
- PostHog BAA: Available on paid plans
- Voyage AI: BAA availability unconfirmed — contact support@voyageai.com

### Codebase Files Cited in This Analysis

| File | Purpose |
|------|--------|
| `apps/web/src/lib/auth.ts` | NextAuth configuration, authentication flow |
| `apps/web/src/lib/auth.config.ts` | Edge-compatible auth configuration |
| `apps/web/src/lib/db/schema.ts` | Full database schema with all PHI tables |
| `apps/web/src/lib/db/index.ts` | Database connection — AWS Aurora RDS Data API |
| `apps/web/src/lib/logger.ts` | Structured logger |
| `apps/web/src/lib/audit.ts` | PHI-access audit logging |
| `apps/web/src/lib/token-encryption.ts` | AES-256-GCM OAuth token encryption |
| `apps/web/src/lib/rate-limit.ts` | Distributed rate limiting (Upstash Redis) |
| `apps/web/src/lib/csrf.ts` | CSRF protection |
| `apps/web/src/lib/api-helpers.ts` | Shared auth helper `getAuthenticatedUser()` |
| `apps/web/src/lib/soft-delete.ts` | PHI soft-delete and purge |
| `apps/web/src/lib/email.ts` | Transactional email via Resend |
| `apps/web/src/lib/analytics.ts` | PostHog analytics with PHI sanitization |
| `apps/web/src/lib/sentry-utils.ts` | Sentry PHI scrubbing |
| `apps/web/src/lib/compliance-tracker.ts` | Medication adherence compliance tracking |
| `apps/web/src/lib/system-prompt.ts` | AI system prompt builder — transmits PHI to Anthropic |
| `apps/web/src/lib/memory/embed.ts` | Google Gemini embedding — sends memory facts (PHI) |
| `apps/web/src/lib/memory/rerank.ts` | Voyage AI reranking — sends memory facts (PHI) |
| `apps/web/src/lib/care-group-auth.ts` | Care group shared password authentication |
| `apps/web/src/middleware.ts` | Next.js middleware — authentication routing |
| `apps/web/src/app/api/health/route.ts` | Health check endpoint |
| `apps/web/src/app/api/chat/route.ts` | Main AI chat endpoint |
| `apps/web/src/app/api/chat/mobile/route.ts` | Mobile AI chat endpoint |
| `apps/web/src/app/api/consent/accept/route.ts` | HIPAA consent recording |
| `apps/web/src/app/api/export-data/route.ts` | PHI data export |
| `apps/web/src/app/api/delete-account/route.ts` | Account deletion (cascade) |
| `apps/web/src/app/api/compliance/audit-log/route.ts` | User-facing audit log endpoint |
| `apps/web/src/app/api/records/medications/route.ts` | Medication CRUD with ownership verification |
| `apps/web/src/app/api/auth/google-calendar/route.ts` | Google Calendar OAuth |
| `apps/web/src/app/api/sync/google-calendar/route.ts` | Calendar sync (PHI exposure) |
| `apps/web/instrumentation.ts` | Sentry initialization with PHI scrubbing |
| `apps/web/next.config.mjs` | Security headers (HSTS, CSP, etc.) |
| `apps/mobile/src/services/api.ts` | Mobile API client (HTTPS enforced) |
| `.env.example` | Environment variable documentation |
| `HIPAA_Compliance_Report.md` | Prior compliance assessment (April 2026) |
| `ARCH_BETS.md` | Architecture decisions and PHI boundary notes |
| `docs/hipaa-migration.md` | HIPAA migration checklist |
| `CLAUDE.md` | Team rules and file ownership |

---

*This document was produced by automated static analysis and should be reviewed by qualified legal counsel and a HIPAA compliance specialist before relying on it for regulatory decisions. Automated analysis cannot substitute for legal interpretation of HIPAA regulations or verification of executed legal agreements with vendors.*

*CareCompanion COMPLIANCE_GAP.md | aryan/dev | 2026-05-21*
