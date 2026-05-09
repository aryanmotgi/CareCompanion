import { test, expect } from '@playwright/test'
import { signInOrSkip } from './helpers'

test.describe('Visual Regression', () => {
  test('login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveScreenshot('login.png', { fullPage: true, maxDiffPixelRatio: 0.01 })
  })

  test('dashboard', async ({ page }) => {
    await signInOrSkip(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('dashboard.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  })

  test('medications page', async ({ page }) => {
    await signInOrSkip(page)
    await page.goto('/medications')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('medications.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  })

  test('settings page', async ({ page }) => {
    await signInOrSkip(page)
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('settings.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  })
})
