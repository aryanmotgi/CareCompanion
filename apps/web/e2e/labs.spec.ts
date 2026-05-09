import { test, expect } from '@playwright/test'
import { signInOrSkip } from './helpers'

test.describe('Labs Page', () => {
  test.beforeEach(async ({ page }) => {
    await signInOrSkip(page)
    await page.goto('/labs')
  })

  test('lab results page loads without errors', async ({ page }) => {
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible({ timeout: 15000 })
  })

  test('displays lab results heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /lab results/i })).toBeVisible({ timeout: 15000 })
  })

  test('shows empty state or lab results list', async ({ page }) => {
    // Page should either show results or an empty state — never a blank/broken page
    await expect(page.getByRole('heading', { name: /lab results/i })).toBeVisible({ timeout: 15000 })
    const hasResults = await page.getByRole('list').isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/no lab results/i).isVisible().catch(() => false)
    const hasUploadPrompt = await page.getByText(/upload/i).isVisible().catch(() => false)
    expect(hasResults || hasEmptyState || hasUploadPrompt).toBe(true)
  })

  test('upload or add lab result button is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /lab results/i })).toBeVisible({ timeout: 15000 })
    // The labs page should have an action to add or upload results
    const addButton = page.getByRole('button', { name: /upload|add|import/i })
    await expect(addButton.first()).toBeVisible({ timeout: 10000 })
  })
})
