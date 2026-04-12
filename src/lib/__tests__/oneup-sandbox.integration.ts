/**
 * 1upHealth Sandbox Integration Test
 *
 * Run manually:  npx tsx src/lib/__tests__/oneup-sandbox.integration.ts
 *
 * Tests against the real 1upHealth sandbox API to verify:
 * 1. Credentials are valid
 * 2. User creation works
 * 3. Auth code → token exchange flow shape is correct
 * 4. FHIR endpoints respond
 */

import { readFileSync } from 'fs'

// Load .env.local manually (no dotenv dependency needed)
try {
  const envFile = readFileSync('.env.local', 'utf-8')
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const val = match[2].trim()
      if (!process.env[key]) process.env[key] = val
    }
  }
} catch { /* .env.local not found — rely on existing env */ }

const CLIENT_ID = process.env.ONEUP_CLIENT_ID
const CLIENT_SECRET = process.env.ONEUP_CLIENT_SECRET
const BASE = 'https://api.1up.health'

// Colors for terminal output
const green = (s: string) => `\x1b[32m✓ ${s}\x1b[0m`
const red = (s: string) => `\x1b[31m✗ ${s}\x1b[0m`
const dim = (s: string) => `\x1b[2m  ${s}\x1b[0m`

let passed = 0
let failed = 0

function assert(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(green(label))
    passed++
  } else {
    console.log(red(label))
    if (detail) console.log(dim(detail))
    failed++
  }
}

async function run() {
  console.log('\n─── 1upHealth Sandbox Integration Test ───\n')

  // 0. Credentials present
  assert('ONEUP_CLIENT_ID is set', !!CLIENT_ID)
  assert('ONEUP_CLIENT_SECRET is set', !!CLIENT_SECRET)

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log(red('Cannot continue without credentials. Set ONEUP_CLIENT_ID and ONEUP_CLIENT_SECRET in .env.local'))
    process.exit(1)
  }

  // 1. Create a test user
  let oneupUserId: string | null = null
  const testAppUserId = `sandbox-test-${Date.now()}`

  try {
    const res = await fetch(`${BASE}/user-management/v1/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        app_user_id: testAppUserId,
      }),
    })

    const data = await res.json()
    oneupUserId = data.oneup_user_id || null

    assert('Create 1upHealth user — HTTP ' + res.status, res.ok, JSON.stringify(data))
    assert('Received oneup_user_id', !!oneupUserId, `oneup_user_id: ${oneupUserId}`)
  } catch (err) {
    assert('Create 1upHealth user — network', false, String(err))
  }

  // 2. Generate an access token for the test user (app token, not patient-authorized)
  let accessToken: string | null = null

  if (oneupUserId) {
    try {
      const res = await fetch(`${BASE}/user-management/v1/user/auth-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          oneup_user_id: oneupUserId,
        }),
      })

      const data = await res.json()
      console.log(dim('Auth code response: ' + JSON.stringify(data)))
      const authCode = data.code || data.auth_code || null

      assert('Get auth code for test user — HTTP ' + res.status, res.ok, JSON.stringify(data))
      assert('Received auth code', !!authCode, `code: ${authCode}`)

      if (authCode) {
        // Exchange auth code for token
        const tokenRes = await fetch(`${BASE}/oauth2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: authCode,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
          }).toString(),
        })

        const tokenData = await tokenRes.json()
        accessToken = tokenData.access_token || null

        assert('Token exchange — HTTP ' + tokenRes.status, tokenRes.ok, JSON.stringify({
          has_access_token: !!tokenData.access_token,
          has_refresh_token: !!tokenData.refresh_token,
          expires_in: tokenData.expires_in,
        }))
      }
    } catch (err) {
      assert('Auth code / token exchange — network', false, String(err))
    }
  }

  // 3. Test FHIR endpoints with the token
  if (accessToken) {
    const fhirResources = [
      'Patient',
      'MedicationRequest',
      'Condition',
      'AllergyIntolerance',
      'Observation?category=laboratory&_count=5',
      'Appointment',
      'Practitioner',
      'ExplanationOfBenefit',
      'Coverage',
    ]

    console.log('\n─── FHIR Resource Endpoints ───\n')

    for (const resource of fhirResources) {
      try {
        const url = `${BASE}/r4/${resource}${resource.includes('?') ? '&' : '?'}_count=2`
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/fhir+json',
          },
        })

        const data = await res.json()
        const entryCount = data.entry?.length ?? 0
        const label = resource.split('?')[0]

        assert(
          `${label} — HTTP ${res.status}, ${entryCount} entries`,
          res.ok,
          !res.ok ? JSON.stringify(data).slice(0, 200) : undefined
        )
      } catch (err) {
        assert(`${resource.split('?')[0]} — network`, false, String(err))
      }
    }
  } else {
    console.log(dim('Skipping FHIR tests — no access token'))
  }

  // Summary
  console.log(`\n─── Results: ${passed} passed, ${failed} failed ───\n`)

  if (failed > 0) {
    console.log(dim('Note: In sandbox mode, FHIR endpoints may return 0 entries.'))
    console.log(dim('This is expected — no patient has connected a health system yet.'))
    console.log(dim('The important thing is that endpoints return HTTP 200, not 401/403.'))
  }

  process.exit(failed > 0 ? 1 : 0)
}

run()
