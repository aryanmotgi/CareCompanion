/**
 * Medication refill status endpoint.
 * Returns refill status for all medications with urgency levels.
 */
export const dynamic = 'force-dynamic'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { checkRefillStatus } from '@/lib/refill-tracker'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET() {
  try {
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, dbUser!.id))
      .limit(1)

    if (!profile) return ApiErrors.notFound('Care profile')

    const statuses = await checkRefillStatus(profile.id)

    const overdue = statuses.filter(s => s.status === 'overdue').length
    const dueSoon = statuses.filter(s => s.status === 'due_soon' || s.status === 'due_today').length

    return apiSuccess({
      medications: statuses,
      summary: {
        total: statuses.length,
        overdue,
        due_soon: dueSoon,
        ok: statuses.filter(s => s.status === 'ok').length,
        unknown: statuses.filter(s => s.status === 'unknown').length,
      },
      message: overdue > 0
        ? `${overdue} medication refill(s) overdue!`
        : dueSoon > 0
          ? `${dueSoon} refill(s) due soon`
          : 'All refills are up to date',
    })
  } catch (error) {
    console.error('[refills] Error:', error)
    return ApiErrors.internal()
  }
}
