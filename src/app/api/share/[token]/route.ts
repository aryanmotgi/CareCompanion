import { db } from '@/lib/db';
import { sharedLinks } from '@/lib/db/schema';
import { eq, gt } from 'drizzle-orm';
import { apiError, apiSuccess } from '@/lib/api-response';

// Public — no auth required
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!token) return apiError('Token required', 400);

  const [link] = await db.select()
    .from(sharedLinks)
    .where(eq(sharedLinks.token, token))
    .limit(1);

  if (!link) return apiError('Link not found', 404);
  if (new Date(link.expiresAt) < new Date()) return apiError('This link has expired', 410);

  // Increment view count (fire-and-forget)
  db.update(sharedLinks)
    .set({ viewCount: (link.viewCount ?? 0) + 1 })
    .where(eq(sharedLinks.token, token))
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
