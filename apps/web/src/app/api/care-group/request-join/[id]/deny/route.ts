/**
 * Patient denies a pending caregiver join request.
 *
 *   POST /api/care-group/request-join/<id>/deny  → 200 { denied: true }
 *
 * No membership created. Request status flipped to 'denied'. Caregiver sees
 * the rejection in their app and can request again later.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { careGroupJoinRequests } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { validateCsrf } from '@/lib/csrf'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await ctx.params

    const request = await db.query.careGroupJoinRequests.findFirst({
      where: and(
        eq(careGroupJoinRequests.id, id),
        eq(careGroupJoinRequests.patientUserId, session.user.id),
        eq(careGroupJoinRequests.status, 'pending'),
      ),
    })
    if (!request) {
      return NextResponse.json({ error: 'Request not found or already resolved' }, { status: 404 })
    }

    await db.update(careGroupJoinRequests)
      .set({ status: 'denied', resolvedAt: new Date() })
      .where(eq(careGroupJoinRequests.id, id))

    return NextResponse.json({ denied: true })
  } catch (err) {
    console.error('[request-join/deny] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
