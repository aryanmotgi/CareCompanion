import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiError, apiSuccess } from '@/lib/api-response'
import { validateCsrf } from '@/lib/csrf'
import { db } from '@/lib/db'
import { documents, careProfiles } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    const { id } = await params

    // Verify document belongs to this user via care profile
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, user!.id))
      .limit(1)

    if (!profile) return apiError('No care profile found', 400)

    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.id, id),
          eq(documents.careProfileId, profile.id),
          isNull(documents.deletedAt),
        )
      )
      .limit(1)

    if (!doc) return apiError('Document not found', 404)

    await db
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.careProfileId, profile.id)))

    return apiSuccess({ deleted: true })
  } catch (err) {
    console.error('[documents/[id]] DELETE error:', err)
    return apiError('Internal server error', 500)
  }
}
