import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const ReadSchema = z.object({
  id: z.string().uuid().optional(),
  all: z.boolean().optional(),
}).refine(data => data.id || data.all, {
  message: 'Either id or all must be provided',
});

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(ReadSchema, body);
    if (valError) return valError;

    if (validated.all) {
      // Mark all as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    } else if (validated.id) {
      // Mark single notification as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', validated.id)
        .eq('user_id', user.id);
    }

    return apiSuccess({ success: true });
  } catch (err) {
    console.error('[notifications/read] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
