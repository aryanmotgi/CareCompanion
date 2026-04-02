import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST — mark a medication reminder as taken, snoozed, or missed
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { log_id, status } = await req.json();

  if (!log_id || !['taken', 'snoozed', 'missed'].includes(status)) {
    return Response.json({ error: 'log_id and valid status (taken/snoozed/missed) required' }, { status: 400 });
  }

  const admin = createAdminClient();

  if (status === 'snoozed') {
    // Snooze: reset to pending and create a new notification in 15 minutes
    const { data: log } = await admin.from('reminder_logs')
      .select('*')
      .eq('id', log_id)
      .eq('user_id', user.id)
      .single();

    if (!log) return Response.json({ error: 'Reminder not found' }, { status: 404 });

    // Update the scheduled time to 15 mins from now
    const snoozedTime = new Date(Date.now() + 15 * 60 * 1000);
    await admin.from('reminder_logs')
      .update({ scheduled_time: snoozedTime.toISOString(), status: 'pending' })
      .eq('id', log_id);

    // Create a new notification for the snoozed time
    await admin.from('notifications').insert({
      user_id: user.id,
      type: 'medication_reminder',
      title: `Reminder: take ${log.medication_name}`,
      message: `Snoozed reminder — time to take your medication now.`,
    });

    return Response.json({ success: true, message: `Snoozed for 15 minutes.` });
  }

  // Mark as taken or missed
  const { error } = await admin.from('reminder_logs')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', log_id)
    .eq('user_id', user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true, message: status === 'taken' ? 'Marked as taken!' : 'Marked as missed.' });
}
