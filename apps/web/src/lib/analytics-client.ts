// Client-side helper that POSTs to /api/analytics. Auth via session cookie.
// Fire-and-forget: never blocks the caller, never throws.

interface TrackArgs {
  eventName: string
  sessionId?: string | null
  properties?: Record<string, unknown>
}

export function trackClientEvent({ eventName, sessionId, properties }: TrackArgs): void {
  if (typeof window === 'undefined') return
  try {
    void fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify({ eventName, sessionId: sessionId ?? null, properties: properties ?? {} }),
    }).catch(() => {})
  } catch {
    /* never throw */
  }
}
