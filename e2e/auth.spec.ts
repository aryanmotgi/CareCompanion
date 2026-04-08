import { test, expect } from '@playwright/test'
import { signInOrSkip } from './helpers'

test.describe('Authentication', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('CareCompanion').first()).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('successful login redirects away from login', async ({ page }) => {
    await signInOrSkip(page)
    await expect(page).not.toHaveURL(/\/login/)
  })
})
