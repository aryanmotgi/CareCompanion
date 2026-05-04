/**
 * HIPAA-compliant audit logging for PHI access.
 *
 * This module provides typed audit actions for tracking access to
 * Protected Health Information (PHI). It complements the general-purpose
 * audit-log.ts (which logs all API requests) with specific PHI access events.
 */
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

type AuditAction =
  | 'view_profile'
  | 'edit_profile'
  | 'view_medications'
  | 'add_medication'
  | 'delete_medication'
  | 'view_lab_results'
  | 'view_appointments'
  | 'export_data'
  | 'import_data'
  | 'share_data'
  | 'view_insurance'
  | 'generate_summary'
  | 'scan_document'
  | 'delete_account'
  | 'switch_profile'
  | 'sync_data'
  | 'view_records'
  | 'hipaa_consent_accepted'
  | 'integration_disconnected'

interface AuditEntry {
  user_id: string
  action: AuditAction
  resource_type?: string
  resource_id?: string
  details?: Record<string, unknown>
  ip_address?: string
}

/**
 * Log a PHI access event to the audit trail.
 * Non-blocking — errors are swallowed so audit logging never breaks the request.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: entry.user_id,
      action: entry.action,
      resource: entry.resource_type || entry.action,
      resourceId: entry.resource_id || null,
      ipAddress: entry.ip_address || null,
      method: 'INTERNAL',
      path: entry.action,
      statusCode: 200,
      durationMs: 0,
      metadata: entry.details || {},
    })
  } catch (error) {
    // Don't fail the request if audit logging fails
    logger.error('Audit log failed', {
      error: error instanceof Error ? error.message : String(error),
      userId: entry.user_id,
      route: entry.action,
    })
  }
}
