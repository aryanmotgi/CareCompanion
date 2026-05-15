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
import AsyncStorage from '@react-native-async-storage/async-storage'
import { apiClient } from './api'
import {
  classifyError,
  formatLastSynced as formatLastSyncedPure,
  backoffFor,
} from './internal/pure'
import {
  normalise,
  type ExtendedHealthKitRecord,
  type RawClinicalRecord,
} from './internal/normalizers'
import type { HealthKitRecord } from '@carecompanion/types'

export { formatLastSyncedPure as formatLastSynced }

const CONNECTED_KEY = 'cc-healthkit-connected'
const LAST_SYNCED_KEY = 'cc-healthkit-last-synced'
const RETRY_QUEUE_KEY = 'cc-healthkit-retry-queue'

// ---------------------------------------------------------------------------
// Native module type declaration
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sync state machine + listeners
// ---------------------------------------------------------------------------

export type SyncState =
  | { status: 'idle' }
  | { status: 'syncing' }
  | { status: 'success'; at: number; synced: number }
  | { status: 'error'; at: number; message: string; userActionable: boolean }
  | { status: 'retrying'; at: number; attempt: number; nextAt: number }

let currentState: SyncState = { status: 'idle' }
const listeners = new Set<(s: SyncState) => void>()

function emit(next: SyncState) {
  currentState = next
  for (const fn of listeners) {
    try { fn(next) } catch { /* listener errors must not affect sync */ }
  }
}

export function subscribeSyncState(fn: (s: SyncState) => void): () => void {
  listeners.add(fn)
  fn(currentState)
  return () => { listeners.delete(fn) }
}

// ---------------------------------------------------------------------------
// Retry queue (AsyncStorage-backed, exponential backoff)
// ---------------------------------------------------------------------------

type QueueEntry = {
  id: string                     // uuid-ish
  records: ExtendedHealthKitRecord[]
  attempt: number                // 0-indexed attempts already made (0 = none)
  nextAttemptAt: number          // epoch ms
  lastError: string | null
}

async function readQueue(): Promise<QueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(RETRY_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QueueEntry[]) : []
  } catch {
    return []
  }
}

async function writeQueue(q: QueueEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(q))
  } catch {
    // Storage full or unavailable — drop silently; next sync attempt re-queues.
  }
}

async function enqueueRetry(records: ExtendedHealthKitRecord[], attempt: number, lastError: string): Promise<void> {
  const delay = backoffFor(attempt)
  if (delay === null) {
    console.warn('[HealthKit] dropping batch after', attempt, 'attempts:', lastError)
    return
  }
  const q = await readQueue()
  q.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    records,
    attempt,
    nextAttemptAt: Date.now() + delay,
    lastError,
  })
  await writeQueue(q)
  emit({ status: 'retrying', at: Date.now(), attempt: attempt + 1, nextAt: Date.now() + delay })
}

/**
 * Drain queue entries whose nextAttemptAt has passed. Called opportunistically
 * on every syncHealthKitData() invocation and from background-sync.
 */
async function drainRetryQueue(): Promise<{ retried: number; succeeded: number }> {
  const q = await readQueue()
  if (q.length === 0) return { retried: 0, succeeded: 0 }
  const now = Date.now()
  const ready = q.filter((e) => e.nextAttemptAt <= now)
  if (ready.length === 0) return { retried: 0, succeeded: 0 }

  const remaining: QueueEntry[] = q.filter((e) => e.nextAttemptAt > now)
  let succeeded = 0

  for (const entry of ready) {
    try {
      await apiClient.healthkit.sync(entry.records as HealthKitRecord[])
      succeeded += 1
    } catch (err) {
      const { cls, message } = classifyError(err)
      if (cls === 'drop' || cls === 'reauth') {
        // 400 = malformed → drop. 401/403 = auth → drop from queue; UI must re-auth.
        if (cls === 'reauth') {
          emit({ status: 'error', at: Date.now(), message: 'Session expired — sign in again', userActionable: true })
        }
        continue
      }
      const nextAttempt = entry.attempt + 1
      const delay = backoffFor(nextAttempt)
      if (delay === null) {
        console.warn('[HealthKit] dropping queued batch after', nextAttempt, 'attempts:', message)
        continue
      }
      remaining.push({ ...entry, attempt: nextAttempt, nextAttemptAt: Date.now() + delay, lastError: message })
    }
  }
  await writeQueue(remaining)
  return { retried: ready.length, succeeded }
}

// ---------------------------------------------------------------------------
// Last-synced tracking
// ---------------------------------------------------------------------------

export async function getLastSyncedAt(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNCED_KEY)
    if (!raw) return null
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

async function setLastSyncedAt(epochMs: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SYNCED_KEY, String(epochMs))
  } catch {
    // ignore
  }
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
 *
 * iOS authorization is intentionally opaque: HK never reveals whether the user
 * denied (privacy by design). The native callback's `success` flag means only
 * "the authorization process completed without a system error" — it is true
 * even when all types were already authorized and no UI was shown. Some native
 * bridge implementations incorrectly forward `false` in the already-authorized
 * case, which would block the connect flow. We therefore ignore the return
 * value and treat any non-throwing call as success.
 *
 * Returns false only when HealthKit is genuinely unavailable (no Bridge) or
 * when the native call throws a real system error.
 */
export async function requestHealthKitPermissions(): Promise<boolean> {
  if (!Bridge) return false
  try {
    await Bridge.requestAuthorization()
    return true
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
    await AsyncStorage.setItem(CONNECTED_KEY, '1')
  } catch {
    // AsyncStorage unavailable (e.g. in tests) — fail open, sync just won't run.
  }
}

export async function isHealthKitConnected(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CONNECTED_KEY)) === '1'
  } catch {
    return false
  }
}

/**
 * Fetch clinical records from HealthKit, normalise them into HealthKitRecord
 * objects, and POST them to the backend sync endpoint.
 */
export async function syncHealthKitData(): Promise<{ synced: number; queued: boolean; error?: string }> {
  if (!Bridge) return { synced: 0, queued: false }

  emit({ status: 'syncing' })

  // Drain anything ready from the retry queue first.
  await drainRetryQueue()

  let raw: RawClinicalRecord[]
  try {
    raw = await Bridge.fetchClinicalRecords()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[HealthKit] fetchClinicalRecords failed:', err)
    emit({ status: 'error', at: Date.now(), message, userActionable: false })
    return { synced: 0, queued: false, error: message }
  }

  if (__DEV__ && raw.length === 0) {
    raw = DEV_MOCK_RECORDS
    console.log('[HealthKit] __DEV__: substituting', raw.length, 'mock clinical records (simulator has no real provider portal)')
  }

  const records: ExtendedHealthKitRecord[] = raw.flatMap((r) => {
    const parsed = normalise(r)
    return parsed ? [parsed] : []
  })

  if (records.length === 0) {
    emit({ status: 'success', at: Date.now(), synced: 0 })
    return { synced: 0, queued: false }
  }

  try {
    const result = await apiClient.healthkit.sync(records as HealthKitRecord[])
    const now = Date.now()
    await setLastSyncedAt(now)
    emit({ status: 'success', at: now, synced: result.synced })
    return { synced: result.synced, queued: false }
  } catch (err) {
    const { cls, status, message } = classifyError(err)
    if (cls === 'reauth') {
      emit({ status: 'error', at: Date.now(), message: 'Session expired — sign in again', userActionable: true })
      return { synced: 0, queued: false, error: message }
    }
    if (cls === 'drop') {
      console.warn('[HealthKit] sync POST rejected (400) — dropping batch:', message)
      emit({ status: 'error', at: Date.now(), message: `Backend rejected payload (${status})`, userActionable: false })
      return { synced: 0, queued: false, error: message }
    }
    // 5xx / network — queue for retry.
    await enqueueRetry(records, 0, message)
    return { synced: 0, queued: true, error: message }
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

  emit({ status: 'syncing' })

  let raw: RawClinicalRecord[]
  try {
    raw = await Bridge.fetchClinicalRecords()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[HealthKit] fetchClinicalRecords failed:', err)
    emit({ status: 'error', at: Date.now(), message, userActionable: false })
    return empty
  }

  const records: ExtendedHealthKitRecord[] = raw.flatMap((r) => {
    const parsed = normalise(r)
    return parsed ? [parsed] : []
  })

  try {
    const result = await apiClient.healthkit.replace(records as HealthKitRecord[], { keepCareProfile: true })
    const now = Date.now()
    await setLastSyncedAt(now)
    emit({ status: 'success', at: now, synced: result.synced })
    return result
  } catch (err) {
    const { cls, message } = classifyError(err)
    if (cls === 'reauth') {
      emit({ status: 'error', at: Date.now(), message: 'Session expired — sign in again', userActionable: true })
    } else {
      emit({ status: 'error', at: Date.now(), message, userActionable: false })
    }
    return empty
  }
}

// Normalisers + FHIR helpers live in ./internal/normalizers — pure code,
// unit-tested in src/services/internal/__tests__/normalizers.test.ts.

