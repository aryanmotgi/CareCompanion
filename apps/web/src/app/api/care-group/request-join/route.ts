/**
 * Caregiver requests to join a patient's care group by email.
 *
 *   POST /api/care-group/request-join  { patientEmail }
 *      → 200 { sent: true }
 *      → 429 { error: "Too many attempts" } if rate-limited
 *
 *   GET  /api/care-group/request-join                  (patient view, lists pending)
 *      → 200 { requests: [{ id, caregiver: { displayName, email }, createdAt }, ...] }
 *
 * Anti-enumeration: POST returns 200 OK regardless of whether the email
 * matches a user. If it doesn't match, we silently don't create a request.
 * Lets attackers learn nothing from response shape.
 *
 * Rate limit: 3 requests per IP per hour. Hour-window prevents email
 * enumeration brute-force; minute-window would have let scripts grind.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { careGroupJoinRequests, users } from '@/lib/db/schema'
import { and, eq, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { validateCsrf } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import { isCaregiverCodeFlowEnabled } from '@/lib/feature-flags'

const RATE_LIMIT = { maxRequests: 3, windowMs: 60 * 60_000 }

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

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rateKey = `request-join:${ip}:${session.user.id}`
    const rateResult = checkRateLimit(rateKey, RATE_LIMIT)
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rateResult.retryAfterMs / 1000)) },
        }
      )
    }

    const body = await req.json()
    const patientEmail = typeof body?.patientEmail === 'string' ? body.patientEmail.trim().toLowerCase() : null
    if (!patientEmail || !patientEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid patientEmail required' }, { status: 400 })
    }

    // Look up the patient. NEVER reveal whether the email exists.
    const patient = await db.query.users.findFirst({
      where: eq(users.email, patientEmail),
    })

    if (patient && patient.id !== session.user.id) {
      // Avoid duplicate pending requests for the same caregiver/patient pair.
      const existing = await db.query.careGroupJoinRequests.findFirst({
        where: and(
          eq(careGroupJoinRequests.patientUserId, patient.id),
          eq(careGroupJoinRequests.caregiverUserId, session.user.id),
          eq(careGroupJoinRequests.status, 'pending'),
        ),
      })
      if (!existing) {
        await db.insert(careGroupJoinRequests).values({
          patientUserId: patient.id,
          caregiverUserId: session.user.id,
          status: 'pending',
        })
        // TODO(notifications): dispatch in-app/push notification to patient.
        // The notifications service exists at apps/web/src/lib/notifications.ts —
        // wire in a follow-up to avoid expanding this PR's blast radius.
      }
    }

    // Always 200 OK — anti-enumeration.
    return NextResponse.json({ sent: true })
  } catch (err) {
    console.error('[care-group/request-join POST] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requests = await db
      .select({
        id: careGroupJoinRequests.id,
        createdAt: careGroupJoinRequests.createdAt,
        caregiverUserId: careGroupJoinRequests.caregiverUserId,
        caregiverDisplayName: users.displayName,
        caregiverEmail: users.email,
      })
      .from(careGroupJoinRequests)
      .innerJoin(users, eq(careGroupJoinRequests.caregiverUserId, users.id))
      .where(and(
        eq(careGroupJoinRequests.patientUserId, session.user.id),
        eq(careGroupJoinRequests.status, 'pending'),
      ))
      .orderBy(desc(careGroupJoinRequests.createdAt))

    return NextResponse.json({ requests })
  } catch (err) {
    console.error('[care-group/request-join GET] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
