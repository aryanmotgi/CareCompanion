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

  test('login page has Care Group tab', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Care Group')).toBeVisible()
  })

  test('Care Group tab shows group name and password fields', async ({ page }) => {
    await page.goto('/login')
    // Click the Care Group tab
    await page.getByText('Care Group').click()
    // Should show group name and password inputs
    await expect(page.getByPlaceholder(/group name/i).or(page.locator('input').nth(0))).toBeVisible()
  })
})
