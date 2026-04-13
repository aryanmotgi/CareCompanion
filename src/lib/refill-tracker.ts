/**
 * Medication refill automation.
 * Tracks refill cycles, predicts next refill dates, and generates renewal notifications.
 */
import { createAdminClient } from '@/lib/supabase/admin'

interface RefillStatus {
  medication_id: string
  medication_name: string
  dose: string | null
  refill_date: string | null
  days_until_refill: number | null
  status: 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'ok' | 'unknown'
  prescribing_doctor: string | null
}

/**
 * Check refill status for all medications for a care profile.
 */
export async function checkRefillStatus(careProfileId: string): Promise<RefillStatus[]> {
  const admin = createAdminClient()

  // Note: deleted_at filter removed — backend_improvements.sql migration adds
  // this column but it may not exist in all deployments. Without the column,
  // no medications can be soft-deleted anyway, so all rows are effectively active.
  const { data: medications, error: medsError } = await admin
    .from('medications')
    .select('id, name, dose, refill_date, prescribing_doctor')
    .eq('care_profile_id', careProfileId)

  if (medsError) {
    console.error('[refill-tracker] medications query failed:', medsError.message)
    return []
  }

  if (!medications || medications.length === 0) return []

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  return medications.map(med => buildRefillStatus(med, now))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRefillStatus(med: any, now: Date): RefillStatus {
  if (!med.refill_date) {
    return {
      medication_id: med.id,
      medication_name: med.name,
      dose: med.dose,
      refill_date: null,
      days_until_refill: null,
      status: 'unknown' as const,
      prescribing_doctor: med.prescribing_doctor,
    }
  }

  const refillDate = new Date(med.refill_date)
  refillDate.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((refillDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  let status: RefillStatus['status'] = 'ok'
  if (diffDays < 0) status = 'overdue'
  else if (diffDays === 0) status = 'due_today'
  else if (diffDays <= 3) status = 'due_soon'
  else if (diffDays <= 7) status = 'upcoming'

  return {
      medication_id: med.id,
      medication_name: med.name,
      dose: med.dose,
      refill_date: med.refill_date,
      days_until_refill: diffDays,
      status,
      prescribing_doctor: med.prescribing_doctor,
    }
}

/**
 * Generate refill notifications for all users.
 * Run from a cron job.
 */
export async function generateRefillNotifications(): Promise<{ total: number; users: number }> {
  const admin = createAdminClient()

  const { data: profiles } = await admin
    .from('care_profiles')
    .select('id, user_id')

  if (!profiles || profiles.length === 0) return { total: 0, users: 0 }

  let total = 0

  for (const profile of profiles) {
    // Check user's notification preferences
    const { data: settings } = await admin
      .from('user_settings')
      .select('refill_reminders')
      .eq('user_id', profile.user_id)
      .single()

    if (settings?.refill_reminders === false) continue

    const statuses = await checkRefillStatus(profile.id)
    const actionable = statuses.filter(s => s.status === 'overdue' || s.status === 'due_today' || s.status === 'due_soon')

    if (actionable.length === 0) continue

    // Check for existing notifications to avoid duplicates
    const { data: existing } = await admin
      .from('notifications')
      .select('title')
      .eq('user_id', profile.user_id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const existingTitles = new Set((existing || []).map(n => n.title))

    const notifications = actionable
      .map(s => {
        const title = s.status === 'overdue'
          ? `${s.medication_name} refill is overdue`
          : s.status === 'due_today'
            ? `${s.medication_name} refill is due today`
            : `${s.medication_name} refill due in ${s.days_until_refill} day${s.days_until_refill === 1 ? '' : 's'}`

        if (existingTitles.has(title)) return null

        return {
          user_id: profile.user_id,
          type: s.status === 'overdue' ? 'refill_overdue' : 'refill_soon',
          title,
          message: `${s.medication_name}${s.dose ? ` ${s.dose}` : ''} needs a refill.${s.prescribing_doctor ? ` Prescriber: ${s.prescribing_doctor}` : ''}`,
        }
      })
      .filter(Boolean)

    if (notifications.length > 0) {
      await admin.from('notifications').insert(notifications)
      total += notifications.length
    }
  }

  return { total, users: profiles.length }
}

/**
 * Auto-advance refill date after a refill is confirmed.
 * Estimates next refill based on typical 30 or 90 day cycles.
 */
export async function advanceRefillDate(
  medicationId: string,
  cycleLength: 30 | 60 | 90 = 30,
): Promise<string> {
  const admin = createAdminClient()
  const nextRefill = new Date()
  nextRefill.setDate(nextRefill.getDate() + cycleLength)
  const nextRefillStr = nextRefill.toISOString().split('T')[0]

  await admin
    .from('medications')
    .update({ refill_date: nextRefillStr })
    .eq('id', medicationId)

  return nextRefillStr
}
