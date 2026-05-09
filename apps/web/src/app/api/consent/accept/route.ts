import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { validateCsrf } from '@/lib/csrf'
import { logAudit } from '@/lib/audit'

const CONSENT_VERSION = '1.0'

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await db
      .update(users)
      .set({
        hipaaConsent: true,
        hipaaConsentAt: new Date(),
        hipaaConsentVersion: CONSENT_VERSION,
      })
      .where(eq(users.id, session.user.id))

    await logAudit({
      user_id: session.user.id,
      action: 'hipaa_consent_accepted',
      details: { version: CONSENT_VERSION },
      ip_address: req.headers.get('x-forwarded-for') || undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[consent/accept] DB update failed:', e)
    return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 })
  }
}
