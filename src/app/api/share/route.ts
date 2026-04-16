import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { validateCsrf } from '@/lib/csrf';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const ShareSchema = z.object({
  type: z.enum(['health_summary', 'medications', 'lab_results', 'care_plan']).default('health_summary'),
});

// Generate a shareable link for a health summary
export async function POST(request: Request) {
  const { valid, error: csrfError } = await validateCsrf(request);
  if (!valid) return csrfError!;

  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) {
    return apiError('Too many requests', 429);
  }

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    await logAudit({
      user_id: user!.id,
      action: 'share_data',
      ip_address: request.headers.get('x-forwarded-for') || undefined,
    });

    const body = await request.json();
    const { data: validated, error: valError } = validateBody(ShareSchema, body);
    if (valError) return valError;

    const { type } = validated;

    // Generate a unique share token
    const shareToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Note: shared_links table not yet in Drizzle schema — use raw response
    // TODO: migrate shared_links to Drizzle schema
    const shareUrl = `https://carecompanionai.org/shared/${shareToken}`;

    // Log that we attempted to share
    console.info('[share] Generated share token for type:', type, 'user:', user!.id);

    return apiSuccess({ url: shareUrl, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error('[share] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
