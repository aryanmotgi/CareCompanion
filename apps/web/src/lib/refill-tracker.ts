/**
 * Medication refill automation.
 * Tracks refill cycles, predicts next refill dates, and generates renewal notifications.
 */
import { db } from '@/lib/db'
import { medications } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

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
    .where(and(eq(medications.careProfileId, careProfileId), isNull(medications.deletedAt)))

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

