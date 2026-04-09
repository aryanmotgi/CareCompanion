import { test, expect } from '@playwright/test'

test.describe('Production 24/7 Monitor', () => {
  // All tests in this suite are strictly for the deployed production environment.
  // They are skipped when PLAYWRIGHT_BASE_URL is not set.
  test.beforeEach(() => {
    test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'This test suite only runs against a deployed environment.')
  })

  test.beforeEach(async ({ page }) => {
    const email = process.env.E2E_MONITOR_EMAIL || 'test_automation@example.com'
    const password = process.env.E2E_MONITOR_PASSWORD || 'password123'
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    // Allow any onboarding redirects to settle
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
    // If the user has a profile, the chat input must be present
    const onChat = page.url().includes('/chat')
    if (onChat) {
      await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 10000 })
    }
  })
})
