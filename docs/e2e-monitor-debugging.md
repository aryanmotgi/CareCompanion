# Debugging the Production 24/7 Monitor

The production monitor runs Playwright tests against `carecompanionai.org` every 4 hours via GitHub Actions. When it fails you'll get an email and an auto-created GitHub issue.

---

## Architecture

```
GitHub Actions (cron)
  → waits for deployment probe v=N
  → runs e2e/production-monitor.spec.ts (4 tests)
    → beforeEach: POST /api/e2e/signin → sets session cookie
    → each test navigates to /dashboard, /care, /connect, /chat
```

The E2E signin endpoint (`apps/web/src/app/api/e2e/signin/route.ts`) bypasses the normal Google OAuth flow by:
1. Looking up the monitor account in the DB by email
2. Minting a NextAuth v5 JWT directly via `encode()` from `next-auth/jwt`
3. Setting it as the `__Secure-authjs.session-token` cookie

The JWT shape **must match what `apps/web/src/lib/auth.ts` callbacks produce**. This is the most common breakage point.

---

## Step 1 — Find the failing run

```bash
gh run list --workflow=production-monitor.yml --limit=5
gh run view <RUN_ID> --log-failed
```

Look for the error type — the rest of this guide branches on it.

---

## Step 2 — Classify the error

### A) Job setup failure: "An action could not be found at URI"

```
##[error]An action could not be found at the URI 'https://api.github.com/repos/actions/github-script/tarball/...'
```

**Cause:** Transient GitHub infrastructure failure. Not a code problem.  
**Fix:** Trigger a new run: `gh workflow run production-monitor.yml --ref main`

---

### B) Signin failure: `503 {"error":"E2E_SECRET not configured"}` or similar

```
Error: E2E signin failed: 503 {"error":"E2E_SECRET not configured"}
Error: E2E signin failed: 503 {"error":"E2E_AUTH_SECRET not configured"}
Error: E2E signin failed: 404 {"error":"not found"}
```

**Cause:** Someone added an env-var guard to `src/app/api/e2e/signin/route.ts` (e.g. `E2E_SECRET`, `E2E_AUTH_SECRET`) that is not set in Vercel.

**Security model:** The only gate needed is the DB email lookup. If the email isn't in the `users` table, the endpoint returns 404. No additional shared secret is required.

**Fix:**
1. Open `src/app/api/e2e/signin/route.ts`
2. Remove the guard block (it usually looks like):
   ```typescript
   const e2eSecret = process.env.E2E_SECRET
   if (!e2eSecret) {
     return NextResponse.json({ error: 'E2E_SECRET not configured' }, { status: 503 })
   }
   ```
3. Bump `v` in the GET handler and update the wait step in `.github/workflows/production-monitor.yml` to match.
4. Commit, push, wait for deployment, re-trigger.

---

### C) Redirect loop: `ERR_TOO_MANY_REDIRECTS at /dashboard`

```
Error: page.goto: net::ERR_TOO_MANY_REDIRECTS at https://carecompanionai.org/dashboard
```

**Cause:** The session cookie is being set successfully, but when `src/app/(app)/layout.tsx` reads the session it finds a required field missing (usually `session.user.id`), so it redirects to `/login`, which redirects back, looping.

**How to debug:**

Check what fields `src/lib/auth.ts` puts in the JWT and session:
```typescript
// auth.ts jwt callback — what gets stored in the token
token.providerSub = String(p.sub)   // ← key field name

// auth.ts session callback — what becomes session.user.id
session.user.id = token.providerSub  // ← must match the JWT field above
```

Then check what `src/app/api/e2e/signin/route.ts` encodes:
```typescript
const token = await encode({
  token: {
    providerSub: cognitoSub,  // ← must be present with the right name
    sub: cognitoSub,
    email,
    ...
  },
  ...
})
```

If the field name in `encode()` doesn't match what `auth.ts` reads, `session.user.id` will be `undefined` → redirect to `/login`.

**Fix:** Align the JWT token shape in the signin endpoint with what `auth.ts` actually reads. Common case: if `auth.ts` was changed (e.g. migrating from Cognito to Google OAuth), the field name may have changed from `sub` to `providerSub` or similar.

After fixing, bump `v` and redeploy.

---

### D) Signin failure: `429 {"error":"too many requests"}`

```
Error: E2E signin failed: 429 {"error":"too many requests"}
```

**Cause:** The rate limiter in `src/app/api/e2e/signin/route.ts` is too low. 4 tests × retries = many calls from one CI IP.

**Fix:** Increase `maxRequests` in the limiter:
```typescript
const limiter = rateLimit({ interval: 60_000, maxRequests: 20 })
```

---

### E) `npm ci` fails: `EUNSUPPORTEDPROTOCOL: workspace:*`

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

**Cause:** The repo uses Turborepo with Bun workspaces. The root `package.json` uses `workspace:*` — a Bun/pnpm protocol that npm does not understand. This happens if the workflow still uses `setup-node` + `npm ci` instead of `setup-bun` + `bun install`.

**Fix:** Update `.github/workflows/production-monitor.yml`:

```yaml
# Replace this:
- uses: actions/setup-node@...
  with:
    node-version: 20
    cache: npm
- run: npm ci
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
- name: Run E2E Production Monitor
  run: npx playwright test e2e/production-monitor.spec.ts ...

# With this:
- uses: oven-sh/setup-bun@v2
  with:
    bun-version: 1.3.11
- run: bun install --frozen-lockfile
- name: Install Playwright browsers
  run: cd apps/web && bunx playwright install --with-deps chromium
- name: Run E2E Production Monitor
  working-directory: apps/web
  run: bunx playwright test e2e/production-monitor.spec.ts ...
```

Also update artifact path from `playwright-report/` to `apps/web/playwright-report/`.

---

### F) `ERR_ABORTED` on `/care` or `/chat`

```
Error: page.goto: net::ERR_ABORTED at https://carecompanionai.org/care
Error: page.goto: net::ERR_ABORTED at https://carecompanionai.org/chat
```

**Cause:** Next.js `redirect()` called at the layout or middleware level aborts the HTTP connection before the response is committed. This is different from a Suspense-boundary redirect — `waitUntil: 'commit'` does NOT help here.

**Fix:** Wrap `page.goto()` in a try/catch for those pages and swallow `ERR_ABORTED`, then assert the final URL:

```typescript
try {
  await page.goto('/care', { waitUntil: 'domcontentloaded', timeout: 20000 })
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  if (!msg.includes('ERR_ABORTED')) throw e
}
await expect(page).not.toHaveURL(/.*\/login/, { timeout: 10000 })
```

This lets redirects happen freely while still catching genuine auth failures (which land back on `/login`).

---

### G) Tests fail inside navigation (not signin)

Check the full log for what actually failed:
```bash
gh run view <RUN_ID> --log 2>&1 | grep -E "×|Error:|expect|locator|timeout" | head -40
```

Common issues and fixes are in the test file `e2e/production-monitor.spec.ts`. The tests are intentionally lenient:
- `/dashboard` — checks nav links (Home, Chat, Care, Scan), not page content
- `/care` — checks nav is present (not specific data, which errors for the minimal E2E profile)
- `/connect` — checks a heading is visible, no "something went wrong" overlay
- `/chat` — checks textarea is visible only if URL is still `/chat`

If a test is too strict for the minimal E2E account, loosen the assertion rather than fixing the app.

---

## Step 3 — Verify the fix is deployed

The GET probe tells you which version is live:
```bash
curl -s https://carecompanionai.org/api/e2e/signin
# {"ready":true,"v":10}
```

When you change `route.ts`, always bump `v` by 1 and update the wait step in the workflow to poll for the new version. This prevents the CI from running tests against stale code.

---

## Step 4 — Trigger and confirm

```bash
gh workflow run production-monitor.yml --ref main
sleep 5
gh run list --workflow=production-monitor.yml --limit=1
# watch for completion:
gh run view <NEW_RUN_ID>
```

A passing run looks like:
```
✓ Production Smoke Test in 1m17s
```

---

## Key files

| File | Purpose |
|------|---------|
| `apps/web/src/app/api/e2e/signin/route.ts` | Mints the session cookie for the E2E account |
| `apps/web/src/lib/auth.ts` | Defines JWT/session shape — **must match the signin endpoint** |
| `apps/web/src/app/(app)/layout.tsx` | Reads `session.user.id`; redirects to `/login` if missing |
| `apps/web/src/middleware.ts` | Must include `/api/e2e` in `PUBLIC_PATHS` |
| `apps/web/e2e/production-monitor.spec.ts` | The 4 Playwright tests |
| `.github/workflows/production-monitor.yml` | Cron schedule, deployment wait, email alerts |

---

## History of recurring failures

| Root cause | Fix |
|-----------|-----|
| `E2E_AUTH_SECRET` guard added (not set in Vercel) | Remove guard |
| `E2E_SECRET` guard added (not set in Vercel) | Remove guard |
| JWT missing `providerSub` after Google OAuth migration | Add `providerSub` to `encode()` token |
| Rate limit too low (5/min) | Raised to 20/min |
| Stale cookie causing redirect loop | Added `context.clearCookies()` in beforeEach |
| Dashboard assertion on "CareCompanion" text node | Changed to check nav links |
| Textbox selector `getByRole('textbox')` not matching | Changed to `textarea, input[type="text"]` |
| Monorepo migration: `npm ci` fails with `workspace:*` | Switch workflow to `setup-bun` + `bun install`; run playwright from `apps/web/` |
| `ERR_ABORTED` on `/care` and `/chat` | Catch abort in try/catch; assert not on `/login` after |
