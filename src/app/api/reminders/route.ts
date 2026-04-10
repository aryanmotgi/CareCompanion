import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const PostSchema = z.object({
  medication_id: z.string().min(1, 'medication_id is required'),
  medication_name: z.string().min(1, 'medication_name is required'),
  dose: z.string().optional(),
  reminder_times: z.array(z.string()).min(1, 'At least one reminder time is required'),
  days_of_week: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
});

const DeleteSchema = z.object({
  reminder_id: z.string().min(1, 'reminder_id is required'),
});

// GET — list all medication reminders for the user
export async function GET() {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const [
      { data: reminders },
      { data: todayLogs },
    ] = await Promise.all([
      supabase.from('medication_reminders').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('reminder_logs').select('*').eq('user_id', user.id)
        .gte('scheduled_time', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order('scheduled_time'),
    ]);

    return apiSuccess({ reminders: reminders || [], todayLogs: todayLogs || [] });
  } catch (err) {
    console.error('[reminders] GET error:', err);
    return apiError('Internal server error', 500);
  }
}

// POST — create or update a medication reminder
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(PostSchema, body);
    if (valError) return valError;

    const { medication_id, medication_name, dose, reminder_times, days_of_week } = validated;
    const admin = createAdminClient();

    const { error } = await admin.from('medication_reminders').upsert({
      user_id: user.id,
      medication_id,
      medication_name,
      dose: dose || null,
      reminder_times,
      days_of_week: days_of_week || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      is_active: true,
    }, { onConflict: 'user_id,medication_id' });

    if (error) return apiError(error.message, 500);
    return apiSuccess({ success: true, message: `Reminder set for ${medication_name}.` });
  } catch (err) {
    console.error('[reminders] POST error:', err);
    return apiError('Internal server error', 500);
  }
}

// DELETE — remove a medication reminder
export async function DELETE(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success: rlSuccess } = limiter.check(ip);
  if (!rlSuccess) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(DeleteSchema, body);
    if (valError) return valError;

    await supabase.from('medication_reminders').delete().eq('id', validated.reminder_id).eq('user_id', user.id);
    return apiSuccess({ success: true });
  } catch (err) {
    console.error('[reminders] DELETE error:', err);
    return apiError('Internal server error', 500);
  }
}
