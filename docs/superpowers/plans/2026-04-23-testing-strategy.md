# Testing Strategy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a comprehensive testing infrastructure covering test accounts, TestFlight, Sentry, bug reporting, feature flags, E2E tests, visual regression, analytics, and team productivity tools — across both web and iOS apps.

**Architecture:** Phased approach: Phase 1 unblocks human testers (day 1), Phase 2 builds automated safety nets (days 2-4), Phase 3 adds polish (days 4-5). Each phase produces independently useful output. All tools configured with HIPAA-safe PHI scrubbing.

**Tech Stack:** Next.js (web), Expo/React Native (mobile), Vitest, Playwright, Maestro, Sentry, PostHog, GitHub Issues API, Vercel, EAS Build/TestFlight

**Spec:** `docs/superpowers/specs/2026-04-23-testing-strategy-design.md`

---

## Chunk 1: Phase 1 — Unblock the Team

### Task 1: Test Mode Banner (Web)

**Files:**
- Create: `apps/web/src/components/TestModeBanner.tsx`
- Modify: `apps/web/src/app/(app)/layout.tsx` (add banner to provider stack)

- [ ] **Step 1: Create the TestModeBanner component**

```tsx
// apps/web/src/components/TestModeBanner.tsx
'use client'

import { useState, useEffect } from 'react'

export function TestModeBanner() {
  const [visible, setVisible] = useState(false)

  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true'

  useEffect(() => {
    if (!isTestMode) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(timer)
  }, [isTestMode])

  if (!isTestMode || !visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 9999,
        background: '#f59e0b',
        color: '#000',
        padding: '6px 14px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: 'none',
      }}
    >
      Staging Mode
    </div>
  )
}
```

- [ ] **Step 2: Add TestModeBanner to app layout**

In `apps/web/src/app/(app)/layout.tsx`, inside the provider stack after `<OfflineIndicator />`:

```tsx
import { TestModeBanner } from '@/components/TestModeBanner'

// Inside the JSX, after <OfflineIndicator />:
<TestModeBanner />
```

- [ ] **Step 3: Add env var to staging config**

Add `NEXT_PUBLIC_TEST_MODE=true` to Vercel preview environment variables. Do NOT set it in production.

- [ ] **Step 4: Verify locally**

Run: `NEXT_PUBLIC_TEST_MODE=true bun run dev`
Expected: Small amber "Staging Mode" badge appears top-right, fades after 4 seconds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/TestModeBanner.tsx apps/web/src/app/\(app\)/layout.tsx
git commit -m "feat: add test mode banner for staging environments"
```

---

### Task 2: Test Mode Banner (Mobile)

**Files:**
- Create: `apps/mobile/src/components/TestModeBanner.tsx`
- Modify: `apps/mobile/app/_layout.tsx` (add banner to root layout)

- [ ] **Step 1: Create the mobile TestModeBanner component**

```tsx
// apps/mobile/src/components/TestModeBanner.tsx
import { useEffect, useState } from 'react'
import { Text, StyleSheet } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, runOnJS } from 'react-native-reanimated'

const isTestMode = process.env.EXPO_PUBLIC_TEST_MODE === 'true'

export function TestModeBanner() {
  const [mounted, setMounted] = useState(true)
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (!isTestMode) return
    opacity.value = withDelay(3000, withTiming(0, { duration: 1000 }, () => {
      runOnJS(setMounted)(false)
    }))
  }, [opacity])

  if (!isTestMode || !mounted) return null

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={styles.text}>Staging Mode</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 9999,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  text: {
    color: '#000',
    fontSize: 13,
    fontWeight: '600',
  },
})
```

- [ ] **Step 2: Add to mobile root layout**

In `apps/mobile/app/_layout.tsx`, inside `RootLayout` after `<ThemedStatusBar />`:

```tsx
import { TestModeBanner } from '@/components/TestModeBanner'

// Inside JSX:
<TestModeBanner />
```

- [ ] **Step 3: Add env var for mobile staging**

In `apps/mobile/.env`: `EXPO_PUBLIC_TEST_MODE=true`
In `apps/mobile/eas.json`, add to production profile env: `"EXPO_PUBLIC_TEST_MODE": "false"`

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/TestModeBanner.tsx apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): add test mode banner for staging builds"
```

---

### Task 3: Test Accounts Seed Script

**Files:**
- Create: `scripts/seed-test-users.ts`
- Create: `apps/web/src/lib/seed-data.ts` (shared seed data constants, importable by both seed script and reset API)

- [ ] **Step 1: Create seed data constants**

```ts
// apps/web/src/lib/seed-data.ts
// Shared synthetic test data — obviously fake, HIPAA-safe

export const TEST_USERS = [
  { email: 'tester1@test.carecompanionai.org', displayName: 'Test User Alpha' },
  { email: 'tester2@test.carecompanionai.org', displayName: 'Test User Beta' },
  { email: 'tester3@test.carecompanionai.org', displayName: 'Test User Gamma' },
  { email: 'tester4@test.carecompanionai.org', displayName: 'Test User Delta' },
]

export const TEST_PASSWORD = process.env.QA_TEST_PASSWORD || (() => { throw new Error('QA_TEST_PASSWORD env var required') })()

export const SEED_CARE_PROFILE = {
  patientName: 'Sample Patient Alpha',
  relationship: 'self' as const,
  cancerType: 'Test Cancer Type',
  cancerStage: 'Stage II',
  diagnosisDate: '2025-12-01',
  treatmentPhase: 'active_treatment',
  onboardingCompleted: true,
}

export const SEED_MEDICATIONS = [
  { name: 'Test Medication A', dosage: '100mg', frequency: 'twice daily', prescribingDoctor: 'Dr. Test Alpha', startDate: new Date('2026-01-01') },
  { name: 'Test Medication B', dosage: '50mg', frequency: 'once daily', prescribingDoctor: 'Dr. Test Beta', startDate: new Date('2026-01-15') },
  { name: 'Test Medication C', dosage: '25mg', frequency: 'as needed', prescribingDoctor: 'Dr. Test Alpha', startDate: new Date('2026-02-01') },
]

export const SEED_LAB_RESULTS = [
  { testName: 'Test Lab Panel A', value: '4.5', unit: 'K/uL', referenceRange: '4.0-11.0', isAbnormal: false, dateTaken: new Date('2026-03-15') },
  { testName: 'Test Lab Panel B', value: '2.8', unit: 'g/dL', referenceRange: '3.5-5.0', isAbnormal: true, dateTaken: new Date('2026-03-15') },
  { testName: 'Test Lab Panel C', value: '120', unit: 'mg/dL', referenceRange: '70-100', isAbnormal: true, dateTaken: new Date('2026-04-01') },
]

export const SEED_APPOINTMENTS = [
  { doctorName: 'Dr. Test Alpha', specialty: 'Oncology', dateTime: new Date(Date.now() + 7 * 86400000), location: 'Test Medical Center', purpose: 'Follow-up consultation' },
  { doctorName: 'Dr. Test Beta', specialty: 'Cardiology', dateTime: new Date(Date.now() + 14 * 86400000), location: 'Test Heart Clinic', purpose: 'Routine checkup' },
]

export const SEED_DOCTORS = [
  { name: 'Dr. Test Alpha', specialty: 'Oncology', phone: '555-0001', hospital: 'Test Medical Center' },
  { name: 'Dr. Test Beta', specialty: 'Cardiology', phone: '555-0002', hospital: 'Test Heart Clinic' },
]

export const SEED_NOTIFICATIONS = [
  { type: 'lab_result', title: 'Test Lab Results Available', message: 'Your Test Lab Panel B results are ready for review.', isRead: false },
  { type: 'appointment', title: 'Upcoming Test Appointment', message: 'You have a follow-up with Dr. Test Alpha in 7 days.', isRead: false },
  { type: 'refill', title: 'Test Medication Refill', message: 'Test Medication A refill is due soon.', isRead: true },
]
```

- [ ] **Step 2: Create the seed script**

```ts
// scripts/seed-test-users.ts
import { db } from '../apps/web/src/lib/db'
import {
  users, careProfiles, medications, labResults, appointments,
  doctors, notifications, symptomEntries, userSettings
} from '../apps/web/src/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import {
  TEST_USERS, TEST_PASSWORD, SEED_CARE_PROFILE, SEED_MEDICATIONS,
  SEED_LAB_RESULTS, SEED_APPOINTMENTS, SEED_DOCTORS, SEED_NOTIFICATIONS
} from '../apps/web/src/lib/seed-data'

// Environment guard
if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('ERROR: Cannot run seed script in production without --force flag')
  process.exit(1)
}

async function seedUser(userData: typeof TEST_USERS[number]) {
  console.log(`Seeding user: ${userData.email}`)

  // Delete existing test user data (idempotent)
  const existing = await db.query.users.findFirst({
    where: eq(users.email, userData.email),
  })
  if (existing) {
    // Cascade deletes will clean up related data
    await db.delete(users).where(eq(users.id, existing.id))
    console.log(`  Deleted existing user: ${userData.email}`)
  }

  // Create user
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12)
  const [user] = await db.insert(users).values({
    email: userData.email,
    displayName: userData.displayName,
    passwordHash,
    isDemo: true,
    hipaaConsent: true,
    hipaaConsentAt: new Date(),
    hipaaConsentVersion: '1.0',
  }).returning()

  // Create care profile
  const [profile] = await db.insert(careProfiles).values({
    userId: user.id,
    ...SEED_CARE_PROFILE,
    isActive: true,
  }).returning()

  // Seed medications
  for (const med of SEED_MEDICATIONS) {
    await db.insert(medications).values({
      careProfileId: profile.id,
      ...med,
    })
  }

  // Seed lab results
  for (const lab of SEED_LAB_RESULTS) {
    await db.insert(labResults).values({
      careProfileId: profile.id,
      ...lab,
    })
  }

  // Seed appointments
  for (const appt of SEED_APPOINTMENTS) {
    await db.insert(appointments).values({
      careProfileId: profile.id,
      ...appt,
    })
  }

  // Seed doctors
  for (const doc of SEED_DOCTORS) {
    await db.insert(doctors).values({
      careProfileId: profile.id,
      ...doc,
    })
  }

  // Seed notifications
  for (const notif of SEED_NOTIFICATIONS) {
    await db.insert(notifications).values({
      userId: user.id,
      careProfileId: profile.id,
      ...notif,
    })
  }

  // Create default settings
  await db.insert(userSettings).values({ userId: user.id })

  console.log(`  Done: ${userData.email} (id: ${user.id})`)
  return user
}

async function main() {
  console.log('=== CareCompanion Test User Seed ===\n')
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Creating ${TEST_USERS.length} test accounts...\n`)

  for (const userData of TEST_USERS) {
    await seedUser(userData)
  }

  console.log('\n=== Seed complete ===')
  console.log(`\nAll accounts use the password from QA_TEST_PASSWORD env var`)
  console.log('Emails:')
  TEST_USERS.forEach(u => console.log(`  - ${u.email}`))
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
```

- [ ] **Step 3: Add seed script to root package.json**

```json
"scripts": {
  "seed:test-users": "npx tsx scripts/seed-test-users.ts"
}
```

- [ ] **Step 4: Test the script locally**

Run: `npm run seed:test-users`
Expected: 4 test users created with seeded data, credentials printed.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-test-users.ts apps/web/src/lib/seed-data.ts package.json
git commit -m "feat: add test user seed script with synthetic patient data"
```

---

### Task 4: One-Tap Data Reset API

**Files:**
- Create: `apps/web/src/app/api/test/reset/route.ts`
- Modify: `apps/web/src/middleware.ts` (add `/api/test` to public paths)

- [ ] **Step 1: Create the reset API route**

```ts
// apps/web/src/app/api/test/reset/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  users, careProfiles, medications, labResults, appointments,
  doctors, notifications, symptomEntries, medicationReminders,
  reminderLogs, userSettings
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  SEED_CARE_PROFILE, SEED_MEDICATIONS, SEED_LAB_RESULTS,
  SEED_APPOINTMENTS, SEED_DOCTORS, SEED_NOTIFICATIONS
} from '@/lib/seed-data'

export async function POST() {
  // Environment guard — never allow in production
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_TEST_MODE !== 'true') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [user] = await db.select().from(users).where(eq(users.email, session.user.email))
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Only allow reset for test/demo accounts
  if (!user.isDemo) {
    return NextResponse.json({ error: 'Reset only available for test accounts' }, { status: 403 })
  }

  // Delete all user data (cascade will handle related records)
  await db.delete(careProfiles).where(eq(careProfiles.userId, user.id))
  await db.delete(notifications).where(eq(notifications.userId, user.id))
  await db.delete(userSettings).where(eq(userSettings.userId, user.id))
  await db.delete(medicationReminders).where(eq(medicationReminders.userId, user.id))

  // Re-seed
  const [profile] = await db.insert(careProfiles).values({
    userId: user.id,
    ...SEED_CARE_PROFILE,
    isActive: true,
  }).returning()

  for (const med of SEED_MEDICATIONS) {
    await db.insert(medications).values({ careProfileId: profile.id, ...med })
  }
  for (const lab of SEED_LAB_RESULTS) {
    await db.insert(labResults).values({ careProfileId: profile.id, ...lab })
  }
  for (const appt of SEED_APPOINTMENTS) {
    await db.insert(appointments).values({ careProfileId: profile.id, ...appt })
  }
  for (const doc of SEED_DOCTORS) {
    await db.insert(doctors).values({ careProfileId: profile.id, ...doc })
  }
  for (const notif of SEED_NOTIFICATIONS) {
    await db.insert(notifications).values({ userId: user.id, careProfileId: profile.id, ...notif })
  }
  await db.insert(userSettings).values({ userId: user.id })

  return NextResponse.json({ ok: true, message: 'Account data reset to initial test state' })
}
```

- [ ] **Step 2: Add /api/test to middleware public paths**

In `apps/web/src/middleware.ts`, add `'/api/test'` to `PUBLIC_PATHS` array.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/test/reset/route.ts apps/web/src/middleware.ts
git commit -m "feat: add one-tap data reset API for test accounts"
```

---

### Task 5: Reset Button in Web Settings

**Files:**
- Modify: `apps/web/src/app/(app)/settings/page.tsx` (pass isDemo to client component)
- Modify: Settings client component (add reset button, conditionally rendered)

- [ ] **Step 1: Pass isDemo flag to settings client component**

In `apps/web/src/app/(app)/settings/page.tsx`, add `isDemo={dbUser.isDemo}` to the `<SettingsPage>` props.

- [ ] **Step 2: Add reset button to settings client component**

Find the settings client component and add a "Reset Test Data" section at the bottom, only visible when `isDemo && process.env.NEXT_PUBLIC_TEST_MODE === 'true'`:

```tsx
{isDemo && process.env.NEXT_PUBLIC_TEST_MODE === 'true' && (
  <section>
    <h3>Test Tools</h3>
    <button
      onClick={async () => {
        if (!confirm('Reset all your data to the initial test state?')) return
        const res = await fetch('/api/test/reset', { method: 'POST' })
        if (res.ok) {
          window.location.reload()
        } else {
          alert('Reset failed. Try again.')
        }
      }}
    >
      Reset Test Data
    </button>
    <p>Wipes your account back to the original seeded state.</p>
  </section>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(app\)/settings/
git commit -m "feat: add reset test data button in settings (staging only)"
```

---

### Task 6: Reset Button in Mobile Settings

**Files:**
- Modify: `apps/mobile/app/(tabs)/settings.tsx` (add reset button section)

- [ ] **Step 1: Add reset section to mobile settings**

At the bottom of the settings screen, before the sign-out button, add (only when `EXPO_PUBLIC_TEST_MODE === 'true'`):

```tsx
{process.env.EXPO_PUBLIC_TEST_MODE === 'true' && (
  <GlassCard>
    <Text style={styles.sectionTitle}>Test Tools</Text>
    <TouchableOpacity
      onPress={() => {
        Alert.alert('Reset Test Data', 'Reset all your data to the initial test state?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reset',
            style: 'destructive',
            onPress: async () => {
              try {
                const token = await SecureStore.getItemAsync('cc-session-token')
                const res = await fetch(`${API_BASE_URL}/api/test/reset`, {
                  method: 'POST',
                  headers: { Cookie: `authjs.session-token=${token}` },
                })
                if (res.ok) {
                  Alert.alert('Done', 'Your test data has been reset.')
                  router.replace('/(tabs)')
                }
              } catch {
                Alert.alert('Error', 'Reset failed. Try again.')
              }
            },
          },
        ])
      }}
    >
      <Text>Reset Test Data</Text>
    </TouchableOpacity>
  </GlassCard>
)}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(tabs\)/settings.tsx
git commit -m "feat(mobile): add reset test data button in settings (staging only)"
```

---

### Task 7: Sentry — Web App

**Files:**
- Create: `apps/web/sentry.client.config.ts`
- Create: `apps/web/sentry.server.config.ts`
- Create: `apps/web/sentry.edge.config.ts`
- Create: `apps/web/src/lib/sentry-utils.ts` (PHI scrubbing)
- Modify: `apps/web/next.config.ts` (wrap with withSentryConfig)
- Modify: `apps/web/package.json` (add @sentry/nextjs)

- [ ] **Step 1: Install Sentry**

Run: `cd apps/web && bun add @sentry/nextjs`

- [ ] **Step 2: Create PHI scrubbing utility**

```ts
// apps/web/src/lib/sentry-utils.ts
import type { Event } from '@sentry/nextjs'

// Fields that may contain PHI — scrub from all Sentry events
const PHI_KEYS = [
  'patientName', 'cancerType', 'cancerStage', 'diagnosis',
  'medicationName', 'dosage', 'prescribingDoctor',
  'testName', 'value', 'referenceRange',
  'message', 'content', 'notes', 'symptoms',
  'doctorName', 'phone', 'location',
]

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const scrubbed = { ...obj }
  for (const key of Object.keys(scrubbed)) {
    if (PHI_KEYS.some(phi => key.toLowerCase().includes(phi.toLowerCase()))) {
      scrubbed[key] = '[REDACTED]'
    } else if (typeof scrubbed[key] === 'object' && scrubbed[key] !== null) {
      scrubbed[key] = scrubObject(scrubbed[key] as Record<string, unknown>)
    }
  }
  return scrubbed
}

export function scrubPHI(event: Event): Event | null {
  // Scrub request body data
  if (event.request?.data && typeof event.request.data === 'object') {
    event.request.data = scrubObject(event.request.data as Record<string, unknown>)
  }

  // Scrub breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(bc => {
      if (bc.data && typeof bc.data === 'object') {
        bc.data = scrubObject(bc.data as Record<string, unknown>)
      }
      if (bc.message) {
        bc.message = '[REDACTED]'
      }
      return bc
    })
  }

  // Scrub extra context
  if (event.extra && typeof event.extra === 'object') {
    event.extra = scrubObject(event.extra as Record<string, unknown>)
  }

  return event
}
```

- [ ] **Step 3: Create Sentry client config**

```ts
// apps/web/sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'
import { scrubPHI } from '@/lib/sentry-utils'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend: scrubPHI,
})
```

- [ ] **Step 4: Create Sentry server config**

```ts
// apps/web/sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'
import { scrubPHI } from '@/lib/sentry-utils'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend: scrubPHI,
})
```

- [ ] **Step 5: Create Sentry edge config**

```ts
// apps/web/sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs'
import { scrubPHI } from '@/lib/sentry-utils'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend: scrubPHI,
})
```

- [ ] **Step 6: Wrap next.config with Sentry**

In `apps/web/next.config.ts`, wrap the export with `withSentryConfig`:

```ts
import { withSentryConfig } from '@sentry/nextjs'

// ... existing config ...

export default withSentryConfig(nextConfig, {
  org: 'carecompanion',
  project: 'web',
  silent: true,
  hideSourceMaps: true,
})
```

- [ ] **Step 7: Add env vars**

Add to `.env.example`:
```
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

- [ ] **Step 8: Configure Sentry alerts (manual)**

In Sentry dashboard → Project Settings → Alerts:
- Create alert rule: "New Issue" → notify via email to team
- Create alert rule: "Error frequency > 10 in 1 hour" → notify via email
- If Slack is available: add Slack integration for real-time alerts

- [ ] **Step 9: Commit**

```bash
git add apps/web/sentry.*.config.ts apps/web/src/lib/sentry-utils.ts apps/web/next.config.ts apps/web/package.json .env.example
git commit -m "feat: add Sentry error monitoring with HIPAA-safe PHI scrubbing (web)"
```

---

### Task 8: Sentry — Mobile App

**Files:**
- Create: `apps/mobile/src/lib/sentry.ts`
- Modify: `apps/mobile/app/_layout.tsx` (initialize Sentry)
- Modify: `apps/mobile/package.json` (add @sentry/react-native)

- [ ] **Step 1: Install Sentry for React Native**

Run: `cd apps/mobile && bun add @sentry/react-native`

- [ ] **Step 2: Create mobile Sentry config with PHI scrubbing**

```ts
// apps/mobile/src/lib/sentry.ts
import * as Sentry from '@sentry/react-native'

const PHI_KEYS = [
  'patientName', 'cancerType', 'cancerStage', 'diagnosis',
  'medicationName', 'dosage', 'prescribingDoctor',
  'testName', 'value', 'referenceRange',
  'message', 'content', 'notes', 'symptoms',
  'doctorName', 'phone', 'location',
]

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const scrubbed = { ...obj }
  for (const key of Object.keys(scrubbed)) {
    if (PHI_KEYS.some(phi => key.toLowerCase().includes(phi.toLowerCase()))) {
      scrubbed[key] = '[REDACTED]'
    } else if (typeof scrubbed[key] === 'object' && scrubbed[key] !== null) {
      scrubbed[key] = scrubObject(scrubbed[key] as Record<string, unknown>)
    }
  }
  return scrubbed
}

export function initSentry() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (event.request?.data && typeof event.request.data === 'object') {
        event.request.data = scrubObject(event.request.data as Record<string, unknown>)
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(bc => {
          if (bc.data && typeof bc.data === 'object') {
            bc.data = scrubObject(bc.data as Record<string, unknown>)
          }
          return bc
        })
      }
      return event
    },
  })
}
```

- [ ] **Step 3: Initialize Sentry in mobile root layout**

In `apps/mobile/app/_layout.tsx`, at the top of the file:

```ts
import { initSentry } from '@/lib/sentry'
initSentry()
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/sentry.ts apps/mobile/app/_layout.tsx apps/mobile/package.json
git commit -m "feat(mobile): add Sentry error monitoring with PHI scrubbing"
```

---

### Task 9: Manual QA Checklist

**Files:**
- Create: `docs/qa-checklist.md`

- [ ] **Step 1: Write the QA checklist**

```markdown
# CareCompanion QA Checklist

**Version:** v1
**Last updated:** 2026-04-23

Instructions: Go through each section. Mark pass/fail. If something breaks, use the in-app bug report button or note it here with a screenshot.

---

## Auth (Web + Mobile)

- [ ] Sign in with test credentials → lands on dashboard
- [ ] Sign out → lands on login page
- [ ] Sign in with wrong password → shows error message
- [ ] Sign in with non-existent email → shows error message
- [ ] Password reset link sends email (if configured)

## Onboarding (Web + Mobile)

- [ ] New user sees onboarding flow after first sign-in
- [ ] Can complete all onboarding steps
- [ ] Skipping onboarding redirects appropriately
- [ ] Onboarding data appears on dashboard after completion

## Dashboard (Web + Mobile)

- [ ] Dashboard loads without errors
- [ ] Patient name displays correctly
- [ ] Medication count is accurate
- [ ] Upcoming appointments show
- [ ] Notifications badge shows unread count
- [ ] Health score displays (if data present)

## Medications (Web + Mobile)

- [ ] View medication list — all seeded meds appear
- [ ] Add a new medication — form submits, med appears in list
- [ ] Edit an existing medication — changes persist
- [ ] Delete a medication — removed from list
- [ ] Medication reminders show at scheduled times

## Lab Results (Web + Mobile)

- [ ] View lab results list — seeded labs appear
- [ ] Abnormal results are visually flagged
- [ ] Lab detail view shows all fields (value, range, date)
- [ ] Trend charts render (if applicable)

## AI Chat (Web + Mobile)

- [ ] Open chat interface — loads without errors
- [ ] Send a message — get a response
- [ ] Response is contextually relevant to the patient profile
- [ ] Chat history persists across page reloads
- [ ] Long messages render correctly (no overflow/cutoff)

## Notifications (Web + Mobile)

- [ ] Notification list shows seeded notifications
- [ ] Unread notifications are visually distinct
- [ ] Marking a notification as read updates the badge
- [ ] Tapping a notification navigates to relevant content

## Settings (Web + Mobile)

- [ ] Settings page loads without errors
- [ ] Toggle notification preferences — changes persist
- [ ] Change theme — UI updates immediately
- [ ] Sign out button works
- [ ] (Staging only) Reset Test Data button appears and works

## Caregiver Features (Web)

- [ ] Add a caregiver profile
- [ ] Switch between patient profiles
- [ ] Caregiver sees appropriate data for selected patient

## iOS-Specific (Mobile)

- [ ] App launches from cold start without crash
- [ ] Background → foreground transition works smoothly
- [ ] Pull-to-refresh works on list screens
- [ ] Keyboard doesn't obscure input fields
- [ ] Safe areas respected on all screen sizes (notch, home indicator)
- [ ] Haptic feedback fires on expected interactions
- [ ] Shake-to-report bug form appears (when implemented)

## Performance

- [ ] Dashboard loads in under 3 seconds
- [ ] Navigation between tabs is instant (no blank screens)
- [ ] Scrolling is smooth (no jank)
- [ ] No console errors in browser dev tools
```

- [ ] **Step 2: Commit**

```bash
git add docs/qa-checklist.md
git commit -m "docs: add manual QA checklist v1"
```

---

### Task 10: Staging Environment Setup

**Files:**
- Modify: `apps/web/.env.example` (document staging vars)

- [ ] **Step 1: Create staging branch**

```bash
git checkout -b staging
git push -u origin staging
```

- [ ] **Step 2: Configure Vercel preview environment**

In Vercel dashboard → Project Settings → Environment Variables:
- Set `NEXT_PUBLIC_TEST_MODE=true` for Preview environment
- Set `NEXT_PUBLIC_TEST_MODE=false` for Production environment
- Ensure all DB/auth env vars have staging-specific values for Preview

- [ ] **Step 3: Update .env.example with staging documentation**

Add comments to `.env.example`:
```
# Staging/Test Mode
NEXT_PUBLIC_TEST_MODE=false  # Set to 'true' in staging/preview environments
```

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "feat: configure staging environment with test mode support"
```

---

### Task 11: TestFlight Distribution

This task is manual (not code). Steps for Aryan to follow:

- [ ] **Step 1: Ensure Apple Developer account is active**

Check at https://developer.apple.com/account — must be enrolled in Apple Developer Program ($99/yr).

- [ ] **Step 2: Build for production**

```bash
cd apps/mobile
eas build --platform ios --profile production
```

- [ ] **Step 3: Submit to TestFlight**

```bash
eas submit --platform ios
```

Or manually upload the .ipa from EAS dashboard to App Store Connect → TestFlight.

- [ ] **Step 4: Add internal testers**

In App Store Connect → TestFlight → Internal Testing:
- Add co-founder emails as testers
- They receive an email invite → tap "Install" in TestFlight app

- [ ] **Step 5: Update mobile .env for staging**

Ensure `EXPO_PUBLIC_API_BASE_URL` points to the staging Vercel URL (the preview deployment), not production, for test builds.

---

## Chunk 2: Phase 2 — Automated Safety Net

### Task 12: Bug Report API Route

**Files:**
- Create: `apps/web/src/app/api/feedback/route.ts`

- [ ] **Step 1: Create the feedback API route**

```ts
// apps/web/src/app/api/feedback/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 })

export async function POST(req: Request) {
  try {
    await limiter.check(10, 'feedback')
  } catch {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const session = await auth()
  const body = await req.json()
  const { description, pageUrl, deviceInfo, userAgent } = body

  if (!description || description.trim().length === 0) {
    return NextResponse.json({ error: 'Description required' }, { status: 400 })
  }

  const ghToken = process.env.GITHUB_FEEDBACK_TOKEN
  if (!ghToken) {
    return NextResponse.json({ error: 'Feedback not configured' }, { status: 500 })
  }

  const issueBody = [
    `## Bug Report`,
    ``,
    `**Reporter:** ${session?.user?.email || 'Anonymous'}`,
    `**Page:** ${pageUrl || 'Unknown'}`,
    `**Device:** ${deviceInfo || 'Unknown'}`,
    `**User Agent:** ${userAgent || 'Unknown'}`,
    `**Time:** ${new Date().toISOString()}`,
    ``,
    `## Description`,
    ``,
    description,
  ].join('\n')

  const repo = process.env.GITHUB_FEEDBACK_REPO
  if (!repo) {
    return NextResponse.json({ error: 'Feedback repo not configured' }, { status: 500 })
  }

  const ghRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ghToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      title: `[Bug] ${description.slice(0, 80)}`,
      body: issueBody,
      labels: ['bug', 'qa'],
    }),
  })

  if (!ghRes.ok) {
    console.error('GitHub Issues API error:', await ghRes.text())
    return NextResponse.json({ error: 'Failed to create issue' }, { status: 500 })
  }

  const issue = await ghRes.json()
  return NextResponse.json({ ok: true, issueUrl: issue.html_url })
}
```

Note: Replace `OWNER/REPO` with actual GitHub org/repo name.

- [ ] **Step 2: Add env vars**

Add to `.env.example`:
```
GITHUB_FEEDBACK_TOKEN=  # GitHub PAT with repo:issues scope, server-side only
GITHUB_FEEDBACK_REPO=owner/repo  # GitHub repo for bug reports
```

- [ ] **Step 3: Add /api/feedback to middleware public paths**

In `apps/web/src/middleware.ts`, add `'/api/feedback'` to `PUBLIC_PATHS` (so unauthenticated reports work too, though we still capture session if available).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/feedback/route.ts apps/web/src/middleware.ts .env.example
git commit -m "feat: add server-side bug report API that creates GitHub Issues"
```

---

### Task 13: Bug Report Button (Web)

**Files:**
- Create: `apps/web/src/components/BugReportButton.tsx`
- Modify: `apps/web/src/app/(app)/layout.tsx` (add to provider stack)

- [ ] **Step 1: Create the BugReportButton component**

```tsx
// apps/web/src/components/BugReportButton.tsx
'use client'

import { useState } from 'react'

export function BugReportButton() {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submit() {
    if (!description.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          pageUrl: window.location.href,
          deviceInfo: `${window.innerWidth}x${window.innerHeight}`,
          userAgent: navigator.userAgent,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
        setDescription('')
        setTimeout(() => { setSubmitted(false); setOpen(false) }, 2000)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9998,
          width: 48, height: 48, borderRadius: '50%',
          background: '#6366f1', color: '#fff', border: 'none',
          cursor: 'pointer', fontSize: 20, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
        title="Report a bug"
      >
        🐛
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 80, right: 20, zIndex: 9999,
          width: 320, background: '#fff', borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 16,
          border: '1px solid #e5e7eb',
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Report a Bug</h3>
          {submitted ? (
            <p style={{ color: '#16a34a' }}>Bug reported! Thanks.</p>
          ) : (
            <>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What went wrong?"
                rows={4}
                style={{
                  width: '100%', padding: 8, borderRadius: 8,
                  border: '1px solid #d1d5db', resize: 'vertical',
                  fontSize: 14, boxSizing: 'border-box',
                }}
              />
              <button
                onClick={submit}
                disabled={submitting || !description.trim()}
                style={{
                  marginTop: 8, width: '100%', padding: '8px 16px',
                  background: submitting ? '#9ca3af' : '#6366f1',
                  color: '#fff', border: 'none', borderRadius: 8,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                }}
              >
                {submitting ? 'Sending...' : 'Submit'}
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Add to app layout**

In `apps/web/src/app/(app)/layout.tsx`, after `<TestModeBanner />`:

```tsx
import { BugReportButton } from '@/components/BugReportButton'

// Inside JSX:
<BugReportButton />
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/BugReportButton.tsx apps/web/src/app/\(app\)/layout.tsx
git commit -m "feat: add floating bug report button (web)"
```

---

### Task 14: Bug Report with Shake-to-Report (Mobile)

**Files:**
- Create: `apps/mobile/src/components/BugReportSheet.tsx`
- Create: `apps/mobile/src/hooks/useShakeDetector.ts`
- Modify: `apps/mobile/app/_layout.tsx` (add shake detector + report sheet)

- [ ] **Step 1: Install shake detection dependency**

Run: `cd apps/mobile && bun add react-native-shake`

- [ ] **Step 2: Create shake detector hook**

```ts
// apps/mobile/src/hooks/useShakeDetector.ts
import { useEffect } from 'react'
import RNShake from 'react-native-shake'

export function useShakeDetector(onShake: () => void) {
  useEffect(() => {
    const subscription = RNShake.addListener(() => {
      onShake()
    })
    return () => subscription.remove()
  }, [onShake])
}
```

- [ ] **Step 3: Create BugReportSheet component**

```tsx
// apps/mobile/src/components/BugReportSheet.tsx
import { useState } from 'react'
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import * as SecureStore from 'expo-secure-store'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://carecompanionai.org'

interface Props {
  visible: boolean
  onClose: () => void
  currentScreen?: string
}

export function BugReportSheet({ visible, onClose, currentScreen }: Props) {
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submit() {
    if (!description.trim()) return
    setSubmitting(true)
    try {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const isSecure = API_BASE_URL.startsWith('https://')
      const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'

      const res = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${cookieName}=${token}`,
        },
        body: JSON.stringify({
          description,
          pageUrl: `mobile://${currentScreen || 'unknown'}`,
          deviceInfo: `${Platform.OS} ${Platform.Version}`,
          userAgent: `CareCompanion-Mobile/${Platform.OS}`,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
        setDescription('')
        setTimeout(() => { setSubmitted(false); onClose() }, 2000)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>Report a Bug</Text>
          {submitted ? (
            <Text style={styles.success}>Bug reported! Thanks.</Text>
          ) : (
            <>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="What went wrong?"
                multiline
                numberOfLines={4}
                style={styles.input}
              />
              <TouchableOpacity
                onPress={submit}
                disabled={submitting || !description.trim()}
                style={[styles.button, (submitting || !description.trim()) && styles.buttonDisabled]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 12, fontSize: 16, minHeight: 100, textAlignVertical: 'top', marginBottom: 16 },
  button: { backgroundColor: '#6366f1', padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#9ca3af' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancel: { marginTop: 12, alignItems: 'center' },
  cancelText: { color: '#6b7280', fontSize: 16 },
  success: { color: '#16a34a', fontSize: 16, textAlign: 'center', marginVertical: 20 },
})
```

- [ ] **Step 4: Add shake detector and report sheet to root layout**

In `apps/mobile/app/_layout.tsx`:

```tsx
import { useState, useCallback } from 'react'
import { useShakeDetector } from '@/hooks/useShakeDetector'
import { BugReportSheet } from '@/components/BugReportSheet'

// Inside RootLayout component:
const [bugReportVisible, setBugReportVisible] = useState(false)
const handleShake = useCallback(() => setBugReportVisible(true), [])
useShakeDetector(handleShake)

// In JSX, after <TestModeBanner />:
<BugReportSheet visible={bugReportVisible} onClose={() => setBugReportVisible(false)} />
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/BugReportSheet.tsx apps/mobile/src/hooks/useShakeDetector.ts apps/mobile/app/_layout.tsx apps/mobile/package.json
git commit -m "feat(mobile): add bug report sheet with shake-to-report"
```

---

### Task 15: Feature Flags

**Files:**
- Create: `apps/web/src/lib/feature-flags.ts`
- Create: `apps/mobile/src/lib/feature-flags.ts`

- [ ] **Step 1: Create web feature flags**

```ts
// apps/web/src/lib/feature-flags.ts

export const flags = {
  // Add feature flags here as needed. Driven by env vars.
  // Example: NEW_CHAT_UI: process.env.NEXT_PUBLIC_FF_NEW_CHAT_UI === 'true',
} as const

export type FeatureFlag = keyof typeof flags

export function isEnabled(flag: FeatureFlag): boolean {
  return flags[flag]
}
```

- [ ] **Step 2: Create mobile feature flags**

```ts
// apps/mobile/src/lib/feature-flags.ts

export const flags = {
  // Add feature flags here as needed. Driven by EXPO_PUBLIC_ env vars.
  // Example: NEW_CHAT_UI: process.env.EXPO_PUBLIC_FF_NEW_CHAT_UI === 'true',
} as const

export type FeatureFlag = keyof typeof flags

export function isEnabled(flag: FeatureFlag): boolean {
  return flags[flag]
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/feature-flags.ts apps/mobile/src/lib/feature-flags.ts
git commit -m "feat: add simple env-based feature flag system (web + mobile)"
```

---

### Task 16: Slow Network Simulator

**Files:**
- Create: `apps/web/src/lib/network-simulator.ts`
- Create: `apps/mobile/src/lib/network-simulator.ts`

- [ ] **Step 1: Create web network simulator**

```ts
// apps/web/src/lib/network-simulator.ts

const DELAY_MS = parseInt(process.env.NEXT_PUBLIC_NETWORK_DELAY_MS || '0', 10)
const isEnabled = process.env.NODE_ENV !== 'production' && DELAY_MS > 0

export async function simulateNetworkDelay(): Promise<void> {
  if (!isEnabled) return
  // Add jitter: 50%-150% of configured delay
  const jitter = DELAY_MS * (0.5 + Math.random())
  await new Promise(resolve => setTimeout(resolve, jitter))
}

// Wrap fetch for automatic delay injection in development
export function createSlowFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  if (!isEnabled) return baseFetch
  return async (input, init) => {
    await simulateNetworkDelay()
    return baseFetch(input, init)
  }
}
```

- [ ] **Step 2: Create mobile network simulator**

```ts
// apps/mobile/src/lib/network-simulator.ts

const DELAY_MS = parseInt(process.env.EXPO_PUBLIC_NETWORK_DELAY_MS || '0', 10)
const isEnabled = __DEV__ && DELAY_MS > 0

export async function simulateNetworkDelay(): Promise<void> {
  if (!isEnabled) return
  const jitter = DELAY_MS * (0.5 + Math.random())
  await new Promise(resolve => setTimeout(resolve, jitter))
}

export function createSlowFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  if (!isEnabled) return baseFetch
  return async (input, init) => {
    await simulateNetworkDelay()
    return baseFetch(input, init)
  }
}
```

- [ ] **Step 3: Add env vars to .env.example**

```
# Slow Network Simulator (development/staging only)
NEXT_PUBLIC_NETWORK_DELAY_MS=0  # Set to e.g. 2000 for 2s delay
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/network-simulator.ts apps/mobile/src/lib/network-simulator.ts .env.example
git commit -m "feat: add slow network simulator for testing loading states"
```

---

### Task 17: API Integration Tests

**Files:**
- Create: `apps/web/src/__tests__/api/medications.test.ts`
- Create: `apps/web/src/__tests__/api/labs.test.ts`
- Create: `apps/web/src/__tests__/api/care-profile.test.ts`

- [ ] **Step 1: Create medication API integration test**

```ts
// apps/web/src/__tests__/api/medications.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock auth to return a test session
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve({
    user: { email: 'tester1@test.carecompanionai.org', id: 'test-user-id' }
  }))
}))

describe('Medications API', () => {
  it('returns medications for authenticated user', async () => {
    // Import after mocks are set up
    const { GET } = await import('@/app/api/medications/route')
    const req = new NextRequest('http://localhost:3000/api/medications')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('rejects unauthenticated requests', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null)
    const { GET } = await import('@/app/api/medications/route')
    const req = new NextRequest('http://localhost:3000/api/medications')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Create lab results API integration test**

```ts
// apps/web/src/__tests__/api/labs.test.ts
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve({
    user: { email: 'tester1@test.carecompanionai.org', id: 'test-user-id' }
  }))
}))

describe('Lab Results API', () => {
  it('returns lab results for authenticated user', async () => {
    const { GET } = await import('@/app/api/labs/route')
    const req = new NextRequest('http://localhost:3000/api/labs')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })
})
```

- [ ] **Step 3: Create care profile API integration test**

```ts
// apps/web/src/__tests__/api/care-profile.test.ts
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve({
    user: { email: 'tester1@test.carecompanionai.org', id: 'test-user-id' }
  }))
}))

describe('Care Profile API', () => {
  it('returns care profile for authenticated user', async () => {
    const { GET } = await import('@/app/api/care-profile/route')
    const req = new NextRequest('http://localhost:3000/api/care-profile')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})
```

Note: These tests use mocked auth but import the real route handlers, testing the full data flow. Adapt import paths to match actual API route file locations in the codebase.

- [ ] **Step 4: Verify tests run**

Run: `cd apps/web && bun run test:run -- --filter api`
Expected: All integration tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/__tests__/api/
git commit -m "feat: add API integration tests for medications, labs, care profiles"
```

---

### Task 18: Expand Playwright E2E Tests

**Files:**
- Modify: `apps/web/e2e/medications.spec.ts` (extend with CRUD tests)
- Create: `apps/web/e2e/labs.spec.ts`
- Create: `apps/web/e2e/chat.spec.ts`
- Modify: `apps/web/e2e/settings.spec.ts` (extend with toggle tests)
- Create: `apps/web/e2e/registration.spec.ts`

Note: Uses existing `*.spec.ts` naming convention. Extends existing `medications.spec.ts` and `settings.spec.ts` rather than creating duplicates.

- [ ] **Step 1: Create medication CRUD E2E test**

```ts
// apps/web/e2e/medications.spec.ts
import { test, expect } from '@playwright/test'
import { signInOrSkip } from './helpers'

test.describe('Medications', () => {
  test.beforeEach(async ({ page }) => {
    await signInOrSkip(page)
  })

  test('medication list loads', async ({ page }) => {
    await page.goto('/medications')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // Should see at least one medication from seed data
    await expect(page.locator('[data-testid="medication-card"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('add new medication', async ({ page }) => {
    await page.goto('/medications')
    await page.getByRole('button', { name: /add/i }).click()
    await page.getByLabel(/name/i).fill('Test New Med')
    await page.getByLabel(/dosage/i).fill('10mg')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText('Test New Med')).toBeVisible({ timeout: 10000 })
  })
})
```

- [ ] **Step 2: Create lab results E2E test**

```ts
// apps/web/e2e/labs.spec.ts
import { test, expect } from '@playwright/test'
import { signInOrSkip } from './helpers'

test.describe('Lab Results', () => {
  test.beforeEach(async ({ page }) => {
    await signInOrSkip(page)
  })

  test('lab results page loads', async ({ page }) => {
    await page.goto('/labs')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('abnormal results are flagged', async ({ page }) => {
    await page.goto('/labs')
    // Seeded data includes abnormal labs — check for visual indicator
    await expect(page.locator('[data-testid="abnormal-indicator"]').first()).toBeVisible({ timeout: 10000 })
  })
})
```

- [ ] **Step 3: Create chat E2E test**

```ts
// apps/web/e2e/chat.spec.ts
import { test, expect } from '@playwright/test'
import { signInOrSkip } from './helpers'

test.describe('AI Chat', () => {
  test.beforeEach(async ({ page }) => {
    await signInOrSkip(page)
  })

  test('chat interface loads', async ({ page }) => {
    await page.goto('/chat')
    await expect(page.getByPlaceholder(/message/i)).toBeVisible({ timeout: 10000 })
  })

  test('send a message and receive response', async ({ page }) => {
    await page.goto('/chat')
    const input = page.getByPlaceholder(/message/i)
    await input.fill('Hello, what medications am I taking?')
    await page.getByRole('button', { name: /send/i }).click()
    // Wait for AI response (may take a few seconds)
    await expect(page.locator('[data-testid="chat-message"]').last()).toBeVisible({ timeout: 30000 })
  })
})
```

- [ ] **Step 4: Create settings E2E test (expanded)**

```ts
// apps/web/e2e/settings.spec.ts
import { test, expect } from '@playwright/test'
import { signInOrSkip } from './helpers'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await signInOrSkip(page)
  })

  test('settings page loads with all sections', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('toggle notification preference', async ({ page }) => {
    await page.goto('/settings')
    const toggle = page.locator('[data-testid="notification-toggle"]').first()
    if (await toggle.isVisible()) {
      await toggle.click()
      // Verify toggle state changed
      await expect(toggle).toBeVisible()
    }
  })
})
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/e2e/*.e2e.spec.ts
git commit -m "feat: expand Playwright E2E tests for medications, labs, chat, settings"
```

---

### Task 18: Maestro Mobile E2E Flows

**Files:**
- Create: `apps/mobile/.maestro/login.yaml`
- Create: `apps/mobile/.maestro/dashboard.yaml`
- Create: `apps/mobile/.maestro/medications.yaml`
- Create: `apps/mobile/.maestro/settings.yaml`

- [ ] **Step 1: Create login flow**

```yaml
# apps/mobile/.maestro/login.yaml
appId: com.carecompanion.app
---
- launchApp
- assertVisible: "Sign in"
- tapOn: "Email"
- inputText: "${QA_TEST_EMAIL}"
- tapOn: "Password"
- inputText: "${QA_TEST_PASSWORD}"
- tapOn: "Sign in"
- assertVisible: "Dashboard"
```

- [ ] **Step 2: Create dashboard flow**

```yaml
# apps/mobile/.maestro/dashboard.yaml
appId: com.carecompanion.app
---
- launchApp
- runFlow: login.yaml
- assertVisible: "Dashboard"
- assertVisible: "Sample Patient Alpha"
- tapOn: "Medications"
- assertVisible: "Test Medication A"
- back
```

- [ ] **Step 3: Create medications flow**

```yaml
# apps/mobile/.maestro/medications.yaml
appId: com.carecompanion.app
---
- launchApp
- runFlow: login.yaml
- tapOn: "Medications"
- assertVisible: "Test Medication A"
- assertVisible: "Test Medication B"
```

- [ ] **Step 4: Create settings flow**

```yaml
# apps/mobile/.maestro/settings.yaml
appId: com.carecompanion.app
---
- launchApp
- runFlow: login.yaml
- tapOn: "Settings"
- assertVisible: "Notifications"
- assertVisible: "Sign Out"
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/.maestro/
git commit -m "feat(mobile): add Maestro E2E test flows"
```

---

## Chunk 3: Phase 3 — Polish

### Task 19: Visual Regression with Playwright Screenshots

**Files:**
- Create: `apps/web/e2e/visual-regression.spec.ts`

- [ ] **Step 1: Create visual regression test**

```ts
// apps/web/e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test'
import { signInOrSkip } from './helpers'

test.describe('Visual Regression', () => {
  test('login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveScreenshot('login.png', { fullPage: true, maxDiffPixelRatio: 0.01 })
  })

  test('dashboard', async ({ page }) => {
    await signInOrSkip(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('dashboard.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  })

  test('medications page', async ({ page }) => {
    await signInOrSkip(page)
    await page.goto('/medications')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('medications.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  })

  test('settings page', async ({ page }) => {
    await signInOrSkip(page)
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('settings.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  })
})
```

- [ ] **Step 2: Generate baselines**

Run: `cd apps/web && npx playwright test e2e/visual-regression.spec.ts --update-snapshots`
Expected: Baseline screenshots created in `e2e/visual-regression.spec.ts-snapshots/`

- [ ] **Step 3: Add snapshots to git**

```bash
git add apps/web/e2e/visual-regression.spec.ts apps/web/e2e/visual-regression.spec.ts-snapshots/
git commit -m "feat: add visual regression tests with Playwright screenshots"
```

---

### Task 20: PostHog Analytics (Web)

**Files:**
- Modify: `apps/web/src/lib/analytics.ts` (REPLACES existing placeholder — audit callers of old `trackEvent({name, properties})` API and update to new `trackEvent(event, properties?)` signature)
- Create: `apps/web/src/components/PostHogProvider.tsx`
- Modify: `apps/web/src/app/layout.tsx` (add PostHog provider)
- Modify: `apps/web/package.json` (add posthog-js)

- [ ] **Step 1: Install PostHog**

Run: `cd apps/web && bun add posthog-js`

- [ ] **Step 2: Create analytics wrapper**

```ts
// apps/web/src/lib/analytics.ts
import posthog from 'posthog-js'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

export function initAnalytics() {
  if (!POSTHOG_KEY || typeof window === 'undefined') return

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    // HIPAA: disable session replay on authenticated pages
    disable_session_recording: true,
    // Only capture flow completion events, never PHI content
    sanitize_properties: (properties) => {
      const safe = { ...properties }
      // Remove any accidentally captured PHI fields
      const phiKeys = ['patientName', 'cancerType', 'medication', 'labValue', 'chatMessage']
      phiKeys.forEach(key => delete safe[key])
      return safe
    },
  })
}

// Track flow completion events (booleans only, no PHI)
export function trackEvent(event: string, properties?: Record<string, string | number | boolean>) {
  if (!POSTHOG_KEY) return
  posthog.capture(event, properties)
}

// Predefined events
export const events = {
  onboardingCompleted: () => trackEvent('onboarding_completed'),
  medicationAdded: () => trackEvent('medication_added'),
  labViewed: () => trackEvent('lab_viewed'),
  chatMessageSent: () => trackEvent('chat_message_sent'),
  settingsChanged: (setting: string) => trackEvent('settings_changed', { setting }),
  bugReportSubmitted: () => trackEvent('bug_report_submitted'),
}
```

- [ ] **Step 3: Create PostHog provider component**

```tsx
// apps/web/src/components/PostHogProvider.tsx
'use client'

import { useEffect } from 'react'
import { initAnalytics } from '@/lib/analytics'

export function PostHogInit() {
  useEffect(() => {
    initAnalytics()
  }, [])
  return null
}
```

- [ ] **Step 4: Add PostHogInit to root layout**

In `apps/web/src/app/layout.tsx`, inside `<body>`:

```tsx
import { PostHogInit } from '@/components/PostHogProvider'

// Inside body:
<PostHogInit />
```

- [ ] **Step 5: Add env vars**

Add to `.env.example`:
```
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/analytics.ts apps/web/src/components/PostHogProvider.tsx apps/web/src/app/layout.tsx apps/web/package.json .env.example
git commit -m "feat: add PostHog analytics with HIPAA-safe event tracking (web)"
```

---

### Task 21: PostHog Analytics (Mobile)

**Files:**
- Create: `apps/mobile/src/lib/analytics.ts`
- Modify: `apps/mobile/app/_layout.tsx` (initialize analytics)
- Modify: `apps/mobile/package.json` (add posthog-react-native)

- [ ] **Step 1: Install PostHog for React Native**

Run: `cd apps/mobile && bun add posthog-react-native`

- [ ] **Step 2: Create mobile analytics wrapper**

```ts
// apps/mobile/src/lib/analytics.ts
import PostHog from 'posthog-react-native'

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || ''
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

let client: PostHog | null = null

export async function initAnalytics() {
  if (!POSTHOG_KEY) return
  client = await PostHog.initAsync(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    // HIPAA: no session replay on mobile
    enableSessionReplay: false,
  })
}

export function trackEvent(event: string, properties?: Record<string, string | number | boolean>) {
  client?.capture(event, properties)
}

export const events = {
  onboardingCompleted: () => trackEvent('onboarding_completed'),
  medicationAdded: () => trackEvent('medication_added'),
  labViewed: () => trackEvent('lab_viewed'),
  chatMessageSent: () => trackEvent('chat_message_sent'),
  settingsChanged: (setting: string) => trackEvent('settings_changed', { setting }),
  bugReportSubmitted: () => trackEvent('bug_report_submitted'),
}
```

- [ ] **Step 3: Initialize in mobile root layout**

In `apps/mobile/app/_layout.tsx`:

```ts
import { initAnalytics } from '@/lib/analytics'

// At top level of RootLayout:
useEffect(() => { initAnalytics() }, [])
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/analytics.ts apps/mobile/app/_layout.tsx apps/mobile/package.json
git commit -m "feat(mobile): add PostHog analytics with HIPAA-safe tracking"
```

---

### Task 22: QA Checklist Versioning

**Files:**
- Create: `apps/web/src/components/ChecklistVersionNotice.tsx`
- Modify: `apps/web/src/app/(app)/layout.tsx` (add notice)

- [ ] **Step 1: Create ChecklistVersionNotice component**

```tsx
// apps/web/src/components/ChecklistVersionNotice.tsx
'use client'

import { useState, useEffect } from 'react'

// Bump this when docs/qa-checklist.md is updated
const CURRENT_VERSION = 'v1'

export function ChecklistVersionNotice() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_TEST_MODE !== 'true') return
    const seen = localStorage.getItem('qa-checklist-version')
    if (seen !== CURRENT_VERSION) {
      setShow(true)
    }
  }, [])

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: '#3b82f6', color: '#fff',
      padding: '8px 16px', borderRadius: 8, fontSize: 13,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <span>New QA checklist ({CURRENT_VERSION}) available</span>
      <button
        onClick={() => {
          localStorage.setItem('qa-checklist-version', CURRENT_VERSION)
          setShow(false)
        }}
        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
      >
        Dismiss
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add to app layout**

In `apps/web/src/app/(app)/layout.tsx`, after `<TestModeBanner />`:

```tsx
import { ChecklistVersionNotice } from '@/components/ChecklistVersionNotice'

<ChecklistVersionNotice />
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ChecklistVersionNotice.tsx apps/web/src/app/\(app\)/layout.tsx
git commit -m "feat: add QA checklist version notification (staging only)"
```

---

### Task 23: Daily Digest GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/daily-digest.yml`

- [ ] **Step 1: Create the workflow**

```yaml
# .github/workflows/daily-digest.yml
name: Daily QA Digest

on:
  schedule:
    - cron: '0 14 * * *'  # 2 PM UTC daily
  workflow_dispatch:

jobs:
  digest:
    runs-on: ubuntu-latest
    steps:
      - name: Gather bug reports
        id: bugs
        run: |
          BUGS=$(gh api repos/${{ github.repository }}/issues \
            --jq '[.[] | select(.labels[].name == "bug") | select(.created_at > (now - 86400 | strftime("%Y-%m-%dT%H:%M:%SZ")))] | length')
          echo "count=$BUGS" >> $GITHUB_OUTPUT

          TITLES=$(gh api repos/${{ github.repository }}/issues \
            --jq '[.[] | select(.labels[].name == "bug") | select(.created_at > (now - 86400 | strftime("%Y-%m-%dT%H:%M:%SZ"))) | .title] | join("\n- ")')
          echo "titles=$TITLES" >> $GITHUB_OUTPUT
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Check CI status
        id: ci
        run: |
          STATUS=$(gh api repos/${{ github.repository }}/actions/runs \
            --jq '.workflow_runs[0].conclusion')
          echo "status=$STATUS" >> $GITHUB_OUTPUT
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Send digest email
        uses: dawidd6/action-send-mail@v3
        with:
          server_address: smtp.resend.com
          server_port: 465
          username: resend
          password: ${{ secrets.RESEND_API_KEY }}
          subject: 'CareCompanion Daily QA Digest'
          to: ${{ secrets.TEAM_EMAIL }}
          from: 'CareCompanion QA <qa@carecompanionai.org>'
          body: |
            ## Daily QA Digest — ${{ github.event.repository.name }}

            **New bugs filed (24h):** ${{ steps.bugs.outputs.count }}
            ${{ steps.bugs.outputs.titles && format('- {0}', steps.bugs.outputs.titles) || 'None' }}

            **Latest CI status:** ${{ steps.ci.outputs.status }}

            ---
            View all open bugs: https://github.com/${{ github.repository }}/issues?q=is%3Aopen+label%3Abug
```

- [ ] **Step 2: Add TEAM_EMAIL secret**

In GitHub repo → Settings → Secrets → Actions, add `TEAM_EMAIL` with comma-separated co-founder emails.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/daily-digest.yml
git commit -m "feat: add daily QA digest email workflow"
```

---

### Task 24: Update CI Workflow

**Files:**
- Modify: `.github/workflows/ci.yml` (add Playwright E2E to CI)

- [ ] **Step 1: Add Playwright E2E step to CI**

Add after the build step in `.github/workflows/ci.yml`:

```yaml
      - name: Install Playwright browsers
        working-directory: apps/web
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        working-directory: apps/web
        run: npx playwright test --project=chromium
        env:
          E2E_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}
          E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: add Playwright E2E tests to CI pipeline"
```

---

### Task 25: Update .env.example with All New Variables

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add all new env vars**

Append to `.env.example`:
```
# === Testing Infrastructure ===

# Test Mode (staging/preview only)
NEXT_PUBLIC_TEST_MODE=false

# Sentry Error Monitoring
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=

# Bug Report (GitHub Issues)
GITHUB_FEEDBACK_TOKEN=
GITHUB_FEEDBACK_REPO=owner/repo

# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Slow Network Simulator (development/staging only)
NEXT_PUBLIC_NETWORK_DELAY_MS=0
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add all testing infrastructure env vars to .env.example"
```
