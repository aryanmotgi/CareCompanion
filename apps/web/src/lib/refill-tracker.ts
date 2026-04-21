/**
 * Medication refill automation.
 * Tracks refill cycles, predicts next refill dates, and generates renewal notifications.
 */
import { db } from '@/lib/db'
import { medications, careProfiles, userSettings, notifications } from '@/lib/db/schema'
import { eq, and, gte } from 'drizzle-orm'

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
  const meds = await db
    .select({
      id: medications.id,
      name: medications.name,
      dose: medications.dose,
      refillDate: medications.refillDate,
      prescribingDoctor: medications.prescribingDoctor,
    })
    .from(medications)
    .where(eq(medications.careProfileId, careProfileId))

  if (meds.length === 0) return []

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  return meds.map(med => buildRefillStatus(med, now))
}

function buildRefillStatus(
  med: { id: string; name: string; dose: string | null; refillDate: string | null; prescribingDoctor: string | null },
  now: Date,
): RefillStatus {
  if (!med.refillDate) {
    return {
      medication_id: med.id,
      medication_name: med.name,
      dose: med.dose,
      refill_date: null,
      days_until_refill: null,
      status: 'unknown' as const,
      prescribing_doctor: med.prescribingDoctor,
    }
  }

  const refillDate = new Date(med.refillDate)
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
    refill_date: med.refillDate,
    days_until_refill: diffDays,
    status,
    prescribing_doctor: med.prescribingDoctor,
  }
}

/**
 * Generate refill notifications for all users.
 * Run from a cron job.
 */
export async function generateRefillNotifications(): Promise<{ total: number; users: number }> {
  const profiles = await db
    .select({ id: careProfiles.id, userId: careProfiles.userId })
    .from(careProfiles)

  if (profiles.length === 0) return { total: 0, users: 0 }

  let total = 0
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  for (const profile of profiles) {
    // Check user's notification preferences
    const [settings] = await db
      .select({ refillReminders: userSettings.refillReminders })
      .from(userSettings)
      .where(eq(userSettings.userId, profile.userId))
      .limit(1)

    if (settings?.refillReminders === false) continue

    const statuses = await checkRefillStatus(profile.id)
    const actionable = statuses.filter(s => s.status === 'overdue' || s.status === 'due_today' || s.status === 'due_soon')

    if (actionable.length === 0) continue

    // Check for existing notifications to avoid duplicates
    const existing = await db
      .select({ title: notifications.title })
      .from(notifications)
      .where(and(eq(notifications.userId, profile.userId), gte(notifications.createdAt, oneDayAgo)))

    const existingTitles = new Set(existing.map(n => n.title))

    const toInsert = actionable
      .map(s => {
        const title = s.status === 'overdue'
          ? `${s.medication_name} refill is overdue`
          : s.status === 'due_today'
            ? `${s.medication_name} refill is due today`
            : `${s.medication_name} refill due in ${s.days_until_refill} day${s.days_until_refill === 1 ? '' : 's'}`

        if (existingTitles.has(title)) return null

        return {
          userId: profile.userId,
          type: s.status === 'overdue' ? 'refill_overdue' : 'refill_soon',
          title,
          message: `${s.medication_name}${s.dose ? ` ${s.dose}` : ''} needs a refill.${s.prescribing_doctor ? ` Prescriber: ${s.prescribing_doctor}` : ''}`,
        }
      })
      .filter((n): n is NonNullable<typeof n> => n !== null)

    if (toInsert.length > 0) {
      await db.insert(notifications).values(toInsert)
      total += toInsert.length
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
  const nextRefill = new Date()
  nextRefill.setDate(nextRefill.getDate() + cycleLength)
  const nextRefillStr = nextRefill.toISOString().split('T')[0]

  await db
    .update(medications)
    .set({ refillDate: nextRefillStr })
    .where(eq(medications.id, medicationId))

  return nextRefillStr
}
