import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    const createAccountText = page.getByText(/Create an account/i)
    if (await createAccountText.isVisible()) {
      await createAccountText.click()
    }
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(7)
    await page.getByPlaceholder('e.g., Sarah').fill(`Dash ${uniqueId}`)
    await page.locator('input[type="email"]').fill(`dash_${uniqueId}@example.com`)
    await page.locator('input[type="password"]').fill('SecurePassword123!')
    await page.getByRole('button', { name: 'Create account' }).click()
    
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
    await page.goto('/dashboard')
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
