import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET — list all medication reminders for the user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const [
    { data: reminders },
    { data: todayLogs },
  ] = await Promise.all([
    supabase.from('medication_reminders').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('reminder_logs').select('*').eq('user_id', user.id)
      .gte('scheduled_time', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .order('scheduled_time'),
  ]);

  return Response.json({ reminders: reminders || [], todayLogs: todayLogs || [] });
}

// POST — create or update a medication reminder
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { medication_id, medication_name, dose, reminder_times, days_of_week } = await req.json();

  if (!medication_id || !medication_name || !reminder_times?.length) {
    return Response.json({ error: 'medication_id, medication_name, and reminder_times are required' }, { status: 400 });
  }

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

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true, message: `Reminder set for ${medication_name}.` });
}

// DELETE — remove a medication reminder
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { reminder_id } = await req.json();
  if (!reminder_id) return Response.json({ error: 'reminder_id required' }, { status: 400 });

  await supabase.from('medication_reminders').delete().eq('id', reminder_id).eq('user_id', user.id);
  return Response.json({ success: true });
}
