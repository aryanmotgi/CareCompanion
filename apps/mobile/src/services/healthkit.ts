/**
 * HealthKit sync service.
 *
 * Clinical records (medications, lab results, appointments) in Apple HealthKit
 * require the HKClinicalRecord API, which needs a dedicated Apple entitlement:
 *   com.apple.developer.healthkit.clinical-records
 *
 * No maintained React Native library exposes this API today.
 * @kingstinct/react-native-healthkit (v9 and v10) only supports quantity,
 * category, workout, and correlation samples — not clinical records.
 *
 * The backend sync endpoint (/api/healthkit/sync), FHIR converters, and DB
 * schema are all ready. To complete this integration, implement a native Swift
 * module that reads HKClinicalRecord objects and calls the JS bridge.
 *
 * Reference:
 *   https://developer.apple.com/documentation/healthkit/hkclinicalrecord
 *   https://developer.apple.com/documentation/healthkit/accessing_health_records
 */
import { apiClient } from './api'
import type { HealthKitRecord } from '@carecompanion/types'

export async function requestHealthKitPermissions(): Promise<boolean> {
  // Clinical record permissions require a native module.
  // Return true as a no-op so the app doesn't crash.
  return true
}

/**
 * Sync HealthKit clinical records to the backend.
 * Returns { synced: 0 } until a native clinical record bridge is implemented.
 * See the comment at the top of this file for implementation guidance.
 */
export async function syncHealthKitData(): Promise<{ synced: number }> {
  const records: HealthKitRecord[] = []

  // Native bridge for HKClinicalRecord goes here.
  // Shape of each record must match HealthKitRecord from @carecompanion/types.

  if (records.length === 0) return { synced: 0 }
  return apiClient.healthkit.sync(records)
}
