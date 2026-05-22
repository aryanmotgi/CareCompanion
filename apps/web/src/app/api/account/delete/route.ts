import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { users } from '@/lib/db/schema'
import { rateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 })

// Mobile-facing endpoint: Bearer-token auth, no CSRF (stateless DELETE).
// Deletes the authenticated user and cascades to all FK-linked tables via Aurora schema.
export async function DELETE(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = await limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    await logAudit({
      user_id: user.id,
      action: 'delete_account',
      ip_address: req.headers.get('x-forwarded-for') || undefined,
    })

    await db.delete(users).where(eq(users.id, user.id))

    return apiSuccess({ success: true })
  } catch (error) {
    console.error('[account/delete] Error:', error)
    return apiError('Internal server error', 500)
  }
}
