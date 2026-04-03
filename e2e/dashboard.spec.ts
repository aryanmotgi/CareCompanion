import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('e.g., Sarah').fill('E2E Tester')
    await page.getByRole('button', { name: 'Get started' }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 })
  })

  test('dashboard loads without errors', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })

  test('dashboard shows app branding', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('CareCompanion')).toBeVisible()
  })
})
