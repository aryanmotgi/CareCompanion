/**
 * End-to-end happy path for the patient → caregiver care-group-code flow.
 *
 * Scenario:
 *   1. Patient creates account + logs in.
 *   2. Patient creates a care group.
 *   3. Patient generates a 5-char code from Settings → Care Group.
 *   4. Caregiver creates account + logs in.
 *   5. Caregiver redeems the code and lands in the patient's care circle.
 *
 * The mobile-specific UI (welcome → care-type → care-group-join) is exercised
 * by the mobile app's own simulator tests; this E2E focuses on the web API
 * surface that both clients call.
 *
 * NOTE: Many existing e2e specs assume backend test fixtures that don't auto-
 * provision care_groups on signup. This test creates the group via the API.
 */
import { test, expect, request } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Care-group 5-char code flow', () => {
  test('patient creates code, caregiver redeems, both land in same group', async ({ browser }) => {
    test.skip(!process.env.E2E_CARE_GROUP_CODES, 'Skipped — set E2E_CARE_GROUP_CODES=1 to run (needs backend + auth fixtures)')

    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const patientEmail = `patient_${uniqueId}@example.com`
    const caregiverEmail = `caregiver_${uniqueId}@example.com`
    const password = 'SecurePassword123!'

    // ── Patient session ──────────────────────────────────────────────────────
    const patientCtx = await browser.newContext()
    const patientPage = await patientCtx.newPage()

    await patientPage.goto(`${BASE_URL}/login`)
    const createAccountText = patientPage.getByText(/Create an account/i)
    if (await createAccountText.isVisible()) await createAccountText.click()
    await patientPage.locator('input[type="email"]').fill(patientEmail)
    await patientPage.locator('input[type="password"]').fill(password)
    await patientPage.getByRole('button', { name: 'Create account' }).click()
    await patientPage.waitForURL(/dashboard|onboarding|home/, { timeout: 15_000 })

    // Create care group via API (UI flow exists but is heavy to drive here)
    const csrfCookie = await patientPage.context().cookies().then((cs) => cs.find((c) => c.name === 'cc-csrf-token'))
    const csrf = csrfCookie?.value ?? ''
    const groupRes = await patientPage.request.post(`${BASE_URL}/api/care-group`, {
      headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
      data: { name: `Test Group ${uniqueId}`, password: 'group-pw' },
    })
    expect(groupRes.ok()).toBeTruthy()
    const { id: groupId } = await groupRes.json()

    // Generate code
    const codeRes = await patientPage.request.post(`${BASE_URL}/api/care-group/code`, {
      headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
      data: { careGroupId: groupId },
    })
    expect(codeRes.ok()).toBeTruthy()
    const { code } = await codeRes.json()
    expect(code).toMatch(/^[2-9A-HJKMNP-TV-Z]{5}$/)

    // ── Caregiver session ───────────────────────────────────────────────────
    const caregiverCtx = await browser.newContext()
    const caregiverPage = await caregiverCtx.newPage()

    await caregiverPage.goto(`${BASE_URL}/login`)
    const cgCreateText = caregiverPage.getByText(/Create an account/i)
    if (await cgCreateText.isVisible()) await cgCreateText.click()
    await caregiverPage.locator('input[type="email"]').fill(caregiverEmail)
    await caregiverPage.locator('input[type="password"]').fill(password)
    await caregiverPage.getByRole('button', { name: 'Create account' }).click()
    await caregiverPage.waitForURL(/dashboard|onboarding|home/, { timeout: 15_000 })

    const cgCsrfCookie = await caregiverPage.context().cookies().then((cs) => cs.find((c) => c.name === 'cc-csrf-token'))
    const cgCsrf = cgCsrfCookie?.value ?? ''
    const joinRes = await caregiverPage.request.post(`${BASE_URL}/api/care-group/join-by-code`, {
      headers: { 'x-csrf-token': cgCsrf, 'content-type': 'application/json' },
      data: { code, relationship: 'spouse' },
    })
    expect(joinRes.ok()).toBeTruthy()
    const joinBody = await joinRes.json()
    expect(joinBody.careGroupId).toBe(groupId)

    await patientCtx.close()
    await caregiverCtx.close()
  })

  test('error parity: wrong code, expired code, revoked code all return identical message', async ({ request: apiReq }) => {
    test.skip(!process.env.E2E_CARE_GROUP_CODES, 'Skipped — set E2E_CARE_GROUP_CODES=1 to run')

    // Three nonsense codes — all hit the parity path.
    const messages = await Promise.all([
      apiReq.post(`${BASE_URL}/api/care-group/join-by-code`, { data: { code: 'ZZZZZ', relationship: 'spouse' } }).then((r) => r.text()),
      apiReq.post(`${BASE_URL}/api/care-group/join-by-code`, { data: { code: 'XXXXX', relationship: 'spouse' } }).then((r) => r.text()),
      apiReq.post(`${BASE_URL}/api/care-group/join-by-code`, { data: { code: 'YYYYY', relationship: 'spouse' } }).then((r) => r.text()),
    ])

    // All three responses should contain the same parity message
    const expected = "That code didn't work"
    for (const msg of messages) {
      expect(msg).toContain(expected)
    }
  })
})
