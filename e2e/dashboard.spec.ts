import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('test_automation@example.com')
    await page.locator('input[type="password"]').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    
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
