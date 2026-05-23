// Internal analytics — POST to /api/analytics. Replaces PostHog.
// All data lands in Aurora `analytics_events` table (HIPAA-covered).
// Fire-and-forget: never blocks UI, never throws.

import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

async function postEvent(eventName: string, properties?: Record<string, string | number | boolean>): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync('cc-session-token').catch(() => null)
    if (!token) return  // anonymous events not recorded — keeps user_id_hash population guaranteed
    const isSecure = API_BASE.startsWith('https://')
    const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'
    await fetch(`${API_BASE}/api/analytics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Cookie: `${cookieName}=${token}`,
      },
      body: JSON.stringify({ eventName, properties: properties ?? {} }),
    }).catch(() => {})
  } catch {
    /* never throw */
  }
}

export async function initAnalytics(): Promise<void> {
  // no-op — fully stateless, every event opens its own fetch
}

// Internal — re-export when first caller appears.
const _events = {
  onboardingCompleted: () => postEvent('onboarding_completed'),
  medicationAdded: () => postEvent('medication_added'),
  labViewed: () => postEvent('lab_viewed'),
  chatMessageSent: () => postEvent('chat_message_sent'),
  settingsChanged: (setting: string) => postEvent('settings_changed', { setting }),
  bugReportSubmitted: () => postEvent('bug_report_submitted'),
}
void _events
