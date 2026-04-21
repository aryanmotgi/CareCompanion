import { test, expect } from '@playwright/test'

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    const createAccountText = page.getByText(/Create an account/i)
    if (await createAccountText.isVisible()) {
      await createAccountText.click()
    }
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(7)
    await page.getByPlaceholder('e.g., Sarah').fill(`Settings ${uniqueId}`)
    await page.locator('input[type="email"]').fill(`settings_${uniqueId}@example.com`)
    await page.locator('input[type="password"]').fill('SecurePassword123!')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
    await page.goto('/settings')
  })

  test('displays settings heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 })
  })

  test('displays settings sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 })
    // Verify key section labels are rendered
    await expect(page.getByText('Care Profile')).toBeVisible()
    await expect(page.getByText('App Preferences')).toBeVisible()
    await expect(page.getByText('Data Management')).toBeVisible()
    await expect(page.getByText('Privacy & Security')).toBeVisible()
  })

  test('theme toggle buttons are visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 })
    // ThemeToggle renders three buttons: Dark, Light, System
    await expect(page.getByRole('button', { name: /dark/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /light/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /system/i })).toBeVisible()
  })

  test('theme toggle switches between modes', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 })
    // Click Light to switch to light theme
    await page.getByRole('button', { name: /light/i }).click()
    // The ThemeProvider sets data-theme on the html element
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(theme).toBe('light')

    // Switch back to Dark
    await page.getByRole('button', { name: /dark/i }).click()
    const darkTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(darkTheme).toBe('dark')
  })

  test('change password form can be opened', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 })
    // Click "Change Password" row to open the form
    await page.getByText('Change Password').click()
    await expect(page.getByLabel(/new password/i)).toBeVisible()
  })
})
