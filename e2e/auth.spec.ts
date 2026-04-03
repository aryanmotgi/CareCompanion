import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('CareCompanion')).toBeVisible()
    await expect(page.getByPlaceholder('e.g., Sarah')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
  })

  test('login button is disabled without a name', async ({ page }) => {
    await page.goto('/login')
    const button = page.getByRole('button', { name: 'Get started' })
    await expect(button).toBeDisabled()
  })

  test('successful login redirects away from login', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('e.g., Sarah').fill('Test User')
    await page.getByRole('button', { name: 'Get started' }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 })
  })
})
