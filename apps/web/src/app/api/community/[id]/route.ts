import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { communityPosts, communityReplies, communityUpvotes } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

const communityReplyLimiter = rateLimit({ interval: 60_000, maxRequests: 10 });
const idSchema = z.string().uuid();

function anonymousLabel(cancerType: string, authorRole: string) {
  const role = authorRole === 'patient' ? 'Patient' : 'Caregiver';
  const type = cancerType
    ? cancerType.charAt(0).toUpperCase() + cancerType.slice(1)
    : 'Cancer';
  return `${type} ${role}`;
}

interface Props { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Props) {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { id } = await params;
    if (!idSchema.safeParse(id).success) return apiError('Invalid post ID', 400);

    const [[post], replies] = await Promise.all([
      db.select({
        id: communityPosts.id,
        cancerType: communityPosts.cancerType,
        authorRole: communityPosts.authorRole,
        title: communityPosts.title,
        body: communityPosts.body,
        upvotes: communityPosts.upvotes,
        replyCount: communityPosts.replyCount,
        isPinned: communityPosts.isPinned,
        createdAt: communityPosts.createdAt,
        isOwn: eq(communityPosts.userId, user!.id),
      }).from(communityPosts).where(
        and(eq(communityPosts.id, id), eq(communityPosts.isModerated, false))
      ).limit(1),

      db.select({
        id: communityReplies.id,
        cancerType: communityReplies.cancerType,
        authorRole: communityReplies.authorRole,
        body: communityReplies.body,
        upvotes: communityReplies.upvotes,
        createdAt: communityReplies.createdAt,
        isOwn: eq(communityReplies.userId, user!.id),
      }).from(communityReplies).where(
        and(eq(communityReplies.postId, id), eq(communityReplies.isModerated, false))
      ).orderBy(desc(communityReplies.upvotes), desc(communityReplies.createdAt)).limit(100),
    ]);

    if (!post) return apiError('Not found', 404);

    // Check if user already upvoted the post
    const [postUpvote] = await db
      .select({ id: communityUpvotes.id })
      .from(communityUpvotes)
      .where(and(eq(communityUpvotes.userId, user!.id), eq(communityUpvotes.targetId, id), eq(communityUpvotes.targetType, 'post')))
      .limit(1);

    const totalReplies = post.replyCount ?? replies.length;
    return apiSuccess({
      post: { ...post, authorLabel: anonymousLabel(post.cancerType, post.authorRole), hasUpvoted: !!postUpvote },
      replies: replies.map((r) => ({ ...r, authorLabel: anonymousLabel(r.cancerType, r.authorRole) })),
      totalReplies,
      hasMoreReplies: totalReplies > replies.length,
    });
  } catch (err) {
    console.error('[community/id] GET error:', err);
    return apiError('Internal server error', 500);
  }
}

const replySchema = z.object({
  body: z.string().min(5).max(1000),
});

export async function POST(request: Request, { params }: Props) {
  try {
    const { valid, error: csrfError } = await validateCsrf(request);
    if (!valid) return csrfError!;

    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { id } = await params;
    if (!idSchema.safeParse(id).success) return apiError('Invalid post ID', 400);

    const rl = await communityReplyLimiter.check(`community-reply:${user!.id}`);
    if (!rl.success) return apiError('Too many requests', 429);

    const [post] = await db
      .select({ id: communityPosts.id, cancerType: communityPosts.cancerType })
      .from(communityPosts)
      .where(and(eq(communityPosts.id, id), eq(communityPosts.isModerated, false)))
      .limit(1);

    if (!post) return apiError('Not found', 404);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid request body', 400);
    }
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) return apiError('Invalid input', 400);

    const reply = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(communityReplies)
        .values({
          postId: id,
          userId: user!.id,
          cancerType: post.cancerType,
          body: parsed.data.body,
        })
        .returning({
          id: communityReplies.id,
          cancerType: communityReplies.cancerType,
          authorRole: communityReplies.authorRole,
          body: communityReplies.body,
          upvotes: communityReplies.upvotes,
          createdAt: communityReplies.createdAt,
        });

      await tx
        .update(communityPosts)
        .set({ replyCount: sql`${communityPosts.replyCount} + 1` })
        .where(eq(communityPosts.id, id));

      return inserted;
    });

    return apiSuccess({ ...reply, authorLabel: anonymousLabel(reply.cancerType, reply.authorRole) });
  } catch (err) {
    console.error('[community/id] POST error:', err);
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(request: Request, { params }: Props) {
  try {
    const { valid, error: csrfError } = await validateCsrf(request);
    if (!valid) return csrfError!;

    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { id } = await params;
    if (!idSchema.safeParse(id).success) return apiError('Invalid post ID', 400);

    const [post] = await db
      .select({ userId: communityPosts.userId })
      .from(communityPosts)
      .where(eq(communityPosts.id, id))
      .limit(1);

    if (!post) return apiError('Post not found', 404);
    if (post.userId !== user!.id) return apiError('Forbidden', 403);

    await db.delete(communityPosts).where(eq(communityPosts.id, id));
    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error('[community/id] DELETE error:', err);
    return apiError('Internal server error', 500);
  }
}
