import type { HealthKitMedicationRecord, HealthKitLabRecord, HealthKitAppointmentRecord } from '@carecompanion/types'

type FhirResource = Record<string, unknown>

export function fhirMedicationToMedication(fhir: FhirResource): HealthKitMedicationRecord {
  const med = fhir.medicationCodeableConcept as { text?: string } | undefined
  const dosage = (fhir.dosageInstruction as { text?: string }[] | undefined)?.[0]
  const requester = fhir.requester as { display?: string } | undefined
  return {
    type: 'medication',
    healthkitFhirId: fhir.id as string,
    name: med?.text ?? 'Unknown medication',
    dose: null,
    frequency: dosage?.text ?? null,
    prescribingDoctor: requester?.display ?? null,
  }
}

export function fhirObservationToLabResult(fhir: FhirResource): HealthKitLabRecord {
  const code = fhir.code as { text?: string } | undefined
  const quantity = fhir.valueQuantity as { value?: number; unit?: string } | undefined
  const range = (fhir.referenceRange as { text?: string }[] | undefined)?.[0]
  const effectiveDateTime = fhir.effectiveDateTime as string | undefined
  const dateTaken = effectiveDateTime ? effectiveDateTime.split('T')[0] : null
  return {
    type: 'labResult',
    healthkitFhirId: fhir.id as string,
    testName: code?.text ?? 'Unknown test',
    value: String(quantity?.value ?? ''),
    unit: quantity?.unit ?? null,
    referenceRange: range?.text ?? null,
    dateTaken,
  }
}

export function fhirEncounterToAppointment(fhir: FhirResource): HealthKitAppointmentRecord {
  const participant = (fhir.participant as { individual?: { display?: string } }[] | undefined)?.[0]
  const period = fhir.period as { start?: string } | undefined
  const location = (fhir.location as { location?: { display?: string } }[] | undefined)?.[0]
  return {
    type: 'appointment',
    healthkitFhirId: fhir.id as string,
    doctorName: participant?.individual?.display ?? 'Unknown provider',
    specialty: null,
    dateTime: period?.start ?? new Date().toISOString(),
    location: location?.location?.display ?? null,
  }
}
