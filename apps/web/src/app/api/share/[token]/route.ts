import { db } from '@/lib/db';
import { sharedLinks } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { apiError, apiSuccess } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';

const shareLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  maxRequests: 20,
  uniqueTokenPerInterval: 500,
});

// Public — no auth required
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // IP-based rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const { success } = await shareLimiter.check(ip);
  if (!success) {
    return apiError('Too many requests. Please try again later.', 429);
  }

  if (!token) return apiError('Token required', 400);

  const [link] = await db.select({
    title: sharedLinks.title,
    type: sharedLinks.type,
    data: sharedLinks.data,
    createdAt: sharedLinks.createdAt,
    expiresAt: sharedLinks.expiresAt,
    revokedAt: sharedLinks.revokedAt,
    viewCount: sharedLinks.viewCount,
  })
    .from(sharedLinks)
    .where(eq(sharedLinks.token, token))
    .limit(1);

  if (!link) return apiError('Link not found', 404);
  if (new Date(link.expiresAt) < new Date()) return apiError('This link has expired', 410);
  if (link.revokedAt) {
    return apiError('This share link has been revoked', 410)
  }

  // Increment view count (fire-and-forget, but actually execute the query)
  db.update(sharedLinks)
    .set({ viewCount: sql`${sharedLinks.viewCount} + 1` })
    .where(eq(sharedLinks.token, token))
    .execute()
    .catch(() => {});

  return apiSuccess({
    title: link.title,
    type: link.type,
    data: link.data,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
  });
}

// Suppress unused import warning
export const dynamic = 'force-dynamic';
