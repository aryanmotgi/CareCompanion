/**
 * Medication reminder compliance tracking.
 * Records taken/skipped/snoozed responses and generates adherence reports.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export interface ComplianceReport {
  period_days: number
  total_expected: number
  total_taken: number
  total_missed: number
  total_snoozed: number
  adherence_percent: number
  by_medication: MedicationCompliance[]
  streak: number // consecutive days with all meds taken
  worst_time: string | null // time of day most often missed
}

interface MedicationCompliance {
  medication_name: string
  expected: number
  taken: number
  missed: number
  snoozed: number
  adherence_percent: number
}

/**
 * Generate a compliance report for a user over a given period.
 */
export async function generateComplianceReport(
  userId: string,
  periodDays: number = 7,
): Promise<ComplianceReport> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: logs }, { data: reminders }] = await Promise.all([
    admin.from('reminder_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: true }),
    admin.from('medication_reminders')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true),
  ])

  if (!reminders || reminders.length === 0) {
    return {
      period_days: periodDays,
      total_expected: 0,
      total_taken: 0,
      total_missed: 0,
      total_snoozed: 0,
      adherence_percent: 100,
      by_medication: [],
      streak: 0,
      worst_time: null,
    }
  }

  // Calculate expected doses per medication
  const byMedication = new Map<string, MedicationCompliance>()

  for (const reminder of reminders) {
    const timesPerDay = reminder.reminder_times?.length || 1
    const daysPerWeek = reminder.days_of_week?.length || 7
    const expectedInPeriod = Math.round((timesPerDay * daysPerWeek * periodDays) / 7)

    byMedication.set(reminder.medication_name, {
      medication_name: reminder.medication_name,
      expected: expectedInPeriod,
      taken: 0,
      missed: 0,
      snoozed: 0,
      adherence_percent: 0,
    })
  }

  // Count actual responses
  const missedTimes: string[] = []

  for (const log of (logs || [])) {
    const entry = byMedication.get(log.medication_name)
    if (!entry) continue

    switch (log.status) {
      case 'taken':
        entry.taken++
        break
      case 'missed':
        entry.missed++
        missedTimes.push(log.scheduled_time)
        break
      case 'snoozed':
        entry.snoozed++
        break
    }
  }

  // Calculate adherence percentages
  let totalExpected = 0
  let totalTaken = 0
  let totalMissed = 0
  let totalSnoozed = 0

  for (const entry of Array.from(byMedication.values())) {
    entry.adherence_percent = entry.expected > 0
      ? Math.round((entry.taken / entry.expected) * 100)
      : 100
    totalExpected += entry.expected
    totalTaken += entry.taken
    totalMissed += entry.missed
    totalSnoozed += entry.snoozed
  }

  // Find worst time of day for missed doses
  let worstTime: string | null = null
  if (missedTimes.length > 0) {
    const timeCounts = new Map<string, number>()
    for (const time of missedTimes) {
      timeCounts.set(time, (timeCounts.get(time) || 0) + 1)
    }
    let maxCount = 0
    for (const [time, count] of Array.from(timeCounts.entries())) {
      if (count > maxCount) {
        maxCount = count
        worstTime = time
      }
    }
  }

  // Calculate streak (consecutive days with 100% adherence)
  let streak = 0
  if (logs && logs.length > 0) {
    const dailyStatus = new Map<string, boolean>()
    for (const log of logs) {
      const day = log.created_at.split('T')[0]
      if (log.status === 'missed') {
        dailyStatus.set(day, false)
      } else if (!dailyStatus.has(day)) {
        dailyStatus.set(day, true)
      }
    }

    // Count from most recent day backwards
    const days = Array.from(dailyStatus.entries()).sort((a, b) => b[0].localeCompare(a[0]))
    for (const [, allTaken] of days) {
      if (allTaken) streak++
      else break
    }
  }

  return {
    period_days: periodDays,
    total_expected: totalExpected,
    total_taken: totalTaken,
    total_missed: totalMissed,
    total_snoozed: totalSnoozed,
    adherence_percent: totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 100,
    by_medication: Array.from(byMedication.values()),
    streak,
    worst_time: worstTime,
  }
}
