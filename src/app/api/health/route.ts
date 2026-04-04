import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring. Tests database connectivity
 * and verifies critical environment variables are set.
 */
export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; message?: string }> = {}

  // Check database connectivity
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('care_profiles').select('id').limit(1)
    checks.database = error ? { status: 'error', message: error.message } : { status: 'ok' }
  } catch (e) {
    checks.database = { status: 'error', message: e instanceof Error ? e.message : 'Unknown error' }
  }

  // Check critical env vars
  checks.supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? { status: 'ok' }
    : { status: 'error', message: 'NEXT_PUBLIC_SUPABASE_URL not set' }

  checks.supabase_key = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? { status: 'ok' }
    : { status: 'error', message: 'SUPABASE_SERVICE_ROLE_KEY not set' }

  checks.anthropic_key = process.env.ANTHROPIC_API_KEY
    ? { status: 'ok' }
    : { status: 'error', message: 'ANTHROPIC_API_KEY not set — chat and extraction will fail' }

  const allHealthy = Object.values(checks).every(c => c.status === 'ok')

  return Response.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  )
}
