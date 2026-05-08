import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiError, apiSuccess } from '@/lib/api-response'
import { db } from '@/lib/db'
import {
  medications,
  appointments,
  labResults,
  wellnessCheckins,
  symptomInsights,
  treatmentCycles,
  careProfiles,
  symptomEntries,
} from '@/lib/db/schema'
import { eq, and, gte, isNull, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export interface TimelineItem {
  id: string
  type: 'medication' | 'appointment' | 'lab' | 'symptom' | 'checkin' | 'insight' | 'cycle'
  date: string
  title: string
  subtitle?: string | null
  severity?: 'info' | 'watch' | 'alert' | 'positive' | 'critical' | 'warning' | 'informational' | null
  isMilestone?: boolean
  data?: Record<string, unknown>
}

/**
 * GET /api/timeline?profileId=X&from=ISO&to=ISO
 *
 * Returns a unified, time-sorted array of events from 5+ tables:
 * medications, appointments, labResults, wellnessCheckins, symptomInsights,
 * treatmentCycles, and symptomEntries.
 */
export async function GET(req: Request) {
  try {
    const { user: dbUser, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const url = new URL(req.url)
    const profileId = url.searchParams.get('profileId')

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

    // Date range — default last 90 days
    const from = url.searchParams.get('from')
      ? new Date(url.searchParams.get('from')!)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    // Query all sources in parallel — each wrapped in catch for graceful degradation
    const [medsData, apptsData, labsData, checkinsData, insightsData, cyclesData, symptomsData] =
      await Promise.all([
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

        db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.careProfileId, profileId),
              isNull(appointments.deletedAt),
            ),
          )
          .catch(() => []),

        db
          .select()
          .from(labResults)
          .where(
            and(
              eq(labResults.userId, dbUser!.id),
              isNull(labResults.deletedAt),
            ),
          )
          .catch(() => []),

        db
          .select()
          .from(wellnessCheckins)
          .where(
            and(
              eq(wellnessCheckins.careProfileId, profileId),
              gte(wellnessCheckins.checkedInAt, from),
            ),
          )
          .orderBy(desc(wellnessCheckins.checkedInAt))
          .catch(() => []),

        db
          .select()
          .from(symptomInsights)
          .where(
            and(
              eq(symptomInsights.careProfileId, profileId),
              gte(symptomInsights.createdAt, from),
            ),
          )
          .orderBy(desc(symptomInsights.createdAt))
          .catch(() => []),

        db
          .select()
          .from(treatmentCycles)
          .where(eq(treatmentCycles.careProfileId, profileId))
          .catch(() => []),

        db
          .select()
          .from(symptomEntries)
          .where(
            and(
              eq(symptomEntries.userId, dbUser!.id),
              gte(symptomEntries.date, from.toISOString().slice(0, 10)),
            ),
          )
          .orderBy(desc(symptomEntries.date))
          .catch(() => []),
      ])

    const timeline: TimelineItem[] = []

    // --- Medications ---
    for (const med of medsData) {
      const dateStr = med.createdAt
        ? new Date(med.createdAt).toISOString()
        : null
      if (!dateStr) continue

      timeline.push({
        id: `med-${med.id}`,
        type: 'medication',
        date: dateStr,
        title: med.name,
        subtitle: med.dose ? `${med.dose}${med.frequency ? ` — ${med.frequency}` : ''}` : 'Medication started',
        data: {
          dose: med.dose,
          frequency: med.frequency,
          prescribingDoctor: med.prescribingDoctor,
          refillDate: med.refillDate,
          pharmacyPhone: med.pharmacyPhone,
        },
      })
    }

    // --- Appointments ---
    for (const appt of apptsData) {
      const dateStr = appt.dateTime
        ? new Date(appt.dateTime).toISOString()
        : appt.createdAt
          ? new Date(appt.createdAt).toISOString()
          : null
      if (!dateStr) continue

      timeline.push({
        id: `appt-${appt.id}`,
        type: 'appointment',
        date: dateStr,
        title: appt.purpose || appt.specialty || 'Appointment',
        subtitle: appt.doctorName ? `Dr. ${appt.doctorName}` : null,
        data: {
          doctorName: appt.doctorName,
          specialty: appt.specialty,
          location: appt.location,
        },
      })
    }

    // --- Lab results ---
    for (const lab of labsData) {
      const dateStr = lab.dateTaken
        ? new Date(lab.dateTaken).toISOString()
        : lab.createdAt
          ? new Date(lab.createdAt).toISOString()
          : null
      if (!dateStr) continue

      timeline.push({
        id: `lab-${lab.id}`,
        type: 'lab',
        date: dateStr,
        title: lab.testName,
        subtitle: lab.value
          ? `${lab.value}${lab.unit ? ` ${lab.unit}` : ''}`
          : 'Pending',
        severity: lab.isAbnormal ? 'alert' : null,
        data: {
          value: lab.value,
          unit: lab.unit,
          referenceRange: lab.referenceRange,
          isAbnormal: lab.isAbnormal,
          source: lab.source,
        },
      })
    }

    // --- Wellness check-ins ---
    for (const checkin of checkinsData) {
      const dateStr = checkin.checkedInAt
        ? new Date(checkin.checkedInAt).toISOString()
        : null
      if (!dateStr) continue

      const moodDescriptions: Record<number, string> = {
        1: 'Very low',
        2: 'Low',
        3: 'Okay',
        4: 'Good',
        5: 'Great',
      }

      timeline.push({
        id: `checkin-${checkin.id}`,
        type: 'checkin',
        date: dateStr,
        title: 'Wellness Check-in',
        subtitle: `Mood: ${moodDescriptions[checkin.mood] || checkin.mood}/5 — Pain: ${checkin.pain}/10`,
        severity: checkin.pain >= 7 ? 'alert' : checkin.mood >= 4 ? 'positive' : 'info',
        data: {
          mood: checkin.mood,
          pain: checkin.pain,
          energy: checkin.energy,
          sleep: checkin.sleep,
          notes: checkin.notes,
        },
      })
    }

    // --- Symptom insights ---
    for (const insight of insightsData) {
      const dateStr = insight.createdAt
        ? new Date(insight.createdAt).toISOString()
        : null
      if (!dateStr) continue

      timeline.push({
        id: `insight-${insight.id}`,
        type: 'insight',
        date: dateStr,
        title: insight.title,
        subtitle: insight.body.length > 100 ? insight.body.slice(0, 100) + '...' : insight.body,
        severity: insight.severity as TimelineItem['severity'],
        isMilestone: insight.type === 'milestone',
        data: {
          body: insight.body,
          insightType: insight.type,
          status: insight.status,
          data: insight.data,
        },
      })
    }

    // --- Treatment cycles (milestones) ---
    for (const cycle of cyclesData) {
      const dateStr = cycle.startDate
        ? new Date(cycle.startDate).toISOString()
        : null
      if (!dateStr) continue

      timeline.push({
        id: `cycle-${cycle.id}`,
        type: 'cycle',
        date: dateStr,
        title: `Cycle ${cycle.cycleNumber}${cycle.regimenName ? ` — ${cycle.regimenName}` : ''}`,
        subtitle: `${cycle.cycleLengthDays}-day cycle${cycle.isActive ? ' (active)' : ''}`,
        isMilestone: true,
        data: {
          cycleNumber: cycle.cycleNumber,
          regimenName: cycle.regimenName,
          cycleLengthDays: cycle.cycleLengthDays,
          isActive: cycle.isActive,
          notes: cycle.notes,
        },
      })
    }

    // --- Symptom entries ---
    for (const entry of symptomsData) {
      const dateStr = entry.date
        ? new Date(entry.date).toISOString()
        : entry.createdAt
          ? new Date(entry.createdAt).toISOString()
          : null
      if (!dateStr) continue

      const symptomList = entry.symptoms || []
      timeline.push({
        id: `symptom-${entry.id}`,
        type: 'symptom',
        date: dateStr,
        title: symptomList.length > 0
          ? symptomList.slice(0, 3).join(', ')
          : 'Symptom Entry',
        subtitle: entry.notes
          ? entry.notes.slice(0, 80) + (entry.notes.length > 80 ? '...' : '')
          : entry.painLevel != null
            ? `Pain: ${entry.painLevel}/10`
            : 'Symptom check-in',
        severity: entry.painLevel != null && entry.painLevel >= 7 ? 'alert' : 'info',
        data: {
          painLevel: entry.painLevel,
          mood: entry.mood,
          sleepQuality: entry.sleepQuality,
          energy: entry.energy,
          symptoms: symptomList,
          notes: entry.notes,
        },
      })
    }

    // Sort by date descending
    timeline.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )

    return apiSuccess(timeline)
  } catch (err) {
    console.error('[timeline] GET error:', err)
    return apiError('Internal server error', 500)
  }
}
