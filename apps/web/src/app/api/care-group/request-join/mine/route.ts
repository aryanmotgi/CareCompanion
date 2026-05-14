/**
 * GET /api/care-group/request-join/mine — returns the caller's most recent
 * outgoing join request (the caregiver side of the email-fallback flow).
 *
 * Used by the mobile /care-group-join screen to surface "approved" or "denied"
 * promptly, so caregivers waiting on a patient aren't stuck staring at the
 * 10-minute polling spinner with no signal when the patient rejects them.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { careGroupJoinRequests } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [latest] = await db
      .select({
        id: careGroupJoinRequests.id,
        status: careGroupJoinRequests.status,
        createdAt: careGroupJoinRequests.createdAt,
        resolvedAt: careGroupJoinRequests.resolvedAt,
        patientUserId: careGroupJoinRequests.patientUserId,
      })
      .from(careGroupJoinRequests)
      .where(eq(careGroupJoinRequests.caregiverUserId, session.user.id))
      .orderBy(desc(careGroupJoinRequests.createdAt))
      .limit(1)

    return NextResponse.json({ request: latest ?? null })
  } catch (err) {
    console.error('[care-group/request-join/mine GET] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
