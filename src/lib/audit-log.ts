/**
 * Audit logging for API requests.
 * Logs every API call with user, action, and metadata for debugging and compliance.
 */
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'

export interface AuditEntry {
  user_id: string | null
  action: string
  resource: string
  resource_id?: string | null
  ip?: string | null
  method: string
  path: string
  status_code: number
  duration_ms: number
  metadata?: Record<string, unknown>
}

/**
 * Log an API action to the audit trail.
 * Non-blocking — errors are swallowed so audit logging never breaks the API.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    // Always log to console in a structured format
    console.log(
      JSON.stringify({
        type: 'audit',
        ts: new Date().toISOString(),
        ...entry,
      })
    )

    // Persist to DB (best-effort)
    await db.insert(auditLogs).values({
      userId: entry.user_id,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resource_id || null,
      ipAddress: entry.ip || null,
      method: entry.method,
      path: entry.path,
      statusCode: entry.status_code,
      durationMs: entry.duration_ms,
      metadata: entry.metadata || {},
    })
  } catch {
    // Never let audit logging break the actual API call
    console.error('[audit] Failed to persist audit log')
  }
}

/**
 * Helper to measure request duration.
 */
export function startTimer(): () => number {
  const start = Date.now()
  return () => Date.now() - start
}
