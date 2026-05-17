import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { medications, labResults, appointments, careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { HealthKitRecord } from '@carecompanion/types'
import { logAudit } from '@/lib/audit'
import { getAuthenticatedUser } from '@/lib/api-helpers'

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser()
  if (authError) return authError

  const { records = [] }: { records: HealthKitRecord[] } = await req.json()

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

  let synced = 0
  let errors = 0
  const counts = { medications: 0, labResults: 0, appointments: 0, skipped: 0 }

  for (const record of records) {
    // Guard: skip records with no FHIR ID — NULL healthkitFhirId bypasses unique dedup
    // (Postgres treats two NULLs as distinct, so unique index does not prevent duplicates)
    if (!record.healthkitFhirId) { counts.skipped++; continue }

    if (record.type === 'medication') {
      try {
        await db.insert(medications)
          .values({
            careProfileId: careProfile.id,
            name: record.name,
            dose: record.dose,
            frequency: record.frequency,
            prescribingDoctor: record.prescribingDoctor,
            healthkitFhirId: record.healthkitFhirId,
          })
          .onConflictDoUpdate({
            target: medications.healthkitFhirId,
            // deletedAt: null un-deletes rows that were soft-deleted by a prior replace
            set: { name: record.name, dose: record.dose, frequency: record.frequency, deletedAt: null },
          })
        counts.medications++
        synced++
      } catch (err) {
        errors++
        console.error('[healthkit/sync] insert failed for medication record:', err instanceof Error ? err.message : err)
      }
    } else if (record.type === 'labResult') {
      try {
        await db.insert(labResults)
          .values({
            userId: user.id,      // labResults uses userId, not careProfileId
            testName: record.testName,
            value: record.value,
            unit: record.unit,
            referenceRange: record.referenceRange,
            dateTaken: record.dateTaken,  // "YYYY-MM-DD" date string matches date column
            source: 'HealthKit',
            healthkitFhirId: record.healthkitFhirId,
          })
          .onConflictDoUpdate({
            target: labResults.healthkitFhirId,
            set: { value: record.value, unit: record.unit },
          })
        counts.labResults++
        synced++
      } catch (err) {
        errors++
        console.error('[healthkit/sync] insert failed for labResult record:', err instanceof Error ? err.message : err)
      }
    } else if (record.type === 'appointment') {
      try {
        await db.insert(appointments)
          .values({
            careProfileId: careProfile.id,
            doctorName: record.doctorName,
            specialty: record.specialty,
            dateTime: record.dateTime ? new Date(record.dateTime) : null,
            location: record.location,
            healthkitFhirId: record.healthkitFhirId,
          })
          .onConflictDoUpdate({
            target: appointments.healthkitFhirId,
            set: { dateTime: record.dateTime ? new Date(record.dateTime) : null, location: record.location },
          })
        counts.appointments++
        synced++
      } catch (err) {
        errors++
        console.error('[healthkit/sync] insert failed for appointment record:', err instanceof Error ? err.message : err)
      }
    } else if (record.type === 'vitalSign') {
      try {
        const dateTaken = record.effectiveDateTime ? record.effectiveDateTime.slice(0, 10) : null
        await db.insert(labResults)
          .values({
            userId: user.id,
            testName: record.display,
            value: record.value ?? '',
            unit: record.unit,
            referenceRange: null,
            dateTaken,
            source: 'HealthKit/VitalSign',
            healthkitFhirId: record.healthkitFhirId,
          })
          .onConflictDoUpdate({
            target: labResults.healthkitFhirId,
            set: { value: record.value ?? '', unit: record.unit },
          })
        counts.labResults++
        synced++
      } catch (err) {
        errors++
        console.error('[healthkit/sync] insert failed for vitalSign record:', err instanceof Error ? err.message : err)
      }
    }
  }

  // HIPAA audit log — counts only, NO PHI (no medication names, lab values, etc.)
  await logAudit({
    user_id: user.id,
    action: 'sync_data',
    resource_type: 'healthkit',
    details: { counts }, // counts only — medications: N, labResults: N, appointments: N
  })

  return NextResponse.json({ synced, errors })
}
