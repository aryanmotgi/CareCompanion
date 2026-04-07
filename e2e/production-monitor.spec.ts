import { test, expect } from '@playwright/test'

test.describe('Production 24/7 Monitor', () => {
  test('core application routes render without errors', async ({ page }) => {
    test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'This test is strictly for the deployed production environment.')
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('test_automation@example.com')
    await page.locator('input[type="password"]').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 15000 })
    await page.goto('/dashboard')

    // Ensure we can see the dashboard loaded (marks successful app load)
    await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible({ timeout: 15000 })

    // Verify Meds Page loads without 500
    await page.getByRole('link', { name: 'Care' }).first().click()
    await expect(page).toHaveURL(/.*\/care/)
    
    // Navigating back
    await page.getByRole('link', { name: 'Home' }).first().click()
    
    // Verify Chat Page loads 
    await page.getByRole('link', { name: 'Chat' }).first().click()
    await expect(page).toHaveURL(/.*\/chat/)
  })
})
