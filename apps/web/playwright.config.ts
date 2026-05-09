import { defineConfig, devices } from '@playwright/test'

// When PLAYWRIGHT_BASE_URL points at a remote host (e.g. production), there is
// nothing to spin up locally.  Skipping the webServer also prevents failures
// caused by missing Supabase credentials in that environment.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const isRemoteTarget = !baseURL.includes('localhost') && !baseURL.includes('127.0.0.1')

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/visual-regression*/**', '**/visual-regression*'],
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
  // Provide Supabase placeholder fallbacks so the server can at least start and
  // serve the login page even when real credentials are absent from the runner.
  webServer: isRemoteTarget
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_SUPABASE_URL:
            process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.placeholder-signature-for-ci',
        },
      },
})
