/**
 * Live Activity wrapper for iOS 16.1+ ActivityKit. Dose countdown and
 * appointment timer surface on the Lock Screen + Dynamic Island.
 *
 * ActivityKit requires a native Widget Extension target in the Xcode project
 * (Swift-only, no Obj-C bridge). This service no-ops gracefully until the
 * extension is added — UI can call `startDoseActivity` from day one and the
 * activity will simply not appear on devices without the extension.
 *
 * Setup steps (one-time, requires native rebuild):
 *   1. `npx expo install expo-live-activity` (or `react-native-live-activity`)
 *   2. Run `npx expo prebuild --platform ios`
 *   3. In Xcode: File → New → Target → Widget Extension named
 *      `CareCompanionLiveActivity`. Enable Live Activity, disable Widget.
 *   4. Add `NSSupportsLiveActivities` = YES to Info.plist (root app target).
 *   5. Define `ActivityAttributes` in Swift matching the JS payload below.
 *   6. Rebuild: `npx expo run:ios --device <udid>`.
 *
 * iOS-only. Android is a no-op (returns null).
 */
import { Platform } from 'react-native'

export interface DoseActivityPayload {
  medicationName: string
  dose: string
  dueAt: string // ISO timestamp
  patientName: string | null
}

export interface AppointmentActivityPayload {
  doctorName: string
  specialty: string | null
  startAt: string // ISO timestamp
  location: string | null
}

type LiveActivityModule = {
  startActivity: (id: string, attrs: unknown, state: unknown) => Promise<string | null>
  updateActivity: (id: string, state: unknown) => Promise<void>
  endActivity: (id: string, state?: unknown, options?: unknown) => Promise<void>
  areActivitiesEnabled: () => Promise<boolean>
} | null

let cached: LiveActivityModule | undefined
function getModule(): LiveActivityModule {
  if (cached !== undefined) return cached
  if (Platform.OS !== 'ios') {
    cached = null
    return null
  }
  try {
    // Try expo-live-activity first, fall back to react-native-live-activity.
    // Both expose a similar shape; if the API drifts, the wrapper will simply
    // no-op until the call signatures are aligned.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = (require('expo-live-activity') as LiveActivityModule)
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('react-native-live-activities') as LiveActivityModule
    } catch {
      cached = null
    }
  }
  return cached
}

export function isSupported(): boolean {
  return getModule() !== null
}

export async function areActivitiesEnabled(): Promise<boolean> {
  const mod = getModule()
  if (!mod) return false
  try {
    return await mod.areActivitiesEnabled()
  } catch {
    return false
  }
}

export async function startDoseActivity(
  payload: DoseActivityPayload,
): Promise<string | null> {
  const mod = getModule()
  if (!mod) return null
  try {
    const id = `dose-${Date.now()}`
    await mod.startActivity(
      id,
      {
        kind: 'dose',
        patientName: payload.patientName,
      },
      {
        medicationName: payload.medicationName,
        dose: payload.dose,
        dueAt: payload.dueAt,
      },
    )
    return id
  } catch {
    return null
  }
}

export async function updateDoseActivity(
  activityId: string,
  state: Partial<DoseActivityPayload>,
): Promise<void> {
  const mod = getModule()
  if (!mod) return
  try {
    await mod.updateActivity(activityId, state)
  } catch {
    // ignore
  }
}

export async function startAppointmentActivity(
  payload: AppointmentActivityPayload,
): Promise<string | null> {
  const mod = getModule()
  if (!mod) return null
  try {
    const id = `appt-${Date.now()}`
    await mod.startActivity(
      id,
      { kind: 'appointment' },
      {
        doctorName: payload.doctorName,
        specialty: payload.specialty,
        startAt: payload.startAt,
        location: payload.location,
      },
    )
    return id
  } catch {
    return null
  }
}

export async function endActivity(activityId: string): Promise<void> {
  const mod = getModule()
  if (!mod) return
  try {
    await mod.endActivity(activityId)
  } catch {
    // ignore
  }
}
