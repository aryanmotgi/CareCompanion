/**
 * Cron: Purge expired soft-deleted records.
 * Runs weekly. Permanently removes records soft-deleted more than 30 days ago.
 */
import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { purgeExpiredRecords } from '@/lib/soft-delete'

export async function GET(req: Request) {
  const authError = verifyCronRequest(req)
  if (authError) return authError

  try {
    const result = await purgeExpiredRecords()

    const totalPurged = Object.values(result.purged).reduce((sum, n) => sum + n, 0)
    console.log(`[cron/purge] Purged ${totalPurged} expired records`, result.purged)

    return NextResponse.json({
      ok: true,
      total_purged: totalPurged,
      by_table: result.purged,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/purge] Error:', error)
    return NextResponse.json({ ok: false, error: 'Purge failed' }, { status: 500 })
  }
}
