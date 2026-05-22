import type { ErrorEvent } from '@sentry/nextjs'

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

// Scrub PHI from free-form strings (error messages, exception values).
// Object-key redaction does not reach these surfaces, so we regex-scan for
// the identifier shapes most likely to appear in stack traces / error text
// (SSN, email, phone, MRN, date-of-birth-like dates) plus any `key=value`
// or `key: value` substrings where `key` matches a known PHI field.
function scrubString(str: string): string {
  if (typeof str !== 'string' || str.length === 0) return str
  let s = str
  // SSN
  s = s.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
  // Email
  s = s.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
  // Phone (US-ish, with optional country code, parens, separators)
  s = s.replace(/(?:\+?1[-.\s]?)?\(?\b\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]')
  // MRN
  s = s.replace(/\bMRN[:\s#]*[\w-]+/gi, '[REDACTED_MRN]')
  // Date-like strings (potential DOB)
  s = s.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '[REDACTED_DATE]')
  s = s.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[REDACTED_DATE]')
  // `key: value` / `key=value` shapes whose key matches a known PHI field
  for (const key of PHI_KEYS) {
    const re = new RegExp(`\\b${key}\\b\\s*[:=]\\s*("[^"]*"|'[^']*'|[^\\s,;)\\]}]+)`, 'gi')
    s = s.replace(re, `${key}=[REDACTED]`)
  }
  return s
}

export function scrubPHI(event: ErrorEvent): ErrorEvent | null {
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

  // Top-level error message — free-form, often contains identifier shapes
  // pulled directly from the failing request/query.
  if (typeof event.message === 'string') {
    event.message = scrubString(event.message)
  }

  // Each captured exception's `value` is the thrown message (e.g. the literal
  // string passed to `new Error(...)`). Same risk surface as `event.message`.
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((ex) => ({
      ...ex,
      ...(typeof ex.value === 'string' ? { value: scrubString(ex.value) } : {}),
    }))
  }

  return event
}
