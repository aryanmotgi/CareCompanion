/**
 * Patient approves a pending caregiver join request.
 *
 *   POST /api/care-group/request-join/<id>/approve  { relationship, careGroupId }
 *      → 200 { approved: true, careGroupId }
 *      → 403 if the request isn't addressed to the calling user
 *      → 404 if the request doesn't exist or is no longer pending
 *      → 409 if the caregiver is already a member
 *
 * Side effect: creates a care_group_members row attaching the caregiver to
 * the patient's care group with userType='caregiver'.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { careGroupJoinRequests } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { validateCsrf } from '@/lib/csrf'
import { joinCareGroup, isGroupPatient, type Relationship } from '@/lib/care-group'

const RELATIONSHIPS: Relationship[] = ['spouse', 'parent', 'child', 'sibling', 'friend', 'other']

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await ctx.params
    const body = await req.json()
    const relationship = body?.relationship as Relationship | undefined
    const careGroupId = typeof body?.careGroupId === 'string' ? body.careGroupId : null
    if (!relationship || !RELATIONSHIPS.includes(relationship)) {
      return NextResponse.json({ error: 'relationship required' }, { status: 400 })
    }
    if (!careGroupId) {
      return NextResponse.json({ error: 'careGroupId required' }, { status: 400 })
    }

    if (!(await isGroupPatient(session.user.id, careGroupId))) {
      return NextResponse.json({ error: 'Only the patient can approve join requests for this group' }, { status: 403 })
    }

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

    const joinResult = await joinCareGroup({
      userId: request.caregiverUserId,
      careGroupId,
      userType: 'caregiver',
      relationship,
      role: 'member',
    })
    if (!joinResult.ok) {
      const status = joinResult.reason === 'already-member' ? 409 : 409
      const msg = joinResult.reason === 'already-member'
        ? 'This caregiver is already a member of the group'
        : 'This care group is full'
      return NextResponse.json({ error: msg }, { status })
    }

    await db.update(careGroupJoinRequests)
      .set({ status: 'approved', resolvedAt: new Date() })
      .where(eq(careGroupJoinRequests.id, id))

    return NextResponse.json({ approved: true, careGroupId })
  } catch (err) {
    console.error('[request-join/approve] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
