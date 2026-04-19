import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiError, ApiErrors } from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { careProfiles, medications, appointments, doctors, labResults, claims, documents, notifications } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 })

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = await limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    await logAudit({
      user_id: user!.id,
      action: 'export_data',
      ip_address: req.headers.get('x-forwarded-for') || undefined,
    })

    const [profile] = await db
      .select()
      .from(careProfiles)
      .where(eq(careProfiles.userId, user!.id))
      .limit(1)

    const profileId = profile?.id

    const [medsData, apptsData, docsData, doctorsData, labsData, claimsData, notifsData] = await Promise.all([
      profileId ? db.select().from(medications).where(and(eq(medications.careProfileId, profileId), isNull(medications.deletedAt))) : [],
      profileId ? db.select().from(appointments).where(and(eq(appointments.careProfileId, profileId), isNull(appointments.deletedAt))) : [],
      profileId ? db.select().from(documents).where(eq(documents.careProfileId, profileId)) : [],
      profileId ? db.select().from(doctors).where(eq(doctors.careProfileId, profileId)) : [],
      db.select().from(labResults).where(eq(labResults.userId, user!.id)),
      db.select().from(claims).where(eq(claims.userId, user!.id)),
      db.select().from(notifications).where(eq(notifications.userId, user!.id)),
    ])

    const exportData = {
      exported_at: new Date().toISOString(),
      profile,
      medications: medsData,
      appointments: apptsData,
      doctors: doctorsData,
      lab_results: labsData,
      claims: claimsData,
      documents: docsData,
      notifications: notifsData,
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="carecompanion-data.json"',
      },
    })
  } catch (error) {
    console.error('[export-data] Error:', error)
    return apiError('Internal server error', 500)
  }
}
