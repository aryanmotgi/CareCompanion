import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { db } from '@/lib/db';
import { communityPosts, communityReplies, communityUpvotes } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

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

    return apiSuccess({
      post: { ...post, authorLabel: anonymousLabel(post.cancerType, post.authorRole), hasUpvoted: !!postUpvote },
      replies: replies.map((r) => ({ ...r, authorLabel: anonymousLabel(r.cancerType, r.authorRole) })),
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
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { id } = await params;

    const [post] = await db
      .select({ id: communityPosts.id, cancerType: communityPosts.cancerType })
      .from(communityPosts)
      .where(and(eq(communityPosts.id, id), eq(communityPosts.isModerated, false)))
      .limit(1);

    if (!post) return apiError('Not found', 404);

    const body = await request.json();
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) return apiError('Invalid input', 400);

    const [reply] = await db
      .insert(communityReplies)
      .values({
        postId: id,
        userId: user!.id,
        cancerType: post.cancerType,
        body: parsed.data.body,
      })
      .returning();

    // Increment reply count safely
    await db
      .update(communityPosts)
      .set({ replyCount: sql`${communityPosts.replyCount} + 1` })
      .where(eq(communityPosts.id, id));

    return apiSuccess({ ...reply, authorLabel: anonymousLabel(reply.cancerType, reply.authorRole) });
  } catch (err) {
    console.error('[community/id] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
