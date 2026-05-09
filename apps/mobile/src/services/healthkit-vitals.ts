/**
 * Wellness vitals service — reads daily health metrics from HealthKit
 * via the WellnessVitals native module.
 *
 * Unlike the clinical-records HealthKitBridge, this module queries
 * standard HKQuantityType / HKCategoryType data:
 *   - Step count (cumulative sum for today)
 *   - Heart rate (most recent sample)
 *   - Sleep analysis (total asleep hours from last night)
 */
import { NativeModules, Platform } from 'react-native'

// ---------------------------------------------------------------------------
// Native module type declaration
// ---------------------------------------------------------------------------

export interface WellnessVitalsData {
  steps: number
  heartRate: number | null
  sleepHours: number | null
}

interface NativeWellnessVitals {
  requestAuthorization(): Promise<boolean>
  fetchDailyVitals(): Promise<WellnessVitalsData>
}

const Bridge: NativeWellnessVitals | null =
  Platform.OS === 'ios' ? (NativeModules.WellnessVitals ?? null) : null

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request HealthKit read authorization for steps, heart rate, and sleep.
 * Returns false when HealthKit is unavailable or the user denies.
 */
export async function requestWellnessPermissions(): Promise<boolean> {
  if (!Bridge) return false
  try {
    return await Bridge.requestAuthorization()
  } catch {
    return false
  }
}

/**
 * Fetch today's wellness vitals from HealthKit.
 * Returns null when the native module is unavailable (e.g. Android, simulator).
 */
export async function fetchWellnessVitals(): Promise<WellnessVitalsData | null> {
  if (!Bridge) return null
  try {
    return await Bridge.fetchDailyVitals()
  } catch (err) {
    console.warn('[WellnessVitals] fetchDailyVitals failed:', err)
    return null
  }
}
