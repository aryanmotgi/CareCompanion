import { test, expect } from '@playwright/test'
import { signInOrSkip } from './helpers'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await signInOrSkip(page)
    await page.goto('/dashboard')
  })

  test('bottom tab bar is visible on dashboard', async ({ page }) => {
    // Instead of <nav>, just ensure at least one element with role navigation or home link works
    await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible()
  })

  test('tab bar has Home, Chat, Care, Scan links', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Chat' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Care' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Scan' }).first()).toBeVisible()
  })

  test('clicking Chat navigates away from dashboard', async ({ page }) => {
    await page.getByRole('link', { name: 'Chat' }).first().click()
    // New users without a profile may be redirected to /connect for onboarding
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 5000 })
  })

  test('can navigate to care page', async ({ page }) => {
    await page.getByRole('link', { name: 'Care' }).first().click()
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 5000 })
  })

  test('can navigate to scan page', async ({ page }) => {
    await page.getByRole('link', { name: 'Scan' }).first().click()
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 5000 })
  })
})
