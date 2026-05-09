import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import {
  wellnessCheckins,
  symptomInsights,
  medications,
  appointments,
  careTeamActivityLog,
  careProfiles,
  users,
} from '@/lib/db/schema'
import { eq, and, gte, desc, isNull } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { error } = await getAuthenticatedUser()
  if (error) return error

  const url = new URL(req.url)
  const careProfileId = url.searchParams.get('careProfileId')
  if (!careProfileId) {
    return NextResponse.json({ ok: false, error: 'careProfileId required' }, { status: 400 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [latestCheckin, recentCheckins, insights, meds, activity, upcoming, profile] =
    await Promise.all([
      db
        .select()
        .from(wellnessCheckins)
        .where(
          and(
            eq(wellnessCheckins.careProfileId, careProfileId),
            gte(wellnessCheckins.checkedInAt, today),
          ),
        )
        .limit(1)
        .catch(() => []),
      db
        .select()
        .from(wellnessCheckins)
        .where(
          and(
            eq(wellnessCheckins.careProfileId, careProfileId),
            gte(wellnessCheckins.checkedInAt, sevenDaysAgo),
          ),
        )
        .orderBy(desc(wellnessCheckins.checkedInAt))
        .catch(() => []),
      db
        .select()
        .from(symptomInsights)
        .where(
          and(
            eq(symptomInsights.careProfileId, careProfileId),
            eq(symptomInsights.status, 'active'),
          ),
        )
        .orderBy(desc(symptomInsights.createdAt))
        .limit(5)
        .catch(() => []),
      db
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.careProfileId, careProfileId),
            isNull(medications.deletedAt),
          ),
        )
        .catch(() => []),
      db
        .select({
          id: careTeamActivityLog.id,
          careProfileId: careTeamActivityLog.careProfileId,
          userId: careTeamActivityLog.userId,
          action: careTeamActivityLog.action,
          metadata: careTeamActivityLog.metadata,
          createdAt: careTeamActivityLog.createdAt,
          userName: users.displayName,
        })
        .from(careTeamActivityLog)
        .leftJoin(users, eq(careTeamActivityLog.userId, users.id))
        .where(eq(careTeamActivityLog.careProfileId, careProfileId))
        .orderBy(desc(careTeamActivityLog.createdAt))
        .limit(10)
        .catch(() => []),
      db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.careProfileId, careProfileId),
            gte(appointments.dateTime, today),
            isNull(appointments.deletedAt),
          ),
        )
        .orderBy(appointments.dateTime)
        .limit(3)
        .catch(() => []),
      db
        .select()
        .from(careProfiles)
        .where(eq(careProfiles.id, careProfileId))
        .limit(1)
        .catch(() => []),
    ])

  return NextResponse.json({
    ok: true,
    data: {
      profile: profile[0] || null,
      todayCheckin: latestCheckin[0] || null,
      recentCheckins,
      insights,
      medications: meds,
      activity,
      upcoming,
    },
  })
}
