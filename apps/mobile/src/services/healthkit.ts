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
import * as SecureStore from 'expo-secure-store'
import { apiClient } from './api'

const CONNECTED_KEY = 'cc-healthkit-connected'
import type {
  HealthKitRecord,
  HealthKitMedicationRecord,
  HealthKitLabRecord,
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
  requestBaselineAuthorization(): Promise<boolean>
  getBaselineCharacteristics(): Promise<{
    dateOfBirth: string | null  // YYYY-MM-DD
    sexAtBirth: 'female' | 'male' | 'intersex' | null
  }>
}

type BaselineCharacteristics = {
  dateOfBirth: string | null
  sexAtBirth: 'female' | 'male' | 'intersex' | null
}

/**
 * Ask HealthKit for read permission on baseline characteristics (DOB + sex)
 * and return the values. These come from `HKCharacteristicType.dateOfBirth` /
 * `.biologicalSex` and do NOT require the restricted `health-records`
 * entitlement, so they work on a sim with ad-hoc signing.
 */
export async function fetchHealthKitBaseline(): Promise<BaselineCharacteristics> {
  const empty: BaselineCharacteristics = { dateOfBirth: null, sexAtBirth: null }
  if (!Bridge) return empty
  try {
    await Bridge.requestBaselineAuthorization()
  } catch {
    return empty
  }
  try {
    return await Bridge.getBaselineCharacteristics()
  } catch {
    return empty
  }
}

const Bridge: NativeHealthKitBridge | null =
  Platform.OS === 'ios' ? (NativeModules.HealthKitBridge ?? null) : null

// ---------------------------------------------------------------------------
// __DEV__ mock data
// ---------------------------------------------------------------------------
//
// The iOS Simulator can't connect to real healthcare provider OAuth portals,
// so HKClinicalRecord queries always return []. This mock substitutes 5
// FHIR-shaped records on simulator builds (gated by __DEV__) so we can walk
// the post-onboarding screens with realistic shapes. Production builds are
// unaffected — the mock array is never read when __DEV__ is false.

const DEV_MOCK_RECORDS: RawClinicalRecord[] = [
  {
    id: 'mock-med-1',
    type: 'HKClinicalTypeIdentifierMedicationRecord',
    displayName: 'Tamoxifen',
    startDate: '2026-04-15T09:00:00Z',
    fhirData: JSON.stringify({
      resourceType: 'MedicationRequest',
      status: 'active',
      medicationCodeableConcept: {
        coding: [{ display: 'Tamoxifen 20 mg oral tablet', code: '198240', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' }],
      },
      dosageInstruction: [{
        text: '20 mg once daily',
        timing: { repeat: { frequency: 1, period: 1, periodUnit: 'd' } },
      }],
      requester: { display: 'Dr. Sarah Chen, MD — Memorial Oncology' },
    }),
  },
  {
    id: 'mock-med-2',
    type: 'HKClinicalTypeIdentifierMedicationRecord',
    displayName: 'Trastuzumab',
    startDate: '2026-03-01T10:30:00Z',
    fhirData: JSON.stringify({
      resourceType: 'MedicationRequest',
      status: 'active',
      medicationCodeableConcept: {
        coding: [{ display: 'Trastuzumab 420 mg IV infusion', code: '224905', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' }],
      },
      dosageInstruction: [{
        text: '420 mg IV every 3 weeks',
        timing: { repeat: { frequency: 1, period: 3, periodUnit: 'wk' } },
      }],
      requester: { display: 'Dr. Sarah Chen, MD — Memorial Oncology' },
    }),
  },
  {
    id: 'mock-lab-1',
    type: 'HKClinicalTypeIdentifierLabResultRecord',
    displayName: 'Hemoglobin',
    startDate: '2026-05-08T08:15:00Z',
    fhirData: JSON.stringify({
      resourceType: 'Observation',
      status: 'final',
      code: { coding: [{ display: 'Hemoglobin', code: '718-7', system: 'http://loinc.org' }] },
      valueQuantity: { value: 11.2, unit: 'g/dL', system: 'http://unitsofmeasure.org', code: 'g/dL' },
      referenceRange: [{ low: { value: 12.0 }, high: { value: 15.5 }, text: '12.0 – 15.5 g/dL' }],
      interpretation: [{ coding: [{ code: 'L', display: 'Low' }] }],
    }),
  },
  {
    id: 'mock-lab-2',
    type: 'HKClinicalTypeIdentifierLabResultRecord',
    displayName: 'Absolute Neutrophil Count',
    startDate: '2026-05-08T08:15:00Z',
    fhirData: JSON.stringify({
      resourceType: 'Observation',
      status: 'final',
      code: { coding: [{ display: 'Neutrophils [#/volume] in Blood', code: '751-8', system: 'http://loinc.org' }] },
      valueQuantity: { value: 1.8, unit: '10*3/uL', system: 'http://unitsofmeasure.org' },
      referenceRange: [{ low: { value: 1.5 }, high: { value: 8.0 }, text: '1.5 – 8.0 ×10³/μL' }],
    }),
  },
  {
    id: 'mock-lab-3',
    type: 'HKClinicalTypeIdentifierLabResultRecord',
    displayName: 'Platelets',
    startDate: '2026-05-08T08:15:00Z',
    fhirData: JSON.stringify({
      resourceType: 'Observation',
      status: 'final',
      code: { coding: [{ display: 'Platelets [#/volume] in Blood', code: '777-3', system: 'http://loinc.org' }] },
      valueQuantity: { value: 145, unit: '10*3/uL', system: 'http://unitsofmeasure.org' },
      referenceRange: [{ low: { value: 150 }, high: { value: 400 }, text: '150 – 400 ×10³/μL' }],
      interpretation: [{ coding: [{ code: 'L', display: 'Low' }] }],
    }),
  },
]

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
 * Persist that the user has gone through the connect flow. Used to gate
 * passive sync calls — Apple does not let apps query auth status for clinical
 * records, so we track it ourselves.
 */
export async function markHealthKitConnected(): Promise<void> {
  try {
    await SecureStore.setItemAsync(CONNECTED_KEY, '1')
  } catch {
    // SecureStore unavailable (e.g. in tests) — fail open, sync just won't run.
  }
}

export async function isHealthKitConnected(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(CONNECTED_KEY)) === '1'
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

  // __DEV__ MOCK: the simulator can never surface real HKClinicalRecord data
  // (no path to provider OAuth portals). Substitute hardcoded FHIR-shaped
  // records so we can walk the post-onboarding screens (home, timeline, AI)
  // with realistic shapes. Production builds are unaffected.
  if (__DEV__ && raw.length === 0) {
    raw = DEV_MOCK_RECORDS
    console.log('[HealthKit] __DEV__: substituting', raw.length, 'mock clinical records (simulator has no real provider portal)')
  }

  const records: HealthKitRecord[] = raw.flatMap((r) => {
    const parsed = normalise(r)
    return parsed ? [parsed] : []
  })

  if (records.length === 0) return { synced: 0 }

  // Don't let a backend failure (auth, network, migration not yet run) propagate
  // up and bail the onboarding flow. Treat it as zero-synced — the gate logic in
  // /onboarding-records can then surface a friendly "no records found yet"
  // alert instead of a generic "could not connect" error. A real fix happens
  // later when the user retries from inside the app.
  try {
    return await apiClient.healthkit.sync(records)
  } catch (err) {
    console.warn('[HealthKit] sync POST failed:', err)
    return { synced: 0 }
  }
}

/**
 * Read clinical records from HealthKit, normalise, and POST to the backend
 * replace endpoint. Care profile fields (patient name, cancer type, etc.) are
 * preserved; only the medical-data tables are wiped and re-populated.
 */
export async function replaceHealthKitData(): Promise<{
  synced: number
  errors: number
  deleted: { medications: number; appointments: number; labResults: number }
}> {
  const empty = { synced: 0, errors: 0, deleted: { medications: 0, appointments: 0, labResults: 0 } }
  if (!Bridge) return empty

  let raw: RawClinicalRecord[]
  try {
    raw = await Bridge.fetchClinicalRecords()
  } catch (err) {
    console.warn('[HealthKit] fetchClinicalRecords failed:', err)
    return empty
  }

  const records: HealthKitRecord[] = raw.flatMap((r) => {
    const parsed = normalise(r)
    return parsed ? [parsed] : []
  })

  return apiClient.healthkit.replace(records, { keepCareProfile: true })
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
    default:
      // Condition, Procedure, Allergy, VitalSign, Immunization records — no
      // CC type maps cleanly to them yet, skip rather than coerce.
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
