export const dynamic = 'force-dynamic'
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { db } from '@/lib/db';
import { sharedLinks } from '@/lib/db/schema';
import { eq, and, gt, desc, isNull } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const now = new Date();

    const [link] = await db
      .select({
        token: sharedLinks.token,
        title: sharedLinks.title,
        createdAt: sharedLinks.createdAt,
        viewCount: sharedLinks.viewCount,
      })
      .from(sharedLinks)
      .where(
        and(
          eq(sharedLinks.userId, user!.id),
          eq(sharedLinks.type, 'weekly_summary'),
          gt(sharedLinks.expiresAt, now),
          isNull(sharedLinks.revokedAt),
        ),
      )
      .orderBy(desc(sharedLinks.createdAt))
      .limit(1);

    if (!link) return apiSuccess({ token: null });

    const shareUrl = `${new URL(request.url).origin}/shared/${link.token}`;
    return apiSuccess({
      token: link.token,
      title: link.title,
      createdAt: link.createdAt,
      viewCount: link.viewCount ?? 0,
      shareUrl,
    });
  } catch (err) {
    console.error('[share/weekly] GET error:', err);
    return apiError('Internal server error', 500);
  }
}
