import posthog from 'posthog-js'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

export function initAnalytics() {
  if (!POSTHOG_KEY || typeof window === 'undefined') return

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    sanitize_properties: (properties) => {
      const safe = { ...properties }
      const phiKeys = ['patientName', 'cancerType', 'medication', 'labValue', 'chatMessage']
      phiKeys.forEach(key => delete safe[key])
      return safe
    },
  })
}

export function trackEvent(event: string, properties?: Record<string, string | number | boolean>) {
  if (!POSTHOG_KEY) return
  posthog.capture(event, properties)
}

