/**
 * HealthKit sync service — backed by the native HealthKitBridge Swift module.
 *
 * The bridge reads HKClinicalRecord objects (FHIR-backed) from Apple HealthKit
 * and returns raw JSON.  This layer normalises that JSON into the typed
 * HealthKitRecord shape expected by the backend sync endpoint.
 *
 * Entitlement in CareCompanion.entitlements:
 *   com.apple.developer.healthkit.access = ["health-records"]
 *
 * Reference:
 *   https://developer.apple.com/documentation/healthkit/hkclinicalrecord
 */
import { NativeModules, Platform } from 'react-native'
import { apiClient } from './api'
import type {
  HealthKitRecord,
  HealthKitMedicationRecord,
  HealthKitLabRecord,
  HealthKitAppointmentRecord,
} from '@carecompanion/types'

// ---------------------------------------------------------------------------
// Native module type declaration
// ---------------------------------------------------------------------------

interface RawClinicalRecord {
  id: string
  type: string          // HKClinicalTypeIdentifier raw value
  displayName: string
  startDate: string     // ISO 8601
  fhirData: string | null
}

interface NativeHealthKitBridge {
  requestAuthorization(): Promise<boolean>
  fetchClinicalRecords(): Promise<RawClinicalRecord[]>
}

const Bridge: NativeHealthKitBridge | null =
  Platform.OS === 'ios' ? (NativeModules.HealthKitBridge ?? null) : null

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request HealthKit authorization for all clinical record types.
 * Returns false (not throws) when HealthKit is unavailable or the user denies.
 */
export async function requestHealthKitPermissions(): Promise<boolean> {
  if (!Bridge) return false
  try {
    return await Bridge.requestAuthorization()
  } catch {
    return false
  }
}

/**
 * Fetch clinical records from HealthKit, normalise them into HealthKitRecord
 * objects, and POST them to the backend sync endpoint.
 */
export async function syncHealthKitData(): Promise<{ synced: number }> {
  if (!Bridge) return { synced: 0 }

  let raw: RawClinicalRecord[]
  try {
    raw = await Bridge.fetchClinicalRecords()
  } catch (err) {
    console.warn('[HealthKit] fetchClinicalRecords failed:', err)
    return { synced: 0 }
  }

  const records: HealthKitRecord[] = raw.flatMap((r) => {
    const parsed = normalise(r)
    return parsed ? [parsed] : []
  })

  if (records.length === 0) return { synced: 0 }
  return apiClient.healthkit.sync(records)
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function normalise(r: RawClinicalRecord): HealthKitRecord | null {
  const fhir = parseFhir(r.fhirData)

  switch (r.type) {
    case 'HKClinicalTypeIdentifierMedicationRecord':
      return normaliseMedication(r, fhir)
    case 'HKClinicalTypeIdentifierLabResultRecord':
      return normaliseLabResult(r, fhir)
    case 'HKClinicalTypeIdentifierConditionRecord':
    case 'HKClinicalTypeIdentifierProcedureRecord':
      // Map conditions/procedures to appointments (closest existing type).
      return normaliseAsAppointment(r, fhir)
    default:
      // AllergyRecord, VitalSignRecord, ImmunizationRecord — no mapped type yet.
      return null
  }
}

function normaliseMedication(
  r: RawClinicalRecord,
  fhir: Record<string, unknown> | null,
): HealthKitMedicationRecord {
  // Pull FHIR MedicationRequest fields when available.
  const dosage = firstPath<Record<string, unknown>[]>(fhir, 'dosageInstruction')?.[0]
  const coding = firstPath<Record<string, unknown>[]>(fhir, 'medicationCodeableConcept', 'coding')?.[0]

  return {
    type: 'medication',
    healthkitFhirId: r.id,
    name: (coding?.display as string) ?? r.displayName,
    dose: (dosage?.text as string) ?? null,
    frequency: stringifyTiming(
      firstPath<Record<string, unknown>>(dosage ?? {}, 'timing'),
    ),
    prescribingDoctor: extractPractitionerName(fhir),
  }
}

function normaliseLabResult(
  r: RawClinicalRecord,
  fhir: Record<string, unknown> | null,
): HealthKitLabRecord {
  const valueQuantity = firstPath<Record<string, unknown>>(fhir, 'valueQuantity')
  const refRange = firstPath<Record<string, unknown>[]>(fhir, 'referenceRange')?.[0]

  return {
    type: 'labResult',
    healthkitFhirId: r.id,
    testName: r.displayName,
    value: valueQuantity
      ? String(valueQuantity.value ?? '')
      : (firstPath<string>(fhir, 'valueString') ?? ''),
    unit: (valueQuantity?.unit as string) ?? null,
    referenceRange: refRange
      ? `${refRange.low ?? ''}–${refRange.high ?? ''}`
      : null,
    dateTaken: isoToDate(r.startDate),
  }
}

function normaliseAsAppointment(
  r: RawClinicalRecord,
  fhir: Record<string, unknown> | null,
): HealthKitAppointmentRecord {
  return {
    type: 'appointment',
    healthkitFhirId: r.id,
    doctorName: extractPractitionerName(fhir) ?? 'Unknown provider',
    specialty: null,
    dateTime: r.startDate,
    location: extractLocation(fhir),
  }
}

// ---------------------------------------------------------------------------
// FHIR utilities
// ---------------------------------------------------------------------------

function parseFhir(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Traverse a FHIR object by a dot-separated path. */
function firstPath<T>(
  obj: Record<string, unknown> | null | undefined,
  ...keys: string[]
): T | null {
  let cursor: unknown = obj
  for (const key of keys) {
    if (cursor == null || typeof cursor !== 'object') return null
    cursor = (cursor as Record<string, unknown>)[key]
  }
  return (cursor as T) ?? null
}

function extractPractitionerName(fhir: Record<string, unknown> | null): string | null {
  // MedicationRequest.requester or Observation.performer
  const ref =
    firstPath<Record<string, unknown>>(fhir, 'requester') ??
    firstPath<Record<string, unknown>[]>(fhir, 'performer')?.[0]
  return (ref?.display as string) ?? null
}

function extractLocation(fhir: Record<string, unknown> | null): string | null {
  return (
    firstPath<string>(fhir, 'location', 'display') ??
    firstPath<string>(fhir, 'serviceProvider', 'display') ??
    null
  )
}

function stringifyTiming(timing: Record<string, unknown> | null): string | null {
  if (!timing) return null
  const code = firstPath<string>(timing, 'code', 'text')
  if (code) return code
  const repeat_ = firstPath<Record<string, unknown>>(timing, 'repeat')
  if (!repeat_) return null
  const freq = repeat_.frequency
  const period = repeat_.period
  const periodUnit = repeat_.periodUnit
  if (freq && period && periodUnit) return `${freq}x per ${period}${periodUnit}`
  return null
}

/** Convert an ISO 8601 timestamp to a YYYY-MM-DD date string. */
function isoToDate(iso: string): string | null {
  try {
    return new Date(iso).toISOString().split('T')[0] ?? null
  } catch {
    return null
  }
}
