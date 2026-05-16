/**
 * Cron: soft-delete memories whose `decay_at < NOW()`.
 *
 * Sets `valid_to = NOW()` so retrieval (which filters `valid_to IS NULL`)
 * stops returning them. Hard-delete is separate (handled by /api/cron/purge
 * for HIPAA-aligned 90-day retention).
 */
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyCronRequest } from '@/lib/cron-auth'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const authError = verifyCronRequest(req)
  if (authError) return authError

  try {
    const result = await db.execute(sql`
      UPDATE memories
      SET valid_to = NOW()
      WHERE decay_at IS NOT NULL
        AND decay_at < NOW()
        AND valid_to IS NULL
    `)

    const softDeleted = (result as unknown as { rowCount?: number }).rowCount ?? 0
    return NextResponse.json({ ok: true, softDeleted })
  } catch (error) {
    console.error('[cron/memory-decay] failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'decay_failed' }, { status: 500 })
  }
}
