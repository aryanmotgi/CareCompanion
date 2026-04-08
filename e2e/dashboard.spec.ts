import { test, expect } from '@playwright/test'
import { signInOrSkip } from './helpers'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signInOrSkip(page)
    await page.goto('/dashboard')
  })

  test('dashboard loads without errors', async ({ page }) => {
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })

  test('dashboard shows app branding', async ({ page }) => {
    await expect(page.getByText('CareCompanion')).toBeVisible()
  })
})
