import { test, expect } from '@playwright/test'

test.describe('Onboarding Flow', () => {
  test('login page loads with signup form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('CareCompanion').first()).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('signup redirects away from login page', async ({ page }) => {
    await page.goto('/login')

    // Switch to signup mode if needed
    const createAccountText = page.getByText(/Create an account/i)
    if (await createAccountText.isVisible()) {
      await createAccountText.click()
    }

    // Fill signup form
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(7)
    const nameInput = page.getByPlaceholder('e.g., Sarah')
    if (await nameInput.isVisible()) {
      await nameInput.fill(`Onboard ${uniqueId}`)
    }
    await page.locator('input[type="email"]').fill(`onboard_${uniqueId}@example.com`)
    await page.locator('input[type="password"]').fill('SecurePassword123!')

    await page.getByRole('button', { name: 'Create account' }).click()

    // After signup, user should leave the login page (redirect to onboarding or dashboard)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
  })

  test('onboarding step 1 shows role selection', async ({ page }) => {
    await page.goto('/login')

    const createAccountText = page.getByText(/Create an account/i)
    if (await createAccountText.isVisible()) {
      await createAccountText.click()
    }

    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(7)
    const nameInput = page.getByPlaceholder('e.g., Sarah')
    if (await nameInput.isVisible()) {
      await nameInput.fill(`Step1 ${uniqueId}`)
    }
    await page.locator('input[type="email"]').fill(`step1_${uniqueId}@example.com`)
    await page.locator('input[type="password"]').fill('SecurePassword123!')
    await page.getByRole('button', { name: 'Create account' }).click()

    // Wait to leave login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })

    // If redirected to onboarding, check for role selection (patient/caregiver)
    const url = page.url()
    if (url.includes('/onboarding')) {
      // Step 1: role selection — look for patient or caregiver options
      const patientOption = page.getByText(/patient/i).first()
      const caregiverOption = page.getByText(/caregiver/i).first()
      const hasRoleSelection = await patientOption.isVisible().catch(() => false) ||
                               await caregiverOption.isVisible().catch(() => false)
      expect(hasRoleSelection).toBe(true)

      // Click patient if visible
      if (await patientOption.isVisible().catch(() => false)) {
        await patientOption.click()
      }
    }
  })
})
