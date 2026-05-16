import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { medications, labResults, appointments, careProfiles } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import type { HealthKitRecord } from '@carecompanion/types'
import { logAudit } from '@/lib/audit'
import { getAuthenticatedUser } from '@/lib/api-helpers'

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser()
  if (authError) return authError

  const { records = [], keepCareProfile = false }: { records: HealthKitRecord[]; keepCareProfile?: boolean } = await req.json()

  let careProfile = await db.query.careProfiles.findFirst({
    where: eq(careProfiles.userId, user.id),
  })
  if (!careProfile) {
    // First-time HealthKit connect — no care profile exists yet (new user).
    // Auto-create a blank profile so records can be stored; user fills in
    // profile details later via setup or the care tab.
    const [created] = await db.insert(careProfiles).values({
      userId: user.id,
      onboardingCompleted: false,
    }).returning()
    careProfile = created
  }

  // ── Wipe phase: atomic via transaction ─────────────────────────────────────
  const deleted = { medications: 0, appointments: 0, labResults: 0 }
  await db.transaction(async (tx) => {
    const medsRows = await tx
      .update(medications)
      .set({ deletedAt: new Date() })
      .where(and(eq(medications.careProfileId, careProfile.id), isNull(medications.deletedAt)))
      .returning({ id: medications.id })
    deleted.medications = medsRows.length

    const apptRows = await tx
      .update(appointments)
      .set({ deletedAt: new Date() })
      .where(and(eq(appointments.careProfileId, careProfile.id), isNull(appointments.deletedAt)))
      .returning({ id: appointments.id })
    deleted.appointments = apptRows.length

    const labRows = await tx.delete(labResults).where(eq(labResults.userId, user.id)).returning({ id: labResults.id })
    deleted.labResults = labRows.length

    if (!keepCareProfile) {
      await tx
        .update(careProfiles)
        .set({
          patientName: null,
          patientAge: null,
          relationship: null,
          cancerType: null,
          cancerStage: null,
          treatmentPhase: null,
          conditions: null,
          allergies: null,
          onboardingCompleted: false,
          onboardingPriorities: [],
          emergencyContactName: null,
          emergencyContactPhone: null,
          caregivingExperience: null,
          primaryConcern: null,
          city: null,
          state: null,
          zipCode: null,
          fieldOverrides: null,
        })
        .where(eq(careProfiles.id, careProfile.id))
    }
  })

  // ── Sync phase: best-effort upserts (matches /api/healthkit/sync) ──────────
  let synced = 0
  let errors = 0
  const counts = { medications: 0, labResults: 0, appointments: 0, skipped: 0 }

  for (const record of records) {
    // Guard: skip records with no FHIR ID — NULL healthkitFhirId bypasses unique dedup
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
            // deletedAt: null un-deletes rows soft-deleted during the wipe phase above
            set: { name: record.name, dose: record.dose, frequency: record.frequency, deletedAt: null },
          })
        counts.medications++
        synced++
      } catch (err) {
        errors++
        console.error('[healthkit/replace] insert failed for medication record:', err instanceof Error ? err.message : err)
      }
    } else if (record.type === 'labResult') {
      try {
        await db.insert(labResults)
          .values({
            userId: user.id,
            testName: record.testName,
            value: record.value,
            unit: record.unit,
            referenceRange: record.referenceRange,
            dateTaken: record.dateTaken,
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
        console.error('[healthkit/replace] insert failed for labResult record:', err instanceof Error ? err.message : err)
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
        console.error('[healthkit/replace] insert failed for appointment record:', err instanceof Error ? err.message : err)
      }
    } else if (record.type === 'vitalSign') {
      // Store vitals (BMI, Heart Rate, Body Temperature, etc.) alongside lab results —
      // same labResults table, source='HealthKit/VitalSign' distinguishes them.
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
        console.error('[healthkit/replace] insert failed for vitalSign record:', err instanceof Error ? err.message : err)
      }
    }
  }

  // HIPAA audit log — counts only, NO PHI (no medication names, lab values, etc.)
  await logAudit({
    user_id: user.id,
    action: 'replace_data',
    resource_type: 'healthkit',
    details: { deleted, synced: counts, careProfileReset: !keepCareProfile },
  })

  return NextResponse.json({ deleted, synced, errors })
}
