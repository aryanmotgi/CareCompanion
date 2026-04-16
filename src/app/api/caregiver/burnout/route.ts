/**
 * Caregiver burnout assessment endpoint.
 * Analyzes journal entries and appointment load to detect burnout signals.
 */
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { careProfiles, symptomEntries, appointments } from '@/lib/db/schema'
import { and, eq, gte, lte, desc } from 'drizzle-orm'
import { assessBurnout } from '@/lib/caregiver-burnout'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 })

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, dbUser!.id))
      .limit(1)

    const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const [entries, appts] = await Promise.all([
      db
        .select()
        .from(symptomEntries)
        .where(eq(symptomEntries.userId, dbUser!.id))
        .orderBy(desc(symptomEntries.date))
        .limit(14),
      profile
        ? db
            .select({ id: appointments.id })
            .from(appointments)
            .where(
              and(
                eq(appointments.careProfileId, profile.id),
                gte(appointments.dateTime, new Date()),
                lte(appointments.dateTime, twoWeeksFromNow),
              )
            )
        : Promise.resolve([]),
    ])

    let daysSinceLastEntry: number | null = null
    if (entries.length > 0) {
      const lastDate = new Date(entries[0].date)
      daysSinceLastEntry = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    }

    const assessment = assessBurnout(entries, appts.length, daysSinceLastEntry)

    return apiSuccess(assessment)
  } catch (error) {
    console.error('[burnout] Error:', error)
    return ApiErrors.internal()
  }
}
