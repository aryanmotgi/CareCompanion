import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { wellnessVitals, careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiError } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'

const WellnessPayloadSchema = z.object({
  capturedAt: z.string().datetime(),
  steps: z.number().int().nonnegative(),
  heartRate: z.number().nullable(),
  sleepHours: z.number().nullable(),
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
  })

  await logAudit({
    user_id: user.id,
    action: 'sync_data',
    resource_type: 'wellness_vitals',
    details: { hasSteps: parsed.steps > 0, hasHr: parsed.heartRate != null, hasSleep: parsed.sleepHours != null },
  })

  return NextResponse.json({ ok: true })
}
