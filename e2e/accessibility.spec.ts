import { test, expect } from '@playwright/test'

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    const createAccountText = page.getByText(/Create an account/i)
    if (await createAccountText.isVisible()) {
      await createAccountText.click()
    }
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(7)
    await page.getByPlaceholder('e.g., Sarah').fill(`A11y ${uniqueId}`)
    await page.locator('input[type="email"]').fill(`a11y_${uniqueId}@example.com`)
    await page.locator('input[type="password"]').fill('SecurePassword123!')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
    await page.goto('/dashboard')
  })

  test('navigation has proper ARIA label', async ({ page }) => {
    // BottomTabBar renders <nav aria-label="Main navigation">
    const nav = page.getByRole('navigation', { name: /main navigation/i })
    await expect(nav).toBeVisible({ timeout: 10000 })
  })

  test('active tab has aria-current="page"', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i })
    await expect(nav).toBeVisible({ timeout: 10000 })
    // On the dashboard, the Home link should have aria-current="page"
    const activeTab = nav.locator('[aria-current="page"]')
    await expect(activeTab).toHaveCount(1)
    // The active tab on dashboard should be "Home"
    await expect(activeTab).toHaveText(/home/i)
  })

  test('bottom tab bar has all navigation links', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i })
    await expect(nav).toBeVisible({ timeout: 10000 })
    const links = nav.getByRole('link')
    const count = await links.count()
    expect(count).toBe(4) // Home, Chat, Care, Scan
  })

  test('bottom tab bar is keyboard navigable', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i })
    await expect(nav).toBeVisible({ timeout: 10000 })
    // Each tab link should be focusable
    const links = nav.getByRole('link')
    const count = await links.count()
    for (let i = 0; i < count; i++) {
      const link = links.nth(i)
      await link.focus()
      await expect(link).toBeFocused()
    }
  })

  test('aria-current updates when navigating', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i })
    await expect(nav).toBeVisible({ timeout: 10000 })
    // Navigate to Care page
    await page.getByRole('link', { name: 'Care' }).first().click()
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 5000 })
    // Now the Care link should have aria-current="page"
    const activeTab = nav.locator('[aria-current="page"]')
    await expect(activeTab).toHaveText(/care/i)
  })
})
