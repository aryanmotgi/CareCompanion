/**
 * Cron: Data retention policy enforcement.
 *
 * HIPAA-aligned retention rules:
 *   - Soft-deleted PHI records: hard-deleted after 90 days
 *   - Audit logs: retained for 1 year, then purged
 *
 * This complements cron/purge (which hard-deletes after 30 days for soft-deleted records)
 * by enforcing longer HIPAA-specific retention windows.
 */
import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const authError = verifyCronRequest(req)
  if (authError) return authError

  try {
    const admin = createAdminClient()
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    // Hard delete soft-deleted records older than 90 days
    const tables = ['medications', 'appointments', 'doctors', 'documents', 'lab_results', 'claims']
    const results: Record<string, number> = {}

    for (const table of tables) {
      const { data } = await admin
        .from(table)
        .delete()
        .not('deleted_at', 'is', null)
        .lt('deleted_at', ninetyDaysAgo)
        .select('id')

      results[table] = data?.length || 0
    }

    // Purge old audit logs (keep 1 year per HIPAA minimum)
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
    const { data: auditData } = await admin
      .from('audit_logs')
      .delete()
      .lt('created_at', oneYearAgo)
      .select('id')

    results.audit_logs = auditData?.length || 0

    const totalPurged = Object.values(results).reduce((sum, n) => sum + n, 0)
    console.log(`[cron/retention] Purged ${totalPurged} records`, results)

    return NextResponse.json({
      ok: true,
      purged: results,
      total_purged: totalPurged,
      retention_policy: {
        soft_deleted_phi: '90 days',
        audit_logs: '1 year',
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/retention] Error:', error)
    return NextResponse.json({ ok: false, error: 'Retention enforcement failed' }, { status: 500 })
  }
}
