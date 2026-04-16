/**
 * Restore soft-deleted records.
 * POST { table, id } — brings back a deleted record.
 */
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { restore } from '@/lib/soft-delete'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 })

const RestoreSchema = z.object({
  table: z.enum(['medications', 'appointments', 'doctors', 'documents', 'lab_results', 'notifications', 'claims']),
  id: z.string().uuid(),
})

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    const body = await req.json()
    const parsed = RestoreSchema.safeParse(body)
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input: table and id (UUID) required')
    }

    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, dbUser!.id))
      .limit(1)

    const result = await restore(parsed.data.table, parsed.data.id, dbUser!.id, profile?.id)
    return apiSuccess(result)
  } catch (error) {
    console.error('[restore] Error:', error)
    return apiError('Failed to restore record', 500)
  }
}
