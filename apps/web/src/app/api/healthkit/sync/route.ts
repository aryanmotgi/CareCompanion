import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { medications, labResults, appointments, careProfiles, conditions, allergies, procedures, immunizations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { HealthKitRecord } from '@carecompanion/types'
import { fhirEncounterToAppointment } from '@carecompanion/utils'
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
  const counts = { medications: 0, labResults: 0, appointments: 0, encounters: 0, conditions: 0, allergies: 0, procedures: 0, immunizations: 0, skipped: 0 }

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
    } else if (record.type === 'condition') {
      try {
        await db.insert(conditions)
          .values({
            careProfileId: careProfile.id,
            code: record.code,
            display: record.display,
            clinicalStatus: record.clinicalStatus,
            onsetDateTime: record.onsetDateTime ? new Date(record.onsetDateTime) : null,
            healthkitFhirId: record.healthkitFhirId,
          })
          .onConflictDoUpdate({
            target: conditions.healthkitFhirId,
            set: {
              code: record.code,
              display: record.display,
              clinicalStatus: record.clinicalStatus,
              onsetDateTime: record.onsetDateTime ? new Date(record.onsetDateTime) : null,
              deletedAt: null,
            },
          })
        counts.conditions++
        synced++
      } catch (err) {
        errors++
        console.error('[healthkit/sync] insert failed for condition record:', err instanceof Error ? err.message : err)
      }
    } else if (record.type === 'allergy') {
      try {
        await db.insert(allergies)
          .values({
            careProfileId: careProfile.id,
            code: record.code,
            display: record.display,
            reaction: record.reaction,
            criticality: record.criticality,
            healthkitFhirId: record.healthkitFhirId,
          })
          .onConflictDoUpdate({
            target: allergies.healthkitFhirId,
            set: {
              code: record.code,
              display: record.display,
              reaction: record.reaction,
              criticality: record.criticality,
              deletedAt: null,
            },
          })
        counts.allergies++
        synced++
      } catch (err) {
        errors++
        console.error('[healthkit/sync] insert failed for allergy record:', err instanceof Error ? err.message : err)
      }
    } else if (record.type === 'procedure') {
      try {
        await db.insert(procedures)
          .values({
            careProfileId: careProfile.id,
            code: record.code,
            display: record.display,
            performedDateTime: record.performedDateTime ? new Date(record.performedDateTime) : null,
            healthkitFhirId: record.healthkitFhirId,
          })
          .onConflictDoUpdate({
            target: procedures.healthkitFhirId,
            set: {
              code: record.code,
              display: record.display,
              performedDateTime: record.performedDateTime ? new Date(record.performedDateTime) : null,
              deletedAt: null,
            },
          })
        counts.procedures++
        synced++
      } catch (err) {
        errors++
        console.error('[healthkit/sync] insert failed for procedure record:', err instanceof Error ? err.message : err)
      }
    } else if (record.type === 'immunization') {
      try {
        await db.insert(immunizations)
          .values({
            careProfileId: careProfile.id,
            code: record.code,
            display: record.display,
            occurrenceDateTime: record.occurrenceDateTime ? new Date(record.occurrenceDateTime) : null,
            healthkitFhirId: record.healthkitFhirId,
          })
          .onConflictDoUpdate({
            target: immunizations.healthkitFhirId,
            set: {
              code: record.code,
              display: record.display,
              occurrenceDateTime: record.occurrenceDateTime ? new Date(record.occurrenceDateTime) : null,
              deletedAt: null,
            },
          })
        counts.immunizations++
        synced++
      } catch (err) {
        errors++
        console.error('[healthkit/sync] insert failed for immunization record:', err instanceof Error ? err.message : err)
      }
    } else if (record.type === 'encounter') {
      try {
        const appt = fhirEncounterToAppointment(record as Record<string, unknown>)
        await db.insert(appointments)
          .values({
            careProfileId: careProfile.id,
            doctorName: appt.doctorName,
            specialty: appt.specialty,
            dateTime: appt.dateTime ? new Date(appt.dateTime) : null,
            location: appt.location,
            healthkitFhirId: appt.healthkitFhirId,
          })
          .onConflictDoUpdate({
            target: appointments.healthkitFhirId,
            set: { dateTime: appt.dateTime ? new Date(appt.dateTime) : null, location: appt.location },
          })
        counts.encounters++
        synced++
      } catch (err) {
        errors++
        console.error('[healthkit/sync] insert failed for encounter record:', err instanceof Error ? err.message : err)
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
