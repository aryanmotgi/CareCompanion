import * as Sentry from '@sentry/react-native'
import type { ErrorEvent, Breadcrumb } from '@sentry/react-native'

const PHI_KEYS = [
  'patientName',
  'cancerType',
  'cancerStage',
  'diagnosis',
  'medicationName',
  'dosage',
  'prescribingDoctor',
  'testName',
  'value',
  'referenceRange',
  'message',
  'content',
  'notes',
  'symptoms',
  'doctorName',
  'phone',
  'location',
]

function scrubObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(scrubObject)

  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (PHI_KEYS.includes(key)) {
      result[key] = '[REDACTED]'
    } else {
      result[key] = scrubObject(val)
    }
  }
  return result
}

function scrubPHI(event: ErrorEvent, _hint: unknown): ErrorEvent | null {
  // Scrub request body
  if (event.request?.data) {
    event.request.data = scrubObject(event.request.data) as typeof event.request.data
  }

  // Scrub breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb: Breadcrumb) => ({
      ...breadcrumb,
      ...(breadcrumb.data
        ? { data: scrubObject(breadcrumb.data) as typeof breadcrumb.data }
        : {}),
    }))
  }

  // Scrub extra context
  if (event.extra) {
    event.extra = scrubObject(event.extra) as typeof event.extra
  }

  return event
}

export function initSentry() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.1,
    beforeSend: scrubPHI,
  })
}
