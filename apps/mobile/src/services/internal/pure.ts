/**
 * Pure helpers shared across sync services (HealthKit, wellness, calendar).
 * No React Native or Expo imports — safe to load from a Node/vitest harness.
 */

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

export type ErrorClass = 'reauth' | 'drop' | 'retry'

/** Parses `API error <status>: ...` from `apiClient` and classifies it. */
export function classifyError(err: unknown): {
  cls: ErrorClass
  status: number | null
  message: string
} {
  const msg = err instanceof Error ? err.message : String(err)
  const match = msg.match(/API error (\d{3})/)
  const status = match ? parseInt(match[1]!, 10) : null

  if (status === 401 || status === 403) return { cls: 'reauth', status, message: msg }
  if (status === 400) return { cls: 'drop', status, message: msg }
  return { cls: 'retry', status, message: msg }
}

/** Classifies a raw HTTP status code from a wellness/non-apiClient call. */
export function classifyStatus(
  status: number | null,
  message: string,
): { cls: ErrorClass; message: string } {
  if (status === 401 || status === 403) return { cls: 'reauth', message }
  if (status !== null && status >= 400 && status < 500) return { cls: 'drop', message }
  return { cls: 'retry', message }
}

// ---------------------------------------------------------------------------
// Last-synced formatting
// ---------------------------------------------------------------------------

export function formatLastSynced(
  epochMs: number | null,
  now: number = Date.now(),
): string {
  if (!epochMs) return 'never'
  const diff = Math.max(0, now - epochMs)
  if (diff < 60_000) return 'just now'
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h ago`
  return `${Math.floor(diff / (24 * 60 * 60_000))}d ago`
}

// ---------------------------------------------------------------------------
// Retry backoff
// ---------------------------------------------------------------------------

export const BACKOFF_MS = [
  30_000,        // 30s
  2 * 60_000,    // 2m
  10 * 60_000,   // 10m
  60 * 60_000,   // 1h
] as const
export const MAX_ATTEMPTS = 5

/** Returns the delay (ms) before the `attempt`-th retry, or null to drop. */
export function backoffFor(attempt: number): number | null {
  if (attempt >= MAX_ATTEMPTS) return null
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? null
}

// ---------------------------------------------------------------------------
// Retry-queue partitioning (pure, AsyncStorage-agnostic)
// ---------------------------------------------------------------------------

export interface RetryQueueEntry {
  nextAttemptAt: number
  attempt: number
}

/** Split a queue into entries whose retry time has come and those still waiting. */
export function partitionReadyEntries<E extends RetryQueueEntry>(
  entries: readonly E[],
  now: number,
): { ready: E[]; waiting: E[] } {
  const ready: E[] = []
  const waiting: E[] = []
  for (const e of entries) {
    if (e.nextAttemptAt <= now) ready.push(e)
    else waiting.push(e)
  }
  return { ready, waiting }
}

/**
 * Given an entry that just failed a retry, compute its next state — either a
 * re-queued entry with a new `nextAttemptAt`, or null when MAX_ATTEMPTS is hit
 * (caller should drop it). Pure: no clock or storage side effects.
 */
export function nextRetryState<E extends RetryQueueEntry>(
  entry: E,
  now: number,
  lastError: string,
): (E & { lastError: string }) | null {
  const nextAttempt = entry.attempt + 1
  const delay = backoffFor(nextAttempt)
  if (delay === null) return null
  return { ...entry, attempt: nextAttempt, nextAttemptAt: now + delay, lastError }
}

// ---------------------------------------------------------------------------
// Medical-event keyword filter (calendar)
// ---------------------------------------------------------------------------

export const MEDICAL_KEYWORDS = [
  'clinic',
  'doctor',
  'hospital',
  'mychart',
  'appointment',
  'oncology',
] as const

export type CalendarEventLike = {
  title: string
  notes?: string | null
  calendarTitle?: string
  location?: string | null
}

export function isMedicalEvent(ev: CalendarEventLike): boolean {
  const haystack = [
    ev.title,
    ev.notes ?? '',
    ev.calendarTitle ?? '',
    ev.location ?? '',
  ].join(' ').toLowerCase()
  return MEDICAL_KEYWORDS.some((kw) => haystack.includes(kw))
}
