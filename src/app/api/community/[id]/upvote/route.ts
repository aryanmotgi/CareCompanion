import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { db } from '@/lib/db';
import { communityPosts, communityReplies, communityUpvotes } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

interface Props { params: Promise<{ id: string }> }

const upvoteSchema = z.object({
  targetType: z.enum(['post', 'reply']),
});

export async function POST(request: Request, { params }: Props) {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { id } = await params;
    const body = await request.json();
    const parsed = upvoteSchema.safeParse(body);
    if (!parsed.success) return apiError('Invalid input', 400);

    const { targetType } = parsed.data;

    // Check for existing upvote (toggle)
    const [existing] = await db
      .select({ id: communityUpvotes.id })
      .from(communityUpvotes)
      .where(and(
        eq(communityUpvotes.userId, user!.id),
        eq(communityUpvotes.targetId, id),
        eq(communityUpvotes.targetType, targetType),
      ))
      .limit(1);

    if (existing) {
      // Remove upvote
      await db.delete(communityUpvotes).where(eq(communityUpvotes.id, existing.id));
      if (targetType === 'post') {
        await db.update(communityPosts)
          .set({ upvotes: sql`GREATEST(${communityPosts.upvotes} - 1, 0)` })
          .where(eq(communityPosts.id, id));
      } else {
        await db.update(communityReplies)
          .set({ upvotes: sql`GREATEST(${communityReplies.upvotes} - 1, 0)` })
          .where(eq(communityReplies.id, id));
      }
      return apiSuccess({ action: 'removed' });
    }

    // Add upvote
    await db.insert(communityUpvotes).values({ userId: user!.id, targetId: id, targetType });
    if (targetType === 'post') {
      await db.update(communityPosts)
        .set({ upvotes: sql`${communityPosts.upvotes} + 1` })
        .where(eq(communityPosts.id, id));
    } else {
      await db.update(communityReplies)
        .set({ upvotes: sql`${communityReplies.upvotes} + 1` })
        .where(eq(communityReplies.id, id));
    }
    return apiSuccess({ action: 'added' });
  } catch (err) {
    console.error('[community/upvote] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
