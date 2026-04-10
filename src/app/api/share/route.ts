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
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    await logAudit({
      user_id: user.id,
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

    // Store the share link
    const { error } = await supabase.from('shared_links').insert({
      user_id: user.id,
      token: shareToken,
      type,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      // If the shared_links table doesn't exist yet, return a helpful message
      if (error.code === '42P01') {
        return apiError(
          'Share feature not yet configured. Run the SQL migration to create the shared_links table.',
          500
        );
      }
      return apiError(error.message, 500);
    }

    const shareUrl = `https://carecompanionai.org/shared/${shareToken}`;

    return apiSuccess({ url: shareUrl, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error('[share] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
