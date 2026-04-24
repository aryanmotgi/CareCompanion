# Self-Healing Production Monitor — Design Spec

**Date:** 2026-04-24
**Status:** Draft
**Goal:** Expand production monitoring to cover auth, APIs, AI chat, crons, and performance — with automatic detection and self-healing via Claude Code Action. Zero cost (GitHub Actions free tier).

---

## Architecture: Two-Tier Monitoring

### Tier 1: API Health Ping (every 30 min)

**New file:** `.github/workflows/api-health-ping.yml`

Lightweight shell script using `curl`. No checkout, no Playwright, no browser. Each run takes ~15-30 seconds.

**Checks:**

| # | Check | Method | Pass criteria | Timeout |
|---|-------|--------|---------------|---------|
| 1 | Site liveness | `GET /api/e2e/signin` | Returns `{"ready":true}`, status 200 | 5s |
| 2 | Auth + DB reachable | `POST /api/e2e/signin` with `x-e2e-secret` header and E2E email | Returns 200, sets session cookie | 45s (Aurora cold start can take up to 30s) |
| 3 | Authenticated API | `GET /api/e2e/signin` with session cookie, verify cookie is valid | Returns 200 | 10s |
| 4 | Valid responses | All checks above | Response bodies are JSON, not HTML error pages | — |

**Note on Check 2 timeout:** The E2E signin endpoint has a built-in retry loop (4 attempts × 10s sleep) for Aurora Serverless cold starts. The curl timeout must be long enough to allow this retry to complete. A 45-second timeout accommodates the worst case.

**Note on Check 3:** Originally specified as `GET /api/records/medications`, but that endpoint requires a `care_profile_id` query param. Instead, we verify the session cookie is valid by re-hitting the signin GET endpoint with the cookie. If the session is valid, the app is serving authenticated requests correctly.

**Smart alerting for secret rotation:** If check 1 (GET liveness) passes but check 2 (POST signin) returns 401, the alert email includes: "Possible secret mismatch — verify E2E_AUTH_SECRET is consistent between GitHub Secrets and Vercel environment variables." No auto-fix issue is created for 401 errors.

**On failure:** Email alert with which check failed, the HTTP status, and the response body (truncated to 500 chars).

**On success:** Silent. No email. No issue creation.

**No auto-fix:** The ping is too lightweight to give Claude useful diagnostic context. Its job is fast detection. The Tier 2 suite handles diagnosis and repair.

**GitHub Actions cost:** ~48 runs/day × ~0.5 min/run = ~24 min/day = ~730 min/month.

---

### Tier 2: Deep Playwright Suite (every 4h)

**Existing file:** `.github/workflows/production-monitor.yml` (unchanged cadence and structure)
**Existing test file:** `apps/web/e2e/production-monitor.spec.ts` (expanded with new tests)

**Existing tests (unchanged):**
1. Dashboard renders and shows navigation
2. Care page loads without errors
3. 1upHealth connect page renders
4. AI chat interface renders

**New tests:**

| # | Test name | What it does | What it catches |
|---|-----------|-------------|-----------------|
| 5 | `medications data renders` | Navigate to `/care`, verify at least one medication name is visible in the DOM | Data fetching + rendering pipeline broken |
| 6 | `AI chat responds to a message` | Type "hello" in chat input, wait up to 15s, verify an assistant response message appears | Anthropic API key expired, streaming broken, AI route handler crash |
| 7 | `API response shape validation` | Navigate to `/care` first (establishes profile context), then `fetch('/api/records/medications?care_profile_id=...')` extracting the profile ID from the page's data attributes or a prior API call. Assert response is JSON with expected fields. | API returning wrong data structure, serialization bugs |
| 8 | `page load performance budgets` | Measure `performance.now()` before/after navigation for dashboard, care, chat pages. Fail if any page exceeds 8 seconds | Performance regression, slow DB queries, bundle bloat |
| 9 | `no console errors` | Listen on `page.on('console')` for `error` level messages. Filter out known noise (third-party cookies, favicon 404, React dev warnings). Fail if any unfiltered errors remain. | Uncaught exceptions, React hydration errors, failed API calls |
| 10 | `cron health — notifications exist` | Check the notifications UI on the dashboard (the bell icon / notification list). Verify at least one notification is visible in the DOM. | Cron jobs silently stopped running |

**On failure:** Same pipeline as today:
1. Email alert
2. Create GitHub issue with `playwright-auto-fix` label (dedup: skip if one is already open)
3. Claude Code Action reads the issue, diagnoses the failure, opens a PR

**GitHub Actions cost:** ~180 runs × ~6 min/run = ~1,080 min/month (revised upward from 720 to account for AI chat wait time and new test overhead).

---

## Auto-fix Quality Improvements

### Better issue context

The GitHub issue body will list ALL failed tests, not just one. Replace the `github-script` step's `body` array in the `Create auto-fix issue` step:

```markdown
## Production Monitor Failure

**Failed tests:**
- `AI chat responds to a message` — Timeout: no assistant message within 15s
- `medications data renders` — No medication names visible on /care

### Playwright Output
\`\`\`
[last 3000 chars of output]
\`\`\`

### Instructions for auto-fix agent
Analyze the Playwright test failures above. The test file is `apps/web/e2e/production-monitor.spec.ts`.
Find the root cause in the application code (not the test) and create a PR with a fix.
The production site is a Next.js app inside a Turborepo monorepo. Check page components under `apps/web/src/`.
If multiple tests failed, they likely share a root cause (e.g., DB connection failure).
```

The failed test names and error summaries are extracted from the Playwright output by parsing lines matching `✗` or `FAIL`.

### PR verification step

After Claude Code Action creates a PR, a new workflow verifies the fix:

**New file:** `.github/workflows/verify-auto-fix.yml`
**Trigger:** `pull_request` with label `playwright-auto-fix`

**Steps:**
1. Get the Vercel preview URL by polling the GitHub Deployments API (`GET /repos/{owner}/{repo}/deployments`) filtered by the PR's HEAD SHA. Wait until a deployment with `state: success` appears (timeout: 5 min, poll every 15s). Extract `environment_url`.
2. Run the full `production-monitor.spec.ts` against the preview URL.
3. If all tests pass: comment "Verified — fix resolves the failing tests" on the PR.
4. If tests fail: comment "Auto-fix did not resolve the issue — needs human review" and add `needs-human` label.

**Lifecycle:** The auto-fix issue remains open with `needs-human` label until a human closes it. No further auto-fix attempts are triggered because `playwright-auto-fix.yml` only fires on `issues: opened`, not `issues: labeled`.

---

## Files Changed

| File | Change |
|------|--------|
| `.github/workflows/api-health-ping.yml` | **New** — Tier 1 curl-based health ping every 30 min |
| `.github/workflows/production-monitor.yml` | **Modified** — update `github-script` step to extract failed test names and build structured issue body |
| `.github/workflows/verify-auto-fix.yml` | **New** — verify auto-fix PRs against Vercel preview deployment |
| `apps/web/e2e/production-monitor.spec.ts` | **Modified** — 6 new tests added |

## Cost Summary

| Component | Runs/month | Minutes/month |
|-----------|-----------|---------------|
| Tier 1 API ping (every 30 min) | 1,440 | ~730 |
| Tier 2 Playwright (every 4h) | 180 | ~1,080 |
| Auto-fix (on failure only) | ~5 | ~25 |
| PR verification (on auto-fix PR only) | ~5 | ~20 |
| **Total** | | **~1,855 min/month** |

Free tier: 2,000 min/month. Headroom: ~145 minutes. Tight but within budget. If needed, reduce Tier 1 to every 45 min to reclaim ~240 min.

## What's NOT in scope

- Visual regression / screenshot diffs (too flaky)
- Load testing (different problem)
- Mobile app monitoring (can't run iOS in GitHub Actions)
- Monitoring third-party services (1upHealth, Anthropic status)
- Database monitoring (covered indirectly by API checks hitting the DB)
- Monitoring GitHub Actions availability (the monitor itself has no external heartbeat — if GitHub Actions is down, no monitoring runs)
