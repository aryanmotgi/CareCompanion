import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiSuccess, apiError } from '@/lib/api-response'
import { db } from '@/lib/db'
import {
  careProfiles,
  medications,
  labResults,
  appointments,
  doctors,
  notifications,
  userSettings,
  medicationReminders,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  SEED_CARE_PROFILE,
  SEED_MEDICATIONS,
  SEED_LAB_RESULTS,
  SEED_APPOINTMENTS,
  SEED_DOCTORS,
  SEED_NOTIFICATIONS,
  SEED_USER_SETTINGS,
} from '@/lib/seed-data'

export async function POST() {
  // Environment guard — block in production unless TEST_MODE is explicitly enabled
  const isProduction = process.env.NODE_ENV === 'production'
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true'
  if (isProduction && !isTestMode) {
    return apiError('Not available in production', 403)
  }

  // Auth check
  const { user: dbUser, error: authError } = await getAuthenticatedUser()
  if (authError) return authError

  // Only allow demo accounts
  if (!dbUser!.isDemo) {
    return apiError('Only available for demo accounts', 403)
  }

  const userId = dbUser!.id

  try {
    // Get or create care profile
    let [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, userId))
      .limit(1)

    if (!profile) {
      const [newProfile] = await db.insert(careProfiles).values({
        userId,
        ...SEED_CARE_PROFILE,
      }).returning({ id: careProfiles.id })
      profile = newProfile
    } else {
      // Reset profile to seed state
      await db.update(careProfiles).set(SEED_CARE_PROFILE).where(eq(careProfiles.id, profile.id))
    }

    const profileId = profile.id

    // Delete all existing user data
    await Promise.all([
      db.delete(medications).where(eq(medications.careProfileId, profileId)),
      db.delete(appointments).where(eq(appointments.careProfileId, profileId)),
      db.delete(doctors).where(eq(doctors.careProfileId, profileId)),
      db.delete(labResults).where(eq(labResults.userId, userId)),
      db.delete(notifications).where(eq(notifications.userId, userId)),
      db.delete(medicationReminders).where(eq(medicationReminders.userId, userId)),
    ])

    // Re-seed from constants
    await Promise.all([
      db.insert(medications).values(
        SEED_MEDICATIONS.map((med) => ({ ...med, careProfileId: profileId }))
      ),
      db.insert(labResults).values(
        SEED_LAB_RESULTS.map((lab) => ({ ...lab, userId }))
      ),
      db.insert(appointments).values(
        SEED_APPOINTMENTS.map((appt) => ({ ...appt, careProfileId: profileId }))
      ),
      db.insert(doctors).values(
        SEED_DOCTORS.map((doc) => ({ ...doc, careProfileId: profileId }))
      ),
      db.insert(notifications).values(
        SEED_NOTIFICATIONS.map((notif) => ({ ...notif, userId }))
      ),
      db.insert(userSettings).values({
        userId,
        ...SEED_USER_SETTINGS,
      }).onConflictDoUpdate({
        target: userSettings.userId,
        set: SEED_USER_SETTINGS,
      }),
    ])

    return apiSuccess({ ok: true, message: 'Account data reset to initial test state' })
  } catch (err) {
    console.error('[api/test/reset] POST error:', err)
    return apiError('Internal server error', 500)
  }
}
