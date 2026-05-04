import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { communityPosts, communityReplies, communityUpvotes } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

interface Props { params: Promise<{ id: string }> }

const upvoteLimiter = rateLimit({ interval: 60_000, maxRequests: 30 });
const idSchema = z.string().uuid();

const upvoteSchema = z.object({
  targetType: z.enum(['post', 'reply']),
});

export async function POST(request: Request, { params }: Props) {
  try {
    const { valid, error: csrfError } = await validateCsrf(request);
    if (!valid) return csrfError!;

    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { id } = await params;
    if (!idSchema.safeParse(id).success) return apiError('Invalid post ID', 400);

    const rl = await upvoteLimiter.check(`community-upvote:${user!.id}`);
    if (!rl.success) return apiError('Too many requests', 429);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid request body', 400);
    }
    const parsed = upvoteSchema.safeParse(body);
    if (!parsed.success) return apiError('Invalid input', 400);

    const { targetType } = parsed.data;

    // Verify target exists and is not moderated
    if (targetType === 'post') {
      const [target] = await db
        .select({ id: communityPosts.id })
        .from(communityPosts)
        .where(and(eq(communityPosts.id, id), eq(communityPosts.isModerated, false)))
        .limit(1);
      if (!target) return apiError('Post not found', 404);
    } else {
      const [target] = await db
        .select({ id: communityReplies.id })
        .from(communityReplies)
        .where(and(eq(communityReplies.id, id), eq(communityReplies.isModerated, false)))
        .limit(1);
      if (!target) return apiError('Reply not found', 404);
    }

    const action = await db.transaction(async (tx) => {
      // Check for existing upvote (toggle)
      const [existing] = await tx
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
        await tx.delete(communityUpvotes).where(eq(communityUpvotes.id, existing.id));
        if (targetType === 'post') {
          await tx.update(communityPosts)
            .set({ upvotes: sql`GREATEST(${communityPosts.upvotes} - 1, 0)` })
            .where(eq(communityPosts.id, id));
        } else {
          await tx.update(communityReplies)
            .set({ upvotes: sql`GREATEST(${communityReplies.upvotes} - 1, 0)` })
            .where(eq(communityReplies.id, id));
        }
        return 'removed' as const;
      }

      // Add upvote
      await tx.insert(communityUpvotes).values({ userId: user!.id, targetId: id, targetType });
      if (targetType === 'post') {
        await tx.update(communityPosts)
          .set({ upvotes: sql`${communityPosts.upvotes} + 1` })
          .where(eq(communityPosts.id, id));
      } else {
        await tx.update(communityReplies)
          .set({ upvotes: sql`${communityReplies.upvotes} + 1` })
          .where(eq(communityReplies.id, id));
      }
      return 'added' as const;
    });

    return apiSuccess({ action });
  } catch (err) {
    console.error('[community/upvote] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
