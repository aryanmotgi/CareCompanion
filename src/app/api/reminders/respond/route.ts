import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const RespondSchema = z.object({
  log_id: z.string().min(1, 'log_id is required'),
  status: z.union([z.literal('taken'), z.literal('snoozed'), z.literal('missed')], {
    message: 'Status must be taken, snoozed, or missed',
  }),
});

// POST — mark a medication reminder as taken, snoozed, or missed
export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await req.json();
    const { data: validated, error: valError } = validateBody(RespondSchema, body);
    if (valError) return valError;

    const { log_id, status } = validated;
    const admin = createAdminClient();

    if (status === 'snoozed') {
      // Snooze: reset to pending and create a new notification in 15 minutes
      const { data: log } = await admin.from('reminder_logs')
        .select('*')
        .eq('id', log_id)
        .eq('user_id', user.id)
        .single();

      if (!log) return apiError('Reminder not found', 404);

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

      return apiSuccess({ success: true, message: `Snoozed for 15 minutes.` });
    }

    // Mark as taken or missed
    const { error } = await admin.from('reminder_logs')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', log_id)
      .eq('user_id', user.id);

    if (error) return apiError(error.message, 500);

    return apiSuccess({ success: true, message: status === 'taken' ? 'Marked as taken!' : 'Marked as missed.' });
  } catch (err) {
    console.error('[reminders/respond] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
