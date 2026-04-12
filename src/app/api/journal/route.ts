import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess, ApiErrors } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const PostSchema = z.object({
  mood: z.number().min(1).max(10).optional(),
  energy: z.number().min(1).max(10).optional(),
  pain: z.number().min(0).max(10).optional(),
  sleep_hours: z.number().min(0).max(24).optional(),
  symptoms: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
}).passthrough();

const DeleteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
});

// POST — save or update today's symptom entry
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) return ApiErrors.rateLimited();

  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(PostSchema, body);
    if (valError) return valError;

    const today = new Date().toISOString().split('T')[0];

    const { data: profile } = await supabase
      .from('care_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const { data: entry, error } = await supabase
      .from('symptom_entries')
      .upsert({
        user_id: user.id,
        care_profile_id: profile?.id || null,
        date: today,
        ...validated,
      }, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (error) {
      console.error('[journal] POST db error:', error.message);
      return apiError('Failed to save journal entry', 500);
    }
    return apiSuccess({ success: true, entry });
  } catch (err) {
    console.error('[journal] POST error:', err);
    return apiError('Internal server error', 500);
  }
}

// GET — fetch symptom entries
export async function GET(req: Request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '14');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data } = await supabase
      .from('symptom_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', since)
      .order('date', { ascending: false });

    return apiSuccess({ entries: data || [] });
  } catch (err) {
    console.error('[journal] GET error:', err);
    return apiError('Internal server error', 500);
  }
}

// DELETE — remove a symptom entry by date
export async function DELETE(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success: rlSuccess } = limiter.check(ip);
  if (!rlSuccess) return ApiErrors.rateLimited();

  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('Invalid or missing request body', 400);
    }

    const { data: validated, error: valError } = validateBody(DeleteSchema, body);
    if (valError) return valError;

    const { error } = await supabase
      .from('symptom_entries')
      .delete()
      .eq('user_id', user.id)
      .eq('date', validated.date);

    if (error) {
      console.error('[journal] DELETE db error:', error.message);
      return apiError('Failed to delete journal entry', 500);
    }
    return apiSuccess({ success: true });
  } catch (err) {
    console.error('[journal] DELETE error:', err);
    return apiError('Internal server error', 500);
  }
}
