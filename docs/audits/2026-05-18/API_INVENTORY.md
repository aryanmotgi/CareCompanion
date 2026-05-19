# API Endpoint Inventory — Auth & Rate-Limit Coverage Map

**Generated:** 2026-05-19  
**Branch:** aryan/dev  
**Scope:** `apps/web/src/app/api/`

---

## Summary

| Metric | Count | % |
|--------|-------|---|
| Total route files | 138 | — |
| Intentionally public (PUBLIC_PATHS) | 27 | 20% |
| Handler-level auth (getAuthenticatedUser / auth / bearerToken) | 104 | 75% |
| Auth via middleware only (no handler check) | 7 | 5% |
| Rate-limited routes | 42 | 30% |
| Routes with Zod validation | 32 | 23% |
| Routes with PHI risk HIGH | 54 | 39% |
| Routes with PHI risk MED | 47 | 34% |

**Global middleware**: `apps/web/src/middleware.ts` — NextAuth session gate covering all non-PUBLIC_PATHS for browser sessions. Bearer token requests (`Authorization: Bearer <jwt>`) bypass the middleware entirely and rely on `getAuthenticatedUser()` in the handler.

---

## Full Matrix

> Columns: **Auth** = handler-level check; **RL** = rate limited; **Val** = input validation; **PHI** = PHI/PII risk level.  
> AUTH values: `getAuthedUser`, `auth()`, `bearerToken`, `PUBLIC`.

| Route | Methods | Auth | RL | Val | PHI |
|-------|---------|------|----|-----|-----|
| /api/account/change-password | POST | getAuthedUser | ✅ | MANUAL | LOW |
| /api/admin/provision-demo | POST | bearerToken | ❌ | MANUAL | HIGH |
| /api/admin/provision-reviewer | POST | bearerToken | ❌ | MANUAL | HIGH |
| /api/auth/[...nextauth] | GET, POST | NextAuth | ❌ | NONE | LOW |
| /api/auth/cognito-logout | GET | PUBLIC | ❌ | NONE | LOW |
| /api/auth/google-calendar/callback | GET | getAuthedUser | ❌ | MANUAL | LOW |
| /api/auth/google-calendar | GET | getAuthedUser | ❌ | NONE | LOW |
| /api/auth/mobile-care-group-login | POST | PUBLIC | ✅ | MANUAL | LOW |
| /api/auth/mobile-login | POST | PUBLIC | ✅ | MANUAL | LOW |
| /api/auth/refresh | POST | PUBLIC | ❌ | NONE | LOW |
| /api/auth/register | POST | PUBLIC | ✅ | ZOD | LOW |
| /api/auth/reset-password | POST | PUBLIC | ✅ | MANUAL | LOW |
| /api/auth/reset-password/confirm | POST | PUBLIC | ❌ | MANUAL | LOW |
| /api/auth/set-password | POST | auth() | ❌ | ZOD | LOW |
| /api/auth/set-role | POST | auth() | ❌ | MANUAL | LOW |
| /api/auth/social | POST | PUBLIC | ❌ | MANUAL | LOW |
| /api/care-group/[id]/status | GET | auth() | ❌ | NONE | MED |
| /api/care-group/code | GET, POST | auth() | ❌ | MANUAL | MED |
| /api/care-group/code/revoke | POST | auth() | ❌ | MANUAL | MED |
| /api/care-group/code/rotate | POST | auth() | ❌ | MANUAL | MED |
| /api/care-group/invite | POST | auth() | ❌ | MANUAL | MED |
| /api/care-group/invite/revoke | POST | auth() | ❌ | MANUAL | MED |
| /api/care-group/join | POST | auth() | ❌ | MANUAL | MED |
| /api/care-group/join-by-code | POST | auth() | ✅ | MANUAL | MED |
| /api/care-group/member/relationship | POST | auth() | ❌ | MANUAL | MED |
| /api/care-group/mine | GET | auth() | ❌ | NONE | MED |
| /api/care-group/request-join | GET, POST | auth() | ✅ | MANUAL | MED |
| /api/care-group/request-join/[id]/approve | POST | auth() | ❌ | MANUAL | MED |
| /api/care-group/request-join/[id]/deny | POST | auth() | ❌ | MANUAL | MED |
| /api/care-group/request-join/mine | GET | auth() | ❌ | NONE | MED |
| /api/care-group | POST | auth() | ❌ | MANUAL | MED |
| /api/care-hub | GET | getAuthedUser | ❌ | NONE | HIGH |
| /api/care-hub/remind | POST | getAuthedUser | ❌ | MANUAL | MED |
| /api/care-profiles | POST | auth() | ❌ | NONE | HIGH |
| /api/care-profiles/[id] | GET, PATCH | auth() | ❌ | MANUAL | HIGH |
| /api/care-team | GET | getAuthedUser | ❌ | NONE | MED |
| /api/care-team/accept | POST | getAuthedUser | ✅ | ZOD | MED |
| /api/care-team/invite | POST | getAuthedUser | ✅ | ZOD | MED |
| /api/care-team/invite/[id] | DELETE | getAuthedUser | ❌ | NONE | MED |
| /api/care-team/remove | POST | getAuthedUser | ✅ | ZOD | MED |
| /api/caregiver/burnout | GET | getAuthedUser | ✅ | NONE | MED |
| /api/chat | POST | getAuthedUser | ✅ | NONE | HIGH |
| /api/chat/guest | POST | PUBLIC | ✅ | MANUAL | LOW |
| /api/chat/history | GET, DELETE | getAuthedUser | ❌ | NONE | MED |
| /api/chat/mobile | POST | getAuthedUser | ✅ | NONE | MED |
| /api/chat/search | GET | getAuthedUser | ❌ | NONE | MED |
| /api/checkins | GET, POST | getAuthedUser | ❌ | ZOD | MED |
| /api/checkins/share | POST | getAuthedUser | ❌ | MANUAL | MED |
| /api/checkins/voice-extract | POST | getAuthedUser | ❌ | MANUAL | MED |
| /api/community | GET, POST | getAuthedUser | ✅ | ZOD | LOW |
| /api/community/[id] | GET, POST, DELETE | getAuthedUser | ✅ | ZOD | LOW |
| /api/community/[id]/upvote | POST | getAuthedUser | ✅ | ZOD | LOW |
| /api/compliance/audit-log | GET | getAuthedUser | ❌ | NONE | LOW |
| /api/compliance/calendar | GET | getAuthedUser | ❌ | NONE | MED |
| /api/compliance/report | GET | getAuthedUser | ❌ | NONE | MED |
| /api/consent/accept | POST | auth() | ❌ | MANUAL | LOW |
| /api/conversations | GET, POST | getAuthedUser | ❌ | NONE | MED |
| /api/conversations/[id] | GET, DELETE, PATCH | getAuthedUser | ❌ | NONE | MED |
| /api/cron/memory-decay | POST | bearerToken (CRON_SECRET) | ❌ | NONE | LOW |
| /api/cron/memory-eval | POST | bearerToken (CRON_SECRET) | ❌ | NONE | LOW |
| /api/cron/purge | POST | bearerToken (CRON_SECRET) | ❌ | NONE | LOW |
| /api/cron/radar | POST | bearerToken (CRON_SECRET) | ❌ | NONE | MED |
| /api/cron/retention | POST | bearerToken (CRON_SECRET) | ❌ | NONE | LOW |
| /api/cron/sync | POST | bearerToken (CRON_SECRET) | ❌ | NONE | LOW |
| /api/cron/trials-match | POST | bearerToken (CRON_SECRET) | ❌ | NONE | HIGH |
| /api/cron/trials-status | POST | bearerToken (CRON_SECRET) | ❌ | NONE | LOW |
| /api/cron/weekly-summary | POST | bearerToken (CRON_SECRET) | ❌ | NONE | MED |
| /api/csrf-token | GET | PUBLIC | ❌ | NONE | LOW |
| /api/cycles | GET, POST | getAuthedUser | ✅ | ZOD | HIGH |
| /api/cycles/[id] | DELETE, PATCH | getAuthedUser | ✅ | ZOD | HIGH |
| /api/cycles/current | GET | getAuthedUser | ❌ | NONE | HIGH |
| /api/delete-account | POST | getAuthedUser | ✅ | MANUAL | LOW |
| /api/demo/start | POST | PUBLIC | ✅ | NONE | HIGH |
| /api/documents/[id] | DELETE | getAuthedUser | ❌ | MANUAL | HIGH |
| /api/documents/extract | POST | getAuthedUser | ✅ | MANUAL | HIGH |
| /api/e2e/signin | GET, POST | bearerToken (E2E_AUTH_SECRET) | ✅ | MANUAL | LOW |
| /api/export-data | GET | getAuthedUser | ✅ | NONE | HIGH |
| /api/export/csv | GET | getAuthedUser | ✅ | MANUAL | HIGH |
| /api/export/pdf | GET | getAuthedUser | ✅ | NONE | HIGH |
| /api/extract-medications | POST | getAuthedUser | ✅ | MANUAL | HIGH |
| /api/feedback | POST | PUBLIC | ✅ | MANUAL | LOW |
| /api/health | GET | PUBLIC | ❌ | NONE | LOW |
| /api/health-summary | GET | getAuthedUser | ❌ | NONE | HIGH |
| /api/health-summary/cache | POST | getAuthedUser | ❌ | NONE | HIGH |
| /api/healthkit/replace | POST | getAuthedUser | ❌ | MANUAL | HIGH |
| /api/healthkit/sync | POST | getAuthedUser | ❌ | MANUAL | HIGH |
| /api/import-data | POST | getAuthedUser | ✅ | MANUAL | HIGH |
| /api/import-medications | POST | getAuthedUser | ❌ | MANUAL | HIGH |
| /api/insurance/appeal | POST | getAuthedUser | ✅ | ZOD | MED |
| /api/integrations/[source] | POST, DELETE | getAuthedUser | ❌ | MANUAL | LOW |
| /api/interactions/check | POST | getAuthedUser | ✅ | MANUAL | HIGH |
| /api/journal | GET, POST | getAuthedUser | ✅ | ZOD | MED |
| /api/labs/trends | GET | getAuthedUser | ❌ | NONE | HIGH |
| /api/me | GET | getAuthedUser | ❌ | NONE | LOW |
| /api/notifications/[id] | POST | getAuthedUser | ❌ | MANUAL | MED |
| /api/notifications/generate | POST | PUBLIC | ✅ | MANUAL | MED |
| /api/notifications/preferences | GET, POST | getAuthedUser | ❌ | ZOD | LOW |
| /api/notifications/read | POST | getAuthedUser | ❌ | MANUAL | MED |
| /api/onboarding/complete | POST | getAuthedUser | ❌ | ZOD | LOW |
| /api/prep | GET | getAuthedUser | ❌ | NONE | HIGH |
| /api/profile-switch | POST | getAuthedUser | ❌ | NONE | HIGH |
| /api/push/subscribe | POST | getAuthedUser | ❌ | ZOD | LOW |
| /api/records/appointments | GET, POST | getAuthedUser | ❌ | ZOD | HIGH |
| /api/records/doctors | GET, POST | getAuthedUser | ❌ | ZOD | HIGH |
| /api/records/labs | GET | getAuthedUser | ❌ | NONE | HIGH |
| /api/records/medication-observations | GET, POST | getAuthedUser | ❌ | ZOD | HIGH |
| /api/records/medications | GET, POST | getAuthedUser | ❌ | ZOD | HIGH |
| /api/records/profile | GET, PATCH | getAuthedUser | ❌ | NONE | HIGH |
| /api/records/restore | POST | getAuthedUser | ❌ | MANUAL | HIGH |
| /api/records/settings | GET, PATCH | getAuthedUser | ❌ | ZOD | MED |
| /api/refills/status | GET | getAuthedUser | ❌ | NONE | HIGH |
| /api/reminders | GET, POST | getAuthedUser | ✅ | ZOD | MED |
| /api/reminders/check | GET | PUBLIC | ❌ | NONE | HIGH |
| /api/reminders/respond | POST | PUBLIC | ✅ | MANUAL | MED |
| /api/save-scan-results | POST | getAuthedUser | ✅ | MANUAL | HIGH |
| /api/scan-document | POST | getAuthedUser | ✅ | MANUAL | HIGH |
| /api/search | GET | getAuthedUser | ❌ | NONE | HIGH |
| /api/seed-demo | POST | bearerToken | ❌ | NONE | HIGH |
| /api/share | GET, POST | getAuthedUser | ❌ | MANUAL | MED |
| /api/share/[token] | GET | PUBLIC | ❌ | NONE | MED |
| /api/share/[token]/revoke | POST | PUBLIC | ❌ | MANUAL | MED |
| /api/share/weekly | GET | PUBLIC | ❌ | NONE | MED |
| /api/sync/google-calendar | POST | bearerToken | ❌ | MANUAL | MED |
| /api/sync/status | GET | getAuthedUser | ❌ | NONE | MED |
| /api/test/reset | POST | bearerToken | ❌ | NONE | LOW |
| /api/timeline | GET | getAuthedUser | ❌ | NONE | HIGH |
| /api/triage | POST | getAuthedUser | ✅ | ZOD | HIGH |
| /api/trials/[nctId] | GET | getAuthedUser | ❌ | NONE | LOW |
| /api/trials/[nctId]/detail | GET | getAuthedUser | ❌ | NONE | LOW |
| /api/trials/match | POST | getAuthedUser | ✅ | MANUAL | HIGH |
| /api/trials/matches | GET | getAuthedUser | ❌ | NONE | HIGH |
| /api/trials/save | POST | getAuthedUser | ❌ | MANUAL | LOW |
| /api/trials/saved | GET | getAuthedUser | ❌ | NONE | LOW |
| /api/trials/saved/[nctId] | DELETE | getAuthedUser | ❌ | NONE | LOW |
| /api/upload/allergies | POST | getAuthedUser | ✅ | MANUAL | HIGH |
| /api/upload/insurance | POST | getAuthedUser | ✅ | MANUAL | MED |
| /api/visit-prep | GET | getAuthedUser | ❌ | NONE | HIGH |
| /api/welcome-email | POST | PUBLIC | ✅ | MANUAL | LOW |

---

## Intentionally Public Routes

Routes that are expected to be reachable without a session (listed in `middleware.ts` PUBLIC_PATHS, or internally gated by a non-session secret):

| Route | Justification | Internal Gate |
|-------|--------------|---------------|
| /api/auth/* | Auth flows (NextAuth, Cognito, registration, OAuth) | — |
| /api/chat/guest | Guest/anonymous AI chat | Rate limit |
| /api/health | Healthcheck endpoint | CRON_SECRET gates detail |
| /api/demo/start | Demo session bootstrap | Rate limit |
| /api/feedback | Bug/feedback submissions | Rate limit |
| /api/share/* | Token-based shared views | Token in URL |
| /api/cron/* | Scheduled jobs | CRON_SECRET |
| /api/notifications/generate | Notification cron | Rate limit |
| /api/reminders/check | Reminder cron | ⚠️ No internal gate — see Critical Findings |
| /api/e2e/signin | E2E smoke tests | E2E_AUTH_SECRET |
| /api/test/reset | Test data reset | env + isDemo guard |

---

## Critical Findings

### 🔴 P0 — Fix Immediately

**1. `/api/reminders/check` — PUBLIC + No rate limit + PHI HIGH**  
Listed in `PUBLIC_PATHS` as a cron endpoint but has no internal CRON_SECRET check and no rate limiting. Any unauthenticated party can repeatedly hit this endpoint, triggering reminder processing over patient data. Every other cron route uses `verifyCronRequest()` / CRON_SECRET. This one doesn't.  
→ **Fix**: Add `verifyCronRequest()` / CRON_SECRET check identical to the other `/api/cron/*` routes.

**2. `/api/reminders/respond` — Handler PUBLIC, NOT in PUBLIC_PATHS (Bearer bypass)**  
The middleware lets through any request with `Authorization: Bearer <anything>`, relying on the handler to verify the token. This handler has no auth check. A mobile client (or attacker) can call this endpoint with an arbitrary Bearer token and receive a 2xx response.  
→ **Fix**: Add `getAuthenticatedUser()` auth check, or add to PUBLIC_PATHS with a signed-token parameter in the body (for SMS-link flows).

**3. `/api/welcome-email` — Handler PUBLIC, NOT in PUBLIC_PATHS (Bearer bypass)**  
Same Bearer-bypass issue: no session required and no handler auth check. Allows unauthenticated triggering of emails to arbitrary users (potential spam/phishing vector). Rate-limited, which blunts bulk abuse, but a determined caller can still send emails.  
→ **Fix**: Add `getAuthenticatedUser()` check, or move to a server-action/cron pattern.

---

### 🟠 P1 — High Priority

**4. `/api/auth/refresh` — No rate limit on token refresh**  
Sits under `/api/auth` (PUBLIC_PATHS). No rate limiting. Token refresh endpoints are brute-force targets.  
→ **Fix**: Add rate limit (suggest ≤5 req/min per IP).

**5. `/api/auth/reset-password/confirm` — No rate limit on OTP/reset-token confirmation**  
Public endpoint for confirming password reset tokens. No rate limit makes OTP brute force feasible.  
→ **Fix**: Add rate limit (≤3 req/min per IP).

**6. `/api/auth/social` — No rate limit on social auth**  
Public social-login trigger with no rate limiting.  
→ **Fix**: Add rate limit consistent with other auth endpoints.

**7. Expensive AI routes without rate limiting — PHI HIGH**  
The following routes perform AI inference or large data aggregation over patient PHI but have no rate limit:

| Route | Risk |
|-------|------|
| /api/health-summary | Full AI health summary (expensive + PHI) |
| /api/health-summary/cache | Cache write for health summary |
| /api/prep | AI appointment prep |
| /api/visit-prep | Visit prep generation |
| /api/search | Full-text search across patient records |
| /api/labs/trends | Lab trend analysis |
| /api/import-medications | Bulk medication import (large payload) |
| /api/healthkit/sync | HealthKit bulk sync |
| /api/healthkit/replace | HealthKit bulk replace |
| /api/timeline | Full timeline aggregation |
| /api/caregiver/burnout | Burnout analysis |

→ **Fix**: Apply rate limiter (suggest ≤10–30 req/min per user depending on cost).

**8. `/api/share/[token]/revoke` — PUBLIC, no auth**  
Anyone knowing a share token can revoke it, including malicious third parties trying to disrupt care sharing. The middleware's `PUBLIC_PATHS` covers `/api/share`, allowing unauthenticated revocation.  
→ **Fix**: Require auth at handler level; only the share creator or group admin should revoke.

---

### 🟡 P2 — Medium Priority

**9. Admin routes missing rate limiting**  
`/api/admin/provision-demo` and `/api/admin/provision-reviewer` use bearer token auth but no rate limit. A leaked admin token could provision unlimited demo/reviewer accounts.  
→ **Fix**: Add rate limit (≤10 req/min).

**10. `/api/seed-demo` — bearerToken, no rate limit, PHI HIGH**  
Seeding demo data creates realistic PHI. No rate limit against bearer token abuse.  
→ **Fix**: Add rate limit + ensure DEMO_SEED_SECRET is rotated regularly.

**11. Routes using `auth()` instead of `getAuthenticatedUser()` — mobile gap**  
The following routes use NextAuth `auth()` which does not verify mobile JWT Bearer tokens. Mobile clients sending a Bearer token bypass the middleware but hit null session — effectively locked out:

`/api/care-group/*`, `/api/care-profiles/*`, `/api/auth/set-password`, `/api/auth/set-role`, `/api/consent/accept`

→ **Verify**: Confirm these routes are intentionally web-only. If mobile clients need them, migrate to `getAuthenticatedUser()`.

**12. Missing Zod validation on PHI write endpoints**  
High-PHI write routes with only MANUAL (typeof/truthy) validation:

| Route | Methods |
|-------|---------|
| /api/care-profiles/[id] | PATCH |
| /api/care-hub/remind | POST |
| /api/chat | POST |
| /api/checkins/voice-extract | POST |
| /api/records/restore | POST |
| /api/healthkit/sync | POST |
| /api/healthkit/replace | POST |
| /api/import-medications | POST |
| /api/trials/match | POST |

→ **Fix**: Add Zod schemas to ensure structural integrity and prevent prototype pollution / injection via malformed payloads.

---

## Recommended Priorities

| Priority | Action | Routes |
|----------|--------|--------|
| P0 | Add CRON_SECRET check | /api/reminders/check |
| P0 | Add getAuthenticatedUser() | /api/reminders/respond, /api/welcome-email |
| P1 | Add rate limiting to auth endpoints | /api/auth/refresh, /api/auth/reset-password/confirm, /api/auth/social |
| P1 | Add rate limiting to expensive AI/data routes | 11 routes (see list above) |
| P1 | Restrict share revoke to authenticated owner | /api/share/[token]/revoke |
| P2 | Add rate limiting to admin routes | /api/admin/provision-demo, /api/admin/provision-reviewer |
| P2 | Audit mobile vs web auth gap (auth() vs getAuthenticatedUser()) | care-group/*, care-profiles/* |
| P2 | Replace MANUAL validation with Zod on PHI write routes | 9 routes (see list above) |
