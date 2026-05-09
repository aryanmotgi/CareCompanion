import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { db } from '@/lib/db';
import { communityPosts, careProfiles } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

const communityPostLimiter = rateLimit({ interval: 60_000, maxRequests: 5 });

const CANCER_TYPES = [
  'breast cancer', 'colorectal cancer', 'lung cancer', 'prostate cancer',
  'ovarian cancer', 'pancreatic cancer', 'lymphoma', 'leukemia',
  'melanoma', 'bladder cancer', 'kidney cancer', 'thyroid cancer',
  'brain cancer', 'liver cancer', 'stomach cancer', 'other',
];

function anonymousLabel(cancerType: string, authorRole: string) {
  const role = authorRole === 'patient' ? 'Patient' : 'Caregiver';
  const type = cancerType
    ? cancerType.charAt(0).toUpperCase() + cancerType.slice(1)
    : 'Cancer';
  return `${type} ${role}`;
}

export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const cancerType = searchParams.get('cancerType') || null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    if (cancerType && !CANCER_TYPES.includes(cancerType)) {
      return apiError('Invalid cancerType', 400);
    }

    const where = cancerType
      ? and(eq(communityPosts.cancerType, cancerType), eq(communityPosts.isModerated, false))
      : eq(communityPosts.isModerated, false);

    const posts = await db
      .select({
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
      })
      .from(communityPosts)
      .where(where)
      .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt))
      .limit(limit)
      .offset(offset);

    return apiSuccess(
      posts.map((p) => ({
        ...p,
        authorLabel: anonymousLabel(p.cancerType, p.authorRole),
        bodyPreview: p.body.slice(0, 200) + (p.body.length > 200 ? '…' : ''),
      }))
    );
  } catch (err) {
    console.error('[community] GET error:', err);
    return apiError('Internal server error', 500);
  }
}

const createPostSchema = z.object({
  title: z.string().min(5).max(200),
  body: z.string().min(10).max(2000),
  cancerType: z.string().refine((v) => CANCER_TYPES.includes(v), { message: 'Invalid cancerType' }),
  authorRole: z.enum(['caregiver', 'patient']).optional().default('caregiver'),
});

export async function POST(request: Request) {
  try {
    const { valid, error: csrfError } = await validateCsrf(request);
    if (!valid) return csrfError!;

    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const rl = await communityPostLimiter.check(`community-post:${user!.id}`);
    if (!rl.success) return apiError('Too many requests', 429);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid request body', 400);
    }
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) return apiError('Invalid input', 400);

    const { title, body: postBody, cancerType, authorRole } = parsed.data;

    // If user hasn't specified cancerType, try to infer from care profile
    let resolvedCancerType = cancerType;
    if (!CANCER_TYPES.includes(cancerType)) {
      const [profile] = await db
        .select({ cancerType: careProfiles.cancerType })
        .from(careProfiles)
        .where(eq(careProfiles.userId, user!.id))
        .limit(1);
      resolvedCancerType = profile?.cancerType || 'other';
    }

    const [post] = await db
      .insert(communityPosts)
      .values({
        userId: user!.id,
        cancerType: resolvedCancerType,
        authorRole,
        title,
        body: postBody,
      })
      .returning({
        id: communityPosts.id,
        cancerType: communityPosts.cancerType,
        authorRole: communityPosts.authorRole,
        title: communityPosts.title,
        createdAt: communityPosts.createdAt,
      });

    return apiSuccess({ ...post, authorLabel: anonymousLabel(post.cancerType, post.authorRole) });
  } catch (err) {
    console.error('[community] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
