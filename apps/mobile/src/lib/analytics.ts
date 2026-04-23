import PostHog from 'posthog-react-native'

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || ''
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

let client: PostHog | null = null

export async function initAnalytics() {
  if (!POSTHOG_KEY) return
  client = await PostHog.initAsync(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    enableSessionReplay: false,
  })
}

export function trackEvent(event: string, properties?: Record<string, string | number | boolean>) {
  client?.capture(event, properties)
}

export const events = {
  onboardingCompleted: () => trackEvent('onboarding_completed'),
  medicationAdded: () => trackEvent('medication_added'),
  labViewed: () => trackEvent('lab_viewed'),
  chatMessageSent: () => trackEvent('chat_message_sent'),
  settingsChanged: (setting: string) => trackEvent('settings_changed', { setting }),
  bugReportSubmitted: () => trackEvent('bug_report_submitted'),
}
