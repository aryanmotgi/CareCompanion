/**
 * HIPAA-compliant audit logging for PHI access.
 *
 * This module provides typed audit actions for tracking access to
 * Protected Health Information (PHI). It complements the general-purpose
 * audit-log.ts (which logs all API requests) with specific PHI access events.
 *
 * All entries are persisted to the `audit_logs` table in Supabase.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export type AuditAction =
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
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      user_id: entry.user_id,
      action: entry.action,
      resource_type: entry.resource_type || null,
      resource_id: entry.resource_id || null,
      details: entry.details ? JSON.stringify(entry.details) : null,
      ip_address: entry.ip_address || null,
      created_at: new Date().toISOString(),
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
