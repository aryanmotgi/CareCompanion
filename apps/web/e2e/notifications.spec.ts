import { test, expect } from '@playwright/test'

test.describe('Notifications Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    const createAccountText = page.getByText(/Create an account/i)
    if (await createAccountText.isVisible()) {
      await createAccountText.click()
    }
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(7)
    await page.getByPlaceholder('e.g., Sarah').fill(`Notif ${uniqueId}`)
    await page.locator('input[type="email"]').fill(`notif_${uniqueId}@example.com`)
    await page.locator('input[type="password"]').fill('SecurePassword123!')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
    await page.goto('/notifications')
  })

  test('navigates to notifications page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible({ timeout: 10000 })
  })

  test('filter tabs are visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible({ timeout: 10000 })
    // The NotificationsView renders filter tab buttons: All, Unread, Medications, Appointments, Labs, Insurance
    const tabs = ['All', 'Unread', 'Medications', 'Appointments', 'Labs', 'Insurance']
    for (const tab of tabs) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible()
    }
  })

  test('filter tabs can be clicked', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible({ timeout: 10000 })
    const tabs = ['All', 'Unread', 'Medications', 'Appointments', 'Labs', 'Insurance']
    for (const tab of tabs) {
      const button = page.getByRole('button', { name: tab })
      await button.click()
      // After clicking, the button should still be present (active filter)
      await expect(button).toBeVisible()
    }
  })

  test('shows empty state for new user', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible({ timeout: 10000 })
    // New user should have no notifications
    await expect(page.getByText(/all caught up/i)).toBeVisible()
  })
})
