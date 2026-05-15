import { db } from '@/lib/db'
import { careProfiles } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

const startTime = Date.now()

// Every column that must exist in Aurora. Add a row here whenever schema.ts changes.
// This is the single source of truth for "did we forget to run the migration?".
const REQUIRED_COLUMNS: { table: string; column: string }[] = [
  // care_profiles
  { table: 'care_profiles', column: 'id' },
  { table: 'care_profiles', column: 'user_id' },
  { table: 'care_profiles', column: 'role' },
  { table: 'care_profiles', column: 'caregiver_for_name' },
  { table: 'care_profiles', column: 'checkin_streak' },
  { table: 'care_profiles', column: 'last_radar_run_at' },
  // care_team_members
  { table: 'care_team_members', column: 'gratitude_nudge_count' },
  { table: 'care_team_members', column: 'last_gratitude_nudge_at' },
  // new Premium Care OS tables (just check they exist via one column each)
  { table: 'wellness_checkins', column: 'id' },
  { table: 'symptom_insights', column: 'id' },
  { table: 'notification_deliveries', column: 'id' },
  { table: 'care_team_activity_log', column: 'id' },
  // messages (core chat)
  { table: 'messages', column: 'id' },
  { table: 'messages', column: 'user_id' },
]

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring. Tests database connectivity,
 * memory usage, uptime, and verifies critical environment variables are set.
 * Protected: only returns detailed checks when CRON_SECRET is provided.
 * Without auth, returns just the status (healthy/degraded) for uptime monitors.
 */
export async function GET(req: Request) {
  const checks: Record<string, { status: 'ok' | 'error'; message?: string; details?: Record<string, unknown> }> = {}

  // Check database connectivity with timing
  try {
    const dbStart = Date.now()
    await db.select({ id: careProfiles.id }).from(careProfiles).limit(1)
    const dbDuration = Date.now() - dbStart
    checks.database = { status: 'ok', details: { responseTimeMs: dbDuration } }
  } catch (e) {
    checks.database = { status: 'error', message: e instanceof Error ? e.message : 'Unknown error' }
  }

  // Schema integrity — catch Aurora migration drift before users hit a 500
  try {
    const tableNames = [...new Set(REQUIRED_COLUMNS.map(r => r.table))]
    const tableList = sql.join(tableNames.map(t => sql`${t}`), sql`, `)
    const result = await db.execute(sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (${tableList})
    `)
    const rows = (Array.isArray(result)
      ? result
      : (result as { rows?: unknown[] }).rows ?? []) as { table_name: string; column_name: string }[]
    const found = new Set(rows.map(r => `${r.table_name}.${r.column_name}`))
    const missing = REQUIRED_COLUMNS.filter(r => !found.has(`${r.table}.${r.column}`))
    if (missing.length > 0) {
      checks.schema = {
        status: 'error',
        message: `Aurora is missing ${missing.length} column(s) — run the migration`,
        details: { missing: missing.map(r => `${r.table}.${r.column}`) },
      }
    } else {
      checks.schema = { status: 'ok', details: { columnCount: REQUIRED_COLUMNS.length } }
    }
  } catch (e) {
    checks.schema = { status: 'error', message: e instanceof Error ? e.message : 'Schema check failed' }
  }

  // Check critical env vars (names only, never values)
  checks.database_url = (process.env.AWS_RESOURCE_ARN && process.env.AWS_SECRET_ARN) ? { status: 'ok' } : { status: 'error' }
  checks.anthropic_key = process.env.ANTHROPIC_API_KEY ? { status: 'ok' } : { status: 'error' }

  // Memory usage
  const memUsage = process.memoryUsage()
  checks.memory = {
    status: memUsage.heapUsed / memUsage.heapTotal > 0.9 ? 'error' : 'ok',
    details: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      externalMB: Math.round(memUsage.external / 1024 / 1024),
    },
  }

  // Uptime
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000)

  const allHealthy = Object.values(checks).every(c => c.status === 'ok')
  const status = allHealthy ? 'healthy' : 'degraded'

  logger.info('Health check', { route: '/api/health', status })

  // Without CRON_SECRET auth, return only the status (no details about which keys are missing)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  // In production, require the secret to be both set and matched.
  // In dev (no CRON_SECRET), allow full details for easier debugging.
  const isProd = process.env.NODE_ENV === 'production'
  const isAuthed = isProd
    ? (!!cronSecret && authHeader === `Bearer ${cronSecret}`)
    : (!cronSecret || authHeader === `Bearer ${cronSecret}`)

  if (!isAuthed) {
    return Response.json(
      { status, timestamp: new Date().toISOString() },
      { status: allHealthy ? 200 : 503 }
    )
  }

  return Response.json(
    {
      status,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      uptime: uptimeSeconds,
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  )
}
