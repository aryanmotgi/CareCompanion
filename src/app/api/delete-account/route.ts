import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { users } from '@/lib/db/schema'
import { rateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import { validateCsrf } from '@/lib/csrf'

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 })

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    await logAudit({
      user_id: user.id,
      action: 'delete_account',
      ip_address: req.headers.get('x-forwarded-for') || undefined,
    })

    console.log(`[delete-account] Starting account deletion for user ${user.id}`)

    // Delete the user record (cascades to all related records via FK constraints)
    await db.delete(users).where(eq(users.cognitoSub, user.id))

    console.log(`[delete-account] Successfully deleted user ${user.id}`)
    return apiSuccess({ success: true })
  } catch (error) {
    console.error('[delete-account] Error:', error)
    return apiError('Internal server error', 500)
  }
}
