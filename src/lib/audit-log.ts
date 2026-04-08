/**
 * Audit logging for API requests.
 * Logs every API call with user, action, and metadata for debugging and compliance.
 * Currently logs to console + Supabase. Ready for external log services.
 */
import { createAdminClient } from '@/lib/supabase/admin'

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

    // Persist to Supabase (best-effort)
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      user_id: entry.user_id,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resource_id || null,
      ip_address: entry.ip || null,
      method: entry.method,
      path: entry.path,
      status_code: entry.status_code,
      duration_ms: entry.duration_ms,
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
