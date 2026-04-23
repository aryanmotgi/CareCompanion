/**
 * Cached health summary endpoint.
 * GET: Returns cached summary if fresh (< 24h), otherwise generates new one.
 * POST: Force-regenerate the health summary.
 */
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { careProfiles, medications, appointments, labResults, notifications, healthSummaries } from '@/lib/db/schema'
import { and, eq, gt, lt, desc } from 'drizzle-orm'
import { calculateHealthScore } from '@/lib/health-score'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET() {
  try {
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    const [cached] = await db
      .select()
      .from(healthSummaries)
      .where(and(
        eq(healthSummaries.userId, dbUser!.id),
        gt(healthSummaries.expiresAt, new Date()),
      ))
      .orderBy(desc(healthSummaries.generatedAt))
      .limit(1)

    if (cached) {
      return apiSuccess({
        ...(cached.summary as Record<string, unknown>),
        health_score: cached.healthScore,
        generated_at: cached.generatedAt,
        cached: true,
      })
    }

    return generateAndCache(dbUser!.id)
  } catch (error) {
    console.error('[health-summary-cache] GET error:', error)
    return ApiErrors.internal()
  }
}

export async function POST() {
  try {
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    return generateAndCache(dbUser!.id)
  } catch (error) {
    console.error('[health-summary-cache] POST error:', error)
    return ApiErrors.internal()
  }
}

async function generateAndCache(userId: string) {
  const [profile] = await db
    .select({
      id: careProfiles.id,
      patientName: careProfiles.patientName,
      cancerType: careProfiles.cancerType,
      cancerStage: careProfiles.cancerStage,
      treatmentPhase: careProfiles.treatmentPhase,
      conditions: careProfiles.conditions,
      allergies: careProfiles.allergies,
    })
    .from(careProfiles)
    .where(eq(careProfiles.userId, userId))
    .limit(1)

  if (!profile) return ApiErrors.notFound('Care profile')

  const [meds, appts, labs, notifs] = await Promise.all([
    db.select().from(medications).where(eq(medications.careProfileId, profile.id)).catch(() => []),
    db.select().from(appointments).where(eq(appointments.careProfileId, profile.id)).catch(() => []),
    db.select().from(labResults).where(eq(labResults.userId, userId)).orderBy(desc(labResults.dateTaken)).limit(20).catch(() => []),
    db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))).limit(5).catch(() => []),
  ])

  const healthScore = calculateHealthScore(meds, labs, appts)

  const now = new Date()
  const futureAppts = appts.filter((a) => a.dateTime && new Date(a.dateTime) > now)
  const abnormalLabs = labs.filter((l) => l.isAbnormal)

  const summary = {
    patient_name: profile.patientName,
    cancer_type: profile.cancerType,
    cancer_stage: profile.cancerStage,
    treatment_phase: profile.treatmentPhase,
    medication_count: meds.length,
    upcoming_appointments: futureAppts.length,
    abnormal_labs: abnormalLabs.length,
    unread_notifications: notifs.length,
    conditions: profile.conditions,
    allergies: profile.allergies,
  }

  // Clean up expired summaries for this user
  await db.delete(healthSummaries).where(
    and(
      eq(healthSummaries.userId, userId),
      lt(healthSummaries.expiresAt, new Date()),
    )
  )

  await db.insert(healthSummaries).values({
    userId,
    careProfileId: profile.id,
    summary,
    healthScore,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })

  return apiSuccess({
    ...summary,
    health_score: healthScore,
    generated_at: now.toISOString(),
    cached: false,
  })
}
