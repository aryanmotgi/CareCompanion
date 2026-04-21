import { db } from '@/lib/db'
import { careProfiles, careTeamMembers, userPreferences } from '@/lib/db/schema'
import { eq, inArray, asc } from 'drizzle-orm'

/**
 * Get the active care profile for a user.
 * Falls back to first profile if no preference is set.
 */
export async function getActiveProfile(userId: string) {
  const [prefs] = await db
    .select({ activeProfileId: userPreferences.activeProfileId })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)

  if (prefs?.activeProfileId) {
    const [profile] = await db
      .select()
      .from(careProfiles)
      .where(eq(careProfiles.id, prefs.activeProfileId))
      .limit(1)
    if (profile) return profile
  }

  // Fallback: first profile owned by user
  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(eq(careProfiles.userId, userId))
    .orderBy(asc(careProfiles.createdAt))
    .limit(1)

  if (profile) {
    await db
      .insert(userPreferences)
      .values({ userId, activeProfileId: profile.id })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { activeProfileId: profile.id },
      })
  }

  return profile ?? null
}

/**
 * Get all care profiles accessible to a user (owned + care team).
 */
export async function getAllProfiles(userId: string) {
  const owned = await db
    .select()
    .from(careProfiles)
    .where(eq(careProfiles.userId, userId))
    .orderBy(asc(careProfiles.createdAt))

  const memberships = await db
    .select({ careProfileId: careTeamMembers.careProfileId })
    .from(careTeamMembers)
    .where(eq(careTeamMembers.userId, userId))

  const ownedIds = new Set(owned.map(p => p.id))
  const sharedIds = memberships
    .map(m => m.careProfileId)
    .filter(id => !ownedIds.has(id))

  let shared: typeof owned = []
  if (sharedIds.length > 0) {
    shared = await db
      .select()
      .from(careProfiles)
      .where(inArray(careProfiles.id, sharedIds))
  }

  return [...owned, ...shared]
}
