/**
 * Care-group invite codes — generate / list.
 *
 *   POST   /api/care-group/code     { careGroupId }     → 201 { code, expiresAt, maxUses }
 *   GET    /api/care-group/code?careGroupId=...        → 200 { code, expiresAt, useCount, maxUses } | null
 *
 * Only the group's patient (userType='patient') can generate or read the
 * active code. One active code per group at any time — generating a new code
 * while one is already active returns the existing active code rather than
 * creating a duplicate (idempotent for the common "show me my code" UX).
 *
 * To replace the active code, use POST /api/care-group/code/rotate.
 * To kill the active code without replacement, use POST /api/care-group/code/revoke.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { careGroupCodes } from '@/lib/db/schema'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { validateCsrf } from '@/lib/csrf'
import { generateCode, isGroupPatient } from '@/lib/care-group'

const CODE_EXPIRY_DAYS = 14
const DEFAULT_MAX_USES = 5

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
      return NextResponse.json({ error: 'Only the patient can generate a care-group code' }, { status: 403 })
    }

    const now = new Date()

    // If there's already an active code, return it. Patients hitting this from
    // Settings → "Generate Code" should see their existing code, not get
    // surprised by a new one (rotate is the explicit replace).
    const existing = await db.query.careGroupCodes.findFirst({
      where: and(
        eq(careGroupCodes.careGroupId, careGroupId),
        isNull(careGroupCodes.revokedAt),
        gt(careGroupCodes.expiresAt, now),
      ),
    })
    if (existing && existing.useCount < existing.maxUses) {
      return NextResponse.json({
        code: existing.code,
        expiresAt: existing.expiresAt,
        useCount: existing.useCount,
        maxUses: existing.maxUses,
      })
    }

    // Otherwise create a fresh one. Retry up to 5 times if we hit a unique
    // collision on `code` — should be vanishingly rare (20M space) but
    // explicit > clever.
    const expiresAt = new Date(now.getTime() + CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    let lastErr: unknown = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode()
      try {
        const [row] = await db.insert(careGroupCodes)
          .values({
            careGroupId,
            code,
            createdBy: session.user.id,
            expiresAt,
            maxUses: DEFAULT_MAX_USES,
          })
          .returning()
        return NextResponse.json({
          code: row.code,
          expiresAt: row.expiresAt,
          useCount: row.useCount,
          maxUses: row.maxUses,
        }, { status: 201 })
      } catch (err) {
        // Unique violation on (care_group_id, revoked_at IS NULL) means
        // another code became active between our existing-check and insert.
        // Unique violation on `code` means a code collision (improbable).
        // Either way, retry — the next iteration will pick a fresh code.
        lastErr = err
      }
    }
    console.error('[care-group/code POST] gave up after 5 attempts:', lastErr)
    return NextResponse.json({ error: 'Could not generate code, please retry' }, { status: 500 })
  } catch (err) {
    console.error('[care-group/code POST] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const careGroupId = new URL(req.url).searchParams.get('careGroupId')
    if (!careGroupId) {
      return NextResponse.json({ error: 'careGroupId required' }, { status: 400 })
    }

    if (!(await isGroupPatient(session.user.id, careGroupId))) {
      return NextResponse.json({ error: 'Only the patient can view care-group codes' }, { status: 403 })
    }

    const active = await db.query.careGroupCodes.findFirst({
      where: and(
        eq(careGroupCodes.careGroupId, careGroupId),
        isNull(careGroupCodes.revokedAt),
        gt(careGroupCodes.expiresAt, new Date()),
      ),
    })
    if (!active || active.useCount >= active.maxUses) {
      return NextResponse.json({ code: null })
    }
    return NextResponse.json({
      code: active.code,
      expiresAt: active.expiresAt,
      useCount: active.useCount,
      maxUses: active.maxUses,
    })
  } catch (err) {
    console.error('[care-group/code GET] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
