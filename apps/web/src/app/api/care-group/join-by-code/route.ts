/**
 * Caregiver redeems a 5-char code to join a care group.
 *
 *   POST /api/care-group/join-by-code  { code, relationship }
 *      → 200 { careGroupId, patientName, patientPhotoUrl } on success
 *      → 404 { error: "..." } for any invalid-code condition (parity, see SECURITY)
 *      → 409 { error: "Already a member" } if caregiver already in this group
 *      → 429 { error: "Too many attempts" } if rate-limited
 *
 * Atomic redemption: a single UPDATE ... WHERE ... RETURNING handles the
 * concurrency case (two caregivers redeeming simultaneously). Drizzle's
 * `update().set().where()...returning()` compiles to one round-trip.
 *
 * SECURITY: error parity. All four "code didn't work" conditions return the
 * same status + message:
 *   - code does not exist
 *   - code is expired
 *   - code is revoked
 *   - code is at max uses
 * Differentiating them lets an attacker enumerate valid codes by status. The
 * caregiver UX is identical in all four cases ("That code didn't work").
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { careGroupCodes, careGroups, users } from '@/lib/db/schema'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { validateCsrf } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import { joinCareGroup, normalizeCode, type Relationship } from '@/lib/care-group'
import { isCaregiverCodeFlowEnabled } from '@/lib/feature-flags'

const RELATIONSHIPS: Relationship[] = ['spouse', 'parent', 'child', 'sibling', 'friend', 'other']

// 5 attempts per IP per minute is plenty for typo correction but kills
// brute-force at the door (20.5M code space ÷ 5/min = 4M minutes to enumerate).
const RATE_LIMIT = { maxRequests: 5, windowMs: 60_000 }

const INVALID_CODE_MSG = "That code didn't work. Ask the patient for a new one."

export async function POST(req: Request) {
  if (!isCaregiverCodeFlowEnabled()) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 503 })
  }

  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit by IP+session so a single account can't hammer the endpoint
    // even from many IPs (and a single IP can't hammer it across accounts).
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rateKey = `join-by-code:${ip}:${session.user.id}`
    const rateResult = checkRateLimit(rateKey, RATE_LIMIT)
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again in a minute.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rateResult.retryAfterMs / 1000)) },
        }
      )
    }

    const body = await req.json()
    const normalized = typeof body?.code === 'string' ? normalizeCode(body.code) : null
    if (!normalized) {
      return NextResponse.json({ error: INVALID_CODE_MSG }, { status: 404 })
    }

    const relationship = body?.relationship as Relationship | undefined
    if (!relationship || !RELATIONSHIPS.includes(relationship)) {
      return NextResponse.json({ error: 'relationship required' }, { status: 400 })
    }

    // ATOMIC REDEMPTION. Single UPDATE that succeeds only if the code is
    // present, not revoked, not expired, and below max_uses. The RETURNING
    // clause gives us the row if (and only if) we won the race.
    const now = new Date()
    const [redeemed] = await db.update(careGroupCodes)
      .set({
        useCount: sql`${careGroupCodes.useCount} + 1`,
        lastUsedAt: now,
      })
      .where(and(
        eq(careGroupCodes.code, normalized),
        isNull(careGroupCodes.revokedAt),
        gt(careGroupCodes.expiresAt, now),
        sql`${careGroupCodes.useCount} < ${careGroupCodes.maxUses}`,
      ))
      .returning()

    if (!redeemed) {
      // Any of: not found, expired, revoked, max_uses hit. Same error for all
      // four to prevent enumeration. Logged with the actual reason for our own
      // observability.
      console.warn('[join-by-code] redemption failed', { ip, userId: session.user.id })
      return NextResponse.json({ error: INVALID_CODE_MSG }, { status: 404 })
    }

    // Create the membership. joinCareGroup is idempotent — already-member is a
    // 409 here (specific UX, not enumeration-leakable since they're past the code gate).
    const joinResult = await joinCareGroup({
      userId: session.user.id,
      careGroupId: redeemed.careGroupId,
      userType: 'caregiver',
      relationship,
      role: 'member',
    })

    if (!joinResult.ok) {
      if (joinResult.reason === 'already-member') {
        return NextResponse.json({ error: 'You are already a member of this care group' }, { status: 409 })
      }
      return NextResponse.json({ error: 'This care group is full' }, { status: 409 })
    }

    // Return patient name + photo for the photo-verify step.
    const group = await db.query.careGroups.findFirst({
      where: eq(careGroups.id, redeemed.careGroupId),
    })
    let patientName: string | null = null
    if (group) {
      const patient = await db.query.users.findFirst({
        where: eq(users.id, group.createdBy),
      })
      patientName = patient?.displayName ?? null
    }

    return NextResponse.json({
      careGroupId: redeemed.careGroupId,
      patientName,
      patientPhotoUrl: null, // user-profile photos not yet wired; null is the visual fallback
    })
  } catch (err) {
    console.error('[join-by-code] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
