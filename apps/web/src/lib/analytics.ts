// Internal product analytics — replaces PostHog. Writes to Aurora
// `analytics_events` (migration 023). No third-party processor.
//
// PHI policy:
//   • Never write raw user UUID — only SHA-256(uuid + ANALYTICS_HASH_SALT)
//   • `properties` is stripped of known PHI keys before insert
//   • Server caller is trusted; client → /api/analytics route enforces auth +
//     rate-limit + the same PHI strip
import { createHash } from 'crypto'
import { db } from './db'
import { analyticsEvents } from './db/schema'

const PHI_KEYS = new Set([
  'patientName', 'patient_name', 'displayName', 'display_name',
  'cancerType', 'cancer_type', 'cancerStage', 'cancer_stage',
  'diagnosis', 'diagnoses',
  'medicationName', 'medication_name', 'medication', 'medications', 'meds',
  'dose', 'dosage', 'frequency',
  'prescribingDoctor', 'prescribing_doctor', 'doctorName', 'doctor_name',
  'testName', 'test_name', 'labName', 'value', 'referenceRange', 'reference_range',
  'message', 'content', 'notes', 'symptoms',
  'allergies', 'conditions', 'procedures',
  'phone', 'phoneNumber', 'email',
  'emergencyContactName', 'emergencyContactPhone',
  'dateOfBirth', 'dob', 'sexAtBirth',
  'location', 'address', 'mrn',
  'token', 'sessionToken', 'authToken', 'password',
])

function hashUserId(userId: string | null | undefined): string | null {
  if (!userId) return null
  const salt = process.env.ANALYTICS_HASH_SALT
  if (!salt) return null   // fail closed — no salt, no insert
  return createHash('sha256').update(`${userId}:${salt}`).digest('hex')
}

function stripPHI(properties: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!properties) return {}
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(properties)) {
    if (PHI_KEYS.has(k)) continue
    if (typeof v === 'object' && v !== null) continue   // no nested objects — too easy to leak
    if (typeof v === 'string' && v.length > 256) continue
    safe[k] = v
  }
  return safe
}

interface TrackArgs {
  eventName: string
  userId?: string | null
  sessionId?: string | null
  properties?: Record<string, unknown>
}

/**
 * Server-side fire-and-forget event recorder. Never throws — analytics
 * failures must not break user flows.
 */
export async function trackEvent({ eventName, userId, sessionId, properties }: TrackArgs): Promise<void> {
  try {
    if (!eventName || eventName.length > 128) return
    await db.insert(analyticsEvents).values({
      eventName,
      userIdHash: hashUserId(userId),
      sessionId: sessionId ?? null,
      properties: stripPHI(properties) as never,
    } as never)
  } catch {
    // analytics never blocks
  }
}
