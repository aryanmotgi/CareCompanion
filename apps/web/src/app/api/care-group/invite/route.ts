import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { validateCsrf } from '@/lib/csrf'
import { db } from '@/lib/db'
import { careGroupInvites, careGroupMembers } from '@/lib/db/schema'
import { eq, and, isNull, gt, count } from 'drizzle-orm'
import { auth } from '@/lib/auth'

const MAX_ACTIVE_TOKENS = 5
const TOKEN_EXPIRY_DAYS = 7
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://carecompanionai.org'

// DEPRECATED 2026-05-12 — long invite tokens are being phased out in favor of
// 5-char codes (see POST /api/care-group/code). Kept live for 30 days for
// backwards compat with old web/email links, then removed in a cleanup PR.
const DEPRECATION_SUNSET = '2026-06-12'
const DEPRECATION_SUCCESSOR = '/api/care-group/code'

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  console.warn('[DEPRECATED] /api/care-group/invite (long token) called', {
    sunset: DEPRECATION_SUNSET,
    successor: DEPRECATION_SUCCESSOR,
    ua: req.headers.get('user-agent') ?? 'unknown',
  })

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { careGroupId } = await req.json()
    if (!careGroupId) {
      return NextResponse.json({ error: 'careGroupId required' }, { status: 400 })
    }

    // Verify caller is a member of this group
    const membership = await db.query.careGroupMembers.findFirst({
      where: and(
        eq(careGroupMembers.careGroupId, careGroupId),
        eq(careGroupMembers.userId, session.user.id),
      ),
    })
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    // Check active token limit
    const now = new Date()
    const [{ value: activeCount }] = await db
      .select({ value: count() })
      .from(careGroupInvites)
      .where(and(
        eq(careGroupInvites.careGroupId, careGroupId),
        isNull(careGroupInvites.usedBy),
        isNull(careGroupInvites.revokedAt),
        gt(careGroupInvites.expiresAt, now),
      ))

    if (activeCount >= MAX_ACTIVE_TOKENS) {
      return NextResponse.json(
        { error: 'You have too many pending invites. Revoke one to create a new one.' },
        { status: 400 }
      )
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

    const [invite] = await db.insert(careGroupInvites)
      .values({ careGroupId, token, createdBy: session.user.id, expiresAt })
      .returning({ id: careGroupInvites.id, token: careGroupInvites.token })

    const joinUrl = `${BASE_URL}/join?group=${careGroupId}&token=${invite.token}`

    return NextResponse.json({ token: invite.token, url: joinUrl }, {
      status: 201,
      headers: {
        'X-Deprecated': 'true',
        'X-Deprecation-Sunset': DEPRECATION_SUNSET,
        'X-Deprecation-Successor': DEPRECATION_SUCCESSOR,
      },
    })
  } catch (err) {
    console.error('[care-group/invite] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
