// Lazy import — @sentry/react-native requires a native build with the module included.
let Sentry: typeof import('@sentry/react-native') | null = null
try {
  Sentry = require('@sentry/react-native')
} catch {
  // Native module not available in this build
}
type ErrorEvent = {
  message?: string
  request?: { data?: unknown; query_string?: string; url?: string }
  breadcrumbs?: any[]
  extra?: Record<string, unknown>
  contexts?: Record<string, unknown>
  tags?: Record<string, unknown>
  user?: Record<string, unknown>
  exception?: { values?: Array<{ value?: string; [k: string]: unknown }> }
}
type Breadcrumb = { data?: unknown; message?: string; [key: string]: unknown }

const PHI_KEYS = [
  'patientName',
  'patient_name',
  'displayName',
  'display_name',
  'cancerType',
  'cancer_type',
  'cancerStage',
  'cancer_stage',
  'diagnosis',
  'diagnoses',
  'medicationName',
  'medication_name',
  'medications',
  'meds',
  'dose',
  'dosage',
  'frequency',
  'prescribingDoctor',
  'prescribing_doctor',
  'doctorName',
  'doctor_name',
  'testName',
  'test_name',
  'labName',
  'value',
  'referenceRange',
  'reference_range',
  'isAbnormal',
  'message',
  'content',
  'notes',
  'symptoms',
  'allergies',
  'conditions',
  'procedures',
  'phone',
  'phoneNumber',
  'emergencyContactName',
  'emergencyContactPhone',
  'dateOfBirth',
  'dob',
  'sexAtBirth',
  'location',
  'address',
  'mrn',
  'email',
  'token',
  'sessionToken',
  'authToken',
]

const PHI_VALUE_PATTERNS: RegExp[] = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,                       // phone
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,       // email
  /\b\d{3}-\d{2}-\d{4}\b/g,                                    // SSN
  /\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g,                           // ISO dates (DOB risk)
  /\bBearer\s+[A-Za-z0-9._-]+/g,                               // auth tokens
]

function scrubString(s: string): string {
  return PHI_VALUE_PATTERNS.reduce((acc, re) => acc.replace(re, '[REDACTED]'), s)
}

function scrubObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return scrubString(obj)
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
  if (event.message) event.message = scrubString(event.message)

  if (event.request) {
    if (event.request.data) {
      event.request.data = scrubObject(event.request.data) as typeof event.request.data
    }
    if (event.request.query_string) event.request.query_string = scrubString(event.request.query_string)
    if (event.request.url) event.request.url = scrubString(event.request.url)
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb: Breadcrumb) => ({
      ...breadcrumb,
      ...(typeof breadcrumb.message === 'string' ? { message: scrubString(breadcrumb.message) } : {}),
      ...(breadcrumb.data
        ? { data: scrubObject(breadcrumb.data) as typeof breadcrumb.data }
        : {}),
    }))
  }

  if (event.extra) event.extra = scrubObject(event.extra) as typeof event.extra
  if (event.contexts) event.contexts = scrubObject(event.contexts) as typeof event.contexts
  if (event.tags) event.tags = scrubObject(event.tags) as typeof event.tags

  // Strip user PII beyond opaque id.
  if (event.user) {
    const { id } = event.user as { id?: unknown }
    event.user = id !== undefined ? { id } : {}
  }

  // Exception messages and stack frame vars are the highest-risk surface.
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((v) => ({
      ...v,
      value: typeof v.value === 'string' ? scrubString(v.value) : v.value,
    }))
  }

  return event
}

function scrubBreadcrumb(breadcrumb: Breadcrumb, _hint?: unknown): Breadcrumb | null {
  return {
    ...breadcrumb,
    ...(typeof breadcrumb.message === 'string' ? { message: scrubString(breadcrumb.message) } : {}),
    ...(breadcrumb.data ? { data: scrubObject(breadcrumb.data) as typeof breadcrumb.data } : {}),
  }
}

export function initSentry() {
  if (!Sentry) {
    console.log('[Sentry] Native module not available, skipping init')
    return
  }
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeSend: scrubPHI as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeBreadcrumb: scrubBreadcrumb as any,
  })
}
