/**
 * Rotate the active code: revoke the current one and create a fresh code.
 * Only the group's patient can rotate. Atomic in a single transaction —
 * either both happen or neither.
 *
 *   POST /api/care-group/code/rotate  { careGroupId } → 201 { code, expiresAt, maxUses }
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { careGroupCodes } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
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
      return NextResponse.json({ error: 'Only the patient can rotate the code' }, { status: 403 })
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

    const result = await db.transaction(async (tx) => {
      // Revoke any active codes for this group
      await tx.update(careGroupCodes)
        .set({ revokedAt: now })
        .where(and(
          eq(careGroupCodes.careGroupId, careGroupId),
          isNull(careGroupCodes.revokedAt),
        ))

      // Insert fresh code (with up to 5 retries on collision)
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const [row] = await tx.insert(careGroupCodes)
            .values({
              careGroupId,
              code: generateCode(),
              createdBy: session.user!.id,
              expiresAt,
              maxUses: DEFAULT_MAX_USES,
            })
            .returning()
          return row
        } catch (err) {
          if (attempt === 4) throw err
          // collision — try again with a new code
        }
      }
      throw new Error('code generation exhausted retries')
    })

    return NextResponse.json({
      code: result.code,
      expiresAt: result.expiresAt,
      useCount: result.useCount,
      maxUses: result.maxUses,
    }, { status: 201 })
  } catch (err) {
    console.error('[care-group/code/rotate] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
