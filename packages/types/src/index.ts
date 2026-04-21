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
} from '../../../apps/web/src/lib/db/schema'

export type User = InferSelectModel<typeof users>
export type CareProfile = InferSelectModel<typeof careProfiles>
export type Medication = InferSelectModel<typeof medications>
export type LabResult = InferSelectModel<typeof labResults>
export type Appointment = InferSelectModel<typeof appointments>
export type InsuranceClaim = InferSelectModel<typeof claims>
export type Notification = InferSelectModel<typeof notifications>

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

export type HealthKitRecord =
  | HealthKitMedicationRecord
  | HealthKitLabRecord
  | HealthKitAppointmentRecord
