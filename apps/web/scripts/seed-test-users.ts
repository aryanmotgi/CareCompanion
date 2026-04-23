/**
 * Seed test users for QA/staging environments.
 * Run: QA_TEST_PASSWORD=<pw> npx tsx scripts/seed-test-users.ts
 *
 * Refuses to run against production unless --force is passed.
 */

import { config } from 'dotenv'
import path from 'path'

// Load .env.local from apps/web (has AWS credentials)
config({ path: path.join(__dirname, '../.env.local') })
config({ path: path.join(__dirname, '../.env') })

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
const hasForce = process.argv.includes('--force')

if (isProduction && !hasForce) {
  console.error('ERROR: Refusing to seed test users in production. Pass --force to override.')
  process.exit(1)
}

// Use dynamic import so dotenv loads first
async function main() {
  const bcrypt = await import('bcryptjs')
  const { db } = await import('../src/lib/db')
  const {
    users,
    careProfiles,
    medications,
    labResults,
    appointments,
    doctors,
    notifications,
    userSettings,
  } = await import('../src/lib/db/schema')
  const { eq } = await import('drizzle-orm')
  const {
    TEST_USERS,
    getTestPassword,
    SEED_CARE_PROFILE,
    SEED_MEDICATIONS,
    SEED_LAB_RESULTS,
    SEED_APPOINTMENTS,
    SEED_DOCTORS,
    SEED_NOTIFICATIONS,
    SEED_USER_SETTINGS,
  } = await import('../src/lib/seed-data')

  const password = getTestPassword()
  const passwordHash = await bcrypt.hash(password, 12)

  console.log(`\nSeeding ${TEST_USERS.length} test users...`)
  const results: { email: string; status: string }[] = []

  for (const testUser of TEST_USERS) {
    try {
      // Delete existing user by email (idempotent)
      await db.delete(users).where(eq(users.email, testUser.email))

      // Create user
      const [newUser] = await db.insert(users).values({
        email: testUser.email,
        displayName: testUser.displayName,
        passwordHash,
        isDemo: false,
        hipaaConsent: true,
      }).returning({ id: users.id })

      const userId = newUser.id

      // Seed care profile
      const [profile] = await db.insert(careProfiles).values({
        userId,
        ...SEED_CARE_PROFILE,
      }).returning({ id: careProfiles.id })

      const profileId = profile.id

      // Seed medications
      await db.insert(medications).values(
        SEED_MEDICATIONS.map((med) => ({ ...med, careProfileId: profileId }))
      )

      // Seed lab results
      await db.insert(labResults).values(
        SEED_LAB_RESULTS.map((lab) => ({ ...lab, userId }))
      )

      // Seed appointments (skip if failing — non-critical for QA)
      try {
        for (const appt of SEED_APPOINTMENTS) {
          await db.insert(appointments).values({
            careProfileId: profileId,
            doctorName: appt.doctorName,
            specialty: appt.specialty,
            dateTime: new Date(appt.dateTime),
            location: appt.location,
            purpose: appt.purpose,
          })
        }
      } catch {
        console.warn(`  ⚠ Skipped appointments for ${testUser.email} (non-critical)`)
      }

      // Seed doctors
      await db.insert(doctors).values(
        SEED_DOCTORS.map((doc) => ({ ...doc, careProfileId: profileId }))
      )

      // Seed notifications
      await db.insert(notifications).values(
        SEED_NOTIFICATIONS.map((notif) => ({ ...notif, userId }))
      )

      // Seed default settings
      await db.insert(userSettings).values({
        userId,
        ...SEED_USER_SETTINGS,
      }).onConflictDoUpdate({
        target: userSettings.userId,
        set: SEED_USER_SETTINGS,
      })

      results.push({ email: testUser.email, status: 'OK' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ email: testUser.email, status: `ERROR: ${msg}` })
    }
  }

  console.log('\nSeed summary:')
  for (const r of results) {
    console.log(`  ${r.status === 'OK' ? '✓' : '✗'} ${r.email} — ${r.status}`)
  }

  const failures = results.filter((r) => r.status !== 'OK')
  if (failures.length > 0) {
    console.error(`\n${failures.length} user(s) failed to seed.`)
    process.exit(1)
  }

  console.log(`\nAll ${TEST_USERS.length} test users seeded successfully.`)
  console.log('Login password set from QA_TEST_PASSWORD env var.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
