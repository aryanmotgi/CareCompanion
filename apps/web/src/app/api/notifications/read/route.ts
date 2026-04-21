import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess, ApiErrors } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const ReadSchema = z.object({
  id: z.string().uuid().optional(),
  all: z.boolean().optional(),
}).refine(data => data.id || data.all, {
  message: 'Either id or all must be provided',
});

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) {
    return ApiErrors.rateLimited();
  }

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(ReadSchema, body);
    if (valError) return valError;

    if (validated.all) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, user!.id), eq(notifications.isRead, false)));
    } else if (validated.id) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, validated.id), eq(notifications.userId, user!.id)));
    }

    return apiSuccess({ success: true });
  } catch (err) {
    console.error('[notifications/read] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
