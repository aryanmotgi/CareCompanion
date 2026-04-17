import { defineConfig, devices } from '@playwright/test'

// When PLAYWRIGHT_BASE_URL points at a remote host (e.g. production), there is
// nothing to spin up locally.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const isRemoteTarget = !baseURL.includes('localhost') && !baseURL.includes('127.0.0.1')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Only start a local dev server when not targeting a remote URL.
  webServer: isRemoteTarget
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
      },
})
