import { test, expect } from '@playwright/test'

test.describe('Production 24/7 Monitor', () => {
  test('core application routes render without errors', async ({ page }) => {
    // Navigate straight to login to be explicit
    await page.goto('/login')
    
    // Switch to create account mode
    const createAccountText = page.getByText(/Create an account/i)
    if (await createAccountText.isVisible()) {
      await createAccountText.click()
    }
    
    // Create dummy account to ensure fresh state and avoid headless captchas
    const uniqueId = Date.now()
    await page.getByPlaceholder('e.g., Sarah').fill(`Monitor ${uniqueId}`)
    await page.locator('input[type="email"]').fill(`monitor_${uniqueId}@example.com`)
    await page.locator('input[type="password"]').fill('SecurePassword123!')
    await page.getByRole('button', { name: 'Create account' }).click()
    
    // Wait for successful login and dashboard load
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 15000 })
    await page.goto('/dashboard')

    // Ensure we can see the bottom navigation (marks successful app load)
    const nav = page.locator('nav')
    await expect(nav).toBeVisible({ timeout: 15000 })

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
