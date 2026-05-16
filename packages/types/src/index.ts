// Types are inferred from the Drizzle schema — never hand-written.
// Any schema change automatically propagates to both web and mobile.
// The relative path crosses workspace boundaries intentionally — types is a
// compile-time-only package with no runtime output.
import type { InferSelectModel } from 'drizzle-orm'
import type {
  users,
  careProfiles,
  medications,
  labResults,
  appointments,
  claims,          // NOTE: the table export is 'claims', not 'insuranceClaims'
  notifications,
  conditions,
  allergies,
  procedures,
  immunizations,
} from '../../../apps/web/src/lib/db/schema'

export type User = InferSelectModel<typeof users>
export type CareProfile = InferSelectModel<typeof careProfiles>
export type Medication = InferSelectModel<typeof medications>
export type LabResult = InferSelectModel<typeof labResults>
export type Appointment = InferSelectModel<typeof appointments>
export type InsuranceClaim = InferSelectModel<typeof claims>
export type Notification = InferSelectModel<typeof notifications>
export type Condition = InferSelectModel<typeof conditions>
export type Allergy = InferSelectModel<typeof allergies>
export type Procedure = InferSelectModel<typeof procedures>
export type Immunization = InferSelectModel<typeof immunizations>

// Discriminated union for HealthKit sync endpoint.
// Server adds userId/careProfileId from session — converters do NOT set these.
export type HealthKitMedicationRecord = {
  type: 'medication'
  healthkitFhirId: string
  name: string
  dose: string | null
  frequency: string | null
  prescribingDoctor: string | null
}

export type HealthKitLabRecord = {
  type: 'labResult'
  healthkitFhirId: string
  testName: string
  value: string
  unit: string | null
  referenceRange: string | null
  dateTaken: string | null  // "YYYY-MM-DD" format — matches labResults.dateTaken
}

export type HealthKitAppointmentRecord = {
  type: 'appointment'
  healthkitFhirId: string
  doctorName: string
  specialty: string | null
  dateTime: string          // ISO timestamp — matches appointments.dateTime
  location: string | null
}

export type HealthKitVitalSignRecord = {
  type: 'vitalSign'
  healthkitFhirId: string
  code: string | null
  display: string
  value: string | null
  unit: string | null
  effectiveDateTime: string | null  // ISO timestamp — sliced to YYYY-MM-DD for dateTaken
}

export type HealthKitConditionRecord = {
  type: 'condition'
  healthkitFhirId: string
  code: string | null
  display: string
  clinicalStatus: string | null
  onsetDateTime: string | null
}

export type HealthKitAllergyRecord = {
  type: 'allergy'
  healthkitFhirId: string
  code: string | null
  display: string
  reaction: string | null
  criticality: string | null
}

export type HealthKitProcedureRecord = {
  type: 'procedure'
  healthkitFhirId: string
  code: string | null
  display: string
  performedDateTime: string | null
}

export type HealthKitImmunizationRecord = {
  type: 'immunization'
  healthkitFhirId: string
  code: string | null
  display: string
  occurrenceDateTime: string | null
}

// Raw FHIR Encounter resource from HealthKit clinical records.
// Converted server-side via fhirEncounterToAppointment before persisting.
export type HealthKitEncounterRecord = {
  type: 'encounter'
  healthkitFhirId: string
  id: string  // FHIR resource id — read by fhirEncounterToAppointment
  participant?: { individual?: { display?: string } }[]
  period?: { start?: string }
  location?: { location?: { display?: string } }[]
}


export type HealthKitRecord =
  | HealthKitMedicationRecord
  | HealthKitLabRecord
  | HealthKitAppointmentRecord
  | HealthKitVitalSignRecord
  | HealthKitConditionRecord
  | HealthKitAllergyRecord
  | HealthKitProcedureRecord
  | HealthKitImmunizationRecord
  | HealthKitEncounterRecord
