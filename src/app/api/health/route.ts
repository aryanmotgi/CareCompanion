import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring. Tests database connectivity
 * and verifies critical environment variables are set.
 * Protected: only returns detailed checks when CRON_SECRET is provided.
 * Without auth, returns just the status (healthy/degraded) for uptime monitors.
 */
export async function GET(req: Request) {
  const checks: Record<string, { status: 'ok' | 'error'; message?: string }> = {}

  // Check database connectivity
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('care_profiles').select('id').limit(1)
    checks.database = error ? { status: 'error', message: error.message } : { status: 'ok' }
  } catch (e) {
    checks.database = { status: 'error', message: e instanceof Error ? e.message : 'Unknown error' }
  }

  // Check critical env vars (names only, never values)
  checks.supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL ? { status: 'ok' } : { status: 'error' }
  checks.supabase_key = process.env.SUPABASE_SERVICE_ROLE_KEY ? { status: 'ok' } : { status: 'error' }
  checks.anthropic_key = process.env.ANTHROPIC_API_KEY ? { status: 'ok' } : { status: 'error' }

  const allHealthy = Object.values(checks).every(c => c.status === 'ok')
  const status = allHealthy ? 'healthy' : 'degraded'

  // Without CRON_SECRET auth, return only the status (no details about which keys are missing)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const isAuthed = !cronSecret || authHeader === `Bearer ${cronSecret}`

  if (!isAuthed) {
    return Response.json(
      { status, timestamp: new Date().toISOString() },
      { status: allHealthy ? 200 : 503 }
    )
  }

  return Response.json(
    { status, timestamp: new Date().toISOString(), checks },
    { status: allHealthy ? 200 : 503 }
  )
}
