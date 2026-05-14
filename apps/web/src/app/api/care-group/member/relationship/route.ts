/**
 * Caregiver updates their own relationship to the patient.
 *
 *   POST /api/care-group/member/relationship  { careGroupId, relationship }
 *      → 200 { updated: true }
 *      → 403 if the user isn't a member of the group
 *      → 400 if relationship is not a valid value
 *
 * Used by the /care-relationship screen after the caregiver picks
 * spouse/parent/child/sibling/friend/other. The initial joinByCode sets
 * relationship='other' as a placeholder; this updates to the real value.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { careGroupMembers } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { validateCsrf } from '@/lib/csrf'
import type { Relationship } from '@/lib/care-group'

const RELATIONSHIPS: Relationship[] = ['spouse', 'parent', 'child', 'sibling', 'friend', 'other']

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const careGroupId = typeof body?.careGroupId === 'string' ? body.careGroupId : null
    const relationship = body?.relationship as Relationship | undefined
    if (!careGroupId) {
      return NextResponse.json({ error: 'careGroupId required' }, { status: 400 })
    }
    if (!relationship || !RELATIONSHIPS.includes(relationship)) {
      return NextResponse.json({ error: 'relationship required' }, { status: 400 })
    }

    const result = await db.update(careGroupMembers)
      .set({ relationship })
      .where(and(
        eq(careGroupMembers.careGroupId, careGroupId),
        eq(careGroupMembers.userId, session.user.id),
      ))
      .returning()

    if (result.length === 0) {
      return NextResponse.json({ error: 'You are not a member of this care group' }, { status: 403 })
    }

    return NextResponse.json({ updated: true })
  } catch (err) {
    console.error('[care-group/member/relationship] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
