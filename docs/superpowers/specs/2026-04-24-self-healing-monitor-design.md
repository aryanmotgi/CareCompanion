# Self-Healing Production Monitor — Design Spec

**Date:** 2026-04-24
**Status:** Draft
**Goal:** Expand production monitoring to cover auth, APIs, AI chat, crons, and performance — with automatic detection and self-healing via Claude Code Action. Zero cost (GitHub Actions free tier).

---

## Architecture: Two-Tier Monitoring

### Tier 1: API Health Ping (every 30 min)

**New file:** `.github/workflows/api-health-ping.yml`

Lightweight shell script using `curl`. No checkout, no Playwright, no browser. Each run takes ~10 seconds.

**Checks:**

| # | Check | Method | Pass criteria |
|---|-------|--------|---------------|
| 1 | Site liveness | `GET /api/e2e/signin` | Returns `{"ready":true}`, status 200 |
| 2 | Auth + DB reachable | `POST /api/e2e/signin` with `x-e2e-secret` header and E2E email | Returns 200, sets session cookie |
| 3 | Authenticated API | `GET /api/records/medications` with session cookie from check 2 | Returns 200, body is valid JSON array |
| 4 | Response time | All checks above | Each completes within 5 seconds (`curl --max-time 5`) |
| 5 | Valid responses | All checks above | Response bodies are JSON, not HTML error pages |

**On failure:** Email alert with which check failed, the HTTP status, and the response body (truncated to 500 chars).

**On success:** Silent. No email. No issue creation.

**No auto-fix:** The ping is too lightweight to give Claude useful diagnostic context. Its job is fast detection. The Tier 2 suite handles diagnosis and repair.

**GitHub Actions cost:** ~48 runs/day × ~0.17 min/run = ~8 min/day = ~245 min/month.

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
| 7 | `API response shape validation` | `fetch('/api/records/medications')` inside the page, assert response is JSON array with `name` and `dose` fields | API returning wrong data structure, serialization bugs |
| 8 | `page load performance budgets` | Measure `performance.now()` before/after navigation for dashboard, care, chat pages. Fail if any page exceeds 8 seconds | Performance regression, slow DB queries, bundle bloat |
| 9 | `no console errors` | Listen on `page.on('console')` for `error` level messages throughout the entire test run. Collect and fail at end if any found | Uncaught exceptions, React hydration errors, failed API calls |
| 10 | `cron health — notifications exist` | `fetch('/api/notifications/read')` or check the notifications UI, verify at least one notification exists | Cron jobs silently stopped running |

**On failure:** Same pipeline as today:
1. Email alert
2. Create GitHub issue with `playwright-auto-fix` label
3. Claude Code Action reads the issue, diagnoses the failure, opens a PR

**GitHub Actions cost:** Same as today (~720 min/month).

---

## Auto-fix Quality Improvements

### Better issue context

The GitHub issue body sent to Claude Code Action will include structured information instead of just raw Playwright output:

```markdown
## Production Monitor Failure

**Failed test:** `AI chat responds to a message`
**What it checks:** Types "hello" in chat, waits for streaming response
**Expected:** Assistant message appears within 15 seconds
**Actual:** Timeout — no assistant message rendered

### Playwright Output
\`\`\`
[last 3000 chars of output]
\`\`\`

### Instructions for auto-fix agent
Analyze the test failure above. The test file is `apps/web/e2e/production-monitor.spec.ts`.
Find the root cause in the application code (not the test) and create a PR with a fix.
The production site is a Next.js app inside a Turborepo monorepo.
Check page components under `apps/web/src/`.
```

### PR verification step

After Claude Code Action creates a PR, a new workflow step will:

1. Wait for Vercel to deploy the preview URL for the PR
2. Run the specific failing test against the preview URL
3. If test passes: comment "Verified — fix resolves the failing test" on the PR
4. If test fails: comment "Auto-fix did not resolve the issue" and add `needs-human` label

This requires a new workflow file: `.github/workflows/verify-auto-fix.yml` triggered on `pull_request` with label `playwright-auto-fix`.

---

## Files Changed

| File | Change |
|------|--------|
| `.github/workflows/api-health-ping.yml` | **New** — Tier 1 curl-based health ping |
| `.github/workflows/production-monitor.yml` | **Modified** — better issue body with structured failure context |
| `.github/workflows/verify-auto-fix.yml` | **New** — verify auto-fix PRs against preview deployment |
| `apps/web/e2e/production-monitor.spec.ts` | **Modified** — 6 new tests added |

## Cost Summary

| Component | Runs/month | Minutes/month |
|-----------|-----------|---------------|
| Tier 1 API ping (every 30 min) | 1,440 | ~245 |
| Tier 2 Playwright (every 4h) | 180 | ~720 |
| Auto-fix (on failure only) | ~5 | ~25 |
| PR verification (on auto-fix PR only) | ~5 | ~20 |
| **Total** | | **~1,010 min/month** |

Free tier: 2,000 min/month. Headroom: ~990 minutes.

## What's NOT in scope

- Visual regression / screenshot diffs (too flaky)
- Load testing (different problem)
- Mobile app monitoring (can't run iOS in GitHub Actions)
- Monitoring third-party services (1upHealth, Anthropic status)
- Database monitoring (covered indirectly by API checks hitting the DB)
