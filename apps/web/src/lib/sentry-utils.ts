import type { ErrorEvent, EventHint } from '@sentry/nextjs'

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

export function scrubPHI(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  // Scrub request body
  if (event.request?.data) {
    event.request.data = scrubObject(event.request.data) as typeof event.request.data
  }

  // Scrub breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
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
