import { expect, type Page, test } from '@playwright/test'

/**
 * Signs in using pre-confirmed test account credentials from environment
 * variables (E2E_TEST_EMAIL + E2E_TEST_PASSWORD).
 *
 * If those variables are not set the calling test is marked as skipped with a
 * descriptive message instead of failing.  This allows the CI suite to pass
 * cleanly when Supabase email confirmation is enabled and no dedicated test
 * account has been configured.
 *
 * To enable authenticated tests, add the following repository secrets:
 *   E2E_TEST_EMAIL    — email of a pre-confirmed Supabase user
 *   E2E_TEST_PASSWORD — password of that user
 */
export async function signInOrSkip(page: Page) {
  const testEmail = process.env.E2E_TEST_EMAIL
  const testPassword = process.env.E2E_TEST_PASSWORD

  if (!testEmail || !testPassword) {
    test.skip(true, 'Authenticated tests require E2E_TEST_EMAIL and E2E_TEST_PASSWORD. Set these as repository secrets to run them in CI.')
    return
  }

  await page.goto('/login')
  await page.locator('input[type="email"]').fill(testEmail)
  await page.locator('input[type="password"]').fill(testPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
}
