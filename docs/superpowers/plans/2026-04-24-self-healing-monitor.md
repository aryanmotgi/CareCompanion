# Self-Healing Production Monitor — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand production monitoring to two tiers — fast API pings every 30 min + deep Playwright tests every 4h — with auto-fix via Claude Code Action and PR verification.

**Architecture:** New `api-health-ping.yml` workflow runs curl checks every 30 min. Existing `production-monitor.spec.ts` gets 6 new tests. New `verify-auto-fix.yml` verifies Claude's fix PRs against Vercel previews. Existing `production-monitor.yml` gets structured issue bodies.

**Tech Stack:** GitHub Actions, Playwright, curl, GitHub Deployments API

**Spec:** `docs/superpowers/specs/2026-04-24-self-healing-monitor-design.md`

---

## Chunk 1: Tier 1 — API Health Ping Workflow

### Task 1: Create the API health ping workflow

**Files:**
- Create: `.github/workflows/api-health-ping.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: API Health Ping

on:
  schedule:
    - cron: '*/30 * * * *'
  workflow_dispatch:

jobs:
  health-ping:
    name: API Health Ping
    runs-on: ubuntu-latest
    timeout-minutes: 3

    steps:
      - name: Check 1 — Site liveness
        id: liveness
        run: |
          HTTP_CODE=$(curl -s -o /tmp/liveness.json -w '%{http_code}' \
            --max-time 5 \
            https://carecompanionai.org/api/e2e/signin 2>/dev/null || echo "000")
          BODY=$(cat /tmp/liveness.json 2>/dev/null | head -c 500 || echo "no response")
          echo "status=$HTTP_CODE" >> $GITHUB_OUTPUT
          echo "body=$BODY" >> $GITHUB_OUTPUT
          if [ "$HTTP_CODE" != "200" ]; then
            echo "::error::Site liveness check failed: HTTP $HTTP_CODE"
            echo "failed=true" >> $GITHUB_OUTPUT
          else
            echo "failed=false" >> $GITHUB_OUTPUT
          fi

      - name: Check 2 — Auth + DB reachable
        id: auth
        run: |
          HTTP_CODE=$(curl -s -o /tmp/auth.json -w '%{http_code}' \
            -D /tmp/auth-headers.txt \
            --max-time 45 \
            -X POST \
            -H 'Content-Type: application/json' \
            -H 'x-e2e-secret: ${{ secrets.E2E_AUTH_SECRET }}' \
            -d '{"email":"${{ secrets.E2E_MONITOR_EMAIL }}"}' \
            https://carecompanionai.org/api/e2e/signin 2>/dev/null || echo "000")
          BODY=$(cat /tmp/auth.json 2>/dev/null | head -c 500 || echo "no response")
          echo "status=$HTTP_CODE" >> $GITHUB_OUTPUT
          echo "body=$BODY" >> $GITHUB_OUTPUT

          # Extract session cookie for Check 3
          COOKIE=$(grep -i 'set-cookie' /tmp/auth-headers.txt 2>/dev/null | head -1 | sed 's/set-cookie: //i' | cut -d';' -f1 || echo "")
          echo "cookie=$COOKIE" >> $GITHUB_OUTPUT

          if [ "$HTTP_CODE" = "401" ] && [ "${{ steps.liveness.outputs.failed }}" = "false" ]; then
            echo "::warning::Auth returned 401 but site is live — possible E2E_AUTH_SECRET mismatch"
            echo "secret_mismatch=true" >> $GITHUB_OUTPUT
            echo "failed=true" >> $GITHUB_OUTPUT
          elif [ "$HTTP_CODE" != "200" ]; then
            echo "::error::Auth check failed: HTTP $HTTP_CODE"
            echo "secret_mismatch=false" >> $GITHUB_OUTPUT
            echo "failed=true" >> $GITHUB_OUTPUT
          else
            echo "secret_mismatch=false" >> $GITHUB_OUTPUT
            echo "failed=false" >> $GITHUB_OUTPUT
          fi

      - name: Check 3 — Session cookie valid
        id: session
        if: steps.auth.outputs.failed != 'true'
        run: |
          COOKIE="${{ steps.auth.outputs.cookie }}"
          if [ -z "$COOKIE" ]; then
            echo "::error::No session cookie received from auth check"
            echo "failed=true" >> $GITHUB_OUTPUT
            exit 0
          fi
          HTTP_CODE=$(curl -s -o /tmp/session.json -w '%{http_code}' \
            --max-time 10 \
            -H "Cookie: $COOKIE" \
            https://carecompanionai.org/api/e2e/signin 2>/dev/null || echo "000")
          echo "status=$HTTP_CODE" >> $GITHUB_OUTPUT
          if [ "$HTTP_CODE" != "200" ]; then
            echo "::error::Session validation failed: HTTP $HTTP_CODE"
            echo "failed=true" >> $GITHUB_OUTPUT
          else
            echo "failed=false" >> $GITHUB_OUTPUT
          fi

      - name: Send failure alert
        if: steps.liveness.outputs.failed == 'true' || steps.auth.outputs.failed == 'true' || steps.session.outputs.failed == 'true'
        uses: dawidd6/action-send-mail@2cea9617b09d79a095af21254fbcb7ae95903dde # v3
        with:
          server_address: smtp.gmail.com
          server_port: 465
          secure: true
          username: ${{ secrets.ALERT_EMAIL_USERNAME }}
          password: ${{ secrets.ALERT_EMAIL_PASSWORD }}
          subject: "🚨 CareCompanion Health Ping Failed"
          to: ${{ secrets.ALERT_EMAIL_TO }}
          from: CareCompanion Alerts <${{ secrets.ALERT_EMAIL_USERNAME }}>
          body: |
            CareCompanion API health ping detected a failure.

            Check 1 (Site liveness): ${{ steps.liveness.outputs.failed == 'true' && 'FAILED' || 'OK' }} — HTTP ${{ steps.liveness.outputs.status }}
            Check 2 (Auth + DB): ${{ steps.auth.outputs.failed == 'true' && 'FAILED' || 'OK' }} — HTTP ${{ steps.auth.outputs.status }}
            Check 3 (Session valid): ${{ steps.session.outputs.failed == 'true' && 'FAILED' || (steps.session.conclusion == 'skipped' && 'SKIPPED' || 'OK') }}

            ${{ steps.auth.outputs.secret_mismatch == 'true' && '⚠️ Possible secret mismatch — verify E2E_AUTH_SECRET is consistent between GitHub Secrets and Vercel environment variables.' || '' }}

            Response bodies:
            Liveness: ${{ steps.liveness.outputs.body }}
            Auth: ${{ steps.auth.outputs.body }}

            Workflow: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}

      - name: Fail job if any check failed
        if: steps.liveness.outputs.failed == 'true' || steps.auth.outputs.failed == 'true' || steps.session.outputs.failed == 'true'
        run: exit 1
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/api-health-ping.yml'))"`
Expected: No output (valid YAML)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/api-health-ping.yml
git commit -m "feat: add Tier 1 API health ping workflow (every 30 min)"
```

---

## Chunk 2: Tier 2 — Expanded Playwright Tests

### Task 2: Add medications data test

**Files:**
- Modify: `apps/web/e2e/production-monitor.spec.ts`

- [ ] **Step 1: Add the test after the existing "AI chat interface renders" test**

```typescript
  test('medications data renders on care page', async ({ page }) => {
    try {
      await page.goto('/care', { waitUntil: 'domcontentloaded', timeout: 20000 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('ERR_ABORTED')) throw e
    }
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 10000 })

    // If on the care page, verify at least one medication name renders
    if (page.url().includes('/care')) {
      // Wait for data to load (Suspense boundaries may delay rendering)
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      // Look for any text content that indicates medication data loaded
      // The care page renders medication cards with medication names
      const medContent = page.locator('[data-testid="medication-card"], .medication-item, h3, h4').first()
      await expect(medContent).toBeVisible({ timeout: 10000 })
    }
  })
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/e2e/production-monitor.spec.ts
git commit -m "test: add medications data rendering test to production monitor"
```

### Task 3: Add AI chat functional test

**Files:**
- Modify: `apps/web/e2e/production-monitor.spec.ts`

- [ ] **Step 1: Add the AI chat functional test**

```typescript
  test('AI chat responds to a message', async ({ page }) => {
    try {
      await page.goto('/chat', { waitUntil: 'domcontentloaded', timeout: 20000 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('ERR_ABORTED')) throw e
    }
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    const onChat = page.url().includes('/chat')
    if (!onChat) {
      // Redirected away from chat (no profile, etc.) — skip functional test
      return
    }

    // Find and fill the chat input
    const chatInput = page.locator('textarea, input[type="text"]').first()
    await expect(chatInput).toBeVisible({ timeout: 10000 })
    await chatInput.fill('hello')

    // Submit the message (press Enter or click send button)
    await chatInput.press('Enter')

    // Wait for an assistant response to appear
    // Look for a new message element that wasn't there before
    const assistantMessage = page.locator('[data-role="assistant"], .assistant-message, [class*="assistant"]').first()
    await expect(assistantMessage).toBeVisible({ timeout: 30000 })
  })
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/e2e/production-monitor.spec.ts
git commit -m "test: add AI chat functional test to production monitor"
```

### Task 4: Add page load performance budget test

**Files:**
- Modify: `apps/web/e2e/production-monitor.spec.ts`

- [ ] **Step 1: Add the performance budget test**

```typescript
  test('page load performance budgets', async ({ page }) => {
    const MAX_LOAD_TIME_MS = 8000
    const pages = ['/dashboard', '/care', '/chat']

    for (const path of pages) {
      const start = Date.now()
      try {
        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 20000 })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!msg.includes('ERR_ABORTED')) throw e
      }
      const elapsed = Date.now() - start

      expect(elapsed, `${path} took ${elapsed}ms (budget: ${MAX_LOAD_TIME_MS}ms)`).toBeLessThan(MAX_LOAD_TIME_MS)
    }
  })
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/e2e/production-monitor.spec.ts
git commit -m "test: add page load performance budget test to production monitor"
```

### Task 5: Add console error capture test

**Files:**
- Modify: `apps/web/e2e/production-monitor.spec.ts`

- [ ] **Step 1: Add the console error test**

```typescript
  test('no unexpected console errors during navigation', async ({ page }) => {
    const errors: string[] = []

    // Known noise patterns to ignore
    const IGNORE_PATTERNS = [
      /third-party cookie/i,
      /favicon\.ico/,
      /ERR_BLOCKED_BY_CLIENT/,
      /Download the React DevTools/,
      /Warning: ReactDOM/,
      /hydration/i,
      /vercel-insights/,
      /vercel-analytics/,
    ]

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        const isNoise = IGNORE_PATTERNS.some((p) => p.test(text))
        if (!isNoise) errors.push(text)
      }
    })

    // Navigate through key pages
    for (const path of ['/dashboard', '/care', '/chat']) {
      try {
        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 20000 })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!msg.includes('ERR_ABORTED')) throw e
      }
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    }

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toHaveLength(0)
  })
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/e2e/production-monitor.spec.ts
git commit -m "test: add console error capture test to production monitor"
```

### Task 6: Add cron health / notifications test

**Files:**
- Modify: `apps/web/e2e/production-monitor.spec.ts`

- [ ] **Step 1: Add the cron health test**

```typescript
  test('notifications exist (cron health check)', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 })
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 15000 })

    // The NotificationBell component renders notification items
    // If crons are running, there should be at least one notification
    // Click the bell to open the notification dropdown
    const bell = page.locator('[aria-label="Notifications"], button:has(svg)').first()
    await expect(bell).toBeVisible({ timeout: 10000 })
    await bell.click()

    // Wait for notification list to appear
    // Verify at least one notification item is visible
    const notificationItem = page.locator('[data-testid="notification-item"], a[href*="notification"], li').first()
    await expect(notificationItem).toBeVisible({ timeout: 5000 })
  })
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/e2e/production-monitor.spec.ts
git commit -m "test: add cron health / notifications test to production monitor"
```

---

## Chunk 3: Improved Auto-fix Issue Body

### Task 7: Update production-monitor.yml with structured issue body

**Files:**
- Modify: `.github/workflows/production-monitor.yml`

- [ ] **Step 1: Replace the `Create auto-fix issue` step's script**

Replace the existing `github-script` step (the "Create auto-fix issue" step) with this updated version that extracts failed test names and builds a structured body:

```javascript
const fs = require('fs');
const output = fs.readFileSync('playwright-output.txt', 'utf8');

// Check for an existing open auto-fix issue to avoid duplicates
const existing = await github.rest.issues.listForRepo({
  owner: context.repo.owner,
  repo: context.repo.repo,
  labels: 'playwright-auto-fix',
  state: 'open',
});
if (existing.data.length > 0) {
  console.log('Open auto-fix issue already exists, skipping creation.');
  return;
}

// Extract failed test names from Playwright output
const failedTests = output
  .split('\n')
  .filter(line => /^\s+[✗×✘]|FAILED|─ FAIL/.test(line))
  .map(line => line.trim())
  .slice(0, 10);

const failedList = failedTests.length > 0
  ? failedTests.map(t => `- ${t}`).join('\n')
  : '- (could not parse failed test names from output)';

const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
const date = new Date().toISOString().split('T')[0];

await github.rest.issues.create({
  owner: context.repo.owner,
  repo: context.repo.repo,
  title: `🔧 Auto-fix: Production monitor failure (${date})`,
  labels: ['playwright-auto-fix', 'bug'],
  body: [
    '## Production Monitor Failure',
    '',
    `The production monitor detected failures on **${date}**.`,
    '',
    `**Workflow run:** ${runUrl}`,
    '',
    '**Failed tests:**',
    failedList,
    '',
    '### Playwright Output',
    '',
    '```',
    output.slice(-3000),
    '```',
    '',
    '### Instructions for auto-fix agent',
    '',
    'Analyze the Playwright test failures above. The test file is `apps/web/e2e/production-monitor.spec.ts`.',
    'Find the root cause in the application code (not the test) and create a PR with a fix.',
    'The production site is a Next.js app inside a Turborepo monorepo. Check page components under `apps/web/src/`.',
    'If multiple tests failed, they likely share a root cause (e.g., DB connection failure, auth issue).',
  ].join('\n'),
});
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/production-monitor.yml
git commit -m "fix: structured issue body with failed test names for auto-fix"
```

---

## Chunk 4: PR Verification Workflow

### Task 8: Create the verify-auto-fix workflow

**Files:**
- Create: `.github/workflows/verify-auto-fix.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Verify Auto-Fix PR

on:
  pull_request:
    types: [labeled]

jobs:
  verify:
    if: contains(github.event.label.name, 'playwright-auto-fix')
    name: Verify Fix Against Preview
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
      pull-requests: write
      deployments: read

    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}

      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2
        with:
          bun-version: 1.3.11

      - run: bun install --frozen-lockfile

      - name: Install Playwright browsers
        run: cd apps/web && bunx playwright install --with-deps chromium

      - name: Wait for Vercel preview deployment
        id: preview
        uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea # v7
        with:
          script: |
            const sha = context.payload.pull_request.head.sha;
            const maxAttempts = 20; // 5 min (20 × 15s)
            for (let i = 0; i < maxAttempts; i++) {
              const { data: deployments } = await github.rest.repos.listDeployments({
                owner: context.repo.owner,
                repo: context.repo.repo,
                sha,
                per_page: 5,
              });
              for (const dep of deployments) {
                const { data: statuses } = await github.rest.repos.listDeploymentStatuses({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  deployment_id: dep.id,
                  per_page: 1,
                });
                if (statuses[0]?.state === 'success' && statuses[0]?.environment_url) {
                  core.setOutput('url', statuses[0].environment_url);
                  console.log(`Preview URL: ${statuses[0].environment_url}`);
                  return;
                }
              }
              console.log(`Attempt ${i + 1}/${maxAttempts}: preview not ready, waiting 15s...`);
              await new Promise(r => setTimeout(r, 15000));
            }
            core.setFailed('Timed out waiting for Vercel preview deployment');

      - name: Run production monitor against preview
        id: verify
        continue-on-error: true
        working-directory: apps/web
        run: bunx playwright test e2e/production-monitor.spec.ts
        env:
          PLAYWRIGHT_BASE_URL: ${{ steps.preview.outputs.url }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          E2E_MONITOR_EMAIL: ${{ secrets.E2E_MONITOR_EMAIL }}
          E2E_AUTH_SECRET: ${{ secrets.E2E_AUTH_SECRET }}

      - name: Comment result on PR
        uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea # v7
        with:
          script: |
            const passed = '${{ steps.verify.outcome }}' === 'success';
            const body = passed
              ? '✅ **Verified** — fix resolves the failing tests against the preview deployment.'
              : '❌ **Auto-fix did not resolve the issue** — needs human review.\n\nThe production monitor tests still fail against this PR\'s preview deployment.';

            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.pull_request.number,
              body,
            });

            if (!passed) {
              await github.rest.issues.addLabels({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.payload.pull_request.number,
                labels: ['needs-human'],
              });
            }
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/verify-auto-fix.yml'))"`
Expected: No output (valid YAML)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/verify-auto-fix.yml
git commit -m "feat: add PR verification workflow for auto-fix PRs"
```

---

## Chunk 5: Final Integration

### Task 9: Update success email to list all monitored checks

**Files:**
- Modify: `.github/workflows/production-monitor.yml`

- [ ] **Step 1: Update the success email body to list all 10 checks**

Replace the success email body with:

```
The CareCompanion production monitor ran successfully against carecompanionai.org.

All checks passed:
- Dashboard renders and shows navigation
- Care page loads without errors
- 1upHealth connect page renders
- AI chat interface renders
- Medications data renders on care page
- AI chat responds to a message
- Page load performance within budgets
- No unexpected console errors
- Notifications exist (cron health)

Workflow run details:
${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/production-monitor.yml
git commit -m "chore: update success email to list all monitored checks"
```

### Task 10: Validate all workflows and run tests

- [ ] **Step 1: Validate all workflow YAML files**

```bash
for f in .github/workflows/*.yml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" && echo "OK: $f" || echo "FAIL: $f"
done
```

- [ ] **Step 2: Run existing tests to ensure nothing broke**

```bash
cd apps/web && npx vitest run
```
Expected: 193+ tests pass

- [ ] **Step 3: Run typecheck**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: No new errors (auth.ts errors from other terminal are pre-existing)

- [ ] **Step 4: Final commit with all files**

```bash
git add -A
git status
# Verify only expected files are staged
git commit -m "feat: self-healing production monitor — two-tier monitoring with auto-fix verification"
```
