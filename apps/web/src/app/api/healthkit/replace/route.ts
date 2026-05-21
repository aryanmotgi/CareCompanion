import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { medications, labResults, appointments, careProfiles, conditions, allergies, procedures, immunizations } from '@/lib/db/schema'
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
  const deleted = { medications: 0, appointments: 0, labResults: 0, conditions: 0, allergies: 0, procedures: 0, immunizations: 0 }
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

    const condRows = await tx
      .update(conditions)
      .set({ deletedAt: new Date() })
      .where(and(eq(conditions.careProfileId, careProfile.id), isNull(conditions.deletedAt)))
      .returning({ id: conditions.id })
    deleted.conditions = condRows.length

    const allergyRows = await tx
      .update(allergies)
      .set({ deletedAt: new Date() })
      .where(and(eq(allergies.careProfileId, careProfile.id), isNull(allergies.deletedAt)))
      .returning({ id: allergies.id })
    deleted.allergies = allergyRows.length

    const procRows = await tx
      .update(procedures)
      .set({ deletedAt: new Date() })
      .where(and(eq(procedures.careProfileId, careProfile.id), isNull(procedures.deletedAt)))
      .returning({ id: procedures.id })
    deleted.procedures = procRows.length

    const immRows = await tx
      .update(immunizations)
      .set({ deletedAt: new Date() })
      .where(and(eq(immunizations.careProfileId, careProfile.id), isNull(immunizations.deletedAt)))
      .returning({ id: immunizations.id })
    deleted.immunizations = immRows.length

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
  const counts = { medications: 0, labResults: 0, appointments: 0, conditions: 0, allergies: 0, procedures: 0, immunizations: 0, skipped: 0 }

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
        console.error('[healthkit/replace] insert failed for condition record:', err instanceof Error ? err.message : err)
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
        console.error('[healthkit/replace] insert failed for allergy record:', err instanceof Error ? err.message : err)
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
        console.error('[healthkit/replace] insert failed for procedure record:', err instanceof Error ? err.message : err)
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
        console.error('[healthkit/replace] insert failed for immunization record:', err instanceof Error ? err.message : err)
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
