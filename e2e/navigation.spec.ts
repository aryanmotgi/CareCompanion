import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('e.g., Sarah').fill('E2E Tester')
    await page.getByRole('button', { name: 'Get started' }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 })
    // New users may land on /connect (onboarding) — navigate to dashboard
    await page.goto('/dashboard')
  })

  test('bottom tab bar is visible on dashboard', async ({ page }) => {
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
  })

  test('tab bar has Home, Chat, Care, Scan links', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Chat' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Care' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Scan' })).toBeVisible()
  })

  test('clicking Chat navigates away from dashboard', async ({ page }) => {
    await page.getByRole('link', { name: 'Chat' }).click()
    // New users without a profile may be redirected to /connect for onboarding
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 5000 })
  })

  test('can navigate to care page', async ({ page }) => {
    await page.getByRole('link', { name: 'Care' }).click()
    await expect(page).toHaveURL(/\/care/)
  })

  test('can navigate to scan page', async ({ page }) => {
    await page.getByRole('link', { name: 'Scan' }).click()
    await expect(page).toHaveURL(/\/scans/)
  })
})
