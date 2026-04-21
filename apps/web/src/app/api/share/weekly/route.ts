import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { db } from '@/lib/db';
import { sharedLinks } from '@/lib/db/schema';
import { eq, and, gt, desc } from 'drizzle-orm';

export async function GET() {
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
        ),
      )
      .orderBy(desc(sharedLinks.createdAt))
      .limit(1);

    if (!link) return apiSuccess({ token: null });

    return apiSuccess({
      token: link.token,
      title: link.title,
      createdAt: link.createdAt,
      viewCount: link.viewCount ?? 0,
      shareUrl: `/shared/${link.token}`,
    });
  } catch (err) {
    console.error('[share/weekly] GET error:', err);
    return apiError('Internal server error', 500);
  }
}
