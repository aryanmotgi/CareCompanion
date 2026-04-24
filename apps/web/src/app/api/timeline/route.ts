import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiError, apiSuccess } from '@/lib/api-response'
import { db } from '@/lib/db'
import {
  medications,
  appointments,
  labResults,
  medicationReminders,
  careProfiles,
} from '@/lib/db/schema'
import { eq, and, gte, lte, isNull, asc } from 'drizzle-orm'

export interface TimelineItem {
  id: string
  type: 'medication' | 'appointment' | 'lab' | 'refill'
  title: string
  subtitle: string | null
  timestamp: string
  meta?: Record<string, unknown>
}

/**
 * GET /api/timeline?profileId=X&days=7
 *
 * Returns a unified, time-sorted array of upcoming care events:
 * medications, appointments, lab results, and refill warnings.
 */
export async function GET(req: Request) {
  try {
    const { user: dbUser, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const url = new URL(req.url)
    const profileId = url.searchParams.get('profileId')
    const daysParam = url.searchParams.get('days')
    const days = Math.min(Math.max(parseInt(daysParam || '7', 10) || 7, 1), 30)

    if (!profileId) {
      return apiError('profileId query parameter is required', 400)
    }

    // Verify the profile belongs to this user
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(and(eq(careProfiles.id, profileId), eq(careProfiles.userId, dbUser!.id)))
      .limit(1)

    if (!profile) {
      return apiError('Profile not found or access denied', 404)
    }

    const now = new Date()
    const rangeEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    // Fetch all data sources in parallel
    const [medsData, apptsData, labsData, remindersData] = await Promise.all([
      // Active medications (no scheduled_time column — we generate timeline items from reminders)
      db
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.careProfileId, profileId),
            isNull(medications.deletedAt),
          ),
        )
        .catch(() => []),

      // Upcoming appointments within range
      db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.careProfileId, profileId),
            isNull(appointments.deletedAt),
            gte(appointments.dateTime, now),
            lte(appointments.dateTime, rangeEnd),
          ),
        )
        .orderBy(asc(appointments.dateTime))
        .catch(() => []),

      // Lab results with recent dates (show labs taken in the range)
      db
        .select()
        .from(labResults)
        .where(
          and(
            eq(labResults.userId, dbUser!.id),
            isNull(labResults.deletedAt),
          ),
        )
        .orderBy(asc(labResults.dateTaken))
        .catch(() => []),

      // Medication reminders for generating daily timeline items
      db
        .select()
        .from(medicationReminders)
        .where(
          and(
            eq(medicationReminders.userId, dbUser!.id),
            eq(medicationReminders.isActive, true),
          ),
        )
        .catch(() => []),
    ])

    const timeline: TimelineItem[] = []

    // --- Medication reminder items ---
    // Generate timeline items from active reminders for today
    const todayDayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()]

    for (const reminder of remindersData) {
      // Only show reminders for today's day of week
      if (!reminder.daysOfWeek.includes(todayDayName)) continue

      const med = medsData.find((m) => m.id === reminder.medicationId)

      for (const timeStr of reminder.reminderTimes) {
        // Parse time string (e.g., "08:00", "14:30")
        const [hours, minutes] = timeStr.split(':').map(Number)
        if (isNaN(hours) || isNaN(minutes)) continue

        const scheduledTime = new Date(now)
        scheduledTime.setHours(hours, minutes, 0, 0)

        timeline.push({
          id: `med-${reminder.id}-${timeStr}`,
          type: 'medication',
          title: reminder.medicationName,
          subtitle: reminder.dose || med?.dose || null,
          timestamp: scheduledTime.toISOString(),
          meta: {
            medicationId: reminder.medicationId,
            reminderId: reminder.id,
            frequency: med?.frequency || null,
          },
        })
      }
    }

    // --- Appointment items ---
    for (const appt of apptsData) {
      if (!appt.dateTime) continue
      timeline.push({
        id: `appt-${appt.id}`,
        type: 'appointment',
        title: appt.purpose || appt.specialty || 'Appointment',
        subtitle: appt.doctorName || null,
        timestamp: new Date(appt.dateTime).toISOString(),
        meta: {
          location: appt.location,
          specialty: appt.specialty,
        },
      })
    }

    // --- Lab result items ---
    for (const lab of labsData) {
      if (!lab.dateTaken) continue
      const labDate = new Date(lab.dateTaken)
      // Show labs from today forward within the range
      if (labDate >= new Date(now.toDateString()) && labDate <= rangeEnd) {
        timeline.push({
          id: `lab-${lab.id}`,
          type: 'lab',
          title: lab.testName,
          subtitle: lab.value ? `${lab.value}${lab.unit ? ` ${lab.unit}` : ''}` : 'Pending',
          timestamp: labDate.toISOString(),
          meta: {
            referenceRange: lab.referenceRange,
            isAbnormal: lab.isAbnormal,
            source: lab.source,
          },
        })
      }
    }

    // --- Refill predictions ---
    // Check medications with refill dates approaching (within 3 days)
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    for (const med of medsData) {
      if (!med.refillDate) continue
      const refillDate = new Date(med.refillDate)
      if (refillDate >= now && refillDate <= threeDaysFromNow) {
        timeline.push({
          id: `refill-${med.id}`,
          type: 'refill',
          title: `Refill ${med.name}`,
          subtitle: med.pharmacyPhone
            ? `Call pharmacy: ${med.pharmacyPhone}`
            : 'Time to request a refill',
          timestamp: refillDate.toISOString(),
          meta: {
            medicationId: med.id,
            pharmacyPhone: med.pharmacyPhone,
          },
        })
      }
    }

    // Sort by timestamp ascending
    timeline.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

    return apiSuccess(timeline)
  } catch (err) {
    console.error('[timeline] GET error:', err)
    return apiError('Internal server error', 500)
  }
}
