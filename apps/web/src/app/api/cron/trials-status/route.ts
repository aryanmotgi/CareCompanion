import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import { savedTrials, cronState, notifications, careProfiles } from '@/lib/db/schema'
import { eq, gt, and, ne, sql } from 'drizzle-orm'
import { getTrialDetails } from '@/lib/trials/tools'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const BATCH_SIZE  = 10
const TIME_BUDGET = 270_000
const CURSOR_KEY  = 'trials_status_cursor'
const NULL_CURSOR = '00000000-0000-0000-0000-000000000000'

export async function GET(req: Request) {
  const authError = verifyCronRequest(req)
  if (authError) return authError

  const start = Date.now()

  // Load cursor
  const [cursorRow] = await db.select().from(cronState).where(eq(cronState.key, CURSOR_KEY))
  const lastId = cursorRow?.value ?? NULL_CURSOR

  const rows = await db.select().from(savedTrials)
    .where(and(gt(savedTrials.id, lastId), ne(savedTrials.interestStatus, 'dismissed')))
    .orderBy(savedTrials.id)
    .limit(100)

  let lastProcessedId = lastId
  let checked = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    if (Date.now() - start > TIME_BUDGET) break
    const batch = rows.slice(i, i + BATCH_SIZE)

    await Promise.all(batch.map(async row => {
      try {
        const detail = await getTrialDetails(row.nctId)
        if ('error' in detail) return

        const newStatus = (detail as Record<string, string>).status
        if (newStatus && newStatus !== row.lastKnownEnrollmentStatus) {
          const [cp] = await db.select({ userId: careProfiles.userId })
            .from(careProfiles).where(eq(careProfiles.id, row.careProfileId)).limit(1)
          if (cp) {
            // Dedup: skip if a status-change notification for this trial was sent in the last 24h
            const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
            const [recent] = await db.select({ id: notifications.id })
              .from(notifications)
              .where(and(
                eq(notifications.userId, cp.userId),
                eq(notifications.type, 'trial_status_change'),
                sql`${notifications.message} LIKE ${'%' + row.nctId.replace(/%/g, '\\%').replace(/_/g, '\\_') + '%'}`,
                gt(notifications.createdAt, since24h),
              ))
              .limit(1)
            if (!recent) {
              await db.insert(notifications).values({
                userId:  cp.userId,
                type:    'trial_status_change',
                title:   'A saved trial has a status update',
                message: `Trial ${row.nctId} status changed to ${newStatus}. Open CareCompanion to view details.`,
              })
              await db.update(savedTrials)
                .set({ lastKnownEnrollmentStatus: newStatus, lastStatusCheckedAt: new Date(), notifiedOfChangeAt: new Date() })
                .where(eq(savedTrials.id, row.id))
            } else {
              await db.update(savedTrials)
                .set({ lastKnownEnrollmentStatus: newStatus, lastStatusCheckedAt: new Date() })
                .where(eq(savedTrials.id, row.id))
            }
          }
        } else {
          await db.update(savedTrials)
            .set({ lastStatusCheckedAt: new Date() })
            .where(eq(savedTrials.id, row.id))
        }
      } catch { /* skip, continue */ }
    }))

    lastProcessedId = batch[batch.length - 1].id
    checked += batch.length
  }

  const ranToEnd = checked === rows.length
  const nextCursor = ranToEnd ? NULL_CURSOR : lastProcessedId

  await db.insert(cronState)
    .values({ key: CURSOR_KEY, value: nextCursor })
    .onConflictDoUpdate({
      target: cronState.key,
      set: { value: nextCursor, updatedAt: new Date() },
    })

  return NextResponse.json({ ok: true, checked, elapsed: Date.now() - start })
}
