import { test, expect } from '@playwright/test'

test.describe('Production 24/7 Monitor', () => {
  // All tests in this suite are strictly for the deployed production environment.
  // They are skipped when PLAYWRIGHT_BASE_URL is not set.
  test.beforeEach(() => {
    test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'This test suite only runs against a deployed environment.')
  })

  test.beforeEach(async ({ page, context }) => {
    const email = process.env.E2E_MONITOR_EMAIL!
    const e2eSecret = process.env.E2E_AUTH_SECRET!

    // Clear all cookies before each test to prevent stale session tokens from
    // a previous test causing ERR_TOO_MANY_REDIRECTS (stale JWT + redirect loop).
    await context.clearCookies()

    // Navigate to the site first so the browser context has the correct origin,
    // then call the E2E signin endpoint via fetch inside the page (same origin).
    // This means the browser itself handles Set-Cookie, including Secure cookies.
    await page.goto('/login')
    const result = await page.evaluate(
      async ({ email, secret }: { email: string; secret: string }) => {
        const res = await fetch('/api/e2e/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-e2e-secret': secret },
          body: JSON.stringify({ email }),
          credentials: 'include',
        })
        return { ok: res.ok, status: res.status, body: await res.text() }
      },
      { email, secret: e2eSecret }
    )

    if (!result.ok) {
      throw new Error(`E2E signin failed: ${result.status} ${result.body}`)
    }

    // Navigate to trigger middleware/session validation and confirm we are
    // not redirected back to the login page.
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 15000 })
  })

  test('dashboard renders and shows navigation', async ({ page }) => {
    await page.goto('/dashboard')
    // Must not be redirected away from the authenticated section
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 15000 })
    // Bottom tab navigation must be present (rendered by AppShell for all authenticated users)
    await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: 'Chat' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Care' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Scan' }).first()).toBeVisible()
  })

  test('care page loads without errors', async ({ page }) => {
    // Next.js redirect() at the layout/middleware level causes ERR_ABORTED before
    // the response is committed. Catch it and check we didn't land on /login.
    try {
      await page.goto('/care', { waitUntil: 'domcontentloaded', timeout: 20000 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('ERR_ABORTED')) throw e
    }
    // Should land on care or a redirect target — never back to /login
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 10000 })
  })

  test('1upHealth connect page renders', async ({ page }) => {
    await page.goto('/connect')
    // Should display the connect accounts UI or redirect to onboarding — never crash
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 10000 })
    // At least one heading should be visible
    const connectHeading = page.getByRole('heading').first()
    await expect(connectHeading).toBeVisible({ timeout: 10000 })
    // No unhandled error overlay
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })

  test('AI chat interface renders', async ({ page }) => {
    // Next.js redirect() at the layout/middleware level causes ERR_ABORTED before
    // the response is committed. Catch it and check we didn't land on /login.
    try {
      await page.goto('/chat', { waitUntil: 'domcontentloaded', timeout: 20000 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('ERR_ABORTED')) throw e
    }
    // Should land on chat or a redirect target — never back to /login
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 10000 })
    // The chat server component calls redirect('/setup') inside a Suspense boundary
    // when the user has no care profile.  That redirect fires as part of the RSC
    // stream *after* goto() resolves, so we must wait for the network to settle
    // before reading the URL to avoid a race where onChat is briefly true while
    // the page is navigating away.
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    // If the user has a profile, the chat input must be present
    const onChat = page.url().includes('/chat')
    if (onChat) {
      // Accept textarea, input[type=text], or role=textbox
      const chatInput = page.locator('textarea, input[type="text"]').first()
      await expect(chatInput).toBeVisible({ timeout: 10000 })
    }
  })

  test('medications data renders on care page', async ({ page }) => {
    try {
      await page.goto('/care', { waitUntil: 'domcontentloaded', timeout: 20000 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('ERR_ABORTED')) throw e
    }
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 10000 })
    if (page.url().includes('/care')) {
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      const medContent = page.locator('h3, h4, [class*="medication"], [class*="med-"]').first()
      await expect(medContent).toBeVisible({ timeout: 10000 })
    }
  })

  test('AI chat responds to a message', async ({ page }) => {
    try {
      await page.goto('/chat', { waitUntil: 'domcontentloaded', timeout: 20000 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('ERR_ABORTED')) throw e
    }
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    const onChat = page.url().includes('/chat')
    if (!onChat) return

    const chatInput = page.locator('textarea, input[type="text"]').first()
    await expect(chatInput).toBeVisible({ timeout: 10000 })
    await chatInput.fill('hello')
    await chatInput.press('Enter')

    const assistantMessage = page.locator('[data-role="assistant"], .assistant-message, [class*="assistant"]').first()
    await expect(assistantMessage).toBeVisible({ timeout: 30000 })
  })

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

  test('no unexpected console errors during navigation', async ({ page }) => {
    const errors: string[] = []
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

  test('notifications exist (cron health check)', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 })
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 15000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

    // The NotificationBell renders in the header — look for the bell button
    const bell = page.locator('button').filter({ has: page.locator('svg') }).first()
    await expect(bell).toBeVisible({ timeout: 10000 })
    await bell.click()

    // After clicking, a notification dropdown/list should appear with at least one item
    const notificationItem = page.locator('a, li, div').filter({ hasText: /refill|appointment|lab|update|reminder/i }).first()
    await expect(notificationItem).toBeVisible({ timeout: 5000 })
  })
})
