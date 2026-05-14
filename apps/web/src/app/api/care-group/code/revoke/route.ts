/**
 * Revoke the active code WITHOUT replacement.
 *
 *   POST /api/care-group/code/revoke  { careGroupId } → 200 { revoked: true }
 *
 * Existing members of the group stay; only the join-by-code path is killed.
 * The patient can generate a fresh code later via POST /api/care-group/code.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { careGroupCodes } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { validateCsrf } from '@/lib/csrf'
import { isGroupPatient } from '@/lib/care-group'

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { careGroupId } = await req.json()
    if (!careGroupId || typeof careGroupId !== 'string') {
      return NextResponse.json({ error: 'careGroupId required' }, { status: 400 })
    }

    if (!(await isGroupPatient(session.user.id, careGroupId))) {
      return NextResponse.json({ error: 'Only the patient can revoke the code' }, { status: 403 })
    }

    await db.update(careGroupCodes)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(careGroupCodes.careGroupId, careGroupId),
        isNull(careGroupCodes.revokedAt),
      ))

    return NextResponse.json({ revoked: true })
  } catch (err) {
    console.error('[care-group/code/revoke] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
