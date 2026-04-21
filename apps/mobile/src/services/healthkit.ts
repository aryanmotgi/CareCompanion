import Healthkit, { HKClinicalTypeIdentifier } from '@kingstinct/react-native-healthkit'
import { fhirMedicationToMedication, fhirObservationToLabResult, fhirEncounterToAppointment } from '@carecompanion/utils'
import { apiClient } from './api'
import type { HealthKitRecord } from '@carecompanion/types'

const CLINICAL_TYPES = [
  HKClinicalTypeIdentifier.allergyRecord,
  HKClinicalTypeIdentifier.conditionRecord,
  HKClinicalTypeIdentifier.labResultRecord,
  HKClinicalTypeIdentifier.medicationRecord,
  HKClinicalTypeIdentifier.procedureRecord,
]

export async function requestHealthKitPermissions(): Promise<boolean> {
  try {
    // `as never` suppresses a v10 type mismatch between HKClinicalTypeIdentifier[]
    // and the second param overload. The runtime behavior is correct — this is a
    // known typing gap in @kingstinct/react-native-healthkit v10 clinical overloads.
    await Healthkit.requestAuthorization([], CLINICAL_TYPES as never)
    return true
  } catch {
    return false
  }
}

/**
 * Sync all available HealthKit clinical records to the backend.
 * Safe to call on every app open — server upserts on healthkitFhirId, no duplicates.
 */
export async function syncHealthKitData(): Promise<{ synced: number }> {
  const granted = await requestHealthKitPermissions()
  if (!granted) return { synced: 0 }

  const records: HealthKitRecord[] = []

  // Medications — FHIR MedicationRequest
  try {
    const meds = await Healthkit.queryClinicalSamples(HKClinicalTypeIdentifier.medicationRecord, {})
    for (const med of meds) {
      if (med.fhirResource) records.push(fhirMedicationToMedication(med.fhirResource as Record<string, unknown>))
    }
  } catch { /* user may deny this specific type */ }

  // Lab results — FHIR Observation
  try {
    const labs = await Healthkit.queryClinicalSamples(HKClinicalTypeIdentifier.labResultRecord, {})
    for (const lab of labs) {
      if (lab.fhirResource) records.push(fhirObservationToLabResult(lab.fhirResource as Record<string, unknown>))
    }
  } catch { /* user may deny this specific type */ }

  // Appointments via procedure records (encounters)
  try {
    const procedures = await Healthkit.queryClinicalSamples(HKClinicalTypeIdentifier.procedureRecord, {})
    for (const proc of procedures) {
      if (proc.fhirResource && (proc.fhirResource as Record<string, unknown>).resourceType === 'Encounter') {
        records.push(fhirEncounterToAppointment(proc.fhirResource as Record<string, unknown>))
      }
    }
  } catch { /* user may deny this specific type */ }

  if (records.length === 0) return { synced: 0 }
  return apiClient.healthkit.sync(records)
}
