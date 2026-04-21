import type { Medication, LabResult, Appointment } from './types'

interface MedicationLog {
  medication_id: string
  taken_at: string
}

/**
 * Calculate a health score (0-100) based on:
 * - Lab results in normal range (40% weight)
 * - Medication adherence (30% weight)
 * - Appointment attendance (20% weight)
 * - Active health management (10% weight)
 */
export function calculateHealthScore(
  medications: Medication[],
  labResults: LabResult[],
  appointments: Appointment[],
  adherenceLogs: MedicationLog[] = []
): number {
  let score = 0

  // Lab score (40%): % of labs in normal range
  if (labResults.length > 0) {
    const normalCount = labResults.filter((l) => !l.isAbnormal).length
    score += (normalCount / labResults.length) * 40
  } else {
    score += 20 // neutral if no labs
  }

  // Adherence score (30%): % of meds taken in last 7 days
  if (medications.length > 0) {
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 86400000
    const recentLogs = adherenceLogs.filter(
      (log) => new Date(log.taken_at).getTime() >= sevenDaysAgo
    )
    // Expected: 1 log per med per day for 7 days
    const expected = medications.length * 7
    const actual = Math.min(recentLogs.length, expected)
    score += (actual / expected) * 30
  } else {
    score += 15 // neutral if no meds
  }

  // Appointment score (20%): has upcoming appointments
  const now = new Date()
  const upcomingAppts = appointments.filter(
    (a) => a.dateTime && new Date(a.dateTime) > now
  )
  if (upcomingAppts.length > 0) {
    score += 20
  } else if (appointments.length > 0) {
    score += 10 // has past appointments but none upcoming
  }

  // Active management score (10%): has data at all
  if (medications.length > 0) score += 3
  if (labResults.length > 0) score += 3
  if (appointments.length > 0) score += 2
  if (adherenceLogs.length > 0) score += 2

  return Math.round(Math.min(score, 100))
}
