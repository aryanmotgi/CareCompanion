import { test, expect } from '@playwright/test'

test.describe('Production 24/7 Monitor', () => {
  // All tests in this suite are strictly for the deployed production environment.
  // They are skipped when PLAYWRIGHT_BASE_URL is not set.
  test.beforeEach(() => {
    test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'This test suite only runs against a deployed environment.')
  })

  test.beforeEach(async ({ page, context }) => {
    const email = process.env.E2E_MONITOR_EMAIL!

    // Clear all cookies before each test to prevent stale session tokens from
    // a previous test causing ERR_TOO_MANY_REDIRECTS (stale JWT + redirect loop).
    await context.clearCookies()

    // Navigate to the site first so the browser context has the correct origin,
    // then call the E2E signin endpoint via fetch inside the page (same origin).
    // This means the browser itself handles Set-Cookie, including Secure cookies.
    await page.goto('/login')
    const result = await page.evaluate(
      async ({ email }: { email: string }) => {
        const res = await fetch('/api/e2e/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
          credentials: 'include',
        })
        return { ok: res.ok, status: res.status, body: await res.text() }
      },
      { email }
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
    // waitUntil:'commit' prevents ERR_ABORTED when Next.js redirect() fires inside
    // a Suspense boundary (the redirect aborts the load event but commits the response).
    await page.goto('/care', { waitUntil: 'commit' })
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
    // Should land on care or be redirected (e.g. to /setup) but never back to /login
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 10000 })
    // The care page may show data-fetch errors for a minimal E2E profile — only
    // flag a crash if the entire page fails to render (no nav at all).
    const hasNav = await page.getByRole('link', { name: 'Home' }).first().isVisible().catch(() => false)
    if (!hasNav) {
      throw new Error('Care page rendered without navigation — possible crash')
    }
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
    // waitUntil:'commit' prevents ERR_ABORTED when Next.js redirect() fires inside
    // a Suspense boundary (the redirect aborts the load event but commits the response).
    await page.goto('/chat', { waitUntil: 'commit' })
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
    // Should land on chat or be redirected to setup — never back to /login
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
})
