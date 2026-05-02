# Authentication — End-to-End Audit

**Audited:** 2026-05-02 | Branch: preview/trials-impeccable  
**Last updated:** 2026-05-02 — consent userId fix, open-redirect fix, set-role session update confirmed  
**Stack:** NextAuth v5 (Auth.js), Credentials + Apple + Google providers, JWT sessions, Aurora Serverless

---

## Architecture Summary

```
Browser                Middleware (Edge)           App Layout (Node)       API Routes (Node)
  │                         │                           │                       │
  │ → /dashboard            │                           │                       │
  │                    auth(req) checks JWT             │                       │
  │                    no session → /login              │                       │
  │                    session, no role → /set-role     │                       │
  │                         │                           │                       │
  │                    passes through                   │                       │
  │                         │              checks hipaaConsent                  │
  │                         │              no consent → /consent               │
  │                         │              no profile → /onboarding            │
  │                         │                           │                       │
  │                         │                      renders page                │
  │ ← page HTML ────────────┴───────────────────────────┘                       │
```

**Two auth layers:**
1. **Middleware** (`middleware.ts`) — Edge runtime, reads JWT cookie, checks session + role
2. **App Layout** (`(app)/layout.tsx`) — Node runtime, DB queries, checks HIPAA consent + onboarding completion

---

## Flows

### 1. Signup (Email/Password)

**Pages:** `/signup` → `/onboarding`

**Frontend:** `SignupForm.tsx`
- Collects: displayName, email, password, confirmPassword, role, HIPAA consent checkbox
- Client-side validation: password ≥ 8 chars, passwords match, role selected, consent checked
- Uses `registerSchema` from `@carecompanion/utils` for Zod validation before fetch

**API:** `POST /api/auth/register`
- Rate limit: 5 requests/hour per IP (x-forwarded-for)
- Validates with `registerSchema`
- Normalizes email (trim + lowercase)
- bcrypt hash cost 12
- Creates user row with `hipaaConsent: true` if checkbox was checked
- Returns `{ id }` 201 or error

**Auto-login after register:** SignupForm calls `signIn('credentials', { redirect: false })` after successful register, then navigates to `/onboarding`.

**Happy path:** signup → register → auto-login → `/onboarding`

**Edge cases:**
- Email already exists → 409 → "This email already has an account"
- Rate limit exceeded → 429 → "Too many registration attempts"
- Register succeeds but auto-login fails → user sees "Account created but sign-in failed. Please log in manually."
- `joinGroup` + `joinToken` params → after login, navigates to `/join?group=…&token=…` instead of `/onboarding`

---

### 2. Login (Email/Password)

**Pages:** `/login`

**Frontend:** `LoginForm.tsx`
- Two tabs: Email | Care Group
- Email tab: social buttons (Apple, Google) + email/password form
- Care Group tab: groupName + groupPassword

**API flow:** `signIn('credentials', { redirect: false })` → NextAuth `authorize()` in `auth.ts`
- Rate limit: 50 attempts/15 min per email (memory-based)
- Looks up user by email, verifies bcrypt hash
- Returns null on any failure (no distinguishing rate-limit vs wrong password)
- On success: redirects to `callbackUrl` (validated: must start with `/` and not `//`) or `/dashboard`

**Care Group login:** `signIn('care-group', { redirect: false })` → second Credentials provider
- Finds care group by name, verifies bcrypt password hash
- Signs in as the group owner's user account

**Security notes:**
- Rate limit returns null (same as wrong password) — no leaking of lockout state
- `callbackUrl` validated against open redirect: must start `/` and not `//`

---

### 3. Google / Apple OAuth

**Frontend:** `LoginForm.tsx` → `signIn('google', { callbackUrl })` / `signIn('apple', { callbackUrl })`

**Flow:**
1. User clicks button → NextAuth redirects to provider
2. Provider redirects back to `/api/auth/callback/[provider]`
3. NextAuth `jwt` callback: looks up user by email, creates if not found
4. If new user has no role → middleware redirects to `/set-role`
5. User selects role → `/onboarding`

**DB interaction (jwt callback in `auth.ts`):**
- Finds or creates user row by email (normalized lowercase)
- Reads `role` from DB → puts on JWT token
- New social users start with `role: null` → funneled to `/set-role`

**Apple email note:** Apple may not return email on repeat sign-ins. The `social/route.ts` mobile API handles this with `providedEmail` fallback. The web NextAuth flow requires email — if Apple doesn't provide it, sign-in throws `'No email provided by social provider'`.

**`pending_role` cookie (dead code on web):** `auth.ts` signIn callback checks for a `pending_role` cookie to pre-assign role on new social users. This cookie is never set by any web UI — it's dead code on web (may be intended for a future role-selection-before-OAuth flow). New social users always land on `/set-role`.

---

### 4. Role Selection

**Page:** `/set-role`

**Frontend:** `set-role/page.tsx` ('use client')
- Role options: caregiver / patient / self
- On save: POST to `/api/auth/set-role`, then `useSession().update()` to refresh JWT cookie
- **Critically:** `update()` must succeed before navigation — failure shows error and stays on page (prevents redirect loop)

**API:** `POST /api/auth/set-role`
- Requires session (401 if no auth)
- Validates role enum: `['caregiver', 'patient', 'self']`
- Updates `users.role` in DB

**JWT refresh:** After DB write, `useSession().update()` triggers jwt callback with `trigger: 'update'`, which re-reads role from DB and rewrites the session cookie. Navigation to `/onboarding` only happens after confirmed update.

**Middleware guard:** `/set-role` is excluded from the no-role redirect (`!pathname.startsWith('/set-role')`), preventing a redirect loop for users landing on the page.

---

### 5. HIPAA Consent

**Page:** `/consent`

**Trigger:** `(app)/layout.tsx` — if `users.hipaaConsent` is false/null, redirects to `/consent`.

**Frontend:** `consent/page.tsx` ('use client')
- Checkbox required to proceed
- Analytics events: `consent_shown`, `consent_accepted`, `consent_declined`
- On accept: reads CSRF token from cookie, POSTs to `/api/consent/accept`
- On decline: `signOut()` and redirect to `/login`

**API:** `POST /api/consent/accept`
- CSRF validated via `validateCsrf(req)`
- Requires session (401 if no auth)
- Updates by `users.id` (not email — safe for Apple users where email may be null)
- Sets `hipaaConsent: true`, `hipaaConsentAt: new Date()`, `hipaaConsentVersion: '1.0'`
- Redirects to `/dashboard` after success

**Consent bypass during registration:** `SignupForm` sends `hipaaConsent: true` in the register request. Users who check the box at signup have `hipaaConsent` set on account creation — they skip the `/consent` page entirely.

**Version tracking:** `CONSENT_VERSION = '1.0'` stored in DB. If the version constant is bumped, all existing users with `hipaaConsentVersion !== '1.0'` would be re-gated (if the layout check is updated to compare versions).

---

### 6. Password Reset

**Pages:** `/reset-password` → email → `/reset-password/confirm?token=…`

**Request flow:**
1. `ResetRequestForm.tsx` → `POST /api/auth/reset-password`
2. Rate limit: 3 requests/hour per email
3. Looks up user — if not found, returns same 200 response (no email enumeration)
4. Generates `crypto.randomUUID()` nonce, stores in `users.resetNonce`
5. Signs JWT: `{ email, nonce }`, 1-hour expiry, signed with `AUTH_SECRET`
6. Sends email via Resend with reset link containing token

**Confirm flow:**
1. `ResetConfirmForm.tsx` reads `?token` from URL (via `useSearchParams`)
2. `POST /api/auth/reset-password/confirm`
3. `jwtVerify` validates signature + expiry
4. Looks up user by `payload.email`, verifies `resetNonce === payload.nonce` (single-use)
5. Hashes new password (bcrypt 12), updates `passwordHash`, clears `resetNonce: null`

**Security properties:**
- Single-use: nonce cleared on use; replaying the token returns "already used"
- Expiry: 1-hour JWT expiry enforced by `jose`
- Anti-enumeration: same response body whether email exists or not
- Rate limited: 3 resets/hour per email
- Frontend: token-missing renders immediately (no empty form)

---

### 7. Logout

**Flow:**
1. User triggers sign-out (settings or decline on consent page)
2. NextAuth `signOut()` clears the JWT session cookie
3. `GET /api/auth/cognito-logout` redirects to site root (`/`)
4. Middleware sees no session → allows `/` (it's in PUBLIC_PATHS)

**`/auth/callback/route.ts`:** Legacy route for backwards compatibility — redirects to `/login`.

---

## Middleware Detail

**File:** `middleware.ts`  
**Runtime:** Edge (NextAuth Edge-safe config from `auth.config.ts`)

**Execution order:**
1. RSC prefetch check — returns 204 (not a redirect) if `Next-Router-Prefetch: 1`
2. `isPublic` check against `PUBLIC_PATHS`
3. If no session + not public → redirect to `/login`
4. If session + no role + not public + not `/set-role` → redirect to `/set-role`
5. If session + on `/login` + no error param → redirect to `callbackUrl` or `/dashboard`
6. Set CSRF cookie if missing (32-byte hex, httpOnly:false, sameSite:strict, 24h)

**PUBLIC_PATHS includes:**
- All marketing/legal pages
- Auth routes (`/api/auth` prefix covers all NextAuth callbacks)
- Public APIs: `/api/chat/guest`, `/api/share/`, `/api/cron`, etc.
- `/reset-password` (both request and confirm pages)
- **Note:** `/api/debug-auth` was removed from PUBLIC_PATHS — the route self-gates via `NODE_ENV !== 'development'` check

**CSRF cookie:** Set in middleware, readable by JS (httpOnly:false) for AJAX requests. Validated by `csrf.ts` on state-changing routes.

---

## Security Properties

| Property | Implementation |
|----------|---------------|
| Brute force protection | 50 login attempts/15 min per email |
| Registration spam | 5 registrations/hour per IP |
| Password reset abuse | 3 resets/hour per email |
| Reset token single-use | DB nonce cleared on use |
| Reset token expiry | 1-hour JWT expiry |
| Email enumeration | All reset paths return same 200 message |
| CSRF | Double-submit cookie pattern on state-changing routes |
| Open redirect | callbackUrl must start with `/` and not `//` |
| Password hashing | bcrypt cost 12 |
| Session storage | Signed JWT HTTP-only cookie (NextAuth default) |
| Social user creation | Email normalized (lowercase/trim), providerSub stored |
| HIPAA audit | Consent version + timestamp stored in DB |

---

## Known Gaps / Remaining Work

See `TODO.md` for tracking. Issues found in this audit:

**Fixed in preview/trials-impeccable:**
- ~~Consent `userId` fix~~ — `/api/consent/accept` now updates by `users.id` instead of `users.email`, making it safe for Apple users where email may be null after repeated sign-ins.
- ~~Open redirect in `callbackUrl`~~ — Middleware now rejects `callbackUrl` values that start with `//` in addition to requiring a leading `/`.
- ~~`set-role` stale session redirect loop~~ — Page now uses `useSession().update()` (trigger: 'update') and waits for confirmed session refresh before navigating to `/onboarding`.
- ~~Registration rate limit~~ — `POST /api/auth/register` now enforces 5 registrations/hour per IP.

**Still open:**

1. **`pending_role` cookie is dead code on web** — `auth.ts:94-104` reads a `pending_role` cookie during social sign-in but no web UI ever sets this cookie. New Google/Apple users always land on `/set-role` via middleware redirect. The code can be removed or wired up if a "role-before-OAuth" flow is desired.

2. **Consent redirect loses original destination** — After `/consent` acceptance, user always goes to `/dashboard`. If the user was redirected to consent from `/labs`, they'd need to navigate back manually. Fix: store original path in sessionStorage before redirect, restore after consent.

3. **`debug-auth` route should be deleted** — `apps/web/src/app/api/debug-auth/route.ts` is marked "TEMP DEBUG" and is intentionally excluded from `PUBLIC_PATHS` (it self-gates on `NODE_ENV !== 'development'`). Delete when login debugging is complete.

4. **Care group login has no rate limiting** — the care-group Credentials provider in `auth.ts` does bcrypt compares for every matching group name. If many groups share a name, this could be slow. Low priority.

5. **Apple sign-in email nullability** — Apple may not re-provide email on repeat sign-ins. If `user.email` is null in the NextAuth `jwt` callback for Apple, `throw new Error('No email provided by social provider')` fires. This is an Apple limitation; the current behavior (fail with error) is safer than allowing anonymous sign-in.

6. **HIPAA consent version bump has no migration path** — changing `CONSENT_VERSION` in `consent/accept/route.ts` re-gates users, but the layout only checks the boolean `hipaaConsent` flag (not the version). A version-based re-consent flow would need a layout change to compare `hipaaConsentVersion`.

---

## Files Reference

| File | Purpose |
|------|---------|
| `middleware.ts` | Edge auth gate — session + role checks |
| `lib/auth.config.ts` | Edge-safe NextAuth config (no Node imports) |
| `lib/auth.ts` | Full NextAuth config — Credentials, Apple, Google providers + JWT/session callbacks |
| `lib/csrf.ts` | CSRF double-submit cookie validation |
| `app/login/page.tsx` | Login page shell |
| `components/LoginForm.tsx` | Email/password + care-group + social login UI |
| `app/signup/page.tsx` | Signup page shell |
| `components/SignupForm.tsx` | Registration form with role + HIPAA consent |
| `components/ResetRequestForm.tsx` | Password reset request form |
| `components/ResetConfirmForm.tsx` | Password reset confirm form |
| `app/set-role/page.tsx` | Role selection page |
| `app/consent/page.tsx` | HIPAA consent page |
| `app/(app)/layout.tsx` | App shell — DB auth checks, consent gate, onboarding gate |
| `app/api/auth/register/route.ts` | User registration API |
| `app/api/auth/reset-password/route.ts` | Reset request API |
| `app/api/auth/reset-password/confirm/route.ts` | Reset confirm API |
| `app/api/auth/set-role/route.ts` | Role assignment API |
| `app/api/consent/accept/route.ts` | Consent recording API |
| `app/api/auth/cognito-logout/route.ts` | Post-logout redirect |
| `app/api/auth/social/route.ts` | Mobile social auth API |
| `app/api/debug-auth/route.ts` | Dev-only debug endpoint (delete when done) |
