/**
 * Cron: Data retention policy enforcement.
 *
 * HIPAA-aligned retention rules:
 *   - Soft-deleted PHI records: hard-deleted after 90 days
 *   - Audit logs: retained for 1 year, then purged
 */
import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import { medications, appointments, doctors, documents, labResults, claims, auditLogs } from '@/lib/db/schema'
import { and, isNotNull, lt } from 'drizzle-orm'

export async function GET(req: Request) {
  const authError = verifyCronRequest(req)
  if (authError) return authError

  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const results: Record<string, number> = {}

    // Hard delete soft-deleted records older than 90 days
    const [medsDeleted, apptsDeleted, docsDeleted, documentsDeleted, labsDeleted, claimsDeleted] = await Promise.all([
      db.delete(medications).where(and(isNotNull(medications.deletedAt), lt(medications.deletedAt, ninetyDaysAgo))).returning({ id: medications.id }),
      db.delete(appointments).where(and(isNotNull(appointments.deletedAt), lt(appointments.deletedAt, ninetyDaysAgo))).returning({ id: appointments.id }),
      db.delete(doctors).where(and(isNotNull(doctors.deletedAt), lt(doctors.deletedAt, ninetyDaysAgo))).returning({ id: doctors.id }),
      db.delete(documents).where(and(isNotNull(documents.deletedAt), lt(documents.deletedAt, ninetyDaysAgo))).returning({ id: documents.id }),
      db.delete(labResults).where(and(isNotNull(labResults.deletedAt), lt(labResults.deletedAt, ninetyDaysAgo))).returning({ id: labResults.id }),
      db.delete(claims).where(and(isNotNull(claims.deletedAt), lt(claims.deletedAt, ninetyDaysAgo))).returning({ id: claims.id }),
    ])

    results.medications = medsDeleted.length
    results.appointments = apptsDeleted.length
    results.doctors = docsDeleted.length
    results.documents = documentsDeleted.length
    results.lab_results = labsDeleted.length
    results.claims = claimsDeleted.length

    // Purge old audit logs (keep 1 year per HIPAA minimum)
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    const auditDeleted = await db.delete(auditLogs).where(lt(auditLogs.createdAt, oneYearAgo)).returning({ id: auditLogs.id })
    results.audit_logs = auditDeleted.length

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
