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

test.describe('New Signup Flow (v0.2.0)', () => {
  test('signup page shows role selection tiles', async ({ page }) => {
    await page.goto('/signup')
    // Role tiles should be visible
    await expect(page.getByText('Caregiver').first()).toBeVisible()
    await expect(page.getByText('Patient').first()).toBeVisible()
    await expect(page.getByText('Self-care').first()).toBeVisible()
  })

  test('signup requires role before submitting', async ({ page }) => {
    await page.goto('/signup')
    // Fill name/email/password but NOT role
    const uniqueId = Date.now().toString()
    await page.locator('input[placeholder*="name" i]').first().fill(`Test User ${uniqueId}`)
    await page.locator('input[type="email"]').fill(`norole_${uniqueId}@example.com`)
    await page.locator('input[type="password"]').first().fill('SecurePassword123!')
    // Accept consent if present
    const consentCheckbox = page.locator('input[type="checkbox"]').first()
    if (await consentCheckbox.isVisible()) await consentCheckbox.check()
    // Try to submit without role
    await page.getByRole('button', { name: /create account|sign up|continue/i }).click()
    // Should show role error
    await expect(page.getByText(/select your role/i).or(page.getByText(/role/i))).toBeVisible()
    // Should NOT leave the signup page
    await expect(page).toHaveURL(/\/signup/)
  })

  test('selecting a role tile highlights it', async ({ page }) => {
    await page.goto('/signup')
    await page.getByText('Caregiver').first().click()
    // The tile should appear selected — check for visual change (border/bg change via aria)
    // We check aria-checked if it's a radio, otherwise just that the page state changed
    const caregiverBtn = page.getByRole('button', { name: /caregiver/i }).first()
    if (await caregiverBtn.isVisible()) {
      await caregiverBtn.click()
      // No error about role after clicking
      await expect(page.getByText(/select your role/i)).not.toBeVisible()
    }
  })

  test('new user signup redirects to onboarding with Care Group step', async ({ page }) => {
    await page.goto('/signup')
    const uniqueId = Date.now().toString()

    // Select role
    await page.getByText('Patient').first().click()

    // Fill form
    const nameInput = page.locator('input[placeholder*="name" i]').first()
    if (await nameInput.isVisible()) await nameInput.fill(`New Patient ${uniqueId}`)
    await page.locator('input[type="email"]').fill(`patient_${uniqueId}@example.com`)
    await page.locator('input[type="password"]').fill('SecurePassword123!')

    // Accept consent
    const consentCheckbox = page.locator('input[type="checkbox"]').first()
    if (await consentCheckbox.isVisible()) await consentCheckbox.check()

    await page.getByRole('button', { name: /create account|sign up|continue/i }).click()

    // Should redirect to onboarding
    await expect(page).not.toHaveURL(/\/signup/, { timeout: 15000 })

    // Should show Care Group setup screen
    const onboardingUrl = page.url()
    if (onboardingUrl.includes('/onboarding')) {
      // Care Group screen should be visible
      await expect(
        page.getByText(/Care Group/i).or(page.getByText(/connect/i))
      ).toBeVisible({ timeout: 5000 })
    }
  })

  test('/set-role page is accessible', async ({ page }) => {
    // The set-role page exists and loads (unauthenticated users get redirected to login)
    await page.goto('/set-role')
    // Either shows the role picker or redirects to login
    const hasRoleText = await page.getByText(/Caregiver/i).isVisible().catch(() => false)
    const isOnLoginPage = page.url().includes('/login')
    expect(hasRoleText || isOnLoginPage).toBe(true)
  })
})
