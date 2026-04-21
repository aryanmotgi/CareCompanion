/**
 * HealthKit sync service.
 *
 * @kingstinct/react-native-healthkit v10 removed the clinical-record APIs
 * (queryClinicalSamples / HKClinicalTypeIdentifier) that were present in v9.
 * Until the library adds them back (or we pin to v9), clinical-record sync is
 * stubbed out. Quantity / category samples still work normally.
 *
 * TODO: re-enable clinical record sync once the library exposes the API again.
 */
import Healthkit from '@kingstinct/react-native-healthkit'
import { apiClient } from './api'
import type { HealthKitRecord } from '@carecompanion/types'

export async function requestHealthKitPermissions(): Promise<boolean> {
  try {
    // Request authorization for any quantity types we may query in the future.
    // Clinical types are omitted until the library re-exposes the API.
    await Healthkit.requestAuthorization([], [])
    return true
  } catch {
    return false
  }
}

/**
 * Sync available HealthKit data to the backend.
 * Clinical records are not available in the current library version (v10).
 * Returns { synced: 0 } until clinical APIs are restored.
 */
export async function syncHealthKitData(): Promise<{ synced: number }> {
  const granted = await requestHealthKitPermissions()
  if (!granted) return { synced: 0 }

  const records: HealthKitRecord[] = []

  // Clinical record sync (medications, lab results, encounters) is temporarily
  // disabled pending @kingstinct/react-native-healthkit v10 clinical API support.
  // See: https://github.com/kingstinct/react-native-healthkit

  if (records.length === 0) return { synced: 0 }
  return apiClient.healthkit.sync(records)
}
