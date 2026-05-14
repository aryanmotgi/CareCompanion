/**
 * Notifications service. Wraps expo-notifications with a safe-fallback when
 * the native module isn't installed yet (e.g. in dev before rebuild).
 *
 * To enable: `npx expo install expo-notifications expo-device` then rebuild
 * with `npx expo run:ios --device <udid>`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

const PREFS_KEY = 'cc-notification-prefs'

export interface NotificationPrefs {
  medications: boolean
  refillReminders: boolean
  doseReminders: boolean
  interactionAlerts: boolean
  appointments: boolean
  twentyFourHour: boolean
  /**
   * When true, missed-dose escalations request iOS Critical Alert delivery
   * (bypasses Silent/DnD). Requires Apple-granted entitlement; without it the
   * flag is silently ignored by the system.
   */
  criticalMissedDose: boolean
}

export const DEFAULT_PREFS: NotificationPrefs = {
  medications: true,
  refillReminders: true,
  doseReminders: true,
  interactionAlerts: true,
  appointments: true,
  twentyFourHour: true,
  criticalMissedDose: false,
}

export async function loadPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_PREFS, ...parsed }
  } catch {
    return DEFAULT_PREFS
  }
}

export async function savePrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {})
}

// Lazy-loaded native module — won't throw if expo-notifications isn't installed yet.
type NotificationsModule = {
  setNotificationHandler: (handler: unknown) => void
  requestPermissionsAsync: (req?: unknown) => Promise<{ status: string; granted: boolean }>
  getPermissionsAsync: () => Promise<{ status: string; granted: boolean }>
  scheduleNotificationAsync: (req: unknown) => Promise<string>
  cancelAllScheduledNotificationsAsync: () => Promise<void>
  cancelScheduledNotificationAsync: (id: string) => Promise<void>
  setNotificationCategoryAsync: (id: string, actions: unknown[], options?: unknown) => Promise<unknown>
  addNotificationResponseReceivedListener: (handler: (resp: unknown) => void) => { remove: () => void }
  AndroidImportance?: Record<string, number>
  setNotificationChannelAsync?: (channelId: string, config: unknown) => Promise<unknown>
} | null

const DOSE_CATEGORY_ID = 'dose-reminder'
const APPT_CATEGORY_ID = 'appointment-reminder'
const CHECKIN_CATEGORY_ID = 'daily-checkin'
const CHECKIN_NOTIF_ID_KEY = 'cc-checkin-notification-id'

export async function registerNotificationCategories(): Promise<void> {
  const Notifications = getModule()
  if (!Notifications) return
  try {
    await Notifications.setNotificationCategoryAsync(DOSE_CATEGORY_ID, [
      {
        identifier: 'TAKEN',
        buttonTitle: '✓ Mark taken',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'SNOOZE',
        buttonTitle: 'Snooze 15m',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'SKIP',
        buttonTitle: 'Skip',
        options: { isDestructive: true, opensAppToForeground: false },
      },
    ])
    await Notifications.setNotificationCategoryAsync(APPT_CATEGORY_ID, [
      {
        identifier: 'CONFIRM',
        buttonTitle: 'Confirm',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'RESCHEDULE',
        buttonTitle: 'Reschedule',
        options: { opensAppToForeground: true },
      },
    ])
    // Daily check-in — three inline-reply actions so the user can answer
    // pain / energy / sleep directly from the notification without opening
    // the app. iOS shows each action as a separate row in the long-press
    // sheet; tapping one pops the keyboard with the placeholder prompt.
    await Notifications.setNotificationCategoryAsync(CHECKIN_CATEGORY_ID, [
      {
        identifier: 'CHECKIN_PAIN',
        buttonTitle: 'Pain (0-10)',
        textInput: { submitButtonTitle: 'Send', placeholder: '0-10' },
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'CHECKIN_ENERGY',
        buttonTitle: 'Energy (1-5)',
        textInput: { submitButtonTitle: 'Send', placeholder: '1-5' },
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'CHECKIN_SLEEP',
        buttonTitle: 'Sleep (1-5)',
        textInput: { submitButtonTitle: 'Send', placeholder: '1-5' },
        options: { opensAppToForeground: false },
      },
    ])
  } catch {
    // best-effort
  }
}

/**
 * Schedule the daily check-in notification at 8pm local time, repeating.
 * No-op when notification permission isn't already granted (we don't trigger
 * a permission prompt here — that lives in the onboarding/settings flow).
 * Returns the scheduled notification id, or null if not scheduled.
 */
export async function scheduleDailyCheckin(): Promise<string | null> {
  const Notifications = getModule()
  if (!Notifications) return null
  try {
    const perm = await Notifications.getPermissionsAsync()
    if (!perm.granted) return null

    // Replace any existing scheduled check-in so the trigger stays single.
    const existing = await AsyncStorage.getItem(CHECKIN_NOTIF_ID_KEY).catch(() => null)
    if (existing) {
      await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {})
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'How are you feeling today?',
        body: 'Tap and hold to reply — pain, energy, sleep.',
        categoryIdentifier: CHECKIN_CATEGORY_ID,
        data: { kind: 'daily-checkin' },
      },
      trigger: {
        type: 'calendar',
        hour: 20,
        minute: 0,
        repeats: true,
      } as any,
    } as any)
    await AsyncStorage.setItem(CHECKIN_NOTIF_ID_KEY, id).catch(() => {})
    return id
  } catch {
    return null
  }
}


type NotificationActionId = 'TAKEN' | 'SNOOZE' | 'SKIP' | 'CONFIRM' | 'RESCHEDULE'

interface NotificationResponse {
  actionId: NotificationActionId | string
  notificationId: string | null
  data: Record<string, unknown>
  /** User-typed value when the action is an inline-reply action. */
  userText: string | null
}

export function onNotificationResponse(
  handler: (resp: NotificationResponse) => void,
): () => void {
  const Notifications = getModule()
  if (!Notifications) return () => {}
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((raw: any) => {
      handler({
        actionId: raw?.actionIdentifier ?? '',
        notificationId: raw?.notification?.request?.identifier ?? null,
        data: raw?.notification?.request?.content?.data ?? {},
        userText: typeof raw?.userText === 'string' ? raw.userText : null,
      })
    })
    return () => sub.remove()
  } catch {
    return () => {}
  }
}

let cached: NotificationsModule | undefined
function getModule(): NotificationsModule {
  if (cached !== undefined) return cached
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule
  } catch {
    cached = null
  }
  return cached
}

export async function requestPermissions(options?: {
  critical?: boolean
}): Promise<'granted' | 'denied' | 'unavailable'> {
  const Notifications = getModule()
  if (!Notifications) return 'unavailable'
  try {
    const existing = await Notifications.getPermissionsAsync()
    if (existing.granted) return 'granted'
    // iOS-specific entitlement flags. Requesting `allowCriticalAlerts` without
    // the Apple-granted entitlement is harmless — the system just ignores it.
    const result = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowCriticalAlerts: options?.critical === true,
        allowProvisional: false,
      },
    } as any)
    return result.granted ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined' | 'unavailable'> {
  const Notifications = getModule()
  if (!Notifications) return 'unavailable'
  try {
    const s = await Notifications.getPermissionsAsync()
    if (s.granted) return 'granted'
    if (s.status === 'denied') return 'denied'
    return 'undetermined'
  } catch {
    return 'unavailable'
  }
}

