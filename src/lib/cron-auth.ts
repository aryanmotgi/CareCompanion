import { NextResponse } from 'next/server'

/**
 * Verify that a cron request is legitimate.
 *
 * Vercel Cron sends an `Authorization: Bearer <CRON_SECRET>` header.
 * In development, skip the check if CRON_SECRET is not set.
 */
export function verifyCronRequest(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET

  // In production, CRON_SECRET must be set. In dev, allow without it.
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }
    return null
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
