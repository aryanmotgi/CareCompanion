import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { wellnessVitals, careProfiles, notifications } from '@/lib/db/schema'
import { eq, and, gte, isNotNull, asc } from 'drizzle-orm'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiError } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'

const WellnessPayloadSchema = z.object({
  capturedAt: z.string().datetime(),
  steps: z.number().int().nonnegative(),
  heartRate: z.number().nullable(),
  sleepHours: z.number().nullable(),
  bodyMass: z.number().positive().nullable().optional(),
})

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser()
  if (authError) return authError

  let parsed
  try {
    parsed = WellnessPayloadSchema.parse(await req.json())
  } catch {
    return apiError('Invalid payload', 400)
  }

  let careProfile = await db.query.careProfiles.findFirst({
    where: eq(careProfiles.userId, user.id),
  })
  if (!careProfile) {
    const [created] = await db.insert(careProfiles).values({
      userId: user.id,
      onboardingCompleted: false,
    }).returning()
    careProfile = created
  }

  await db.insert(wellnessVitals).values({
    careProfileId: careProfile.id,
    capturedAt: new Date(parsed.capturedAt),
    steps: parsed.steps,
    heartRate: parsed.heartRate != null ? String(parsed.heartRate) : null,
    sleepHours: parsed.sleepHours != null ? String(parsed.sleepHours) : null,
    bodyMass: parsed.bodyMass != null ? String(parsed.bodyMass) : null,
  })

  // Weight loss detection: flag if >5% loss over 90-day window
  let weightLossDetected = false
  if (parsed.bodyMass != null) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const weightHistory = await db.query.wellnessVitals.findMany({
      where: and(
        eq(wellnessVitals.careProfileId, careProfile.id),
        gte(wellnessVitals.capturedAt, ninetyDaysAgo),
        isNotNull(wellnessVitals.bodyMass),
      ),
      orderBy: [asc(wellnessVitals.capturedAt)],
      columns: { bodyMass: true, capturedAt: true },
    })
    if (weightHistory.length >= 2) {
      const earliest = parseFloat(weightHistory[0].bodyMass!)
      const current = parsed.bodyMass
      if (earliest > 0) {
        const lossPct = (earliest - current) / earliest
        if (lossPct >= 0.05) {
          weightLossDetected = true
          const lossDisplay = (lossPct * 100).toFixed(1)
          await db.insert(notifications).values({
            userId: user.id,
            type: 'weight_loss_alert',
            title: `Weight loss alert: ${lossDisplay}% over 90 days`,
            message: `Patient weight has decreased ${lossDisplay}% over the past 90 days (from ${earliest.toFixed(1)} to ${current.toFixed(1)} kg). Significant weight loss during cancer treatment may indicate nutritional toxicity or disease progression — oncologist review recommended.`,
            isRead: false,
          })
        }
      }
    }
  }

  await logAudit({
    user_id: user.id,
    action: 'sync_data',
    resource_type: 'wellness_vitals',
    details: { hasSteps: parsed.steps > 0, hasHr: parsed.heartRate != null, hasSleep: parsed.sleepHours != null, hasBodyMass: parsed.bodyMass != null, weightLossDetected },
  })

  return NextResponse.json({ ok: true, weightLossDetected })
}
