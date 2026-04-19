import { test, expect } from '@playwright/test'

test.describe('Production 24/7 Monitor', () => {
  // All tests in this suite are strictly for the deployed production environment.
  // They are skipped when PLAYWRIGHT_BASE_URL is not set.
  test.beforeEach(() => {
    test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'This test suite only runs against a deployed environment.')
  })

  test.beforeEach(async ({ page }) => {
    const email = process.env.E2E_MONITOR_EMAIL!
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL!

    // Authenticate via the dedicated E2E endpoint.
    // Use page.request so that Set-Cookie headers are stored in the browser
    // context and are automatically sent on the next page.goto() call.
    const res = await page.request.post(`${baseUrl}/api/e2e/signin`, {
      data: { email },
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok()) {
      throw new Error(`E2E signin failed: ${res.status()} ${await res.text()}`)
    }

    // Manually copy any Set-Cookie headers into the browser context to ensure
    // they are sent on subsequent navigations (Playwright's APIRequestContext
    // stores cookies separately from the BrowserContext by default).
    const rawCookies = res.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie')
    for (const { value } of rawCookies) {
      // Parse each Set-Cookie header and add it to the browser context.
      const parts = value.split(';').map(p => p.trim())
      const [nameVal] = parts
      const eqIdx = nameVal.indexOf('=')
      const cookieName = nameVal.slice(0, eqIdx)
      const cookieValue = nameVal.slice(eqIdx + 1)
      const domain = new URL(baseUrl).hostname
      await page.context().addCookies([{
        name: cookieName,
        value: cookieValue,
        domain,
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      }])
    }

    // Navigate to trigger middleware/session validation and confirm we are
    // not redirected back to the login page.
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 15000 })
  })

  test.afterEach(async ({ page }) => {
    // Ensure no unhandled error overlay appeared during any test
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })

  test('dashboard renders and shows navigation', async ({ page }) => {
    await page.goto('/dashboard')
    // Core branding must be visible
    await expect(page.getByText('CareCompanion')).toBeVisible({ timeout: 15000 })
    // Bottom tab navigation must be present
    await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Chat' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Care' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Scan' }).first()).toBeVisible()
  })

  test('care page loads without errors', async ({ page }) => {
    await page.goto('/care')
    // Should land on care or be redirected (e.g. to /setup) but never back to /login
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 10000 })
  })

  test('1upHealth connect page renders', async ({ page }) => {
    await page.goto('/connect')
    // Should display the connect accounts UI or redirect to onboarding — never crash
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 10000 })
    // At least one heading should be visible
    const connectHeading = page.getByRole('heading').first()
    await expect(connectHeading).toBeVisible({ timeout: 10000 })
  })

  test('AI chat interface renders', async ({ page }) => {
    await page.goto('/chat')
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
      await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 10000 })
    }
  })
})
