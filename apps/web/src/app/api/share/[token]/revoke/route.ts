import { db } from '@/lib/db'
import { sharedLinks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiError, apiSuccess } from '@/lib/api-response'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { user, error: authError } = await getAuthenticatedUser()
  if (authError) return authError

  const { token } = await params

  const [link] = await db
    .select({ userId: sharedLinks.userId, revokedAt: sharedLinks.revokedAt })
    .from(sharedLinks)
    .where(eq(sharedLinks.token, token))
    .limit(1)

  if (!link) return apiError('Link not found', 404)
  if (link.userId !== user!.id) return apiError('Forbidden', 403)
  if (link.revokedAt) return apiSuccess({ revoked: true, alreadyRevoked: true })

  await db
    .update(sharedLinks)
    .set({ revokedAt: new Date() })
    .where(eq(sharedLinks.token, token))

  return apiSuccess({ revoked: true })
}
