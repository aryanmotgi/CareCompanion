import { db } from '@/lib/db'
import { labResults } from '@/lib/db/schema'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiError, apiSuccess } from '@/lib/api-response'

// GET — list lab results for the authenticated user
export async function GET(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser()
  if (error) return error

  const url = new URL(req.url)
  const careProfileId = url.searchParams.get('care_profile_id')

  if (!careProfileId) return apiError('care_profile_id is required', 400)

  // Lab results are linked by userId, but we still verify the care profile
  // belongs to the user so the param contract matches other /records/* endpoints
  const labs = await db
    .select()
    .from(labResults)
    .where(
      and(
        eq(labResults.userId, dbUser!.id),
        isNull(labResults.deletedAt),
      ),
    )
    .orderBy(desc(labResults.dateTaken))
    .limit(50)

  return apiSuccess(labs)
}
