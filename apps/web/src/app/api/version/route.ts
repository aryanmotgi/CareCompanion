import { db } from '@/lib/db'
import { appVersionConfig } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

interface VersionResponse {
  minIosBuild: number
  minAndroidBuild: number
  latestBuild: number
  killSwitch: boolean
  killReason?: string
  message?: string
}

/**
 * GET /api/version
 *
 * Returns mobile app version gating config. Called at launch by the React
 * Native client to enforce force-update and kill-switch policies.
 *
 * Source priority (highest wins):
 *   1. Env vars: APP_MIN_IOS_BUILD, APP_MIN_ANDROID_BUILD, APP_LATEST_BUILD,
 *                APP_KILL_SWITCH, APP_KILL_REASON, APP_MESSAGE
 *   2. Aurora app_version_config table (migration 022)
 *   3. Safe defaults (build 1, kill-switch off)
 *
 * No auth required — called before the user is authenticated.
 * Response is safe to cache for up to 60 s on the CDN edge.
 */
export async function GET() {
  let minIosBuild = 1
  let minAndroidBuild = 1
  let latestBuild = 1
  let killSwitch = false
  let killReason: string | undefined
  let message: string | undefined

  try {
    const rows = await db.select().from(appVersionConfig)
    const cfg = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]))

    if (cfg.min_ios_build)     minIosBuild     = parseInt(cfg.min_ios_build, 10)
    if (cfg.min_android_build) minAndroidBuild = parseInt(cfg.min_android_build, 10)
    if (cfg.latest_build)      latestBuild     = parseInt(cfg.latest_build, 10)
    if (cfg.kill_switch)       killSwitch      = cfg.kill_switch === 'true'
    if (cfg.kill_reason?.trim())  killReason   = cfg.kill_reason.trim()
    if (cfg.message?.trim())      message      = cfg.message.trim()
  } catch (e) {
    // DB unavailable — serve env-only or safe defaults so the app can still launch
    logger.warn('GET /api/version: DB read failed, falling back to env/defaults', {
      error: e instanceof Error ? e.message : String(e),
    })
  }

  // Env vars override DB values — zero-downtime ops without a DB write
  if (process.env.APP_MIN_IOS_BUILD)     minIosBuild     = parseInt(process.env.APP_MIN_IOS_BUILD, 10)
  if (process.env.APP_MIN_ANDROID_BUILD) minAndroidBuild = parseInt(process.env.APP_MIN_ANDROID_BUILD, 10)
  if (process.env.APP_LATEST_BUILD)      latestBuild     = parseInt(process.env.APP_LATEST_BUILD, 10)
  if (process.env.APP_KILL_SWITCH)       killSwitch      = process.env.APP_KILL_SWITCH === 'true'
  if (process.env.APP_KILL_REASON?.trim())  killReason   = process.env.APP_KILL_REASON!.trim()
  if (process.env.APP_MESSAGE?.trim())      message      = process.env.APP_MESSAGE!.trim()

  const payload: VersionResponse = { minIosBuild, minAndroidBuild, latestBuild, killSwitch }
  if (killReason) payload.killReason = killReason
  if (message)    payload.message    = message

  return Response.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  })
}
